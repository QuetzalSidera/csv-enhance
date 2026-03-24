import type { DiagnosticLocale } from "../types";
import type { AnalysisDiagnosticKey, ParserDiagnosticKey, RuntimeDiagnosticKey } from "../keys";
import { ANALYSIS_ERROR_MESSAGES } from "./analysis";
import { PARSER_ERROR_MESSAGES } from "./parser";
import { RUNTIME_ERROR_MESSAGES } from "./runtime";

export function formatParserErrorMessage(
  key: ParserDiagnosticKey,
  params: Record<string, string | number> = {},
  locale: DiagnosticLocale = "en",
): string {
  ensureLocale(locale);
  return PARSER_ERROR_MESSAGES[key](params);
}

export function formatAnalysisErrorMessage(
  key: AnalysisDiagnosticKey,
  params: Record<string, string | number> = {},
  locale: DiagnosticLocale = "en",
): string {
  ensureLocale(locale);
  return ANALYSIS_ERROR_MESSAGES[key](params);
}

export function formatRuntimeErrorMessage(
  key: RuntimeDiagnosticKey,
  params: Record<string, string | number> = {},
  locale: DiagnosticLocale = "en",
): string {
  ensureLocale(locale);
  return RUNTIME_ERROR_MESSAGES[key](params);
}

function ensureLocale(locale: DiagnosticLocale): void {
  if (locale !== "en") {
    throw new Error(`Unsupported diagnostic locale: ${locale}`);
  }
}
