const {
  childProcess,
  createServices,
  fixturePath,
  fs,
  path,
  projectPath,
  writeTempCsvx,
  XLSX,
} = require("./helpers/csvx-test-kit.js");

describe("Runtime, compiler, and CLI", () => {
  const { reader, analyzer, computeExecutor, documentExecutor, plotCompiler, sheetCompiler, linter, xlsxAdapter } = createServices();
  const integrationPath = fixturePath("file-interface", "integration.csvx");

  test("emits structured diagnostic errors", () => {
    expect(() =>
      reader.readFromString(
        `@plot missing
x: amount
y: total
`,
        fixturePath("file-interface", "structured-error.csvx"),
      ),
    ).toThrow(/\[PARSER:PARSER_UNKNOWN_PLOT_TABLE\]/);
  });

  test("returns parser diagnostics from the linter", () => {
    const result = linter.lintSource(
      `@plot missing
x: amount
y: total
`,
      fixturePath("file-interface", "lint-parser-error.csvx"),
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "PARSER_UNKNOWN_PLOT_TABLE",
        phase: "parser",
        severity: "error",
      }),
    ]);
  });

  test("collects analyzer warnings and lint rules together", () => {
    const result = linter.lintSource(
      `@func helper(value[number]) => number
return value * 2;

@table sheet
value
1
hello

@compute sheet
target: doubled[number]
temp = value * 2
doubled = value

@plot sheet
deps: doubled, value
x: doubled
y: doubled
`,
      fixturePath("file-interface", "lint-rules.csvx"),
    );

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "ANALYSIS_NUMBER_COMPATIBLE_REQUIRED", phase: "analysis", severity: "warning" }),
        expect.objectContaining({ code: "LINT_UNUSED_LOCAL", phase: "lint", severity: "warning" }),
        expect.objectContaining({ code: "LINT_UNUSED_FUNC", phase: "lint", severity: "warning" }),
        expect.objectContaining({ code: "LINT_REDUNDANT_PLOT_DEPENDENCY", phase: "lint", severity: "warning" }),
      ]),
    );
  });

  test("infers plugin return types from TypeScript signatures", () => {
    const file = reader.readFromString(
      `@plugin finance
path: ../../../examples/plugins/finance.ts
exports: tax, bucket

@table sheet
price[number],qty[number]
3,5

@compute sheet
target: taxed[number], bucketed[string]
taxed = finance.tax(price, qty)
bucketed = finance.bucket(qty)
`,
      fixturePath("file-interface", "plugin-return-types.csvx"),
    );

    const pluginBlock = file.document.blocks.find((block) => block.kind === "plugin");
    expect(pluginBlock.binding.exports[0].__sheetReturnType).toBe("number");
    expect(pluginBlock.binding.exports[1].__sheetReturnType).toBe("string");
    expect(analyzer.analyze(file.document).warnings).toEqual([]);
  });

  test("preserves typed compute output columns in runtime tables", () => {
    const file = reader.readFromString(
      `name[string],price[number]
alpha,3

@compute sheet
target: total[number], label[string], passthrough
total = price
label = name
passthrough = price
`,
      fixturePath("file-interface", "runtime-typed-targets.csvx"),
    );

    const analyzedDocument = analyzer.analyze(file.document);
    const tableBlock = file.document.blocks.find((block) => block.kind === "table");
    const computeBlock = analyzedDocument.blocks.find((block) => block.kind === "compute");
    const evaluatedTable = computeExecutor.execute(tableBlock, computeBlock);

    expect(evaluatedTable.columns).toEqual([
      ...tableBlock.columns,
      expect.objectContaining({ name: "total", declaredType: "number", columnType: "number", isTypeExplicit: true }),
      expect.objectContaining({ name: "label", declaredType: "string", columnType: "string", isTypeExplicit: true }),
      expect.objectContaining({ name: "passthrough", declaredType: "dynamic", columnType: "dynamic", isTypeExplicit: false }),
    ]);
  });

  test("executes compute blocks before plots and exposes computed dependencies", () => {
    const file = reader.readFromString(
      `value[number]
1
2

@compute sheet
target: doubled[number]
doubled = value * 2

@plot sheet
deps: doubled
x: doubled
y: doubled
`,
      fixturePath("file-interface", "document-executor.csvx"),
    );

    const evaluatedDocument = documentExecutor.execute(analyzer.analyze(file.document));
    expect(evaluatedDocument.tables.sheet.rows).toEqual([
      { value: { type: "number", value: 1 }, doubled: { type: "number", value: 2 } },
      { value: { type: "number", value: 2 }, doubled: { type: "number", value: 4 } },
    ]);
    expect(evaluatedDocument.plots[0].rows).toEqual([{ doubled: { type: "number", value: 2 } }, { doubled: { type: "number", value: 4 } }]);
  });

  test("compiles evaluated plots, full sheets, and xlsx workbooks", () => {
    const compiled = sheetCompiler.compilePath(integrationPath);
    const workbook = xlsxAdapter.buildWorkbook(compiled);

    expect(plotCompiler.compileBarPlot(compiled.evaluatedDocument.plots[0])).toEqual(compiled.plotSpecs[0]);
    expect(compiled.file.path).toBe(integrationPath);
    expect(compiled.evaluatedDocument.tables.sheet.rows[0]).toEqual({
      region: { type: "string", value: "North" },
      price: { type: "number", value: 3 },
      active: { type: "boolean", value: true },
      note: { type: "null", value: null },
      count: { type: "number", value: 1 },
      flag: { type: "boolean", value: true },
      label: { type: "string", value: "alpha" },
      mixed: { type: "number", value: 1 },
      amount: { type: "number", value: 10 },
      total: { type: "number", value: 20 },
      double_total: { type: "number", value: 40 },
      taxed_total: { type: "number", value: 3.24 },
    });

    expect(workbook.SheetNames).toEqual(["sheet", "_plots"]);
    const tableRows = XLSX.utils.sheet_to_json(workbook.Sheets.sheet, { header: 1, defval: null });
    expect(tableRows[1]).toEqual(["North", 3, true, null, 1, true, "alpha", 1, 10, 20, 40, 3.24]);
  });

  test("writes compiled workbook to disk", () => {
    const compiled = sheetCompiler.compilePath(integrationPath);
    const { directory } = writeTempCsvx("csvx-xlsx-write-", "placeholder.csvx", "@table sheet\nvalue[number]\n1\n");
    const outputPath = path.join(directory, "integration.xlsx");

    xlsxAdapter.writeCompiledResult(compiled, outputPath);

    expect(fs.existsSync(outputPath)).toBe(true);
    const workbook = XLSX.readFile(outputPath);
    expect(workbook.SheetNames).toEqual(["sheet", "_plots"]);
  });

  test("throws when plot execution happens before its computed dependency is materialized", () => {
    const file = reader.readFromString(
      `value[number]
1

@plot sheet
deps: doubled
x: doubled
y: doubled

@compute sheet
target: doubled[number]
doubled = value * 2
`,
      fixturePath("file-interface", "document-order.csvx"),
    );

    expect(() => documentExecutor.execute(analyzer.analyze(file.document))).toThrow(/not materialized yet: doubled/);
  });

  test("throws when compute executor receives the wrong table", () => {
    const file = reader.readFromString(
      `value[number]
1

@table sales
value[number]
2

@compute sales
target: total[number]
total = value
`,
      fixturePath("file-interface", "executor-mismatch.csvx"),
    );

    const analyzedDocument = analyzer.analyze(file.document);
    const wrongTable = file.document.blocks.find((block) => block.kind === "table" && block.name === "sheet");
    const computeBlock = analyzedDocument.blocks.find((block) => block.kind === "compute");

    expect(() => computeExecutor.execute(wrongTable, computeBlock)).toThrow(/executor received "sheet"/);
  });

  test("runs lint, compile, and xlsx through the main csvx CLI", () => {
    const cliPath = projectPath("dist/cli/csvx.js");

    const lintFixture = writeTempCsvx(
      "csvx-cli-warning-",
      "warning.csvx",
      `@func helper(value[number]) => number
return value * 2;

@table sheet
value[number]
1

@compute sheet
target: doubled[number]
doubled = value * 2
`,
    );
    const lintOutput = childProcess.execFileSync("node", [cliPath, "lint", lintFixture.filePath], {
      cwd: projectPath(),
      encoding: "utf8",
    });
    expect(lintOutput).toContain("warning LINT_UNUSED_FUNC");

    const compileFixture = writeTempCsvx(
      "csvx-cli-compile-",
      "compile.csvx",
      `@table 销售表
销售额[number]
15

@compute 销售表
target: 含税销售额[number]
含税销售额 = 销售额

@plot 销售表
deps: 销售额,含税销售额
x: 销售额
y: 含税销售额
`,
    );
    const compileOutput = childProcess.execFileSync("node", [cliPath, "compile", compileFixture.filePath], {
      cwd: projectPath(),
      encoding: "utf8",
    });
    expect(compileOutput).toContain("compiled");
    expect(compileOutput).toContain("table 销售表 rows=1 columns=2");

    const xlsxFixture = writeTempCsvx("csvx-cli-xlsx-", "export.csvx", `@table sheet\nvalue[number]\n1\n`);
    const outputPath = path.join(xlsxFixture.directory, "export.xlsx");
    const xlsxOutput = childProcess.execFileSync("node", [cliPath, "xlsx", xlsxFixture.filePath, "-o", outputPath], {
      cwd: projectPath(),
      encoding: "utf8",
    });
    expect(xlsxOutput).toContain(`wrote ${outputPath}`);
    expect(fs.existsSync(outputPath)).toBe(true);
  });

  test("keeps the sheet CLI alias working for lint failures", () => {
    const cliPath = projectPath("dist/cli/sheet.js");
    const errorFixture = writeTempCsvx(
      "sheet-cli-error-",
      "error.csvx",
      `@plot missing
x: amount
y: total
`,
    );

    try {
      childProcess.execFileSync("node", [cliPath, "lint", errorFixture.filePath], {
        cwd: projectPath(),
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      throw new Error("Expected CLI failure");
    } catch (error) {
      expect(error.status).toBe(1);
      expect(String(error.stdout)).toContain("error PARSER_UNKNOWN_PLOT_TABLE");
    }
  });
});
