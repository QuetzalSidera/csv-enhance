# `.sheet` Editor Token Classes

This document defines the editor-facing token taxonomy for `.sheet` files.
The VS Code grammar should map syntax into these semantic roles first, then
choose TextMate scopes that align with common TypeScript themes.

## Design Goals

- Keep language keywords visually distinct from user-defined names.
- Highlight declarations and references consistently.
- Avoid styling raw table cell data as if it were code.
- Prefer scopes that most VS Code themes already color in a familiar way.

## Token Classes

### 1. Directive Keywords

Examples:

- `@meta`
- `@plugin`
- `@table`
- `@func`
- `@compute`
- `@plot`

Meaning:

- Block-level language keywords.

Suggested scope family:

- `keyword.control.directive`

Expected look:

- Similar to TypeScript keywords such as `const`, `function`, `return`.

### 2. Block Identifiers

Examples:

- `sales` in `@table sales`
- `sales` in `@compute sales`
- `sales` in `@plot sales`
- `finance` in `@plugin finance`
- `税额` in `@func 税额(...)`

Meaning:

- User-defined top-level named symbols declared by a block header.

Suggested scope family:

- Table / compute / plot table names: `entity.name.type`
- Plugin aliases: `entity.name.type`
- Function names: `entity.name.function`

Expected look:

- Distinct from keywords and properties.

### 3. Mapping Keys

Examples:

- `target`
- `deps`
- `path`
- `exports`
- `x`
- `y`
- `color`
- `title`
- keys inside `@meta`

Meaning:

- Structured object-like keys inside blocks.

Suggested scope family:

- `variable.object.property`

Expected look:

- Similar to object property names in TypeScript themes.

### 4. Declared Column-Like Names

Examples:

- `region` in `region[string]`
- `price` in `price[number]`
- `含税销售额` in `target: 含税销售额[number]`
- `含税销售额` in `target: 含税销售额[number]`

Meaning:

- Column declarations in schema-like positions.

Suggested scope family:

- `variable.other.member`

Expected look:

- Different from mapping keys and different from raw table cell values.

### 5. Column References

Examples:

- `price` in `deps: price, qty`
- `x: price`
- `销售额` in `含税销售额 = 财务插件.tax(销售额)`

Meaning:

- References to existing table or compute columns.

Suggested scope family:

- `variable.other.readwrite`

### 6. Types

Examples:

- `number`
- `string`
- `boolean`
- `null`
- `dynamic`

Meaning:

- Primitive DSL type names.

Suggested scope family:

- `storage.type.primitive`

### 7. Functions

Examples:

- `if`
- `coalesce`
- `and`
- `or`
- `tax` in `plugin.tax(...)`
- `bucket` in `plugin.bucket(...)`
- local `@func` calls

Meaning:

- Callable names in expressions.

Suggested scope family:

- Builtins: `support.function.builtin`
- Plugin/local functions: `entity.name.function`
- Plugin alias before dot: `entity.name.type`

### 8. Operators And Punctuation

Examples:

- `=`
- `+`
- `-`
- `*`
- `/`
- `:`
- `,`
- `.`
- `(`
- `)`
- `[`
- `]`

Meaning:

- Expression and declaration punctuation.

Suggested scope family:

- `keyword.operator.*`
- `punctuation.*`

### 9. Literals

Examples:

- `1`
- `3.14`
- `true`
- `false`
- `null`

Meaning:

- Expression literals.

Suggested scope family:

- `constant.numeric`
- `constant.language.boolean`
- `constant.language.null`

### 10. Raw Table Cell Data

Examples:

- `North`
- `apple`
- `online`

Meaning:

- CSV-like data payload inside `@table`.

Suggested scope family:

- No special identifier-style highlighting by default.

Expected look:

- Plain text unless part of a type declaration or expression syntax.
