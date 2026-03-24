import type { DataCellValueType } from "../shared/value";
import type { DiagnosticRange } from "../diagnostics";

export type ColumnType = DataCellValueType["type"] | "dynamic";
export type PluginExport = ((...args: unknown[]) => unknown) & {
  __sheetReturnType?: ColumnType;
};

export interface SourceRange {
  startLine: number;
  endLine: number;
}

export interface MetaEntry {
  key: string;
  value: string;
  source: SourceRange;
}

export interface ParsedPluginBinding {
  path: string;
  exportNames: string[];
}

export interface ResolvedPluginBinding {
  exports: PluginExport[];
}

export interface ComputeStatement {
  target: string;
  targetColumn: TableColumn;
  targetRange: DiagnosticRange;
  expression: string;
  expressionRange: DiagnosticRange;
  source: SourceRange;
}

export interface FunctionParameter {
  name: string;
  type: ColumnType;
  shape: ValueShape;
  nameRange?: DiagnosticRange;
}

export type ValueShape = "scalar" | "row" | "col";

export interface FunctionValueBinding {
  name: string;
  type: ColumnType;
  shape: ValueShape;
  nameRange?: DiagnosticRange;
}

export interface FuncReturnSpec {
  type: ColumnType;
  shape: ValueShape;
  range?: DiagnosticRange;
}

export interface FuncAssignmentStatement {
  kind: "assign";
  target: FunctionValueBinding;
  targetRange: DiagnosticRange;
  expression: string;
  expressionRange: DiagnosticRange;
  source: SourceRange;
}

export interface FuncReturnStatement {
  kind: "return";
  expression: string;
  expressionRange: DiagnosticRange;
  source: SourceRange;
}

export type FuncStatement = FuncAssignmentStatement | FuncReturnStatement;

export interface ComputeBlockTargets {
  columns: TableColumn[];
  source: SourceRange;
}

// The first iteration only targets bar charts, so plot fields are kept minimal.
export interface PlotFieldMap {
  x?: string;
  y?: string;
  color?: string;
  title?: string;
}

export interface PlotDependencies {
  names: string[];
  nameRanges?: Record<string, DiagnosticRange>;
  source: SourceRange;
}

export interface TableColumn {
  name: string;
  nameRange?: DiagnosticRange;
  declaredType: ColumnType;
  columnType: ColumnType;
  isTypeExplicit: boolean;
}

export interface BaseBlock {
  kind: "meta" | "plugin" | "table" | "func" | "compute" | "window" | "plot";
  source: SourceRange;
}

export interface MetaBlock extends BaseBlock {
  kind: "meta";
  entries: MetaEntry[];
}

export interface ParsedPluginBlock extends BaseBlock {
  kind: "plugin";
  alias: string;
  aliasRange?: DiagnosticRange;
  pathRange?: DiagnosticRange;
  exportNameRanges?: Record<string, DiagnosticRange>;
  binding: ParsedPluginBinding;
}

export interface ResolvedPluginBlock extends BaseBlock {
  kind: "plugin";
  alias: string;
  aliasRange?: DiagnosticRange;
  pathRange?: DiagnosticRange;
  exportNameRanges?: Record<string, DiagnosticRange>;
  modulePath: string;
  exportNames: string[];
  binding: ResolvedPluginBinding;
}

export interface TableBlock extends BaseBlock {
  kind: "table";
  name: string;
  nameRange?: DiagnosticRange;
  columns: TableColumn[];
  rows: DataCellValueType[][];
}

export interface FuncBlock extends BaseBlock {
  kind: "func";
  name: string;
  nameRange?: DiagnosticRange;
  params: FunctionParameter[];
  returnSpec: FuncReturnSpec;
  statements: FuncStatement[];
}

export interface ComputeBlock extends BaseBlock {
  kind: "compute";
  tableName: string;
  tableNameRange?: DiagnosticRange;
  targets: ComputeBlockTargets;
  statements: ComputeStatement[];
}

export interface WindowBlock extends BaseBlock {
  kind: "window";
  tableName: string;
  tableNameRange?: DiagnosticRange;
  orderBy?: string;
  orderByRange?: DiagnosticRange;
  groupBy?: string[];
  groupByRanges?: Record<string, DiagnosticRange>;
  targets: ComputeBlockTargets;
  statements: ComputeStatement[];
}

export interface PlotBlock extends BaseBlock {
  kind: "plot";
  tableName: string;
  tableNameRange?: DiagnosticRange;
  dependencies: PlotDependencies;
  fields: PlotFieldMap;
  fieldRanges?: Partial<Record<keyof PlotFieldMap, DiagnosticRange>>;
}

export type ParsedSheetBlock = MetaBlock | ParsedPluginBlock | TableBlock | FuncBlock | ComputeBlock | WindowBlock | PlotBlock;
export type ResolvedSheetBlock = MetaBlock | ResolvedPluginBlock | TableBlock | FuncBlock | ComputeBlock | WindowBlock | PlotBlock;

export interface ParsedSheetDocument {
  blocks: ParsedSheetBlock[];
}

export interface ResolvedSheetDocument {
  blocks: ResolvedSheetBlock[];
}

export interface ParsedSheetFile {
  path?: string;
  source: string;
  document: ParsedSheetDocument;
}

export interface SheetFile {
  path?: string;
  source: string;
  document: ResolvedSheetDocument;
}
