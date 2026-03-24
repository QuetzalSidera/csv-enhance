import type { LintIssue, LintResult } from "../lint";

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
