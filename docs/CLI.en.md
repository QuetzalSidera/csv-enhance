# CSVX CLI Guide

This document tracks the command-line interface for `.csvx`.

## Status

Current CLI support is intentionally minimal.

Implemented:

- `csvx lint <file.csvx>`
- `csvx compile <file.csvx>`
- `csvx xlsx <file.csvx> [-o <output.xlsx>]`

The CLI now exposes both validation and compilation flows.

## Build

Before using the local CLI entry, build the project:

```bash
npm run build
```

## Local Usage

Run the compiled CLI directly:

```bash
node dist/cli/csvx.js lint ./examples/retail.csvx
node dist/cli/csvx.js compile ./examples/retail.csvx
node dist/cli/csvx.js xlsx ./examples/retail.csvx
```

## Installed Binary Usage

Install the npm package:

```bash
npm install -g csvx-lang
```

After installation, use:

```bash
csvx lint ./examples/retail.csvx
csvx compile ./examples/retail.csvx
csvx xlsx ./examples/retail.csvx
```

Legacy compatibility alias:

```bash
sheet lint ./examples/retail.csvx
```

## Output

`csvx lint` runs:

- parser validation
- semantic analysis
- built-in warnings
- custom lint rules

`csvx compile` runs the full pipeline and prints:

- number of evaluated tables
- table row/column summary
- number of compiled plots

`csvx xlsx` runs the same pipeline and writes an `.xlsx` workbook.
If `-o` is omitted, the output path defaults to the source file with the `.xlsx` extension.

Exit code behavior:

- `0`: no errors
- `1`: at least one error

Warnings are still printed, but do not make the command fail on their own.

## Current Limitation

The CLI does not yet expose:

- batch processing
- machine-readable JSON output

Bundled example scripts are still available:

```bash
node examples/compile-retail.js
node examples/compile-chinese-sales.js
```

## Related Files

- [src/cli/app.ts](/Users/qianshuang/Project/WebProject/csv-enhance/src/cli/app.ts)
- [src/cli/csvx.ts](/Users/qianshuang/Project/WebProject/csv-enhance/src/cli/csvx.ts)
- [src/cli/sheet.ts](/Users/qianshuang/Project/WebProject/csv-enhance/src/cli/sheet.ts)
- [src/cli/format.ts](/Users/qianshuang/Project/WebProject/csv-enhance/src/cli/format.ts)
- [src/runtime/sheet-compiler.ts](/Users/qianshuang/Project/WebProject/csv-enhance/src/runtime/sheet-compiler.ts)
- [src/runtime/xlsx-adapter.ts](/Users/qianshuang/Project/WebProject/csv-enhance/src/runtime/xlsx-adapter.ts)

## Planned Next Step

The next CLI milestone should be:

1. optional `--json` output for diagnostics and compile summaries
2. batch processing for multiple `.sheet` files
3. additional export targets
