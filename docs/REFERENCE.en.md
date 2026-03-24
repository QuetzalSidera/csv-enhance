# CSVX Syntax Reference

This document is the syntax reference for advanced readers.

If you are new to CSVX, start with:

- [WIKI.en.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/WIKI.en.md)

---

## Supported Directives

### `@meta`

Stores simple key-value metadata.

```csvx
@meta
title: Weekly report
owner: finance
```

Rules:

- no block name
- `key: value` entries only
- keys must be valid identifiers

### `@plugin <alias>`

Declares a trusted external module alias.

```csvx
@plugin finance
path: ./plugins/finance.ts
exports: tax, bucket
```

Rules:

- `path:` is required
- `exports:` is optional
- relative paths resolve relative to the `.csvx` file

### `@table <name>`

Declares raw table data.

```csvx
@table sales
region[string],price[number],qty[number]
North,3,5
```

Rules:

- first row is the header
- headers must be unique
- row width must match header width

### `@func <signature>`

Declares a reusable pure function.

```csvx
@func tax(price[number], qty[number]) => number
subtotal[number] = price * qty;
return subtotal * 1.08;
```

Rules:

- multi-statement function body
- statements separated by `;`
- must contain `return`
- parameters and locals use `name[type]`, `name[row:type]`, or `name[col:type]`

### `@compute <table-name>`

Declares row-scoped computed columns.

```csvx
@compute sales
target: revenue[number]
revenue = price * qty
```

Rules:

- `target:` is required
- assignments not declared in `target:` are locals
- outputs materialize as table columns

### `@window <table-name>`

Declares sequence-scoped computed columns.

```csvx
@window sales
group: region
order: qty
target: running_revenue[number]
running_revenue = cumsum(revenue)
```

Rules:

- `target:` is required
- `group:` is optional
- `order:` is optional
- without `group:`, the whole table is one group
- without `order:`, file order is used

### `@plot <table-name>`

Declares a plot.

```csvx
@plot sales
deps: revenue,running_revenue
x: revenue
y: running_revenue
title: Revenue vs running revenue
```

Rules:

- `deps:` is required
- `x:` is required
- `y:` is required

---

## Comments

CSVX uses `#` for line comments.

```csvx
# comment
```

Any trimmed line starting with `#` is ignored.

---

## Identifiers

Identifiers are Unicode-aware.

Examples:

- `sales`
- `销售表`
- `含税销售额`

Used for:

- tables
- columns
- functions
- plugin aliases
- targets

---

## Types

### Element types

- `number`
- `string`
- `boolean`
- `null`
- `dynamic`

### Shape-aware declarations

```csvx
name[number]
name[row:number]
name[col:number]
```

Current practical rule:

- table/output contexts are column-oriented
- function/local contexts are scalar-oriented

### `dynamic`

`dynamic` values are parsed in this order:

1. `null`
2. `number`
3. `boolean`
4. `string`

Implicit `dynamic` columns may be inferred after parsing all rows.

Explicitly declared columns keep their declared type.

---

## Expressions

### Operators

- `+`
- `-`
- `*`
- `/`
- parentheses `()`

### Builtins

General builtins:

- `if`
- `coalesce`
- `and`
- `or`

Window-only builtins:

- `current`
- `lag`
- `lead`
- `first`
- `last`
- `row_number`
- `rank`
- `cumsum`

See:

- [BUILTINS.en.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/BUILTINS.en.md)

---

## Default Behaviors

- first block without `@` -> implicit `@table sheet`
- omitted type -> `dynamic`
- omitted `@window order:` -> file order
- omitted `@window group:` -> whole table as one group
- assignment not listed in `target:` -> local variable

---

## Visibility Rules

Can be referenced by later blocks:

- table columns
- `@compute` outputs
- `@window` outputs

Cannot be referenced outside their block:

- `@compute` locals
- `@window` locals
- `@func` locals
