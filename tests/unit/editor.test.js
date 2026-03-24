const path = require("path");
const fs = require("fs");
const { SheetLanguageService } = require("../../dist/index.js");

describe("SheetLanguageService", () => {
  const service = new SheetLanguageService();
  const fixturePath = (name) => path.resolve(__dirname, `../fixtures/editor/${name}`);
  const readFixture = (name) => fs.readFileSync(fixturePath(name), "utf8");

  test("indexes top-level block names for hover and definition", () => {
    const source = readFixture("top-level.csvx");

    const result = service.analyzeSource(
      source,
      fixturePath("top-level.csvx"),
    );

    const tableSymbol = result.symbols.find((symbol) => symbol.kind === "table" && symbol.name === "销售表");
    const computeReference = result.symbols.find(
      (symbol) => symbol.kind === "compute_table_reference" && symbol.name === "销售表",
    );

    expect(tableSymbol).toBeDefined();
    expect(tableSymbol.range).toEqual({
      startLine: 1,
      startColumn: 8,
      startOffset: 7,
      endLine: 1,
      endColumn: 10,
      endOffset: 9,
    });

    expect(computeReference).toBeDefined();
    expect(computeReference.definitionRange).toEqual(tableSymbol.range);

    const definition = service.getDefinition(
      source,
      { line: 5, column: 11 },
      fixturePath("top-level.csvx"),
    );

    expect(definition).toEqual({
      name: "销售表",
      kind: "compute_table_reference",
      fromRange: {
        startLine: 5,
        startColumn: 10,
        startOffset: 9,
        endLine: 5,
        endColumn: 12,
        endOffset: 11,
      },
      toRange: {
        startLine: 1,
        startColumn: 8,
        startOffset: 7,
        endLine: 1,
        endColumn: 10,
        endOffset: 9,
      },
    });

    const hover = service.getHover(
      source,
      { line: 1, column: 9 },
      fixturePath("top-level.csvx"),
    );

    expect(hover).toEqual({
      range: {
        startLine: 1,
        startColumn: 8,
        startOffset: 7,
        endLine: 1,
        endColumn: 10,
        endOffset: 9,
      },
      contents: "table 销售表\n销售额[number]",
    });
  });

  test("resolves @func call hover and definition", () => {
    const source = readFixture("func-reference.csvx");

    const definition = service.getDefinition(
      source,
      { line: 11, column: 10 },
      fixturePath("func-reference.csvx"),
    );

    expect(definition).toEqual({
      name: "税额",
      kind: "func_reference",
      fromRange: {
        startLine: 11,
        startColumn: 9,
        startOffset: 8,
        endLine: 11,
        endColumn: 10,
        endOffset: 9,
      },
      toRange: {
        startLine: 1,
        startColumn: 7,
        startOffset: 6,
        endLine: 1,
        endColumn: 8,
        endOffset: 7,
      },
    });

    const hover = service.getHover(
      source,
      { line: 11, column: 9 },
      fixturePath("func-reference.csvx"),
    );

    expect(hover).toEqual({
      range: {
        startLine: 11,
        startColumn: 9,
        startOffset: 8,
        endLine: 11,
        endColumn: 10,
        endOffset: 9,
      },
      contents: "税额(销售额[number]) => number",
    });
  });

  test("resolves builtin hover and definition", () => {
    const source = `@func helper(value[number]) => number
return coalesce(value, 0);

@table 销售表
销售额[number]
10

@window 销售表
target: 累计[number]
累计 = cumsum(销售额)
`;

    const hover = service.getHover(
      source,
      { line: 2, column: 9 },
      fixturePath("func-reference.csvx"),
    );

    expect(hover).toEqual({
      range: {
        startLine: 2,
        startColumn: 8,
        startOffset: 7,
        endLine: 2,
        endColumn: 15,
        endOffset: 14,
      },
      contents: "builtin coalesce(value, fallback, ...)",
    });

    const definition = service.getDefinition(
      source,
      { line: 10, column: 7 },
      fixturePath("func-reference.csvx"),
    );

    expect(definition).toEqual({
      name: "cumsum",
      kind: "builtin_reference",
      fromRange: {
        startLine: 10,
        startColumn: 6,
        startOffset: 5,
        endLine: 10,
        endColumn: 11,
        endOffset: 10,
      },
      toRange: expect.objectContaining({
        startLine: expect.any(Number),
        startColumn: expect.any(Number),
        endLine: expect.any(Number),
        endColumn: expect.any(Number),
      }),
      toPath: path.resolve(__dirname, "../../docs/BUILTINS.en.md"),
    });
  });

  test("suggests directives, keys, columns, builtins, and plugin calls", () => {
    const source = `@

@plugin 财务插件
path: ./plugins/finance.ts
exports: tax

@table 销售表
销售额[number],地区[string]
10,华北

@compute 销售表
t
target: 含税销售额[number]
局部[number] = 销售额
含税销售额 = 

@window 销售表
g
target: 累计[number]
累计 = 

@plot 销售表
d
x: 
`;

    expect(service.getCompletions(source, { line: 1, column: 2 }).map((item) => item.label)).toContain("@window");
    expect(service.getCompletions(source, { line: 12, column: 2 }).map((item) => item.insertText ?? item.label)).toContain("target: ");
    expect(service.getCompletions(source, { line: 18, column: 2 }).map((item) => item.insertText ?? item.label)).toContain("group: ");
    expect(service.getCompletions(source, { line: 23, column: 2 }).map((item) => item.insertText ?? item.label)).toContain("deps: ");

    const computeCompletions = service.getCompletions(source, { line: 15, column: 9 }).map((item) => item.label);
    expect(computeCompletions).toEqual(expect.arrayContaining(["销售额", "局部", "if", "财务插件.tax"]));

    const windowCompletions = service.getCompletions(source, { line: 20, column: 6 }).map((item) => item.label);
    expect(windowCompletions).toEqual(expect.arrayContaining(["cumsum", "lag", "销售额"]));

    const plotCompletions = service.getCompletions(source, { line: 24, column: 4 }).map((item) => item.label);
    expect(plotCompletions).toEqual(expect.arrayContaining(["销售额", "含税销售额", "累计"]));
  });

  test("finds builtin references across function and window call sites", () => {
    const source = `@func helper(value[number]) => number
return coalesce(value, 0);

@table 销售表
销售额[number]
10
20

@window 销售表
target: 累计[number]
累计 = cumsum(销售额)
`;

    const coalesceReferences = service.getReferences(
      source,
      { line: 2, column: 9 },
      fixturePath("func-reference.csvx"),
      { includeDeclaration: true },
    );

    expect(coalesceReferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "coalesce",
          kind: "builtin_reference",
          path: path.resolve(__dirname, "../../docs/BUILTINS.en.md"),
        }),
        expect.objectContaining({
          name: "coalesce",
          kind: "builtin_reference",
          path: fixturePath("func-reference.csvx"),
        }),
      ]),
    );

    const cumsumReferences = service.getReferences(
      source,
      { line: 11, column: 7 },
      fixturePath("func-reference.csvx"),
      { includeDeclaration: true },
    );

    expect(cumsumReferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "cumsum",
          kind: "builtin_reference",
          path: path.resolve(__dirname, "../../docs/BUILTINS.en.md"),
        }),
        expect.objectContaining({
          name: "cumsum",
          kind: "builtin_reference",
          path: fixturePath("func-reference.csvx"),
        }),
      ]),
    );
  });

  test("resolves local references inside @window blocks", () => {
    const source = `@table 销售表
销售额[number]
10
20

@window 销售表
order: 销售额
target: 累计[number]
局部[number] = current(销售额)
累计 = 局部
`;

    const hover = service.getHover(
      source,
      { line: 10, column: 6 },
      fixturePath("local-reference.csvx"),
    );

    expect(hover).toEqual({
      range: {
        startLine: 10,
        startColumn: 6,
        startOffset: 5,
        endLine: 10,
        endColumn: 7,
        endOffset: 6,
      },
      contents: "local 局部[number]",
    });

    const definition = service.getDefinition(
      source,
      { line: 10, column: 6 },
      fixturePath("local-reference.csvx"),
    );

    expect(definition).toEqual(
      expect.objectContaining({
        name: "局部",
        kind: "local_reference",
        fromRange: {
          startLine: 10,
          startColumn: 6,
          startOffset: 5,
          endLine: 10,
          endColumn: 7,
          endOffset: 6,
        },
        toRange: {
          startLine: 9,
          startColumn: 1,
          startOffset: 0,
          endLine: 9,
          endColumn: 10,
          endOffset: 9,
        },
      }),
    );
  });

  test("suggests function-body locals and parameters after partial edits", () => {
    const source = `@func helper(value[number], rate[number]) => number
base[number] = value * rate;
return 
`;

    const completions = service.getCompletions(
      source,
      { line: 3, column: 8 },
      fixturePath("func-reference.csvx"),
    ).map((item) => item.label);

    expect(completions).toEqual(expect.arrayContaining(["value", "rate", "base", "if", "coalesce"]));
  });

  test("resolves column reference hover and definition in @compute", () => {
    const source = readFixture("compute-column-reference.csvx");

    const definition = service.getDefinition(
      source,
      { line: 7, column: 4 },
      fixturePath("compute-column-reference.csvx"),
    );

    expect(definition).toEqual({
      name: "销售额",
      kind: "column_reference",
      fromRange: {
        startLine: 7,
        startColumn: 3,
        startOffset: 2,
        endLine: 7,
        endColumn: 5,
        endOffset: 4,
      },
      toRange: {
        startLine: 2,
        startColumn: 1,
        startOffset: 0,
        endLine: 2,
        endColumn: 11,
        endOffset: 10,
      },
    });

    const hover = service.getHover(
      source,
      { line: 7, column: 4 },
      fixturePath("compute-column-reference.csvx"),
    );

    expect(hover).toEqual({
      range: {
        startLine: 7,
        startColumn: 3,
        startOffset: 2,
        endLine: 7,
        endColumn: 5,
        endOffset: 4,
      },
      contents: "销售表.销售额[number]",
    });
  });

  test("resolves column reference hover and definition in @plot", () => {
    const source = readFixture("plot-column-reference.csvx");

    const depsDefinition = service.getDefinition(
      source,
      { line: 6, column: 7 },
      fixturePath("plot-column-reference.csvx"),
    );

    expect(depsDefinition).toEqual({
      name: "销售额",
      kind: "column_reference",
      fromRange: {
        startLine: 6,
        startColumn: 7,
        startOffset: 6,
        endLine: 6,
        endColumn: 9,
        endOffset: 8,
      },
      toRange: {
        startLine: 2,
        startColumn: 1,
        startOffset: 0,
        endLine: 2,
        endColumn: 11,
        endOffset: 10,
      },
    });

    const fieldHover = service.getHover(
      source,
      { line: 7, column: 5 },
      fixturePath("plot-column-reference.csvx"),
    );

    expect(fieldHover).toEqual({
      range: {
        startLine: 7,
        startColumn: 4,
        startOffset: 3,
        endLine: 7,
        endColumn: 6,
        endOffset: 5,
      },
      contents: "销售表.销售额[number]",
    });
  });

  test("shows hover for local references in @compute", () => {
    const source = readFixture("local-reference.csvx");

    const hover = service.getHover(
      source,
      { line: 8, column: 10 },
      fixturePath("local-reference.csvx"),
    );

    expect(hover).toEqual({
      range: {
        startLine: 8,
        startColumn: 9,
        startOffset: 8,
        endLine: 8,
        endColumn: 12,
        endOffset: 11,
      },
      contents: "local test[number]",
    });
  });

  test("resolves local reference definition in @compute", () => {
    const source = readFixture("local-reference.csvx");

    const definition = service.getDefinition(
      source,
      { line: 8, column: 10 },
      fixturePath("local-reference.csvx"),
    );

    expect(definition).toEqual({
      name: "test",
      kind: "local_reference",
      fromRange: {
        startLine: 8,
        startColumn: 9,
        startOffset: 8,
        endLine: 8,
        endColumn: 12,
        endOffset: 11,
      },
      toRange: {
        startLine: 7,
        startColumn: 1,
        startOffset: 0,
        endLine: 7,
        endColumn: 4,
        endOffset: 3,
      },
      toPath: undefined,
    });
  });

  test("finds local references in @compute", () => {
    const source = readFixture("local-reference.csvx");

    const references = service.getReferences(
      source,
      { line: 8, column: 10 },
      fixturePath("local-reference.csvx"),
    );

    expect(references).toEqual([
      {
        name: "test",
        kind: "local",
        range: {
          startLine: 7,
          startColumn: 1,
          startOffset: 0,
          endLine: 7,
          endColumn: 4,
          endOffset: 3,
        },
        path: fixturePath("local-reference.csvx"),
      },
      {
        name: "test",
        kind: "local_reference",
        range: {
          startLine: 8,
          startColumn: 9,
          startOffset: 8,
          endLine: 8,
          endColumn: 12,
          endOffset: 11,
        },
        path: fixturePath("local-reference.csvx"),
      },
    ]);
  });

  test("shows hover for plugin calls", () => {
    const source = readFixture("plugin-reference.csvx");

    const hover = service.getHover(
      source,
      { line: 11, column: 12 },
      fixturePath("plugin-reference.csvx"),
    );

    expect(hover).toEqual({
      range: {
        startLine: 11,
        startColumn: 9,
        startOffset: 8,
        endLine: 11,
        endColumn: 16,
        endOffset: 15,
      },
      contents: "plugin 财务插件.tax(..., ...) -> number",
    });
  });

  test("resolves plugin call definition to the exported function", () => {
    const source = readFixture("plugin-reference.csvx");

    const definition = service.getDefinition(
      source,
      { line: 11, column: 12 },
      fixturePath("plugin-reference.csvx"),
    );

    expect(definition).toEqual({
      name: "财务插件.tax",
      kind: "plugin_reference",
      fromRange: {
        startLine: 11,
        startColumn: 9,
        startOffset: 8,
        endLine: 11,
        endColumn: 16,
        endOffset: 15,
      },
      toRange: {
        startLine: 1,
        startColumn: 17,
        startOffset: 16,
        endLine: 1,
        endColumn: 20,
        endOffset: 19,
      },
      toPath: path.resolve(__dirname, "../fixtures/editor/../../../examples/plugins/finance.ts"),
    });
  });

  test("finds plugin call references and exported declaration", () => {
    const source = readFixture("plugin-reference.csvx");

    const references = service.getReferences(
      source,
      { line: 11, column: 12 },
      fixturePath("plugin-reference.csvx"),
    );

    expect(references).toEqual([
      {
        name: "财务插件.tax",
        kind: "plugin_reference",
        range: {
          startLine: 1,
          startColumn: 17,
          startOffset: 16,
          endLine: 1,
          endColumn: 20,
          endOffset: 19,
        },
        path: path.resolve(__dirname, "../fixtures/editor/../../../examples/plugins/finance.ts"),
      },
      {
        name: "tax",
        kind: "plugin_export_reference",
        range: {
          startLine: 3,
          startColumn: 10,
          startOffset: 9,
          endLine: 3,
          endColumn: 12,
          endOffset: 11,
        },
        path: fixturePath("plugin-reference.csvx"),
      },
      {
        name: "财务插件.tax",
        kind: "plugin_reference",
        range: {
          startLine: 11,
          startColumn: 9,
          startOffset: 8,
          endLine: 11,
          endColumn: 16,
          endOffset: 15,
        },
        path: fixturePath("plugin-reference.csvx"),
      },
    ]);
  });

  test("resolves plugin path definition to the plugin file", () => {
    const source = readFixture("plugin-reference.csvx");

    const definition = service.getDefinition(
      source,
      { line: 2, column: 12 },
      fixturePath("plugin-reference.csvx"),
    );

    expect(definition).toEqual({
      name: path.resolve(__dirname, "../fixtures/editor/../../../examples/plugins/finance.ts"),
      kind: "plugin_path_reference",
      fromRange: {
        startLine: 2,
        startColumn: 7,
        startOffset: 6,
        endLine: 2,
        endColumn: 42,
        endOffset: 41,
      },
      toRange: {
        startLine: 1,
        startColumn: 1,
        startOffset: 0,
        endLine: 1,
        endColumn: 1,
        endOffset: 0,
      },
      toPath: path.resolve(__dirname, "../fixtures/editor/../../../examples/plugins/finance.ts"),
    });
  });

  test("resolves plugin exports definition to the exported function", () => {
    const source = readFixture("plugin-reference.csvx");

    const definition = service.getDefinition(
      source,
      { line: 3, column: 11 },
      fixturePath("plugin-reference.csvx"),
    );

    expect(definition).toEqual({
      name: "tax",
      kind: "plugin_export_reference",
      fromRange: {
        startLine: 3,
        startColumn: 10,
        startOffset: 9,
        endLine: 3,
        endColumn: 12,
        endOffset: 11,
      },
      toRange: {
        startLine: 1,
        startColumn: 17,
        startOffset: 16,
        endLine: 1,
        endColumn: 20,
        endOffset: 19,
      },
      toPath: path.resolve(__dirname, "../fixtures/editor/../../../examples/plugins/finance.ts"),
    });
  });
});
