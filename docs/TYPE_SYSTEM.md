# CSVX Type System

This document defines the current and planned type model for `.csvx`.

The goal is to keep the language:

- readable
- AI-friendly
- statically analyzable
- compatible with future row-scope, sequence-scope, and aggregate features

## Overview

CSVX types have two dimensions:

1. element type
2. value shape

The element type describes the kind of each scalar value.
The value shape describes whether the value is a single scalar or a whole column of values.

## Element Types

CSVX currently supports these element types:

- `number`
- `string`
- `boolean`
- `null`
- `dynamic`

`dynamic` means the value is not statically fixed to a single known element type.

## Value Shapes

CSVX currently recognizes these shapes:

- `scalar`
- `column`

There is also a reserved shape name:

- `row`

`row` is intentionally not part of the active semantic model yet.

## Declaration Syntax

CSVX uses a unified declaration syntax:

```text
name[number]
name[row:number]
name[col:number]
```

### Meaning

- `name[number]`
  - default-shape declaration
- `name[row:number]`
  - explicit row-shape declaration
- `name[col:number]`
  - explicit column-shape declaration

### Context Defaults

The same syntax may resolve differently depending on context.

Current defaults:

- table columns
  - `name[number]` means a table column with element type `number`
- compute targets
  - `name[number]` means an output table column with element type `number`
- compute locals
  - `name[number]` means a scalar local value with element type `number`
- func parameters
  - `name[number]` means a scalar parameter with element type `number`
- func locals
  - `name[number]` means a scalar local value with element type `number`

This defaulting rule is intentional:

- table and output contexts are column-oriented
- expression and function-local contexts are scalar-oriented

## Why `row:*` Is Reserved

In spreadsheets and tabular data, rows are usually heterogeneous.

For example:

```text
region[string], qty[number], active[boolean]
```

The row contains different element types, so a declaration like `name[row:number]` has very limited practical meaning.

Because of that:

- `row:*` remains reserved syntax
- parser support may exist
- semantic execution support should not rely on it yet

The project should not build major runtime behavior around `row:*` until there is a concrete use case.

## Current Execution Model

### `@table`

`@table` defines materialized table columns.

Example:

```text
@table sales
region[string],price[number],qty[number]
North,3,5
```

Each declared table column is a column-shaped value in the table model.

## `@compute`

`@compute` is row-scoped.

Example:

```text
@compute sales
target: revenue[number]
revenue = price * qty
```

Semantic model:

- expressions execute once per row
- references such as `price` and `qty` are scalar values from the current row
- locals inside `@compute` are scalar
- outputs are materialized as a new table column

So `@compute` is best understood as:

- input: scalar values from the current row
- output: a new column after evaluating all rows

## `@func`

Current `@func` should remain scalar-oriented.

Example:

```text
@func tax(price[number], qty[number]) => number
amount[number] = price * qty;
return amount * 1.08;
```

Semantic model:

- parameters are scalar by default
- local assignments are scalar by default
- `return` currently participates in scalar expression flow

This is the safest base for reuse from `@compute`.

## Future Sequence Layer

Future sequence-style computation should not be modeled as a scalar-returning block.

Instead, sequence computation should also produce a column.

Intended model:

- input: one or more columns, plus ordering and optional partition context
- output: one new column

That means future `@window` or `@sequence` should behave more like `@compute` than like an aggregate.

Examples of sequence outputs:

- `lag`
- `lead`
- `row_number`
- `rank`
- `cumsum`

All of these produce one value per row, which means the result is column-shaped.

## Future Aggregate Layer

Aggregate logic is a separate concern.

Examples:

- `sum`
- `avg`
- `min`
- `max`

These typically consume a column and produce a single scalar.

That means future aggregate behavior should be modeled separately from both:

- `@compute`
- `@window` / `@sequence`

Recommended future direction:

- `@compute`
  - row scope
  - produces columns
- `@window` or `@sequence`
  - sequence scope
  - produces columns
- `@aggregate`
  - table scope
  - produces scalars

## Reference Rules

Values created by `@compute` should be referenceable by later blocks because they become table columns.

Likewise, values created by future sequence blocks should also be referenceable by later blocks if they materialize as new columns.

This is the key consistency rule:

- if a block produces a new column, later blocks may reference it by name

## Recommended Near-Term Constraints

To keep the implementation stable, the project should follow these constraints for now:

- keep `@func` scalar-only in effective execution semantics
- treat `row:*` as reserved
- keep `@compute` row-scoped only
- keep cross-row sequence logic out of `@compute`
- introduce sequence semantics in a dedicated block later
- introduce aggregate scalar semantics in a separate dedicated block later

## Summary

The current recommended mental model is:

- scalar element types: `number`, `string`, `boolean`, `null`, `dynamic`
- active shapes: `scalar`, `column`
- reserved shape: `row`
- `@compute` consumes row scalars and materializes columns
- future sequence blocks should also materialize columns
- future aggregate blocks should produce scalars

This separation keeps CSVX easier to learn, easier to analyze, and easier to extend.
