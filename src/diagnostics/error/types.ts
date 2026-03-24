export type DiagnosticPhase = "parser" | "analysis" | "runtime";
export type DiagnosticSeverity = "error" | "warning";
export type DiagnosticLocale = "en";

export interface DiagnosticRange {
  startLine: number;
  startColumn: number;
  startOffset: number;
  endLine: number;
  endColumn: number;
  endOffset: number;
}

export interface DiagnosticOptions {
  range?: DiagnosticRange;
  suggestion?: string;
  locale?: DiagnosticLocale;
}

export interface DiagnosticShape {
  code: string;
  phase: DiagnosticPhase;
  severity: DiagnosticSeverity;
  message: string;
  range?: DiagnosticRange;
  suggestion?: string;
}

export class SheetDiagnosticError extends Error implements DiagnosticShape {
  readonly severity = "error" as const;
  readonly messageText: string;

  constructor(
    public readonly code: string,
    public readonly phase: DiagnosticPhase,
    message: string,
    public readonly range?: DiagnosticRange,
    public readonly suggestion?: string,
  ) {
    super(formatDiagnosticMessage({ code, phase, severity: "error", message, range, suggestion }));
    this.name = "SheetDiagnosticError";
    this.messageText = message;
  }
}

function formatDiagnosticMessage(diagnostic: DiagnosticShape): string {
  const prefix = `[${diagnostic.phase.toUpperCase()}:${diagnostic.code}]`;
  const location = diagnostic.range
    ? ` line ${diagnostic.range.startLine}, column ${diagnostic.range.startColumn}, offset ${diagnostic.range.startOffset}`
    : "";
  const suggestion = diagnostic.suggestion ? ` Suggestion: ${diagnostic.suggestion}` : "";
  return `${prefix}${location}: ${diagnostic.message}${suggestion}`;
}
