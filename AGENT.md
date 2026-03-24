# AGENT.md

This document is the single best entry point for an AI agent that needs to understand this repository, explain it, or generate valid `.csvx` files.

## What CSVX is

CSVX is a lightweight, text-first spreadsheet format.

It combines:

- CSV-style tabular data
- typed columns
- row-level computed columns
- window columns
- declarative plot definitions
- compilation to `.xlsx`

The design goals are:

- human-readable
- AI-friendly
- deterministic
- easy to diff in version control
- extensible without becoming a full spreadsheet binary format

## Core mental model

Think in layers:

1. `@table`
   - defines typed tabular data
2. `@compute`
   - adds new columns from row-scoped expressions
3. `@window`
   - adds new columns from sequence-scoped expressions
4. `@plot`
   - declares chart specs
5. CLI / runtime
   - lint, compile, export `.xlsx`
6. editor support
   - syntax highlighting, diagnostics, hover, definition, references, completion

CSVX is not trying to be full Excel.
It is trying to be a compact, inspectable, programmable spreadsheet text format.

## File format overview

### Smallest valid CSVX

CSVX is compatible with plain CSV-like table input.

```csvx
item[string],price[number],count[number]
apple,1.99,3
banana,2.50,4
```

If the first non-comment block does not start with a directive like `@table`, the parser treats it as an implicit table named `sheet`.

Equivalent explicit form:

```csvx
@table sheet
item[string],price[number],count[number]
apple,1.99,3
banana,2.50,4
```

### Supported directives

- `@meta`
- `@plugin <alias>`
- `@table <name>`
- `@func <signature>`
- `@compute <table-name>`
- `@window <table-name>`
- `@plot <table-name>`

## Type system

### Column element types

- `string`
- `number`
- `boolean`
- `null`
- `dynamic`

### Shape model

The project distinguishes between:

- scalar values
- column values

Current active semantics:

- `name[number]`
  - scalar in `@func` parameter/local contexts
  - column in table/output declaration contexts
- `name[col:number]`
  - explicit column-shaped declaration
- `name[row:number]`
  - reserved syntax space, not a main execution path yet

### Dynamic behavior

When a column is implicitly `dynamic`, each cell is parsed in this order:

1. `null`
2. `number`
3. `boolean`
4. `string`

Then the whole column is reconsidered:

- if all parsed cells are one stable type, the column narrows to that type
- if cells mix types, the column stays `dynamic`

Important:

- `dynamic` is a column-level state
- each cell still has a concrete runtime type

## Expressions

CSVX expressions do not use Excel-style cell references.
They use named columns, locals, function calls, and builtins.

### Operators

- `+`
- `-`
- `*`
- `/`
- parentheses

### General builtins

- `if`
- `coalesce`
- `and`
- `or`

These are allowed in row and function contexts.

### Window-only builtins

- `current`
- `lag`
- `lead`
- `first`
- `last`
- `row_number`
- `rank`
- `cumsum`

These are only valid in `@window`.

If they are used in `@compute` or `@func`, analysis fails at compile time.

## Block semantics

### `@table`

Defines a named table.

```csvx
@table sales
region[string],item[string],price[number],count[number]
North,apple,1.99,3
South,banana,2.50,4
```

### `@compute`

Adds row-scoped computed columns.

```csvx
@compute sales
target: revenue[number]
revenue = price * count
```

Rules:

- `target:` declares public output columns
- assignments whose left side is not in `target:` are locals
- locals may be typed or inferred
- `@compute` cannot use window-only builtins

Typed and inferred locals:

```csvx
@compute sales
target: taxed[number]
base[number] = price * count
taxed = base * 1.1
```

```csvx
@compute sales
target: taxed[number]
base = price * count
taxed = base * 1.1
```

### `@func`

Defines reusable inline functions.

```csvx
@func tax(base[number]) => number
return base * 1.1;
```

Multi-statement form is supported:

```csvx
@func tax(price[number], count[number]) => number
base[number] = price * count;
return base * 1.1;
```

Rules:

- functions are pure
- they can use parameters, locals, builtins, and other allowed expression constructs
- they cannot directly access table columns
- non-scalar functions are not valid in scalar compute expressions

### `@plugin`

Loads trusted local TypeScript/JavaScript helper functions.

```csvx
@plugin finance
path: ./plugins/finance.ts
exports: tax, bucket
```

Rules:

- `path` is resolved relative to the current `.csvx` file
- `exports` must point to exported functions
- TypeScript return types are inspected when possible and used for analysis

### `@window`

Adds sequence-scoped computed columns.

