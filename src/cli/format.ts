import type { SheetDiagnosticError } from "../diagnostics";
import type { LintIssue, LintResult } from "../lint";
import type { CompiledSheetResult } from "../runtime/sheet-compiler";

export function formatLintResult(filePath: string, result: LintResult): string {
  const lines: string[] = [filePath];

  if (result.issues.length === 0) {
    lines.push("  ok");
    return lines.join("\n");
  }

  result.issues.forEach((issue: LintIssue) => {
    const location = issue.range
      ? `${issue.range.startLine}:${issue.range.startColumn}`
      : "-";
    const suggestion = issue.suggestion ? ` Suggestion: ${issue.suggestion}` : "";
    lines.push(
      `  ${issue.severity} ${issue.code} ${location} ${issue.message}${suggestion}`,
    );
  });

  return lines.join("\n");
}

export function formatCompileResult(filePath: string, result: CompiledSheetResult): string {
  const tableNames = Object.keys(result.evaluatedDocument.tables);
  const lines: string[] = [
    filePath,
    "  compiled",
    `  tables ${tableNames.length}`,
  ];

  tableNames.forEach((tableName) => {
    const table = result.evaluatedDocument.tables[tableName];
    lines.push(`  table ${table.name} rows=${table.rows.length} columns=${table.columns.length}`);
  });

  lines.push(`  plots ${result.plotSpecs.length}`);
  return lines.join("\n");
}

export function formatXlsxResult(inputPath: string, outputPath: string): string {
  return [
    inputPath,
    `  wrote ${outputPath}`,
  ].join("\n");
}

export function formatDiagnosticError(filePath: string, error: SheetDiagnosticError): string {
  const lines = [
    filePath,
    `  error ${error.code} ${formatRange(error)} ${error.messageText}`,
  ];

  if (error.suggestion) {
    lines.push(`  suggestion ${error.suggestion}`);
  }

  return lines.join("\n");
}

function formatRange(error: SheetDiagnosticError): string {
  return error.range
    ? `${error.range.startLine}:${error.range.startColumn}`
    : "-";
}
