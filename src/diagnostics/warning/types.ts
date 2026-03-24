import type { DiagnosticShape } from "../error/types";

export interface SheetWarning extends DiagnosticShape {
  severity: "warning";
}
