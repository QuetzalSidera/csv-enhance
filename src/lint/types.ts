import type { DiagnosticPhase, DiagnosticRange, SheetWarning } from "../diagnostics";
import type { AnalyzedSheetDocument, ExpressionNode } from "../analysis/types";
import type { SheetFile } from "../file-interface/types";

export type LintSeverity = "error" | "warning";
export type LintPhase = DiagnosticPhase | "lint";

export interface LintIssue {
  code: string;
  phase: LintPhase;
  severity: LintSeverity;
  message: string;
  range?: DiagnosticRange;
  suggestion?: string;
}

export interface LintResult {
  issues: LintIssue[];
  ok: boolean;
}

export interface LintRuleContext {
  file: SheetFile;
  analyzedDocument: AnalyzedSheetDocument;
}

export interface LintRule {
  id: string;
  run(context: LintRuleContext): LintIssue[];
}

export interface LintRuleDiagnostic extends Omit<LintIssue, "phase"> {
  phase?: LintPhase;
}

export function warningToLintIssue(warning: SheetWarning): LintIssue {
  return {
    code: warning.code,
    phase: warning.phase,
    severity: warning.severity,
    message: warning.message,
    range: warning.range,
    suggestion: warning.suggestion,
  };
}

export function collectExpressionReferences(
  expression: ExpressionNode,
  state: {
    localNames: Set<string>;
    functionNames: Set<string>;
  } = {
    localNames: new Set<string>(),
    functionNames: new Set<string>(),
  },
): { localNames: Set<string>; functionNames: Set<string> } {
  switch (expression.kind) {
    case "number_literal":
    case "column_reference":
    case "plugin_call":
      if (expression.kind === "plugin_call") {
        expression.args.forEach((arg) => collectExpressionReferences(arg, state));
      }
      return state;
    case "local_reference":
      state.localNames.add(expression.name);
      return state;
    case "unary_expression":
      return collectExpressionReferences(expression.operand, state);
    case "binary_expression":
      collectExpressionReferences(expression.left, state);
      collectExpressionReferences(expression.right, state);
      return state;
    case "builtin_call":
      expression.args.forEach((arg) => collectExpressionReferences(arg, state));
      return state;
    case "func_call":
      state.functionNames.add(expression.functionName);
      expression.args.forEach((arg) => collectExpressionReferences(arg, state));
      return state;
  }
}
