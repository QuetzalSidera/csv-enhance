declare const process: {
  stdout: { write(message: string): void };
  stderr: { write(message: string): void };
  exitCode?: number;
};
declare function require(name: string): any;

import { SheetDiagnosticError } from "../diagnostics";
import { SheetLinter } from "../lint";
import { SheetCompiler, XlsxAdapter } from "../index";
import { formatCompileResult, formatDiagnosticError, formatLintResult, formatXlsxResult } from "./format";

const path = require("path");

export function runCli(argv: string[], cliName: string): void {
  const [, , command, targetPath, ...rest] = argv;

  if (command === "--help" || command === "-h" || command === undefined) {
    printHelp(cliName);
    process.exitCode = command ? 0 : 1;
    return;
  }

  if (command !== "lint" && command !== "compile" && command !== "xlsx") {
    process.stderr.write(`Unknown command "${command}".\n\n`);
    printHelp(cliName);
    process.exitCode = 1;
    return;
  }

  if (!targetPath) {
    printUsage(cliName, command);
    process.exitCode = 1;
    return;
  }

  if (command === "lint") {
    if (rest.length > 0) {
      printUsage(cliName, command);
      process.exitCode = 1;
      return;
    }

    const linter = new SheetLinter();
    const result = linter.lintPath(targetPath);
    process.stdout.write(`${formatLintResult(targetPath, result)}\n`);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (command === "compile") {
    if (rest.length > 0) {
      printUsage(cliName, command);
      process.exitCode = 1;
      return;
    }

    runCompile(targetPath);
    return;
  }

  runXlsx(cliName, targetPath, rest);
}

function printHelp(cliName: string): void {
  process.stdout.write(
    [
      cliName,
      "",
      "Usage:",
      `  ${cliName} lint <file.csvx>`,
      `  ${cliName} compile <file.csvx>`,
      `  ${cliName} xlsx <file.csvx> [-o <output.xlsx>]`,
      "",
      "Commands:",
      "  lint    Run parser, analyzer, warnings, and lint rules",
      "  compile Compile .csvx and print an execution summary",
      "  xlsx    Compile .csvx and write an .xlsx workbook",
      "",
    ].join("\n"),
  );
}

function printUsage(cliName: string, command: string): void {
  if (command === "xlsx") {
    process.stderr.write(`Usage: ${cliName} xlsx <file.csvx> [-o <output.xlsx>]\n`);
    return;
  }

  process.stderr.write(`Usage: ${cliName} ${command} <file.csvx>\n`);
}

function runCompile(targetPath: string): void {
  try {
    const compiler = new SheetCompiler();
    const result = compiler.compilePath(targetPath);
    process.stdout.write(`${formatCompileResult(targetPath, result)}\n`);
    process.exitCode = 0;
  } catch (error) {
    handleCliError(targetPath, error);
  }
}

function runXlsx(cliName: string, targetPath: string, args: string[]): void {
  const outputPath = resolveOutputPath(targetPath, args);
  if (!outputPath) {
    printUsage(cliName, "xlsx");
    process.exitCode = 1;
    return;
  }

  try {
    const compiler = new SheetCompiler();
    const adapter = new XlsxAdapter();
    const result = compiler.compilePath(targetPath);
    adapter.writeCompiledResult(result, outputPath);
    process.stdout.write(`${formatXlsxResult(targetPath, outputPath)}\n`);
    process.exitCode = 0;
  } catch (error) {
    handleCliError(targetPath, error);
  }
}

function resolveOutputPath(targetPath: string, args: string[]): string | undefined {
  if (args.length === 0) {
    return replaceExtension(targetPath, ".xlsx");
  }

  if (args.length === 2 && (args[0] === "-o" || args[0] === "--output")) {
    return args[1];
  }

  return undefined;
}

function replaceExtension(filePath: string, extension: string): string {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, `${parsed.name}${extension}`);
}

function handleCliError(targetPath: string, error: unknown): void {
  if (error instanceof SheetDiagnosticError) {
    process.stderr.write(`${formatDiagnosticError(targetPath, error)}\n`);
    process.exitCode = 1;
    return;
  }

  throw error;
}
