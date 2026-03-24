<p align="center">
  <img src="./asset/Logo.webp" alt="CSVX logo" width="160" />
</p>

<h1 align="center">CSVX</h1>

<p align="center">
  Lightweight, AI-friendly, text-first spreadsheets.
</p>

<p align="center">
  <a href="https://github.com/QuetzalSidera/csv-enhance"><img alt="repo" src="https://img.shields.io/badge/GitHub-csv--enhance-111827?logo=github"></a>
  <img alt="npm" src="https://img.shields.io/badge/npm-csvx--lang-cb3837?logo=npm">
  <img alt="version" src="https://img.shields.io/badge/version-0.1.0-111827">
  <img alt="status" src="https://img.shields.io/badge/status-demo-f59e0b">
  <img alt="language" src="https://img.shields.io/badge/language-TypeScript-3178c6">
  <img alt="export" src="https://img.shields.io/badge/export-.xlsx-16a34a">
  <img alt="editor" src="https://img.shields.io/badge/editor-VS%20Code-007acc">
  <img alt="tests" src="https://img.shields.io/badge/tests-68%20passing-22c55e">
</p>

CSVX is a lightweight, AI-friendly, text-first spreadsheet format.

It sits in the space between:

- CSV
- spreadsheets
- structured data DSLs

CSVX is designed to be:

- easy to read in plain text
- friendly to version control
- expressive enough for computed columns and window columns
- compilable into `.xlsx`
- pleasant to work with in editors and automation flows

The npm package name is `csvx-lang`.
The installed CLI command remains `csvx`.

---

## At a Glance

- CSV-compatible table input
- typed columns
- `@compute` for row-scoped derived columns
- `@func` for reusable inline logic
- `@plugin` for trusted local TypeScript helpers
- `@window` for sequence-scoped columns
- `@plot` for declarative chart specs
- CLI for lint, compile, and `.xlsx` export
- VS Code extension with highlighting, diagnostics, hover, definition, references, and completion

---

## Documentation

All project documentation now lives under [docs](/Users/qianshuang/Project/WebProject/csv-enhance/docs).

### Beginner-friendly guides

- [WIKI.en.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/WIKI.en.md)
- [WIKI.zh-CN.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/WIKI.zh-CN.md)
- [AGENT.md](/Users/qianshuang/Project/WebProject/csv-enhance/AGENT.md)

### Reference docs

- [REFERENCE.en.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/REFERENCE.en.md)
- [REFERENCE.zh-CN.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/REFERENCE.zh-CN.md)

### Builtins

- [BUILTINS.en.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/BUILTINS.en.md)
- [BUILTINS.zh-CN.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/BUILTINS.zh-CN.md)

### CLI

- [CLI.en.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/CLI.en.md)
- [CLI.zh-CN.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/CLI.zh-CN.md)

### Contributing

- [CONTRIBUTING.en.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/CONTRIBUTING.en.md)
- [CONTRIBUTING.zh-CN.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/CONTRIBUTING.zh-CN.md)

### Project notes

- [ROADMAP.en.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/ROADMAP.en.md)
- [ROADMAP.zh-CN.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/ROADMAP.zh-CN.md)
- [TYPE_SYSTEM.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/TYPE_SYSTEM.md)
- [CHANGELOG.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/CHANGELOG.md)
- [RELEASING.en.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/RELEASING.en.md)

---

## Quick Start

Build the project:

```bash
npm run build
```

Run tests:

```bash
npm test
```

Try the CLI:

```bash
node dist/cli/csvx.js lint ./examples/retail.csvx
node dist/cli/csvx.js compile ./examples/retail.csvx
node dist/cli/csvx.js xlsx ./examples/retail.csvx
```

---

## Current Status

CSVX currently supports:

- typed tables
- `@compute`
- `@func`
- `@plugin`
- `@window`
- `@plot`
- `.xlsx` export
- CLI workflows
- first-pass editor tooling

VS Code support is currently the most complete editor experience.