```csvx
@window sales
group: region
order: count
target: running_revenue[number], previous_revenue[number]
running_revenue = cumsum(revenue)
previous_revenue = lag(revenue, 1)
```

Rules:

- `group:` is optional
- `order:` is optional
- if `order:` is omitted, file order is used
- outputs become new columns that later blocks can reference

### `@plot`

Defines a declarative chart spec.

```csvx
@plot sales
deps: revenue,taxed_revenue
x: revenue
y: taxed_revenue
title: Revenue vs Taxed Revenue
```

Rules:

- current implementation is bar-oriented
- plot dependencies must be declared in `deps:`
- plots compile to Vega-Lite JSON
- `.xlsx` export preserves plot metadata in a `_plots` sheet

## Comments and CSV parsing

- lines starting with `#` are comments and are ignored
- this also means a table row that starts with `#` is currently treated as a comment
- quoted CSV fields are supported
- unterminated quotes are parser errors

Whitespace note:

- blank or whitespace-only cells are treated as null-like empty cells

## Execution pipeline

### Parsing

Main files:

- `src/file-interface/parser.ts`
- `src/file-interface/parser/blocks/*`

The parser builds block-level structures and preserves source ranges for diagnostics and editor tooling.

### Analysis

Main files:

- `src/analysis/analyzer.ts`
- `src/expression/parser.ts`
- `src/expression/semantics.ts`

The analyzer resolves:

- names
- types
- builtin availability by context
- function/plugin bindings
- plot dependencies
- diagnostics and warnings

### Runtime

Main files:

- `src/runtime/compute-executor.ts`
- `src/runtime/window-executor.ts`
- `src/runtime/document-executor.ts`
- `src/runtime/plot-compiler.ts`
- `src/runtime/xlsx-adapter.ts`

The runtime:

- materializes computed columns
- materializes window columns
- compiles plot specs
- exports `.xlsx`

## Diagnostics model

Diagnostics are structured and centralized.

Main files:

- `src/diagnostics/error/*`
- `src/diagnostics/warning/*`

Important properties:

- phase-specific diagnostics
- structured ranges
- bilingual message metadata in diagnostic catalogs
- warnings are distinct from errors

This is important for:

- CLI output
- lint rules
- editor red/yellow squiggles

## Editor support

Main language service files:

- `src/editor/language-service.ts`
- `src/editor/symbol-collector.ts`
- `src/editor/symbol-query.ts`
- `src/editor/completion.ts`

VS Code extension:

- `editors/vscode-sheet/`

Current editor features:

- syntax highlighting
- diagnostics
- hover
- go to definition
- find references
- completion

## CLI

Main CLI entrypoints:

- `dist/cli/csvx.js`
- `dist/cli/sheet.js`

Supported commands:

- `csvx lint <file.csvx>`
- `csvx compile <file.csvx>`
- `csvx xlsx <file.csvx> [-o output.xlsx]`

## How to generate valid CSVX

If you are generating `.csvx`, prefer this order of complexity:

1. start with a plain table
2. add explicit column types where obvious
3. add `@compute` for row-scoped columns
4. add `@func` only if logic repeats
5. add `@plugin` only if inline `@func` is not enough
6. add `@window` only when cross-row logic is truly needed
7. add `@plot` last

### Good generation habits

- prefer explicit numeric/string/boolean types for stable columns
- keep identifiers simple and stable
- prefer `count` over domain abbreviations like `qty` for beginner-facing examples
- use `target:` explicitly
- keep `@window` examples small
- use `group:` only when grouping is semantically needed
- use `order:` only when the sequence meaning matters

### Common mistakes to avoid

- using `lag` / `cumsum` inside `@compute`
- assuming `dynamic` means each cell is untyped
- treating `@plot` as image output instead of declarative chart output
- assuming plugin paths resolve from process cwd instead of the current `.csvx` file
- writing examples that are too big for first-time readers

## Example of a good compact CSVX file

```csvx
item[string],price[number],count[number]
apple,1.99,3
banana,2.50,4

@compute sheet
target: revenue[number]
revenue = price * count

@plot sheet
deps: price,revenue
x: price
y: revenue
title: Price vs Revenue
```

## Where to look next

For human-facing docs:

- `docs/WIKI.en.md`
- `docs/REFERENCE.en.md`
- `docs/BUILTINS.en.md`
- `docs/CLI.en.md`
- `docs/TYPE_SYSTEM.md`

For contributor context:

- `docs/CONTRIBUTING.en.md`
- `docs/ROADMAP.en.md`
- `docs/CHANGELOG.md`
