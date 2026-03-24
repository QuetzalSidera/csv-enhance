# `.csvx` VS Code Language Support

This extension provides the first editor integration layer for `.csvx` files:

- `.csvx` file association
- `.sheet` legacy compatibility association
- `#` comment support
- bracket and quote pairing
- inline diagnostics powered by the project linter
- TextMate syntax highlighting for:
  - block directives such as `@table` and `@compute`
  - `target:` / `deps:` / `x:` / `y:` / `title:` keys
  - `name[type]` column declarations
  - `@func` signatures
  - arithmetic operators
  - builtin functions such as `if`, `coalesce`, `and`, and `or`

This version does not yet provide:

- hover
- completion
- go to definition

## Package As VSIX

From the project root:

```bash
npm run package:vscode-extension
```

This generates:

`editors/vscode-sheet/csvx-language-support-0.1.0.vsix`

## Install In VS Code

1. Open VS Code.
2. Run `Extensions: Install from VSIX...`
3. Select the generated `.vsix` file.

## Load In VS Code (Development)

1. Open VS Code.
2. Open this folder:

   `editors/vscode-sheet`
3. Press `F5`.
4. Test `.csvx` or `.sheet` files in the new Extension Development Host window.

## Next Step

The next planned iteration is to add richer editor features on top of diagnostics, such as hover, completion, and go-to-definition for `@func`, table columns, and block references.
