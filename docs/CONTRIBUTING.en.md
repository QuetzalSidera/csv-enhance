# Contributing

Thanks for considering a contribution to CSVX.

This project is still young, which is good news: thoughtful changes can meaningfully improve the format, the tooling, and the learning experience.

The best contributions are not always the biggest ones.  
Clear examples, better diagnostics, smaller syntax improvements, and test coverage are all very valuable here.

---

## What Kind of Contributions Help Most

Contributions are especially welcome in these areas:

- language design improvements that keep CSVX lightweight and readable
- runtime correctness fixes
- editor support
- CLI polish
- plot and rendering improvements
- documentation and beginner experience
- examples and test coverage

When in doubt, optimize for:

- clarity
- consistency
- beginner readability
- predictable behavior

---

## Before You Start

It helps to quickly scan these documents first:

- [README.md](/Users/qianshuang/Project/WebProject/csv-enhance/README.md)
- [WIKI.en.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/WIKI.en.md)
- [REFERENCE.en.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/REFERENCE.en.md)
- [TYPE_SYSTEM.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/TYPE_SYSTEM.md)
- [ROADMAP.en.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/ROADMAP.en.md)

These give a good sense of:

- what CSVX is trying to be
- what is already implemented
- which tradeoffs are intentional

---

## Development Setup

Install dependencies:

```bash
npm install
```

Build the project:

```bash
npm run build
```

Run tests:

```bash
npm test
```

Package the VS Code extension:

```bash
npm run package:vscode-extension
```

---

## Project Principles

Please try to keep changes aligned with these principles:

### 1. CSVX should stay readable

If a new feature makes `.csvx` files much harder to read, it probably needs a second look.

### 2. CSVX should stay lightweight

The format should not drift toward a heavy, hard-to-explain mini-programming language.

### 3. AI-friendliness matters

Stable, low-ambiguity syntax is a real design goal here.

### 4. Strong typing should help, not intimidate

Type behavior should be predictable and explicit where it matters, without making small files feel burdensome.

### 5. Beginner experience matters

A feature can be technically correct and still be too hard to learn.  
Please consider the first-time reader as well as the advanced user.

---

## Code Style

Please keep changes:

- clear over clever
- small over sprawling
- explicit over magical

Additional guidance:

- prefer ASCII unless the file already uses Unicode meaningfully
- keep comments short and useful
- avoid unnecessary abstraction
- preserve the existing architecture where possible

If you touch parser, analyzer, runtime, or editor code, try to keep boundaries clean:

- file interface parses source
- analysis resolves meaning
- runtime executes
- editor consumes structured language data

---

## Tests

Tests are expected for behavior changes.

Especially add or update tests when you touch:

- parsing rules
- type behavior
- diagnostics
- runtime execution
- CLI output
- editor features

The project already uses fixture-based tests for several areas.  
When possible, prefer adding a small focused fixture instead of embedding very large strings directly in tests.

---

## Documentation Expectations

If a change affects the language or user-facing workflow, please update the relevant docs too.

Depending on the change, that may include:

- [WIKI.en.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/WIKI.en.md)
- [WIKI.zh-CN.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/WIKI.zh-CN.md)
- [REFERENCE.en.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/REFERENCE.en.md)
- [REFERENCE.zh-CN.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/REFERENCE.zh-CN.md)
- [BUILTINS.en.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/BUILTINS.en.md)
- [CLI.en.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/CLI.en.md)
- [ROADMAP.en.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/ROADMAP.en.md)

If the feature changes the beginner story, update the wiki.  
If it changes the exact grammar, update the reference.

---

## Commit Message Format

Please use:

```text
<type>(<scope>): <subject>
```

Allowed `type` values:

- `feat`
- `fix`
- `to`
- `docs`
- `style`
- `refactor`
- `perf`
- `test`
- `chore`
- `revert`
- `merge`
- `sync`

Examples:

```text
feat(editor): add builtin completion
fix(parser): preserve implicit table name
docs(wiki): simplify dynamic type explanation
test(runtime): cover grouped window output
```

Guidelines:

- keep the subject short
- prefer a concrete scope
- describe the actual user-facing change when possible

---

## Good First Contributions

If you are looking for a safe place to start, these are usually strong options:

- improve an error message
- add a focused test
- clarify a doc example
- add a small editor feature
- improve a beginner-facing explanation
- add a realistic `.csvx` example

These contributions often make a surprisingly large difference.

---

## When Proposing Bigger Language Changes

For syntax or semantics changes, please be especially careful about:

- readability
- backwards compatibility
- ambiguity
- editor implications
- AI generation stability

A feature that saves a few characters but makes files harder to understand is often not a good trade.

---

## Final Checklist Before Sending a Change

Before opening a PR or sharing a patch, it helps to check:

- the project still builds
- tests still pass
- docs match the new behavior
- examples still make sense
- the change fits the existing architecture

That is usually enough to keep changes easy to review.
