# `.sheet` File Interface

This refactor focuses on the file interface layer first, following the architecture notes in `Comment.md`.

Current scope:

- file-oriented entry API
- block-level syntax parsing
- expression AST parsing
- semantic analysis for `@compute`
- local `@func` pure-expression reuse
- compute execution runtime
- document execution runtime
- Vega-Lite bar plot compilation
- `.xlsx` workbook export
- end-to-end `compile` facade
- typed table cell representation
- typed table column declaration and inference
- source metadata for each parsed block
- `#` comment line support

Not part of this phase:

- syntax static analysis
- xlsx adapter

## Structure

- [src/file-interface/reader.ts](/Users/qianshuang/Project/WebProject/csv-enhance/src/file-interface/reader.ts): file interface and default reader
- [src/file-interface/parser.ts](/Users/qianshuang/Project/WebProject/csv-enhance/src/file-interface/parser.ts): parser entry and block dispatch
- [src/file-interface/parser/blocks](/Users/qianshuang/Project/WebProject/csv-enhance/src/file-interface/parser/blocks): per-block parsers
- [src/file-interface/parser/parser-support.ts](/Users/qianshuang/Project/WebProject/csv-enhance/src/file-interface/parser/parser-support.ts): shared parsing helpers
- [src/file-interface/types.ts](/Users/qianshuang/Project/WebProject/csv-enhance/src/file-interface/types.ts): document and block types
- [src/analysis/expression-parser.ts](/Users/qianshuang/Project/WebProject/csv-enhance/src/analysis/expression-parser.ts): expression AST parser
- [src/analysis/analyzer.ts](/Users/qianshuang/Project/WebProject/csv-enhance/src/analysis/analyzer.ts): semantic binding for compute expressions
- [src/runtime/document-executor.ts](/Users/qianshuang/Project/WebProject/csv-enhance/src/runtime/document-executor.ts): document-order runtime execution
- [src/runtime/plot-compiler.ts](/Users/qianshuang/Project/WebProject/csv-enhance/src/runtime/plot-compiler.ts): Vega-Lite bar spec compiler
- [src/runtime/sheet-compiler.ts](/Users/qianshuang/Project/WebProject/csv-enhance/src/runtime/sheet-compiler.ts): high-level compile facade
- [src/runtime/xlsx-adapter.ts](/Users/qianshuang/Project/WebProject/csv-enhance/src/runtime/xlsx-adapter.ts): workbook export with table sheets and `_plots` metadata
- [src/shared/value.ts](/Users/qianshuang/Project/WebProject/csv-enhance/src/shared/value.ts): typed cell inference
- [src/shared/csv.ts](/Users/qianshuang/Project/WebProject/csv-enhance/src/shared/csv.ts): CSV line parsing

## Example

```ts
import { SheetCompiler } from "./src";

const compiler = new SheetCompiler();
const result = compiler.compilePath("./examples/retail.sheet");

console.log(result.evaluatedDocument.tables.sales.rows[0]);
console.log(result.plotSpecs[0]);
```

To export `.xlsx`, use one of the bundled examples:

```bash
npm run build
node examples/compile-retail.js
node examples/compile-chinese-sales.js
```

To lint a `.sheet` file from the command line:

```bash
npm run build
node dist/cli/sheet.js lint ./examples/retail.sheet
```

After installing the package as a binary, the same command is available as:

```bash
sheet lint ./examples/retail.sheet
```

## Editor Support

A first VS Code syntax-highlighting extension is available in:

- [editors/vscode-sheet/package.json](/Users/qianshuang/Project/WebProject/csv-enhance/editors/vscode-sheet/package.json)
- [editors/vscode-sheet/syntaxes/sheet.tmLanguage.json](/Users/qianshuang/Project/WebProject/csv-enhance/editors/vscode-sheet/syntaxes/sheet.tmLanguage.json)
- [editors/vscode-sheet/language-configuration.json](/Users/qianshuang/Project/WebProject/csv-enhance/editors/vscode-sheet/language-configuration.json)

This first iteration provides:

- `.sheet` file association
- `#` comment support
- syntax highlighting for directives, block keys, `name[type]`, `@func` signatures, and expressions

The next editor step is wiring the existing lint and diagnostics engine into inline warnings and errors.

These scripts compile:

- [examples/retail.sheet](/Users/qianshuang/Project/WebProject/csv-enhance/examples/retail.sheet) -> `examples/retail.xlsx`
- [examples/chinese-sales.sheet](/Users/qianshuang/Project/WebProject/csv-enhance/examples/chinese-sales.sheet) -> `examples/chinese-sales.xlsx`

Each table becomes one worksheet, and plots are stored in a `_plots` worksheet as structured metadata plus Vega-Lite JSON.

The bundled [examples/retail.sheet](/Users/qianshuang/Project/WebProject/csv-enhance/examples/retail.sheet) is a valid end-to-end input for the current DSL.
The bundled [examples/chinese-sales.sheet](/Users/qianshuang/Project/WebProject/csv-enhance/examples/chinese-sales.sheet) demonstrates Unicode table names, column names, compute targets, and plot dependencies.

`@func` defines a reusable pure expression in the same `.sheet` file:

```text
@func 税额(单价[number], 数量[number]) -> number
单价 * 数量 * 1.08
```

It can then be called from `@compute` just like a normal function call.
`@compute` is row-scoped only, so built-in cross-row aggregators such as `avg` or `max` are intentionally not supported.
Current builtin expression functions are `if`, `coalesce`, `and`, and `or`.

Comment lines starting with `#` are ignored during parsing.
If the first block does not start with `@`, it is parsed as an implicit `@table sheet` block for CSV compatibility.
Table columns support `name[type]`, for example `region[string]` or `qty[number]`.
Identifiers are Unicode-aware, so table names and column names such as `销售表` or `金额[number]` are valid.
If the type is omitted, the column starts as `dynamic` and each cell is parsed in `null -> number -> boolean -> string` order.
The current demo only models bar plots, and plot fields may only reference `number` columns.
`@compute` expressions are preserved in the file interface layer, parsed into AST plus semantic bindings in the analysis layer, and then materialized during runtime execution.
