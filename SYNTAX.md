# `.sheet` Syntax Guide

This document describes the currently implemented `.sheet` DSL in this repository.

## Overview

A `.sheet` file is a sequence of blocks.
Supported directives are:

- `@meta`
- `@plugin <alias>`
- `@table <name>`
- `@func <signature>`
- `@compute <table-name>`
- `@plot <table-name>`

If the first non-comment block does not start with `@`, it is treated as an implicit:

```text
@table sheet
```

This keeps plain CSV-compatible files valid.

## Comments

Lines starting with `#` are ignored.

Example:

```text
# Sales input
region,amount
North,10
```

Current limitation:
If a full table row starts with `#`, it is also treated as a comment line.

## Identifiers

Identifiers are Unicode-aware.
This means names such as `sales`, `销售表`, `金额`, and `含税销售额` are valid.

They are used for:

- table names
- function names
- plugin aliases
- column names
- compute targets
- plot dependencies

## Types

Supported scalar types are:

- `dynamic`
- `string`
- `number`
- `boolean`
- `null`

### Column Declaration

Columns use:

```text
name[type]
```

Examples:

```text
region[string]
qty[number]
active[boolean]
note[null]
```

If the type is omitted:

```text
qty
```

the declared type is `dynamic`.

### `dynamic` Behavior

For `dynamic` cells, parsing is attempted in this order:

1. `null`
2. `number`
3. `boolean`
4. `string`

Parsing short-circuits at the first successful match.

For implicit `dynamic` columns:

- the column starts as `dynamic`
- after the full column is parsed, it may be inferred as `number`, `string`, or `boolean`
- if values are mixed, the column remains `dynamic`

For explicitly declared columns:

- parsing is forced according to the declared type
- parse failure is an error
- the declared type is not changed by inference

## `@meta`

`@meta` stores simple key-value metadata.

Example:

```text
@meta
title: Weekly report
owner: finance
```

Rules:

- no block name is allowed
- each entry uses `key: value`
- keys must be valid identifiers

## `@plugin`

`@plugin` declares a trusted external module alias.

Example:

```text
@plugin finance
path: ./plugins/finance.ts
exports: tax, bucket
```

Rules:

- `path:` is required
- `exports:` is optional
- relative paths are resolved relative to the `.sheet` file itself
- plugin functions are trusted extensions

Plugin calls use:

```text
finance.tax(price, qty)
```

## `@table`

`@table` stores raw CSV-like tabular data.

Example:

```text
@table sales
region[string],price[number],qty[number]
North,3,5
South,4,6
```

Rules:

- first row is the header
- headers must be unique
- rows must have the same number of cells as the header
- quoted CSV values are supported

## `@func`

`@func` defines a reusable pure expression in the same file.

Example:

```text
@func tax(price[number], qty[number]) -> number
price * qty * 1.08
```

Rules:

- the signature is written on the directive line
- the function body must contain exactly one expression
- parameters use the same type syntax as columns
- functions are pure
- functions may reference only:
  - their own parameters
  - other `@func`
  - builtin expression functions
- functions may not directly reference table columns
- recursive function calls are rejected

## `@compute`

`@compute` defines row-scoped computed columns for an existing table.

Example:

```text
@compute sales
target: revenue[number], taxed[number]
revenue = price * qty
taxed = tax(price, qty)
```

Rules:

- `target:` is required
- `target:` declares the output columns that become part of the table
- non-target assignments are treated as local variables
- local variables can be referenced by later statements in the same block
- `@compute` is row-scoped only
- cross-row aggregate builtins such as `avg` and `max` are not supported

## `@plot`

Current plot support is bar-only.

Example:

```text
@plot sales
deps: price, qty
x: price
y: qty
title: Price vs quantity
```

Shorthand form:

```text
@plot sales
bar price qty
```

Rules:

- the block name must be an existing table name
- `deps:` declares the columns the plot depends on
- `x` and `y` are required
- `color` and `title` are optional
- `x`, `y`, and `color` must be listed in `deps:`
- plot fields currently only support numeric columns in the implemented flow

## Expressions

Expressions are used in `@func` and `@compute`.

Supported syntax:

- number literals
- identifier references
- function calls
- unary `-`
- binary `+ - * /`
- parentheses

Examples:

```text
price * qty
-(amount / 2)
tax(price, qty)
```

## Builtin Expression Functions

Currently implemented builtin functions are:

- `if(cond, thenValue, elseValue)`
- `coalesce(a, b, ...)`
- `and(a, b, ...)`
- `or(a, b, ...)`

### `if`

Example:

```text
if(active, price, fallback)
```

Behavior:

- argument 1 must be boolean-compatible
- only the selected branch is evaluated

### `coalesce`

Example:

```text
coalesce(primary, backup, "n/a")
```

Behavior:

- returns the first non-null value
- arguments are evaluated left to right

### `and` / `or`

Examples:

```text
and(leftFlag, rightFlag)
or(leftFlag, rightFlag)
```

Behavior:

- arguments must be boolean-compatible
- evaluation is short-circuiting

## Current Execution Model

The implemented pipeline is:

1. read `.sheet`
2. parse blocks
3. resolve plugin modules
4. analyze expressions and types
5. execute `@compute`
6. execute `@plot`
7. optionally compile plots to Vega-Lite
8. optionally export tables and plot metadata to `.xlsx`
