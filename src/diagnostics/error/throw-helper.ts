import {
  formatAnalysisErrorMessage,
  formatParserErrorMessage,
  formatRuntimeErrorMessage,
} from "./messages";
import type { AnalysisDiagnosticKey, ParserDiagnosticKey, RuntimeDiagnosticKey } from "./keys";
import { SheetDiagnosticError, type DiagnosticOptions, type DiagnosticPhase, type DiagnosticRange } from "./types";

export class ThrowHelper {
  static parser(
    key: ParserDiagnosticKey,
    params: Record<string, string | number> = {},
    options: DiagnosticOptions = {},
  ): never {
    throw this.createParser(key, params, options);
  }

  static analysis(
    key: AnalysisDiagnosticKey,
    params: Record<string, string | number> = {},
    options: DiagnosticOptions = {},
  ): never {
    throw this.createAnalysis(key, params, options);
  }

  static runtime(
    key: RuntimeDiagnosticKey,
    params: Record<string, string | number> = {},
    options: DiagnosticOptions = {},
  ): never {
    throw this.createRuntime(key, params, options);
  }

  static createParser(
    key: ParserDiagnosticKey,
    params: Record<string, string | number> = {},
    options: DiagnosticOptions = {},
  ): SheetDiagnosticError {
    return new SheetDiagnosticError(
      this.toCode("parser", key),
      "parser",
      formatParserErrorMessage(key, params, options.locale),
      options.range,
      options.suggestion,
    );
  }

  static createAnalysis(
    key: AnalysisDiagnosticKey,
    params: Record<string, string | number> = {},
    options: DiagnosticOptions = {},
  ): SheetDiagnosticError {
    return new SheetDiagnosticError(
      this.toCode("analysis", key),
      "analysis",
      formatAnalysisErrorMessage(key, params, options.locale),
      options.range,
      options.suggestion,
    );
  }

  static createRuntime(
    key: RuntimeDiagnosticKey,
    params: Record<string, string | number> = {},
    options: DiagnosticOptions = {},
  ): SheetDiagnosticError {
    return new SheetDiagnosticError(
      this.toCode("runtime", key),
      "runtime",
      formatRuntimeErrorMessage(key, params, options.locale),
      options.range,
      options.suggestion,
    );
  }

  static create(
    phase: DiagnosticPhase,
    key: string,
    message: string,
    options: DiagnosticOptions = {},
  ): SheetDiagnosticError {
    return new SheetDiagnosticError(
      this.toCode(phase, key),
      phase,
      message,
      options.range,
      options.suggestion,
    );
  }

  static pointRange(line: number, column = 1): DiagnosticRange {
    const offset = Math.max(0, column - 1);
    return {
      startLine: line,
      startColumn: column,
      startOffset: offset,
      endLine: line,
      endColumn: column,
      endOffset: offset,
    };
  }

  static lineFragmentRange(line: number, rawLine: string, fragment: string, fallbackColumn = 1): DiagnosticRange {
    const fragmentIndex = rawLine.indexOf(fragment);
    const column = fragmentIndex >= 0 ? fragmentIndex + 1 : fallbackColumn;
    const endColumn = column + Math.max(fragment.length - 1, 0);
    return {
      startLine: line,
      startColumn: column,
      startOffset: Math.max(0, column - 1),
      endLine: line,
      endColumn,
      endOffset: Math.max(0, endColumn - 1),
    };
  }

  private static toCode(phase: DiagnosticPhase, key: string): string {
    return `${phase.toUpperCase()}_${key.toUpperCase()}`;
  }
}
