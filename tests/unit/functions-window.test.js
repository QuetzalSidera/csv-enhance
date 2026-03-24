const {
  createServices,
  fixturePath,
  isBuiltinFunction,
  isKnownBuiltinFunction,
  SheetDiagnosticError,
} = require("./helpers/csvx-test-kit.js");

describe("Functions, builtins, and window execution", () => {
  const { reader, analyzer, computeExecutor, documentExecutor } = createServices();

  test("@func defines a reusable pure expression for @compute", () => {
    const file = reader.readFromString(
      `@func 税额(单价[number], 数量[number]) => number
销售额[number] = 单价 * 数量;
return 销售额 * 1.08;

@table 销售表
商品[string],单价[number],数量[number]
苹果,3,5

@compute 销售表
target: 含税金额[number]
含税金额 = 税额(单价, 数量)
`,
      fixturePath("file-interface", "func.csvx"),
    );

    const funcBlock = file.document.blocks.find((block) => block.kind === "func");
    expect(funcBlock).toEqual(expect.objectContaining({
      kind: "func",
      name: "税额",
      params: [
        { name: "单价", type: "number", shape: "scalar", nameRange: expect.any(Object) },
        { name: "数量", type: "number", shape: "scalar", nameRange: expect.any(Object) },
      ],
      returnSpec: { type: "number", shape: "scalar", range: expect.any(Object) },
    }));

    const analyzedDocument = analyzer.analyze(file.document);
    const analyzedFuncBlock = analyzedDocument.blocks.find((block) => block.kind === "func");
    const analyzedComputeBlock = analyzedDocument.blocks.find((block) => block.kind === "compute");
    const tableBlock = file.document.blocks.find((block) => block.kind === "table");
    const evaluatedTable = computeExecutor.execute(tableBlock, analyzedComputeBlock);

    expect(analyzedFuncBlock.locals).toEqual([
      expect.objectContaining({ name: "销售额", type: "number", shape: "scalar" }),
    ]);
    expect(analyzedComputeBlock.statements[0].expression.kind).toBe("func_call");
    expect(evaluatedTable.rows[0]).toEqual({
      商品: { type: "string", value: "苹果" },
      单价: { type: "number", value: 3 },
      数量: { type: "number", value: 5 },
      含税金额: { type: "number", value: 16.200000000000003 },
    });
  });

  test("@func infers local scalar types and parses explicit column-shaped declarations", () => {
    const localInference = reader.readFromString(
      `@func helper(value[number]) => number
temp = value * 2;
return temp;
`,
      fixturePath("file-interface", "func-local-inference.csvx"),
    );
    const colShape = reader.readFromString(
      `@func build_series(value[col:number]) => [number]
return value;
`,
      fixturePath("file-interface", "func-col-shape.csvx"),
    );

    const inferredFunc = analyzer.analyze(localInference.document).blocks.find((block) => block.kind === "func");
    const colFunc = colShape.document.blocks.find((block) => block.kind === "func");

    expect(inferredFunc.locals).toEqual([
      expect.objectContaining({ name: "temp", type: "number", shape: "scalar" }),
    ]);
    expect(colFunc.params).toEqual([
      expect.objectContaining({ name: "value", type: "number", shape: "col" }),
    ]);
    expect(colFunc.returnSpec).toEqual(expect.objectContaining({ type: "number", shape: "col" }));
  });

  test("rejects unsupported function usages across scalar contexts", () => {
    const nonScalarCall = reader.readFromString(
      `@func build_series(value[col:number]) => [number]
return value;

@table 销售表
销售额[number]
15

@compute 销售表
target: 结果[number]
结果 = build_series(销售额)
`,
      fixturePath("file-interface", "non-scalar-func-call.csvx"),
    );
    const invalidFunc = reader.readFromString(
      `@func 非法函数() => number
return 金额 * 2;

@table 销售表
金额[number]
10
`,
      fixturePath("file-interface", "invalid-func.csvx"),
    );
    const invalidReturn = reader.readFromString(
      `@func 非法返回(value[string]) => number
return value;
`,
      fixturePath("file-interface", "invalid-func-return.csvx"),
    );

    expect(() => analyzer.analyze(nonScalarCall.document)).toThrow(/returns col values and cannot be used in a scalar expression context/);
    expect(() => analyzer.analyze(invalidFunc.document)).toThrow(/Unknown local or parameter reference "金额"/);
    expect(() => analyzer.analyze(invalidReturn.document)).toThrow(/return value expects number but expression resolves to string/);
  });

  test("keeps builtin availability scoped by expression context", () => {
    expect(isKnownBuiltinFunction("lag")).toBe(true);
    expect(isBuiltinFunction("lag")).toBe(true);
    expect(isBuiltinFunction("lag", "window")).toBe(true);
    expect(isBuiltinFunction("lag", "compute")).toBe(false);
    expect(isBuiltinFunction("lag", "func")).toBe(false);
    expect(isBuiltinFunction("if", "compute")).toBe(true);
    expect(isBuiltinFunction("if", "func")).toBe(true);
  });

  test("rejects window-only builtins inside @compute and @func", () => {
    const computeFile = reader.readFromString(
      `@table 销售表
销售额[number]
15

@compute 销售表
target: 前值[number]
前值 = lag(销售额, 1)
`,
      fixturePath("file-interface", "window-builtin-compute.csvx"),
    );
    const funcFile = reader.readFromString(
      `@func helper(value[number]) => number
return lag(value, 1);
`,
      fixturePath("file-interface", "window-builtin-func.csvx"),
    );

    expect(() => analyzer.analyze(computeFile.document)).toThrow(/Builtin function "lag" is not available in compute expressions/);
    expect(() => analyzer.analyze(funcFile.document)).toThrow(/Builtin function "lag" is not available in func expressions/);
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
      fixturePath("file-interface", "builtin-if.csvx"),
    );

    const analyzedDocument = analyzer.analyze(file.document);
    const tableBlock = file.document.blocks.find((block) => block.kind === "table");
    const computeBlock = analyzedDocument.blocks.find((block) => block.kind === "compute");
    const evaluatedTable = computeExecutor.execute(tableBlock, computeBlock);

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

  test("supports coalesce, and, and or", () => {
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
      fixturePath("file-interface", "builtin-coalesce.csvx"),
    );

    const analyzedDocument = analyzer.analyze(file.document);
    const tableBlock = file.document.blocks.find((block) => block.kind === "table");
    const computeBlock = analyzedDocument.blocks.find((block) => block.kind === "compute");
    const evaluatedTable = computeExecutor.execute(tableBlock, computeBlock);

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

  test("rejects invalid builtin argument types and removed aggregate builtins", () => {
    const invalidBuiltin = reader.readFromString(
      `value[number]
1

@compute sheet
target: bad[boolean]
bad = and(value)
`,
      fixturePath("file-interface", "builtin-invalid.csvx"),
    );
    const removedAggregate = reader.readFromString(
      `value[number]
1
2

@compute sheet
target: average[number]
average = avg(value)
`,
      fixturePath("file-interface", "aggregate-removed.csvx"),
    );

    expect(() => analyzer.analyze(invalidBuiltin.document)).toThrow(/Argument 1 of and must be boolean-compatible, received number/);
    expect(() => analyzer.analyze(removedAggregate.document)).toThrow(/Unknown function "avg"/);
  });

  test("analyzes and executes @window with ordering and file-order fallback", () => {
    const ordered = reader.readFromString(
      `@table 销售表
日期[number],销售额[number]
2,20
1,10
3,15

@window 销售表
order: 日期
target: 前值[number],累计[number],序号[number]
前值 = lag(销售额, 1)
累计 = cumsum(销售额)
序号 = row_number()
`,
      fixturePath("file-interface", "window-basic.csvx"),
    );
    const defaultOrder = reader.readFromString(
      `@table 销售表
销售额[number]
20
10
15

@window 销售表
target: 前值[number],累计[number],序号[number],排名[number]
前值 = lag(销售额, 1)
累计 = cumsum(销售额)
序号 = row_number()
排名 = rank()
`,
      fixturePath("file-interface", "window-default-order.csvx"),
    );

    const orderedDocument = documentExecutor.execute(analyzer.analyze(ordered.document));
    const defaultDocument = documentExecutor.execute(analyzer.analyze(defaultOrder.document));

    expect(orderedDocument.tables["销售表"].rows[0]).toEqual({
      日期: { type: "number", value: 2 },
      销售额: { type: "number", value: 20 },
      前值: { type: "number", value: 10 },
      累计: { type: "number", value: 30 },
      序号: { type: "number", value: 2 },
    });
    expect(defaultDocument.tables["销售表"].rows[0]).toEqual({
      销售额: { type: "number", value: 20 },
      前值: { type: "null", value: null },
      累计: { type: "number", value: 20 },
      序号: { type: "number", value: 1 },
      排名: { type: "number", value: 1 },
    });
  });

  test("executes grouped window blocks independently", () => {
    const file = reader.readFromString(
      `@table 销售表
地区[string],日期[number],销售额[number]
华北,2,20
华北,1,10
华南,2,7
华南,1,5

@window 销售表
group: 地区
order: 日期
target: 分组累计[number],排名[number]
分组累计 = cumsum(销售额)
排名 = rank()
`,
      fixturePath("file-interface", "window-partition.csvx"),
    );

    const evaluatedDocument = documentExecutor.execute(analyzer.analyze(file.document));
    expect(evaluatedDocument.tables["销售表"].rows[0].分组累计).toEqual({ type: "number", value: 30 });
    expect(evaluatedDocument.tables["销售表"].rows[2].分组累计).toEqual({ type: "number", value: 12 });
  });

  test("executes extended window builtins", () => {
    const file = reader.readFromString(
      `@table 销售表
日期[number],销售额[number]
1,10
2,20
3,15

@window 销售表
order: 日期
target: 当前值[number],后值[dynamic],首值[number],末值[number]
当前值 = current(销售额)
后值 = lead(销售额, 1)
首值 = first(销售额)
末值 = last(销售额)
`,
      fixturePath("file-interface", "window-extended-builtins.csvx"),
    );

    const evaluatedDocument = documentExecutor.execute(analyzer.analyze(file.document));
    expect(evaluatedDocument.tables["销售表"].rows[0]).toEqual({
      日期: { type: "number", value: 1 },
      销售额: { type: "number", value: 10 },
      当前值: { type: "number", value: 10 },
      后值: { type: "number", value: 20 },
      首值: { type: "number", value: 10 },
      末值: { type: "number", value: 15 },
    });
  });

  test("rejects unknown @window order columns with a precise range", () => {
    const file = reader.readFromString(
      `@table 销售表
日期[number],销售额[number]
1,10

@window 销售表
order: 日期值
target: 前值[number]
前值 = lag(销售额, 1)
`,
      fixturePath("file-interface", "window-unknown-order.csvx"),
    );

    try {
      analyzer.analyze(file.document);
      throw new Error("Expected window order diagnostic");
    } catch (error) {
      expect(error).toBeInstanceOf(SheetDiagnosticError);
      expect(error.code).toBe("ANALYSIS_UNKNOWN_WINDOW_ORDER");
      expect(error.range).toEqual({
        startLine: 6,
        startColumn: 8,
        startOffset: 7,
        endLine: 6,
        endColumn: 10,
        endOffset: 9,
      });
    }
  });

  test("allows window outputs to be consumed by later compute blocks", () => {
    const file = reader.readFromString(
      `@table 销售表
日期[number],销售额[number]
1,10
2,20

@window 销售表
order: 日期
target: 累计[number]
累计 = cumsum(销售额)

@compute 销售表
target: 双倍累计[number]
双倍累计 = 累计 * 2
`,
      fixturePath("file-interface", "window-output-into-compute.csvx"),
    );

    const evaluatedDocument = documentExecutor.execute(analyzer.analyze(file.document));
    expect(evaluatedDocument.tables["销售表"].rows).toEqual([
      {
        日期: { type: "number", value: 1 },
        销售额: { type: "number", value: 10 },
        累计: { type: "number", value: 10 },
        双倍累计: { type: "number", value: 20 },
      },
      {
        日期: { type: "number", value: 2 },
        销售额: { type: "number", value: 20 },
        累计: { type: "number", value: 30 },
        双倍累计: { type: "number", value: 60 },
      },
    ]);
  });
});
