import type { AnalyzedSheetDocument } from "../analysis/types";
import type { DiagnosticRange } from "../diagnostics";
import type { SheetFile } from "../file-interface/types";
import type { LintIssue, LintResult } from "../lint/types";

export type SheetSymbolKind =
  | "table"
  | "column"
  | "column_reference"
  | "local"
  | "local_reference"
  | "plugin"
  | "plugin_path_reference"
  | "plugin_export_reference"
  | "plugin_reference"
  | "builtin_reference"
  | "func"
  | "func_reference"
  | "compute_table_reference"
  | "window_table_reference"
  | "plot_table_reference";

export interface SheetSymbol {
  kind: SheetSymbolKind;
  name: string;
  range: DiagnosticRange;
  definitionRange?: DiagnosticRange;
  definitionPath?: string;
  detail?: string;
}

export interface EditorPosition {
  line: number;
  column: number;
}

export interface HoverInfo {
  range: DiagnosticRange;
  contents: string;
}

export interface DefinitionInfo {
  name: string;
  kind: SheetSymbolKind;
  fromRange: DiagnosticRange;
  toRange: DiagnosticRange;
  toPath?: string;
}

export interface ReferenceInfo {
  name: string;
  kind: SheetSymbolKind;
  range: DiagnosticRange;
  path?: string;
}

export type CompletionItemKind = "keyword" | "property" | "field" | "function" | "variable" | "module";

export interface CompletionItem {
  label: string;
  kind: CompletionItemKind;
  detail?: string;
  insertText?: string;
}

export interface LanguageServiceResult {
  file?: SheetFile;
  analyzedDocument?: AnalyzedSheetDocument;
  lintResult: LintResult;
  issues: LintIssue[];
  symbols: SheetSymbol[];
}
