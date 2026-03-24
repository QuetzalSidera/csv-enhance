const path = require("path");
const fs = require("fs");
const os = require("os");
const childProcess = require("child_process");
const {
  ComputeExecutor,
  DefaultSheetFileReader,
  DocumentExecutor,
  ExpressionEvaluator,
  PlotCompiler,
  SheetDiagnosticError,
  SheetCompiler,
  SheetLinter,
  SheetSemanticAnalyzer,
  XlsxAdapter,
} = require("../../dist/index.js");
const XLSX = require("xlsx");

describe("DefaultSheetFileReader integration", () => {
  const reader = new DefaultSheetFileReader();
  const analyzer = new SheetSemanticAnalyzer();
  const evaluator = new ExpressionEvaluator();
  const computeExecutor = new ComputeExecutor(evaluator);
  const documentExecutor = new DocumentExecutor(computeExecutor);
  const plotCompiler = new PlotCompiler();
  const sheetCompiler = new SheetCompiler(reader, analyzer, documentExecutor, plotCompiler);
  const linter = new SheetLinter(reader, analyzer);
  const xlsxAdapter = new XlsxAdapter();
  const fixturePath = path.resolve(__dirname, "../fixtures/file-interface/integration.sheet");

  test("parses one sheet fixture end to end", () => {
    const file = reader.readFromPath(fixturePath);

    expect(file.path).toBe(fixturePath);
    expect(file.document.blocks).toHaveLength(5);

    const [tableBlock, metaBlock, pluginBlock, computeBlock, plotBlock] = file.document.blocks;

    expect(tableBlock.kind).toBe("table");
    expect(tableBlock.name).toBe("sheet");

    expect(metaBlock.kind).toBe("meta");
    expect(metaBlock.entries).toEqual([
      {
        key: "title",
        value: "integration demo",
        source: { startLine: 9, endLine: 9 },
      },
      {
        key: "owner",
        value: "qa",
        source: { startLine: 10, endLine: 10 },
      },
    ]);

    expect(pluginBlock.kind).toBe("plugin");
    expect(pluginBlock.alias).toBe("finance");
    expect(pluginBlock.modulePath).toBe(
      path.resolve(path.dirname(fixturePath), "../../../examples/plugins/finance.ts"),
    );
    expect(pluginBlock.exportNames).toEqual(["tax"]);
    expect(pluginBlock.binding.exports).toHaveLength(1);
    expect(pluginBlock.binding.exports[0].name).toBe("tax");
    expect(pluginBlock.binding.exports[0].__sheetReturnType).toBe("number");

    expect(tableBlock.columns).toEqual([
      { name: "region", declaredType: "string", columnType: "string", isTypeExplicit: true },
      { name: "price", declaredType: "number", columnType: "number", isTypeExplicit: true },
      { name: "active", declaredType: "boolean", columnType: "boolean", isTypeExplicit: true },
      { name: "note", declaredType: "null", columnType: "null", isTypeExplicit: true },
      { name: "count", declaredType: "dynamic", columnType: "number", isTypeExplicit: false },
      { name: "flag", declaredType: "dynamic", columnType: "boolean", isTypeExplicit: false },
      { name: "label", declaredType: "dynamic", columnType: "string", isTypeExplicit: false },
      { name: "mixed", declaredType: "dynamic", columnType: "dynamic", isTypeExplicit: false },
      { name: "amount", declaredType: "number", columnType: "number", isTypeExplicit: true },
      { name: "total", declaredType: "number", columnType: "number", isTypeExplicit: true },
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
        { name: "double_total", declaredType: "dynamic", columnType: "dynamic", isTypeExplicit: false },
        { name: "taxed_total", declaredType: "dynamic", columnType: "dynamic", isTypeExplicit: false },
      ],
      source: { startLine: 19, endLine: 19 },
    });
    expect(computeBlock.statements).toEqual([
      {
        target: "double_total",
        targetRange: {
          startLine: 20,
          startColumn: 1,
          startOffset: 0,
          endLine: 20,
          endColumn: 12,
          endOffset: 11,
        },
        expression: "total * 2",
        expressionRange: {
          startLine: 20,
          startColumn: 16,
          startOffset: 15,
          endLine: 20,
          endColumn: 24,
          endOffset: 23,
        },
        source: { startLine: 20, endLine: 20 },
      },
      {
        target: "taxed_total",
        targetRange: {
          startLine: 21,
          startColumn: 1,
          startOffset: 0,
          endLine: 21,
          endColumn: 11,
          endOffset: 10,
        },
        expression: "finance.tax(price, count)",
        expressionRange: {
          startLine: 21,
          startColumn: 15,
          startOffset: 14,
          endLine: 21,
          endColumn: 39,
          endOffset: 38,
        },
        source: { startLine: 21, endLine: 21 },
      },
    ]);

    expect(plotBlock.kind).toBe("plot");
    expect(plotBlock.tableName).toBe("sheet");
    expect(plotBlock.dependencies).toEqual({
      names: ["amount", "total"],
      nameRanges: {
        amount: {
          startLine: 25,
          startColumn: 7,
          startOffset: 6,
          endLine: 25,
          endColumn: 12,
          endOffset: 11,
        },
        total: {
          startLine: 25,
          startColumn: 14,
          startOffset: 13,
          endLine: 25,
          endColumn: 18,
          endOffset: 17,
        },
      },
      source: { startLine: 25, endLine: 25 },
    });
    expect(plotBlock.fields).toEqual({
      x: "amount",
      y: "total",
      title: "amount vs total",
    });
    expect(plotBlock.fieldRanges).toEqual({
      x: {
        startLine: 26,
        startColumn: 4,
        startOffset: 3,
        endLine: 26,
        endColumn: 9,
        endOffset: 8,
      },
      y: {
        startLine: 27,
        startColumn: 4,
        startOffset: 3,
        endLine: 27,
        endColumn: 8,
        endOffset: 7,
      },
      title: {
        startLine: 28,
        startColumn: 8,
        startOffset: 7,
        endLine: 28,
        endColumn: 22,
        endOffset: 21,
      },
    });

    const analyzedDocument = analyzer.analyze(file.document);
    expect(analyzedDocument.warnings).toEqual([]);
    const analyzedComputeBlock = analyzedDocument.blocks.find((block) => block.kind === "compute");

    expect(analyzedComputeBlock).toBeDefined();
    expect(analyzedComputeBlock.tableName).toBe("sheet");
    expect(analyzedComputeBlock.outputs).toEqual([
      { columnName: "double_total" },
      { columnName: "taxed_total" },
    ]);
    expect(analyzedComputeBlock.outputColumns).toEqual([
      { name: "double_total", declaredType: "dynamic", columnType: "dynamic", isTypeExplicit: false },
      { name: "taxed_total", declaredType: "dynamic", columnType: "dynamic", isTypeExplicit: false },
    ]);
    expect(analyzedComputeBlock.locals).toEqual([]);
    expect(analyzedComputeBlock.statements).toHaveLength(2);
    expect(analyzedComputeBlock.statements[0]).toEqual({
      target: { columnName: "double_total" },
      expression: expect.objectContaining({
        kind: "binary_expression",
        operator: "*",
        left: expect.objectContaining({
          kind: "column_reference",
          column: tableBlock.columns[9],
        }),
        right: expect.objectContaining({
          kind: "number_literal",
          value: 2,
        }),
      }),
      source: { startLine: 20, endLine: 20 },
      isOutput: true,
    });
    expect(analyzedComputeBlock.statements[1].target).toEqual({ columnName: "taxed_total" });
    expect(analyzedComputeBlock.statements[1].expression.kind).toBe("plugin_call");
    expect(analyzedComputeBlock.statements[1].expression.pluginAlias).toBe("finance");
    expect(analyzedComputeBlock.statements[1].expression.exportName).toBe("tax");
    expect(analyzedComputeBlock.statements[1].expression.fn).toBe(pluginBlock.binding.exports[0]);
    expect(analyzedComputeBlock.statements[1].expression.args).toEqual([
      expect.objectContaining({
        kind: "column_reference",
        column: tableBlock.columns[1],
      }),
      expect.objectContaining({
        kind: "column_reference",
        column: tableBlock.columns[4],
      }),
    ]);

    const analyzedPlotBlock = analyzedDocument.blocks.find((block) => block.kind === "plot");
    expect(analyzedPlotBlock).toBeDefined();
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
    expect(evaluatedTable.columns).toEqual([
      ...tableBlock.columns,
      { name: "double_total", declaredType: "dynamic", columnType: "dynamic", isTypeExplicit: false },
      { name: "taxed_total", declaredType: "dynamic", columnType: "dynamic", isTypeExplicit: false },
    ]);
    expect(evaluatedTable.rows[0].double_total).toEqual({ type: "number", value: 40 });
    expect(evaluatedTable.rows[0].taxed_total).toEqual({ type: "number", value: 3.24 });

    const evaluatedDocument = documentExecutor.execute(analyzedDocument);
    expect(Object.keys(evaluatedDocument.tables)).toEqual(["sheet"]);
    expect(evaluatedDocument.tables.sheet.columns).toEqual(evaluatedTable.columns);
    expect(evaluatedDocument.tables.sheet.rows).toEqual(evaluatedTable.rows);
    expect(evaluatedDocument.plots).toEqual([
      {
        kind: "plot",
        tableName: "sheet",
        fields: {
          x: "amount",
          y: "total",
          title: "amount vs total",
        },
        resolvedDependencies: [
          tableBlock.columns[8],
          tableBlock.columns[9],
        ],
        rows: [
          {
            amount: { type: "number", value: 10 },
            total: { type: "number", value: 20 },
          },
          {
            amount: { type: "number", value: 15 },
            total: { type: "number", value: 30 },
          },
          {
            amount: { type: "number", value: 18 },
            total: { type: "number", value: 36 },
          },
        ],
        source: { startLine: 24, endLine: 28 },
      },
    ]);
  });

  test("throws when a plot field is not declared in deps", () => {
    const conflictFile = reader.readFromString(
      `value[number]
1

@plot sheet
deps: value
x: other
y: value
`,
      path.resolve(__dirname, "../fixtures/file-interface/conflict.sheet"),
    );

    try {
      analyzer.analyze(conflictFile.document);
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
      expect(error.message).toMatch(/must be declared in deps/);
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
        path.resolve(__dirname, "../fixtures/file-interface/missing-target.sheet"),
      ),
    ).toThrow(/\[PARSER:PARSER_COMPUTE_TARGET_REQUIRED\] line 4, column 1, offset 0: @compute sheet must declare target:/);
  });

  test("throws when a plot dependency does not exist", () => {
    const conflictFile = reader.readFromString(
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
      path.resolve(__dirname, "../fixtures/file-interface/conflict.sheet"),
    );

    try {
      analyzer.analyze(conflictFile.document);
      throw new Error("Expected structured diagnostic");
    } catch (error) {
      expect(error).toBeInstanceOf(SheetDiagnosticError);
      expect(error.code).toBe("ANALYSIS_UNKNOWN_PLOT_DEPENDENCY");
      expect(error.range).toEqual({
        startLine: 9,
        startColumn: 7,
        startOffset: 6,
        endLine: 9,
        endColumn: 13,
        endOffset: 12,
      });
      expect(error.message).toMatch(/Unknown plot dependency "missing"/);
    }
  });

  test("reports precise range for invalid column declarations", () => {
    try {
      reader.readFromString(
        `bad-name[number],value[number]
1,2
`,
        path.resolve(__dirname, "../fixtures/file-interface/invalid-column.sheet"),
      );
      throw new Error("Expected structured diagnostic");
    } catch (error) {
      expect(error).toBeInstanceOf(SheetDiagnosticError);
      expect(error.code).toBe("PARSER_INVALID_COLUMN_DECLARATION");
      expect(error.range).toEqual({
        startLine: 1,
        startColumn: 1,
        startOffset: 0,
        endLine: 1,
        endColumn: 16,
        endOffset: 15,
      });
    }
  });

  test("reports precise range for invalid @func parameters", () => {
    try {
      reader.readFromString(
        `@func broken(a-b[number]) -> number
a
`,
        path.resolve(__dirname, "../fixtures/file-interface/invalid-func-parameter.sheet"),
      );
      throw new Error("Expected structured diagnostic");
    } catch (error) {
      expect(error).toBeInstanceOf(SheetDiagnosticError);
      expect(error.code).toBe("PARSER_INVALID_FUNCTION_PARAMETER");
      expect(error.range).toEqual({
        startLine: 1,
        startColumn: 14,
        startOffset: 13,
        endLine: 1,
        endColumn: 24,
        endOffset: 23,
      });
    }
  });

  test("reports precise range for declared table cell type mismatches", () => {
    try {
      reader.readFromString(
        `@table 销售表
地区[string],商品[number],单价[number],数量[number],销售额[number]
华北,苹果,3,5,15
华东,香蕉,2,8,16
华南,橙子,4,6,24
`,
        path.resolve(__dirname, "../fixtures/file-interface/declared-type-mismatch.sheet"),
      );
      throw new Error("Expected structured diagnostic");
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
      path.resolve(__dirname, "../fixtures/file-interface/locals.sheet"),
    );

    const analyzedDocument = analyzer.analyze(file.document);
    const analyzedComputeBlock = analyzedDocument.blocks.find((block) => block.kind === "compute");

    expect(analyzedComputeBlock).toBeDefined();
    expect(analyzedComputeBlock.outputs).toEqual([{ columnName: "total" }]);
    expect(analyzedComputeBlock.outputColumns).toEqual([
      { name: "total", declaredType: "dynamic", columnType: "dynamic", isTypeExplicit: false },
    ]);
    expect(analyzedComputeBlock.locals).toEqual(["subtotal"]);
    expect(analyzedComputeBlock.statements).toEqual([
      {
        target: { columnName: "subtotal" },
        expression: expect.objectContaining({
          kind: "binary_expression",
          operator: "*",
          left: expect.objectContaining({
            kind: "column_reference",
            column: file.document.blocks[0].columns[0],
          }),
          right: expect.objectContaining({
            kind: "column_reference",
            column: file.document.blocks[0].columns[1],
          }),
        }),
        source: { startLine: 6, endLine: 6 },
        isOutput: false,
      },
      {
        target: { columnName: "total" },
        expression: expect.objectContaining({
          kind: "local_reference",
          name: "subtotal",
        }),
        source: { startLine: 7, endLine: 7 },
        isOutput: true,
      },
    ]);

    const evaluatedTable = computeExecutor.execute(file.document.blocks[0], analyzedComputeBlock);
    expect(evaluatedTable.columns).toEqual([
      ...file.document.blocks[0].columns,
      { name: "total", declaredType: "dynamic", columnType: "dynamic", isTypeExplicit: false },
    ]);
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
      path.resolve(__dirname, "../fixtures/file-interface/plot-output.sheet"),
    );

    const analyzedDocument = analyzer.analyze(file.document);
    const analyzedPlotBlock = analyzedDocument.blocks.find((block) => block.kind === "plot");

    expect(analyzedPlotBlock).toBeDefined();
    expect(analyzedPlotBlock.resolvedDependencies).toEqual([
      {
        name: "total",
        declaredType: "dynamic",
        columnType: "dynamic",
        isTypeExplicit: false,
      },
    ]);
  });

  test("parses typed compute targets without inference", () => {
    const file = reader.readFromString(
      `name[string],price[number]
alpha,3

@compute sheet
target: total[number], label[string], passthrough
total = price
label = name
passthrough = price
`,
      path.resolve(__dirname, "../fixtures/file-interface/typed-targets.sheet"),
    );

    const computeBlock = file.document.blocks.find((block) => block.kind === "compute");
    expect(computeBlock).toBeDefined();
    expect(computeBlock.targets).toEqual({
      columns: [
        { name: "total", declaredType: "number", columnType: "number", isTypeExplicit: true },
        { name: "label", declaredType: "string", columnType: "string", isTypeExplicit: true },
        { name: "passthrough", declaredType: "dynamic", columnType: "dynamic", isTypeExplicit: false },
      ],
      source: { startLine: 5, endLine: 5 },
    });

    const analyzedDocument = analyzer.analyze(file.document);
    const analyzedPlotSource = reader.readFromString(
      `price[number]
3

@compute sheet
target: total[number]
total = price

@plot sheet
deps: total
x: total
y: total
`,
      path.resolve(__dirname, "../fixtures/file-interface/typed-target-plot.sheet"),
    );
    const analyzedPlotDocument = analyzer.analyze(analyzedPlotSource.document);
    const analyzedPlotBlock = analyzedPlotDocument.blocks.find((block) => block.kind === "plot");

    expect(analyzedDocument.blocks.find((block) => block.kind === "compute").outputs).toEqual([
      { columnName: "total" },
      { columnName: "label" },
      { columnName: "passthrough" },
    ]);
    expect(analyzedPlotBlock.resolvedDependencies).toEqual([
      {
        name: "total",
        declaredType: "number",
        columnType: "number",
        isTypeExplicit: true,
      },
    ]);
  });

  test("supports unicode identifiers in table names, column names, compute targets, and plot deps", () => {
    const file = reader.readFromString(
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
      path.resolve(__dirname, "../fixtures/file-interface/unicode.sheet"),
    );

    const tableBlock = file.document.blocks.find((block) => block.kind === "table");
    expect(tableBlock.name).toBe("销售表");
    expect(tableBlock.columns).toEqual([
      { name: "地区", declaredType: "string", columnType: "string", isTypeExplicit: true },
      { name: "金额", declaredType: "number", columnType: "number", isTypeExplicit: true },
    ]);

    const analyzedDocument = analyzer.analyze(file.document);
    const evaluatedDocument = documentExecutor.execute(analyzedDocument);

    expect(evaluatedDocument.tables["销售表"].columns).toEqual([
      { name: "地区", declaredType: "string", columnType: "string", isTypeExplicit: true },
      { name: "金额", declaredType: "number", columnType: "number", isTypeExplicit: true },
      { name: "合计", declaredType: "number", columnType: "number", isTypeExplicit: true },
    ]);
    expect(evaluatedDocument.tables["销售表"].rows).toEqual([
      {
        地区: { type: "string", value: "华北" },
        金额: { type: "number", value: 10 },
        合计: { type: "number", value: 20 },
      },
      {
        地区: { type: "string", value: "华东" },
        金额: { type: "number", value: 12 },
        合计: { type: "number", value: 24 },
      },
    ]);
    expect(plotCompiler.compileBarPlot(evaluatedDocument.plots[0])).toEqual({
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      mark: "bar",
      title: "金额与合计",
      data: {
        values: [
          { 金额: 10, 合计: 20 },
          { 金额: 12, 合计: 24 },
        ],
      },
      encoding: {
        x: {
          field: "金额",
          type: "quantitative",
        },
        y: {
          field: "合计",
          type: "quantitative",
        },
      },
    });
  });

  test("@func defines a reusable pure expression for @compute", () => {
    const file = reader.readFromString(
      `@func 税额(单价[number], 数量[number]) -> number
单价 * 数量 * 1.08

@table 销售表
商品[string],单价[number],数量[number]
苹果,3,5

@compute 销售表
target: 含税金额[number]
含税金额 = 税额(单价, 数量)
`,
      path.resolve(__dirname, "../fixtures/file-interface/func.sheet"),
    );

    const funcBlock = file.document.blocks.find((block) => block.kind === "func");
    expect(funcBlock).toEqual({
      kind: "func",
      name: "税额",
      params: [
        { name: "单价", type: "number" },
        { name: "数量", type: "number" },
      ],
      returnType: "number",
      expression: "单价 * 数量 * 1.08",
      expressionRange: {
        startLine: 2,
        startColumn: 1,
        startOffset: 0,
        endLine: 2,
        endColumn: 14,
        endOffset: 13,
      },
      source: { startLine: 1, endLine: 3 },
    });

    const analyzedDocument = analyzer.analyze(file.document);
    const analyzedFuncBlock = analyzedDocument.blocks.find((block) => block.kind === "func");
    const analyzedComputeBlock = analyzedDocument.blocks.find((block) => block.kind === "compute");
    const tableBlock = file.document.blocks.find((block) => block.kind === "table");

    expect(analyzedFuncBlock.expression).toEqual(expect.objectContaining({
      kind: "binary_expression",
      operator: "*",
      left: expect.objectContaining({
        kind: "binary_expression",
        operator: "*",
        left: expect.objectContaining({
          kind: "local_reference",
          name: "单价",
        }),
        right: expect.objectContaining({
          kind: "local_reference",
          name: "数量",
        }),
      }),
      right: expect.objectContaining({
        kind: "number_literal",
        value: 1.08,
      }),
    }));
    expect(analyzedComputeBlock.statements[0].expression.kind).toBe("func_call");
    expect(analyzedComputeBlock.statements[0].expression.functionName).toBe("税额");
    expect(analyzedComputeBlock.statements[0].expression.func).toBe(analyzedFuncBlock);

    const evaluatedTable = computeExecutor.execute(tableBlock, analyzedComputeBlock);
    expect(evaluatedTable.rows[0]).toEqual({
      商品: { type: "string", value: "苹果" },
      单价: { type: "number", value: 3 },
      数量: { type: "number", value: 5 },
      含税金额: { type: "number", value: 16.200000000000003 },
    });
  });

  test("@func cannot reference table columns directly", () => {
    const file = reader.readFromString(
      `@func 非法函数() -> number
金额 * 2

@table 销售表
金额[number]
10
`,
      path.resolve(__dirname, "../fixtures/file-interface/invalid-func.sheet"),
    );

    expect(() => analyzer.analyze(file.document)).toThrow(/Unknown parameter reference "金额" in @func 非法函数/);
  });

  test("reports precise range for unknown @compute references", () => {
    const file = reader.readFromString(
      `value[number]
1

@compute sheet
target: doubled[number]
doubled = valuee * 2
`,
      path.resolve(__dirname, "../fixtures/file-interface/unknown-compute-reference.sheet"),
    );

    try {
      analyzer.analyze(file.document);
      throw new Error("Expected structured diagnostic");
    } catch (error) {
      expect(error).toBeInstanceOf(SheetDiagnosticError);
      expect(error.code).toBe("ANALYSIS_UNKNOWN_REFERENCE");
      expect(error.range).toEqual({
        startLine: 6,
        startColumn: 11,
        startOffset: 10,
        endLine: 6,
        endColumn: 16,
        endOffset: 15,
      });
    }
  });

  test("reports precise range for unknown @func parameter references", () => {
    const file = reader.readFromString(
      `@func 计算(value[number]) -> number
missing * 2
`,
      path.resolve(__dirname, "../fixtures/file-interface/unknown-func-parameter.sheet"),
    );

    try {
      analyzer.analyze(file.document);
      throw new Error("Expected structured diagnostic");
    } catch (error) {
      expect(error).toBeInstanceOf(SheetDiagnosticError);
      expect(error.code).toBe("ANALYSIS_UNKNOWN_FUNCTION_PARAMETER_REFERENCE");
      expect(error.range).toEqual({
        startLine: 2,
        startColumn: 1,
        startOffset: 0,
        endLine: 2,
        endColumn: 7,
        endOffset: 6,
      });
    }
  });

  test("reports precise range for unknown function calls in @compute", () => {
    const file = reader.readFromString(
      `value[number]
1

@compute sheet
target: out[number]
out = missing(value)
`,
      path.resolve(__dirname, "../fixtures/file-interface/unknown-function-call.sheet"),
    );

    try {
      analyzer.analyze(file.document);
      throw new Error("Expected structured diagnostic");
    } catch (error) {
      expect(error).toBeInstanceOf(SheetDiagnosticError);
      expect(error.code).toBe("ANALYSIS_UNKNOWN_FUNCTION");
      expect(error.range).toEqual({
        startLine: 6,
        startColumn: 7,
        startOffset: 6,
        endLine: 6,
        endColumn: 13,
        endOffset: 12,
      });
    }
  });

  test("reports precise range for builtin if argument type errors", () => {
    const file = reader.readFromString(
      `@func test(s[number]) -> number
if(s * 0.9, s * 1.1, s)
`,
      path.resolve(__dirname, "../fixtures/file-interface/func-if-type-range.sheet"),
    );

    try {
      analyzer.analyze(file.document);
      throw new Error("Expected builtin if type diagnostic");
    } catch (error) {
      expect(error).toBeInstanceOf(SheetDiagnosticError);
      expect(error.code).toBe("ANALYSIS_BOOLEAN_COMPATIBLE_REQUIRED");
      expect(error.range).toEqual({
        startLine: 2,
        startColumn: 4,
        startOffset: 3,
        endLine: 2,
        endColumn: 10,
        endOffset: 9,
      });
    }
  });

  test("throws a compile-time error for non-number arithmetic in @compute", () => {
    const file = reader.readFromString(
      `value[string]
abc

@compute sheet
target: doubled[number]
doubled = value * 2
`,
      path.resolve(__dirname, "../fixtures/file-interface/invalid-compute-type.sheet"),
    );

    expect(() => analyzer.analyze(file.document)).toThrow(/must be number-compatible, received string/);
  });

  test("collects warnings for dynamic arithmetic that may fail at runtime", () => {
    const file = reader.readFromString(
      `value
1
hello

@compute sheet
target: doubled[dynamic]
doubled = value * 2
`,
      path.resolve(__dirname, "../fixtures/file-interface/dynamic-warning.sheet"),
    );

    const analyzedDocument = analyzer.analyze(file.document);

    expect(analyzedDocument.warnings).toEqual([
      expect.objectContaining({
        phase: "analysis",
        severity: "warning",
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
    expect(analyzedDocument.warnings[0].message).toMatch(/number-compatible, received dynamic/);
  });

  test("emits structured diagnostic errors", () => {
    try {
      reader.readFromString(
        `@plot missing
x: amount
y: total
`,
        path.resolve(__dirname, "../fixtures/file-interface/structured-error.sheet"),
      );
      throw new Error("Expected structured diagnostic");
    } catch (error) {
      expect(error).toBeInstanceOf(SheetDiagnosticError);
      expect(error.code).toBe("PARSER_UNKNOWN_PLOT_TABLE");
      expect(error.phase).toBe("parser");
      expect(error.range).toEqual({
        startLine: 1,
        startColumn: 1,
        startOffset: 0,
        endLine: 1,
        endColumn: 1,
        endOffset: 0,
      });
      expect(error.message).toMatch(/\[PARSER:PARSER_UNKNOWN_PLOT_TABLE\]/);
    }
  });

  test("returns parser diagnostics from the linter", () => {
    const result = linter.lintSource(
      `@plot missing
x: amount
y: total
`,
      path.resolve(__dirname, "../fixtures/file-interface/lint-parser-error.sheet"),
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "PARSER_UNKNOWN_PLOT_TABLE",
        phase: "parser",
        severity: "error",
        range: {
          startLine: 1,
          startColumn: 1,
          startOffset: 0,
          endLine: 1,
          endColumn: 1,
          endOffset: 0,
        },
      }),
    ]);
  });

  test("collects analyzer warnings and lint rules together", () => {
    const result = linter.lintSource(
      `@func helper(value[number]) -> number
value * 2

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
      path.resolve(__dirname, "../fixtures/file-interface/lint-rules.sheet"),
    );

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "ANALYSIS_NUMBER_COMPATIBLE_REQUIRED",
          phase: "analysis",
          severity: "warning",
        }),
        expect.objectContaining({
          code: "LINT_UNUSED_LOCAL",
          phase: "lint",
          severity: "warning",
        }),
        expect.objectContaining({
          code: "LINT_UNUSED_FUNC",
          phase: "lint",
          severity: "warning",
        }),
        expect.objectContaining({
          code: "LINT_REDUNDANT_PLOT_DEPENDENCY",
          phase: "lint",
          severity: "warning",
        }),
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
      path.resolve(__dirname, "../fixtures/file-interface/plugin-return-types.sheet"),
    );

    const pluginBlock = file.document.blocks.find((block) => block.kind === "plugin");
    expect(pluginBlock.binding.exports[0].__sheetReturnType).toBe("number");
    expect(pluginBlock.binding.exports[1].__sheetReturnType).toBe("string");

    const analyzedDocument = analyzer.analyze(file.document);
    expect(analyzedDocument.warnings).toEqual([]);
  });

  test("runs the sheet lint CLI for warnings", () => {
    const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "sheet-cli-warning-"));
    const fixturePath = path.join(tempDirectory, "warning.sheet");
    const cliPath = path.resolve(__dirname, "../../dist/cli/sheet.js");
    fs.writeFileSync(
      fixturePath,
      `@func helper(value[number]) -> number
value * 2

@table sheet
value[number]
1

@compute sheet
target: doubled[number]
doubled = value * 2
`,
      "utf8",
    );

    const output = childProcess.execFileSync("node", [cliPath, "lint", fixturePath], {
      cwd: path.resolve(__dirname, "../.."),
      encoding: "utf8",
    });

    expect(output).toContain(fixturePath);
    expect(output).toContain("warning LINT_UNUSED_FUNC");
  });

  test("returns a non-zero exit code for sheet lint CLI errors", () => {
    const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "sheet-cli-error-"));
    const fixturePath = path.join(tempDirectory, "error.sheet");
    const cliPath = path.resolve(__dirname, "../../dist/cli/sheet.js");
    fs.writeFileSync(
      fixturePath,
      `@plot missing
x: amount
y: total
`,
      "utf8",
    );

    try {
      childProcess.execFileSync("node", [cliPath, "lint", fixturePath], {
        cwd: path.resolve(__dirname, "../.."),
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      throw new Error("Expected CLI failure");
    } catch (error) {
      expect(error.status).toBe(1);
      expect(String(error.stdout)).toContain("error PARSER_UNKNOWN_PLOT_TABLE");
    }
  });

  test("throws a compile-time error when @func return type does not match its expression", () => {
    const file = reader.readFromString(
      `@func 非法返回(value[string]) -> number
value
`,
      path.resolve(__dirname, "../fixtures/file-interface/invalid-func-return.sheet"),
    );

    expect(() => analyzer.analyze(file.document)).toThrow(/@func 非法返回 return value expects number but expression resolves to string/);
  });

  test("supports builtin if with branch short-circuiting", () => {
    const file = reader.readFromString(
      `flag[boolean],value[number],fallback[number]
false,0,99
true,10,0

@compute sheet
target: chosen[number]
chosen = if(flag, value / 2, fallback / 3)
`,
      path.resolve(__dirname, "../fixtures/file-interface/builtin-if.sheet"),
    );

    const analyzedDocument = analyzer.analyze(file.document);
    const tableBlock = file.document.blocks.find((block) => block.kind === "table");
    const analyzedComputeBlock = analyzedDocument.blocks.find((block) => block.kind === "compute");
    const evaluatedTable = computeExecutor.execute(tableBlock, analyzedComputeBlock);

    expect(evaluatedTable.rows).toEqual([
      {
        flag: { type: "boolean", value: false },
        value: { type: "number", value: 0 },
        fallback: { type: "number", value: 99 },
        chosen: { type: "number", value: 33 },
      },
      {
        flag: { type: "boolean", value: true },
        value: { type: "number", value: 10 },
        fallback: { type: "number", value: 0 },
        chosen: { type: "number", value: 5 },
      },
    ]);
  });

  test("supports builtin coalesce and boolean builtins", () => {
    const file = reader.readFromString(
      `primary,secondary,left[boolean],right[boolean]
,备用,true,false
主值,备用,false,true

@compute sheet
target: picked[string], both[boolean], either[boolean]
picked = coalesce(primary, secondary)
both = and(left, right)
either = or(left, right)
`,
      path.resolve(__dirname, "../fixtures/file-interface/builtin-coalesce.sheet"),
    );

    const analyzedDocument = analyzer.analyze(file.document);
    const tableBlock = file.document.blocks.find((block) => block.kind === "table");
    const analyzedComputeBlock = analyzedDocument.blocks.find((block) => block.kind === "compute");
    const evaluatedTable = computeExecutor.execute(tableBlock, analyzedComputeBlock);

    expect(evaluatedTable.rows).toEqual([
      {
        primary: { type: "null", value: null },
        secondary: { type: "string", value: "备用" },
        left: { type: "boolean", value: true },
        right: { type: "boolean", value: false },
        picked: { type: "string", value: "备用" },
        both: { type: "boolean", value: false },
        either: { type: "boolean", value: true },
      },
      {
        primary: { type: "string", value: "主值" },
        secondary: { type: "string", value: "备用" },
        left: { type: "boolean", value: false },
        right: { type: "boolean", value: true },
        picked: { type: "string", value: "主值" },
        both: { type: "boolean", value: false },
        either: { type: "boolean", value: true },
      },
    ]);
  });

  test("rejects invalid builtin argument types at compile time", () => {
    const file = reader.readFromString(
      `value[number]
1

@compute sheet
target: bad[boolean]
bad = and(value)
`,
      path.resolve(__dirname, "../fixtures/file-interface/builtin-invalid.sheet"),
    );

    expect(() => analyzer.analyze(file.document)).toThrow(/Argument 1 of and must be boolean-compatible, received number/);
  });

  test("rejects removed aggregate builtins in @compute", () => {
    const file = reader.readFromString(
      `value[number]
1
2

@compute sheet
target: average[number]
average = avg(value)
`,
      path.resolve(__dirname, "../fixtures/file-interface/aggregate-removed.sheet"),
    );

    expect(() => analyzer.analyze(file.document)).toThrow(/Unknown function "avg"/);
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
      path.resolve(__dirname, "../fixtures/file-interface/runtime-typed-targets.sheet"),
    );

    const analyzedDocument = analyzer.analyze(file.document);
    const tableBlock = file.document.blocks.find((block) => block.kind === "table");
    const analyzedComputeBlock = analyzedDocument.blocks.find((block) => block.kind === "compute");
    const evaluatedTable = computeExecutor.execute(tableBlock, analyzedComputeBlock);

    expect(evaluatedTable.columns).toEqual([
      ...tableBlock.columns,
      { name: "total", declaredType: "number", columnType: "number", isTypeExplicit: true },
      { name: "label", declaredType: "string", columnType: "string", isTypeExplicit: true },
      { name: "passthrough", declaredType: "dynamic", columnType: "dynamic", isTypeExplicit: false },
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
      path.resolve(__dirname, "../fixtures/file-interface/document-executor.sheet"),
    );

    const analyzedDocument = analyzer.analyze(file.document);
    const evaluatedDocument = documentExecutor.execute(analyzedDocument);

    expect(evaluatedDocument.tables.sheet.columns).toEqual([
      { name: "value", declaredType: "number", columnType: "number", isTypeExplicit: true },
      { name: "doubled", declaredType: "number", columnType: "number", isTypeExplicit: true },
    ]);
    expect(evaluatedDocument.tables.sheet.rows).toEqual([
      {
        value: { type: "number", value: 1 },
        doubled: { type: "number", value: 2 },
      },
      {
        value: { type: "number", value: 2 },
        doubled: { type: "number", value: 4 },
      },
    ]);
    expect(evaluatedDocument.plots).toEqual([
      {
        kind: "plot",
        tableName: "sheet",
        fields: {
          x: "doubled",
          y: "doubled",
        },
        resolvedDependencies: [
          { name: "doubled", declaredType: "number", columnType: "number", isTypeExplicit: true },
        ],
        rows: [
          {
            doubled: { type: "number", value: 2 },
          },
          {
            doubled: { type: "number", value: 4 },
          },
        ],
        source: { startLine: 9, endLine: 12 },
      },
    ]);
  });

  test("compiles evaluated plots into Vega-Lite bar specs", () => {
    const file = reader.readFromPath(fixturePath);
    const analyzedDocument = analyzer.analyze(file.document);
    const evaluatedDocument = documentExecutor.execute(analyzedDocument);
    const [plot] = evaluatedDocument.plots;

    expect(plotCompiler.compileBarPlot(plot)).toEqual({
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      mark: "bar",
      title: "amount vs total",
      data: {
        values: [
          { amount: 10, total: 20 },
          { amount: 15, total: 30 },
          { amount: 18, total: 36 },
        ],
      },
      encoding: {
        x: {
          field: "amount",
          type: "quantitative",
        },
        y: {
          field: "total",
          type: "quantitative",
        },
      },
    });
  });

  test("compiles a sheet from path through the full pipeline", () => {
    const compiled = sheetCompiler.compilePath(fixturePath);

    expect(compiled.file.path).toBe(fixturePath);
    expect(compiled.analyzedDocument.blocks).toHaveLength(5);
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
    expect(compiled.plotSpecs).toEqual([
      {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        mark: "bar",
        title: "amount vs total",
        data: {
          values: [
            { amount: 10, total: 20 },
            { amount: 15, total: 30 },
            { amount: 18, total: 36 },
          ],
        },
        encoding: {
          x: {
            field: "amount",
            type: "quantitative",
          },
          y: {
            field: "total",
            type: "quantitative",
          },
        },
      },
    ]);
  });

  test("builds an xlsx workbook with table sheets and a _plots metadata sheet", () => {
    const compiled = sheetCompiler.compilePath(fixturePath);
    const workbook = xlsxAdapter.buildWorkbook(compiled);

    expect(workbook.SheetNames).toEqual(["sheet", "_plots"]);

    const tableRows = XLSX.utils.sheet_to_json(workbook.Sheets.sheet, { header: 1, defval: null });
    expect(tableRows).toEqual([
      [
        "region",
        "price",
        "active",
        "note",
        "count",
        "flag",
        "label",
        "mixed",
        "amount",
        "total",
        "double_total",
        "taxed_total",
      ],
      ["North", 3, true, null, 1, true, "alpha", 1, 10, 20, 40, 3.24],
      ["South", 4, false, null, 2, false, "beta", "hello", 15, 30, 60, 8.64],
      ["East", 5, true, null, null, null, "gamma", null, 18, 36, 72, 0],
    ]);

    const plotRows = XLSX.utils.sheet_to_json(workbook.Sheets._plots);
    expect(plotRows).toEqual([
      {
        plot_index: 0,
        table: "sheet",
        title: "amount vs total",
        x: "amount",
        y: "total",
        color: "",
        deps: "amount,total",
        spec_json: JSON.stringify(compiled.plotSpecs[0]),
      },
    ]);
  });

  test("writes compiled workbook to disk", () => {
    const compiled = sheetCompiler.compilePath(fixturePath);
    const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "sheet-format-"));
    const outputPath = path.join(tempDirectory, "integration.xlsx");

    xlsxAdapter.writeCompiledResult(compiled, outputPath);

    expect(fs.existsSync(outputPath)).toBe(true);

    const workbook = XLSX.readFile(outputPath);
    expect(workbook.SheetNames).toEqual(["sheet", "_plots"]);
    expect(XLSX.utils.sheet_to_json(workbook.Sheets.sheet, { header: 1, defval: null })[1]).toEqual([
      "North",
      3,
      true,
      null,
      1,
      true,
      "alpha",
      1,
      10,
      20,
      40,
      3.24,
    ]);
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
      path.resolve(__dirname, "../fixtures/file-interface/document-order.sheet"),
    );

    const analyzedDocument = analyzer.analyze(file.document);

    expect(() => documentExecutor.execute(analyzedDocument)).toThrow(/not materialized yet: doubled/);
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
      path.resolve(__dirname, "../fixtures/file-interface/executor-mismatch.sheet"),
    );

    const analyzedDocument = analyzer.analyze(file.document);
    const wrongTable = file.document.blocks.find((block) => block.kind === "table" && block.name === "sheet");
    const analyzedComputeBlock = analyzedDocument.blocks.find((block) => block.kind === "compute");

    expect(() => computeExecutor.execute(wrongTable, analyzedComputeBlock)).toThrow(
      /executor received "sheet"/,
    );
  });
});
