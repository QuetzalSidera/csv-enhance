import type { DiagnosticOptions, DiagnosticPhase } from "../error/types";
import type { WarningDiagnosticKey } from "./keys";
import { formatWarningMessage } from "./messages";
import type { SheetWarning } from "./types";

export class WarningCollector {
  private readonly values: SheetWarning[] = [];

  add(warning: SheetWarning): void {
    this.values.push(warning);
  }

  list(): SheetWarning[] {
    return [...this.values];
  }
}

export class WarningHelper {
  static analysis(
    key: WarningDiagnosticKey,
    params: Record<string, string | number> = {},
    options: DiagnosticOptions = {},
  ): SheetWarning {
    return this.create("analysis", key, params, options);
  }

  static create(
    phase: DiagnosticPhase,
    key: WarningDiagnosticKey,
    params: Record<string, string | number> = {},
    options: DiagnosticOptions = {},
  ): SheetWarning {
    return {
      code: `${phase.toUpperCase()}_${key.toUpperCase()}`,
      phase,
      severity: "warning",
      message: formatWarningMessage(key, params, options.locale),
      range: options.range,
      suggestion: options.suggestion,
    };
  }
}
