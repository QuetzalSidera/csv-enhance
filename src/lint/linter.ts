import { SheetDiagnosticError } from "../diagnostics";
import { SheetSemanticAnalyzer } from "../analysis/analyzer";
import { DefaultSheetFileReader, type SheetFileReader } from "../file-interface/reader";
import type { SheetFile } from "../file-interface/types";
import { DEFAULT_LINT_RULES } from "./rules";
import type { LintIssue, LintResult, LintRule } from "./types";
import { warningToLintIssue } from "./types";

export class SheetLinter {
  constructor(
    private readonly reader: SheetFileReader = new DefaultSheetFileReader(),
    private readonly analyzer: SheetSemanticAnalyzer = new SheetSemanticAnalyzer(),
    private readonly rules: LintRule[] = DEFAULT_LINT_RULES,
  ) {}

  lintPath(path: string): LintResult {
    try {
      const file = this.reader.readFromPath(path);
      return this.lintFile(file);
    } catch (error) {
      return this.toFailureResult(error);
    }
  }

  lintSource(source: string, path?: string): LintResult {
    try {
      const file = this.reader.readFromString(source, path);
      return this.lintFile(file);
    } catch (error) {
      return this.toFailureResult(error);
    }
  }

  private lintFile(file: SheetFile): LintResult {
    try {
      const analyzedDocument = this.analyzer.analyze(file.document);
      const issues: LintIssue[] = analyzedDocument.warnings.map(warningToLintIssue);
      this.rules.forEach((rule: LintRule) => {
        issues.push(...rule.run({ file, analyzedDocument }));
      });

      return {
        issues,
        ok: !issues.some((issue) => issue.severity === "error"),
      };
    } catch (error) {
      return this.toFailureResult(error);
    }
  }

  private toFailureResult(error: unknown): LintResult {
    if (error instanceof SheetDiagnosticError) {
      return {
        issues: [
          {
            code: error.code,
            phase: error.phase,
            severity: error.severity,
            message: error.messageText,
            range: error.range,
            suggestion: error.suggestion,
          },
        ],
        ok: false,
      };
    }

    throw error;
  }
}
