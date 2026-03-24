# Releasing

This document describes the release flow for CSVX.

## Versioning

CSVX uses a pragmatic semantic versioning style:

- `MAJOR`
  - incompatible syntax or runtime behavior changes
  - breaking CLI changes
  - breaking editor protocol or public API changes
- `MINOR`
  - new language features
  - new builtins
  - new CLI commands
  - editor capabilities added without breaking existing behavior
- `PATCH`
  - bug fixes
  - diagnostics improvements
  - documentation fixes
  - test and packaging fixes

Examples:

- `0.1.0`
  - first public demo release
- `0.2.0`
  - new language feature such as richer plot syntax or more window builtins
- `0.1.1`
  - parser fix, editor fix, packaging fix, or documentation correction

## Release Checklist

Before publishing:

1. Run the full test suite
   - `npm test`
2. Build the package
   - `npm run build`
3. Verify the npm tarball locally
   - `npm pack`
4. Verify the VS Code extension package
   - `npm run package:vscode-extension`
5. Confirm examples still compile
   - `node examples/compile-retail.js`
   - `node examples/compile-chinese-sales.js`
6. Update `docs/CHANGELOG.md`
7. Check the package version in `package.json`

## npm Publishing

The npm package name is:

- `csvx-lang`

Recommended release command:

```bash
npm publish --access public
```

If you want to validate contents before publishing:

```bash
npm pack
tar -tf csvx-lang-<version>.tgz
```

## VS Code Extension Publishing

This repository currently builds the extension package locally as a `.vsix`.

Build command:

```bash
npm run package:vscode-extension
```

Current output location:

- `editors/vscode-sheet/csvx-language-support-<version>.vsix`

## Notes

- The npm package and the VS Code extension do not need to share the same version forever, but keeping them aligned is simpler during the demo phase.
- If a release only changes docs, examples, or tests, a patch version is usually enough.
- If a release changes the beginner-facing language story, update the wiki as part of the release.
