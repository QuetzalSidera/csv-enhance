const {
  createServices,
  fixturePath,
  path,
  projectPath,
  SheetDiagnosticError,
} = require("./helpers/csvx-test-kit.js");

describe("Parser and analyzer", () => {
  const { reader, analyzer, evaluator, computeExecutor, documentExecutor, plotCompiler } = createServices();
  const integrationPath = fixturePath("file-interface", "integration.csvx");

  test("parses one csvx fixture end to end", () => {
    const file = reader.readFromPath(integrationPath);

    expect(file.path).toBe(integrationPath);
    expect(file.document.blocks).toHaveLength(5);

    const [tableBlock, metaBlock, pluginBlock, computeBlock, plotBlock] = file.document.blocks;

    expect(tableBlock.kind).toBe("table");
    expect(tableBlock.name).toBe("sheet");
    expect(metaBlock.kind).toBe("meta");
    expect(metaBlock.entries).toEqual([
      { key: "title", value: "integration demo", source: { startLine: 9, endLine: 9 } },
      { key: "owner", value: "qa", source: { startLine: 10, endLine: 10 } },
    ]);

    expect(pluginBlock.kind).toBe("plugin");
    expect(pluginBlock.alias).toBe("finance");
    expect(pluginBlock.modulePath).toBe(
      path.resolve(path.dirname(integrationPath), "../../../examples/plugins/finance.ts"),
    );
    expect(pluginBlock.exportNames).toEqual(["tax"]);
    expect(pluginBlock.binding.exports).toHaveLength(1);
    expect(pluginBlock.binding.exports[0].name).toBe("tax");
    expect(pluginBlock.binding.exports[0].__sheetReturnType).toBe("number");

    expect(tableBlock.columns).toEqual([
      expect.objectContaining({ name: "region", declaredType: "string", columnType: "string", isTypeExplicit: true }),
      expect.objectContaining({ name: "price", declaredType: "number", columnType: "number", isTypeExplicit: true }),
      expect.objectContaining({ name: "active", declaredType: "boolean", columnType: "boolean", isTypeExplicit: true }),
      expect.objectContaining({ name: "note", declaredType: "null", columnType: "null", isTypeExplicit: true }),
      expect.objectContaining({ name: "count", declaredType: "dynamic", columnType: "number", isTypeExplicit: false }),
      expect.objectContaining({ name: "flag", declaredType: "dynamic", columnType: "boolean", isTypeExplicit: false }),
      expect.objectContaining({ name: "label", declaredType: "dynamic", columnType: "string", isTypeExplicit: false }),
      expect.objectContaining({ name: "mixed", declaredType: "dynamic", columnType: "dynamic", isTypeExplicit: false }),
      expect.objectContaining({ name: "amount", declaredType: "number", columnType: "number", isTypeExplicit: true }),
      expect.objectContaining({ name: "total", declaredType: "number", columnType: "number", isTypeExplicit: true }),
    ]);
    expect(tableBlock.rows).toEqual([
      [
        { type: "string", value: "North" },
        { type: "number", value: 3 },
        { type: "boolean", value: true },
        { type: "null", value: null },
        { type: "number", value: 1 },
        { type: "boolean", value: true },
        { type: "string", value: "alpha" },
        { type: "number", value: 1 },
        { type: "number", value: 10 },
        { type: "number", value: 20 },
      ],
      [
        { type: "string", value: "South" },
        { type: "number", value: 4 },
        { type: "boolean", value: false },
        { type: "null", value: null },
        { type: "number", value: 2 },
        { type: "boolean", value: false },
        { type: "string", value: "beta" },
        { type: "string", value: "hello" },
        { type: "number", value: 15 },
        { type: "number", value: 30 },
      ],
      [
        { type: "string", value: "East" },
        { type: "number", value: 5 },
        { type: "boolean", value: true },
        { type: "null", value: null },
        { type: "null", value: null },
        { type: "null", value: null },
        { type: "string", value: "gamma" },
        { type: "null", value: null },
        { type: "number", value: 18 },
        { type: "number", value: 36 },
      ],
    ]);

    expect(computeBlock.kind).toBe("compute");
    expect(computeBlock.tableName).toBe("sheet");
    expect(computeBlock.targets).toEqual({
      columns: [
        expect.objectContaining({ name: "double_total", declaredType: "dynamic", columnType: "dynamic", isTypeExplicit: false }),
        expect.objectContaining({ name: "taxed_total", declaredType: "dynamic", columnType: "dynamic", isTypeExplicit: false }),
      ],
      source: { startLine: 19, endLine: 19 },
    });
    expect(plotBlock.kind).toBe("plot");
    expect(plotBlock.dependencies).toEqual({
      names: ["amount", "total"],
      nameRanges: {
        amount: { startLine: 25, startColumn: 7, startOffset: 6, endLine: 25, endColumn: 12, endOffset: 11 },
        total: { startLine: 25, startColumn: 14, startOffset: 13, endLine: 25, endColumn: 18, endOffset: 17 },
      },
      source: { startLine: 25, endLine: 25 },
    });

    const analyzedDocument = analyzer.analyze(file.document);
    const analyzedComputeBlock = analyzedDocument.blocks.find((block) => block.kind === "compute");
    const analyzedPlotBlock = analyzedDocument.blocks.find((block) => block.kind === "plot");

    expect(analyzedDocument.warnings).toEqual([]);
    expect(analyzedComputeBlock.outputs).toEqual([
      expect.objectContaining({ columnName: "double_total" }),
      expect.objectContaining({ columnName: "taxed_total" }),
    ]);
    expect(analyzedComputeBlock.locals).toEqual([]);
    expect(analyzedComputeBlock.statements[1].expression.kind).toBe("plugin_call");
    expect(analyzedComputeBlock.statements[1].expression.pluginAlias).toBe("finance");
    expect(analyzedPlotBlock.resolvedDependencies).toEqual([
      tableBlock.columns[8],
      tableBlock.columns[9],
    ]);

    const runtimeRow = {
      total: { type: "number", value: 20 },
      price: { type: "number", value: 3 },
      count: { type: "number", value: 1 },
    };

    expect(
      evaluator.evaluate(analyzedComputeBlock.statements[0].expression, {
        row: runtimeRow,
        locals: {},
        aggregateRows: [runtimeRow],
      }),
    ).toEqual({ type: "number", value: 40 });

    expect(
      evaluator.evaluate(analyzedComputeBlock.statements[1].expression, {
        row: runtimeRow,
        locals: {},
        aggregateRows: [runtimeRow],
      }),
    ).toEqual({ type: "number", value: 3.24 });

    const evaluatedTable = computeExecutor.execute(tableBlock, analyzedComputeBlock);
    expect(evaluatedTable.rows[0].double_total).toEqual({ type: "number", value: 40 });
    expect(evaluatedTable.rows[0].taxed_total).toEqual({ type: "number", value: 3.24 });

    const evaluatedDocument = documentExecutor.execute(analyzedDocument);
    expect(Object.keys(evaluatedDocument.tables)).toEqual(["sheet"]);
    expect(plotCompiler.compileBarPlot(evaluatedDocument.plots[0])).toEqual({
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      mark: "bar",
      title: "amount vs total",
      data: { values: [{ amount: 10, total: 20 }, { amount: 15, total: 30 }, { amount: 18, total: 36 }] },
      encoding: {
        x: { field: "amount", type: "quantitative" },
        y: { field: "total", type: "quantitative" },
      },
    });
  });

  test("throws when a plot field is not declared in deps", () => {
    const file = reader.readFromString(
      `value[number]
1

@plot sheet
deps: value
x: other
y: value
`,
      fixturePath("file-interface", "conflict.csvx"),
    );

    try {
      analyzer.analyze(file.document);
      throw new Error("Expected structured diagnostic");
    } catch (error) {
      expect(error).toBeInstanceOf(SheetDiagnosticError);
      expect(error.code).toBe("ANALYSIS_PLOT_FIELD_NOT_IN_DEPS");
      expect(error.range).toEqual({
        startLine: 6,
        startColumn: 4,
        startOffset: 3,
        endLine: 6,
        endColumn: 8,
        endOffset: 7,
      });
    }
  });

  test("throws when @compute is missing target declaration", () => {
    expect(() =>
      reader.readFromString(
        `value[number]
1

@compute sheet
x = value
`,
        fixturePath("file-interface", "missing-target.csvx"),
      ),
    ).toThrow(/\[PARSER:PARSER_COMPUTE_TARGET_REQUIRED\]/);
  });

  test("throws when a plot dependency does not exist", () => {
    const file = reader.readFromString(
      `value[number]
1

@compute sheet
target: out
out = value

@plot sheet
deps: missing
x: value
y: value
`,
      fixturePath("file-interface", "unknown-plot-dependency.csvx"),
    );

    expect(() => analyzer.analyze(file.document)).toThrow(/Unknown plot dependency "missing"/);
  });

  test("reports precise parser ranges for invalid declarations and cell types", () => {
    const invalidColumn = () =>
      reader.readFromString(
        `bad-name[number],value[number]
1,2
`,
        fixturePath("file-interface", "invalid-column.csvx"),
      );

    const invalidFuncParam = () =>
      reader.readFromString(
        `@func broken(a-b[number]) => number
return a;
`,
        fixturePath("file-interface", "invalid-func-parameter.csvx"),
      );

    const invalidCell = () =>
      reader.readFromString(
        `@table 销售表
地区[string],商品[number],单价[number],数量[number],销售额[number]
华北,苹果,3,5,15
华东,香蕉,2,8,16
华南,橙子,4,6,24
`,
        fixturePath("file-interface", "declared-type-mismatch.csvx"),
      );

    expect(invalidColumn).toThrow(/PARSER_INVALID_COLUMN_DECLARATION/);
    expect(invalidFuncParam).toThrow(/PARSER_INVALID_FUNCTION_PARAMETER/);

    try {
      invalidCell();
      throw new Error("Expected declared type mismatch");
    } catch (error) {
      expect(error).toBeInstanceOf(SheetDiagnosticError);
      expect(error.code).toBe("PARSER_DECLARED_TYPE_MISMATCH");
      expect(error.range).toEqual({
        startLine: 3,
        startColumn: 4,
        startOffset: 3,
        endLine: 3,
        endColumn: 5,
        endOffset: 4,
      });
    }
  });

  test("analyzes local compute variables separately from outputs", () => {
    const file = reader.readFromString(
      `price[number],qty[number]
3,5

@compute sheet
target: total
subtotal = price * qty
total = subtotal
`,
      fixturePath("file-interface", "locals.csvx"),
    );

    const analyzedDocument = analyzer.analyze(file.document);
    const analyzedComputeBlock = analyzedDocument.blocks.find((block) => block.kind === "compute");
    const evaluatedTable = computeExecutor.execute(file.document.blocks[0], analyzedComputeBlock);

    expect(analyzedComputeBlock.outputs).toEqual([expect.objectContaining({ columnName: "total" })]);
    expect(analyzedComputeBlock.locals).toEqual(["subtotal"]);
    expect(evaluatedTable.rows[0].total).toEqual({ type: "number", value: 15 });
    expect(evaluatedTable.rows[0].subtotal).toBeUndefined();
  });

  test("resolves plot deps against compute outputs", () => {
    const file = reader.readFromString(
      `price[number],qty[number]
3,5

@compute sheet
target: total
total = price * qty

@plot sheet
deps: total
x: total
y: total
`,
      fixturePath("file-interface", "plot-output.csvx"),
    );

    const analyzedDocument = analyzer.analyze(file.document);
    const analyzedPlotBlock = analyzedDocument.blocks.find((block) => block.kind === "plot");

    expect(analyzedPlotBlock.resolvedDependencies).toEqual([
      expect.objectContaining({ name: "total", declaredType: "dynamic", columnType: "dynamic", isTypeExplicit: false }),
    ]);
  });

  test("parses typed compute targets and unicode identifiers", () => {
    const typedTargets = reader.readFromString(
      `name[string],price[number]
alpha,3

@compute sheet
target: total[number], label[string], passthrough
total = price
label = name
passthrough = price
`,
      fixturePath("file-interface", "typed-targets.csvx"),
    );

    const computeBlock = typedTargets.document.blocks.find((block) => block.kind === "compute");
    expect(computeBlock.targets).toEqual({
      columns: [
        expect.objectContaining({ name: "total", declaredType: "number", columnType: "number", isTypeExplicit: true }),
        expect.objectContaining({ name: "label", declaredType: "string", columnType: "string", isTypeExplicit: true }),
        expect.objectContaining({ name: "passthrough", declaredType: "dynamic", columnType: "dynamic", isTypeExplicit: false }),
      ],
      source: { startLine: 5, endLine: 5 },
    });

    const unicodeFile = reader.readFromString(
      `@table 销售表
地区[string],金额[number]
华北,10
华东,12

@compute 销售表
target: 合计[number]
合计 = 金额 * 2

@plot 销售表
deps: 金额,合计
x: 金额
y: 合计
title: 金额与合计
`,
      fixturePath("file-interface", "unicode.csvx"),
    );

    const analyzedDocument = analyzer.analyze(unicodeFile.document);
    const evaluatedDocument = documentExecutor.execute(analyzedDocument);

    expect(evaluatedDocument.tables["销售表"].rows).toEqual([
      { 地区: { type: "string", value: "华北" }, 金额: { type: "number", value: 10 }, 合计: { type: "number", value: 20 } },
      { 地区: { type: "string", value: "华东" }, 金额: { type: "number", value: 12 }, 合计: { type: "number", value: 24 } },
    ]);
  });

  test("reports precise analyzer ranges for unknown references and invalid builtin conditions", () => {
    const unknownCompute = reader.readFromString(
      `value[number]
1

@compute sheet
target: doubled[number]
doubled = valuee * 2
`,
      fixturePath("file-interface", "unknown-compute-reference.csvx"),
    );
    const unknownFuncParam = reader.readFromString(
      `@func 计算(value[number]) => number
return missing * 2;
`,
      fixturePath("file-interface", "unknown-func-parameter.csvx"),
    );
    const unknownFunction = reader.readFromString(
      `value[number]
1

@compute sheet
target: out[number]
out = missing(value)
`,
      fixturePath("file-interface", "unknown-function-call.csvx"),
    );
    const builtinIf = reader.readFromString(
      `@func test(s[number]) => number
return if(s * 0.9, s * 1.1, s);
`,
      fixturePath("file-interface", "func-if-type-range.csvx"),
    );

    expect(() => analyzer.analyze(unknownCompute.document)).toThrow(/ANALYSIS_UNKNOWN_REFERENCE/);
    expect(() => analyzer.analyze(unknownFuncParam.document)).toThrow(/ANALYSIS_UNKNOWN_FUNCTION_PARAMETER_REFERENCE/);
    expect(() => analyzer.analyze(unknownFunction.document)).toThrow(/ANALYSIS_UNKNOWN_FUNCTION/);

    try {
      analyzer.analyze(builtinIf.document);
      throw new Error("Expected builtin if diagnostic");
    } catch (error) {
      expect(error).toBeInstanceOf(SheetDiagnosticError);
      expect(error.code).toBe("ANALYSIS_BOOLEAN_COMPATIBLE_REQUIRED");
      expect(error.range).toEqual({
        startLine: 2,
        startColumn: 11,
        startOffset: 10,
        endLine: 2,
        endColumn: 17,
        endOffset: 16,
      });
    }
  });

  test("supports typed and inferred local variables in @compute", () => {
    const typedFile = reader.readFromString(
      `@table 销售表
销售额[number]
15

@compute 销售表
target: 含税销售额[number]
test[number] = 销售额
含税销售额 = test
`,
      fixturePath("file-interface", "typed-local.csvx"),
    );
    const inferredFile = reader.readFromString(
      `@table 销售表
销售额[number]
15

@compute 销售表
target: 含税销售额[number]
test = 销售额
含税销售额 = test
`,
      fixturePath("file-interface", "inferred-local.csvx"),
    );

    const typedComputeBlock = typedFile.document.blocks.find((block) => block.kind === "compute");
    expect(typedComputeBlock.statements[0].targetColumn).toEqual({
      name: "test",
      declaredType: "number",
      columnType: "number",
      isTypeExplicit: true,
    });
    expect(() => analyzer.analyze(inferredFile.document)).not.toThrow();
  });

  test("performs compile-time type checks and collects dynamic warnings", () => {
    const invalidCompute = reader.readFromString(
      `value[string]
abc

@compute sheet
target: doubled[number]
doubled = value * 2
`,
      fixturePath("file-interface", "invalid-compute-type.csvx"),
    );
    const dynamicWarning = reader.readFromString(
      `value
1
hello

@compute sheet
target: doubled[dynamic]
doubled = value * 2
`,
      fixturePath("file-interface", "dynamic-warning.csvx"),
    );

    expect(() => analyzer.analyze(invalidCompute.document)).toThrow(/must be number-compatible, received string/);

    const analyzedDocument = analyzer.analyze(dynamicWarning.document);
    expect(analyzedDocument.warnings).toEqual([
      expect.objectContaining({
        code: "ANALYSIS_NUMBER_COMPATIBLE_REQUIRED",
        range: {
          startLine: 7,
          startColumn: 11,
          startOffset: 10,
          endLine: 7,
          endColumn: 15,
          endOffset: 14,
        },
      }),
    ]);
  });
});
