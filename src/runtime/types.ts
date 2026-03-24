import type { AnalyzedFuncBlock, ExpressionNode } from "../analysis/types";
import type { PlotFieldMap, ResolvedPluginBlock, SourceRange, TableColumn } from "../file-interface/types";
import type { MetaBlock } from "../file-interface/types";
import type { DataCellValueType } from "../shared/value";

export interface RuntimeRow {
  [columnName: string]: DataCellValueType;
}

export interface ExpressionEvaluationContext {
  row: RuntimeRow;
  locals: Record<string, DataCellValueType>;
  aggregateRows: RuntimeRow[];
}

export interface EvaluatedExpression {
  expression: ExpressionNode;
  value: DataCellValueType;
}

export interface EvaluatedTable {
  name: string;
  columns: TableColumn[];
  rows: RuntimeRow[];
}

export interface EvaluatedPlot {
  kind: "plot";
  tableName: string;
  fields: PlotFieldMap;
  resolvedDependencies: TableColumn[];
  rows: RuntimeRow[];
  source: SourceRange;
}

export interface EvaluatedComputeResult {
  kind: "compute";
  tableName: string;
  table: EvaluatedTable;
  source: SourceRange;
}

export type EvaluatedSheetBlock =
  | MetaBlock
  | ResolvedPluginBlock
  | AnalyzedFuncBlock
  | EvaluatedTable
  | EvaluatedComputeResult
  | EvaluatedPlot;

export interface EvaluatedSheetDocument {
  blocks: EvaluatedSheetBlock[];
  tables: Record<string, EvaluatedTable>;
  plots: EvaluatedPlot[];
}
