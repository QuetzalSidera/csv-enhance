#!/usr/bin/env node

declare const process: {
  argv: string[];
  stdout: { write(message: string): void };
  stderr: { write(message: string): void };
  exitCode?: number;
};

import { SheetLinter } from "../lint";
import { formatLintResult } from "./format";

function main(argv: string[]): void {
  const [, , command, targetPath, ...rest] = argv;

  if (command === "--help" || command === "-h" || command === undefined) {
    printHelp();
    process.exitCode = command ? 0 : 1;
    return;
  }

  if (command !== "lint") {
    process.stderr.write(`Unknown command "${command}".\n\n`);
    printHelp();
    process.exitCode = 1;
    return;
  }

  if (!targetPath || rest.length > 0) {
    process.stderr.write("Usage: sheet lint <file.sheet>\n");
    process.exitCode = 1;
    return;
  }

  const linter = new SheetLinter();
  const result = linter.lintPath(targetPath);
  process.stdout.write(`${formatLintResult(targetPath, result)}\n`);
  process.exitCode = result.ok ? 0 : 1;
}

function printHelp(): void {
  process.stdout.write(
    [
      "sheet",
      "",
      "Usage:",
      "  sheet lint <file.sheet>",
      "",
      "Commands:",
      "  lint    Run parser, analyzer, warnings, and lint rules",
      "",
    ].join("\n"),
  );
}

main(process.argv);
