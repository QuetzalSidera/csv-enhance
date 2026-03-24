# Changelog

All notable changes to CSVX should be documented in this file.

The format is intentionally simple and human-readable.

---

## [0.1.0] - 2026-03-24

Initial public demo release.

### Added

- `.csvx` as the preferred public file extension, with `.sheet` kept as a compatibility alias
- block-based text format with:
  - `@meta`
  - `@plugin`
  - `@table`
  - `@func`
  - `@compute`
  - `@window`
  - `@plot`
- CSV-compatible first-block parsing with implicit `@table sheet`
- strong table column typing with explicit declarations and dynamic inference
- expression parsing and semantic analysis
- row-scoped computed columns via `@compute`
- local reusable pure functions via `@func`
- external trusted plugin support via `@plugin`
- sequence-scoped computed columns via `@window`
- built-in expression functions including:
  - `if`
  - `coalesce`
  - `and`
  - `or`
  - `lag`
  - `lead`
  - `current`
  - `first`
  - `last`
  - `row_number`
  - `rank`
  - `cumsum`
- Vega-Lite plot compilation for bar-style plot definitions
- `.xlsx` export with table worksheets and `_plots` metadata sheet
- end-to-end compiler facade and CLI commands:
  - `csvx lint`
  - `csvx compile`
  - `csvx xlsx`
- diagnostics infrastructure with:
  - parser / analysis / runtime phases
  - warnings
  - structured ranges
  - message catalogs
- fixture-based and editor-oriented automated tests
- first-pass VS Code extension support with:
  - syntax highlighting
  - diagnostics
  - hover
  - go to definition
  - references
  - completion

### Documentation

- beginner wiki in Chinese and English
- syntax reference in Chinese and English
- builtins guide
- CLI guide
- type-system notes
- roadmap

### Known limitations at release time

- `@plot` is still prototype-shaped and currently centered on Vega-Lite metadata output
- chart image rendering is not implemented yet
- editor support is currently strongest in VS Code; JetBrains support is not yet implemented
- comment handling still treats any fully trimmed `#` line as a comment, including inside table sections
