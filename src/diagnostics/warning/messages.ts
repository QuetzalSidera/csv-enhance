import type { WarningDiagnosticKey } from "./keys";
import type { DiagnosticLocale } from "../error/types";

type MessageFormatter = (params: Record<string, string | number>) => string;

const WARNING_MESSAGES: Record<WarningDiagnosticKey, MessageFormatter> = {
  boolean_compatible_required: ({ context, actual }) => `${context} must be boolean-compatible, received ${actual}`,
  number_compatible_required: ({ context, actual }) => `${context} must be number-compatible, received ${actual}`,
  type_mismatch: ({ context, expected, actual }) => `${context} expects ${expected} but expression resolves to ${actual}`,
};

export function formatWarningMessage(
  key: WarningDiagnosticKey,
  params: Record<string, string | number> = {},
  locale: DiagnosticLocale = "en",
): string {
  if (locale !== "en") {
    throw new Error(`Unsupported diagnostic locale: ${locale}`);
  }

  return WARNING_MESSAGES[key](params);
}
