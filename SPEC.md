# `.sheet` Specification

`.sheet` is a lightweight spreadsheet DSL for tables, computed columns, declarative charts, trusted plugin calls, and direct `.xlsx` generation.

## Goals

- Single text file as the primary source
- Human-readable and low-token
- Deterministic parsing and execution
- Safe core expression language
- Optional trusted extension layer for TypeScript plugins
- Direct compilation to `.xlsx`

## Directives

```text
@meta
@plugin <alias>
@table <name>
@compute <table-name>
@plot <table-name>
```

The document is a sequence of blocks. A block body runs until the next directive or end of file.

## EBNF

```ebnf
document      = { blank-line | block } ;

block         = meta-block
              | plugin-block
              | table-block
              | compute-block
              | plot-block ;

meta-block    = "@meta" newline { meta-line | blank-line } ;
meta-line     = identifier ":" ws? text newline ;

plugin-block  = "@plugin" ws identifier newline
                plugin-line
                { plugin-line | blank-line } ;
plugin-line   = ("path" | "exports") ":" ws? text newline ;

table-block   = "@table" ws identifier newline
                csv-header newline
                { csv-row newline | blank-line } ;

compute-block = "@compute" ws identifier newline
                { compute-line newline | blank-line } ;
compute-line  = identifier ws? "=" ws? expression ;

plot-block    = "@plot" ws identifier newline
                ( plot-short-hand newline
                | { plot-line newline | blank-line } ) ;
plot-short-hand = plot-type ws identifier ws identifier [ ws identifier ] ;
plot-line     = plot-key ":" ws? text newline ;

expression    = term { ("+" | "-") term } ;
term          = factor { ("*" | "/") factor } ;
factor        = number
              | identifier
              | "-" factor
              | "(" expression ")"
              | function-call ;
function-call = function-name "(" [ expression { "," expression } ] ")" ;
function-name = identifier | qualified-name ;
qualified-name = identifier "." identifier ;

plot-key      = "type" | "x" | "y" | "color" | "title" ;
plot-type     = "bar" | "line" | "point" | "area" ;
identifier    = letter { letter | digit | "_" } ;
```

## Semantics

### `@meta`

Optional string metadata.

```text
@meta
title: Sales workbook
owner: finance
```

### `@plugin`

Declares a trusted plugin alias backed by a local `.ts`, `.js`, or `.cjs` module.

```text
@plugin plugin
path: ./plugins/finance.ts
exports: tax, bucket
```

Rules:

- `path` is required.
- `exports` is optional. If omitted, all function exports are exposed.
- Plugin modules must export pure functions from scalar inputs to scalar outputs.
- Supported scalar types: `number`, `string`, `boolean`, `null`.
- Plugin execution is intentionally outside the safe-core model. It is a trusted extension boundary.

### `@table`

CSV-like raw data.

- First non-blank row is the header.
- Headers must be unique identifiers.
- Double-quoted CSV cells are supported.
- Empty cells become `null`.

Type inference is column-oriented:

- `number`
- `boolean`
- `string`
- `null`

### `@compute`

Column-based expressions evaluated row by row.

```text
@compute sales
revenue = price * qty
taxed = plugin.tax(price, qty)
```

Rules:

- No A1 references.
- Statements execute top-to-bottom.
- Built-in operators: `+ - * / ()`
- Plugin calls use qualified names: `<alias>.<function>(...)`
- Plugin functions execute per row and receive evaluated scalar arguments.
- `@compute` is row-scoped and does not support cross-row aggregate functions.

### `@plot`

Declarative plot definition compiled to Vega-Lite JSON.

Shorthand:

```text
@plot sales
bar item revenue
```

Expanded:

```text
@plot sales
type: bar
x: item
y: revenue
color: region
title: Revenue by region
```

## Execution Model

Execution order is document order:

1. Parse source into AST blocks.
2. Register `@plugin` modules.
3. Load `@table` data.
4. Apply `@compute` blocks.
5. Compile `@plot` blocks.
6. Optionally emit `.xlsx` from final table state.

Later blocks may only refer to earlier tables or plugins.

## Safety Model

Two execution tiers exist:

- Safe core:
  - table parsing
  - built-in arithmetic
  - built-in aggregate functions
  - plot compilation
- Trusted extension mode:
  - `@plugin` loading
  - local TypeScript or JavaScript execution

The core engine never uses `eval`. Plugin modules are trusted code and should be treated like application extensions.

## XLSX Compilation

The reference implementation writes a minimal valid `.xlsx` package:

- one worksheet per table
- header row from table columns
- computed values materialized into worksheet cells
- string, number, boolean, and blank cell support

Charts are not embedded into the workbook in this prototype; they compile separately to Vega-Lite JSON.

## Example

```text
@plugin plugin
path: ./plugins/finance.ts

@table sales
item,price,qty
apple,3,5
banana,2,10

@compute sales
revenue = price * qty
taxed = plugin.tax(price, qty)

@plot sales
bar item taxed
```
