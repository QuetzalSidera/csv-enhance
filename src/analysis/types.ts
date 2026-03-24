import type {
  ComputeBlock,
  FuncBlock,
  FuncAssignmentStatement,
  FuncReturnSpec,
  FunctionParameter,
  FunctionValueBinding,
  MetaBlock,
  PlotBlock,
  PluginExport,
  ResolvedPluginBlock,
  ResolvedSheetDocument,
  SourceRange,
  TableBlock,
  TableColumn,
  WindowBlock,
} from "../file-interface/types";
import type { DiagnosticRange, SheetWarning } from "../diagnostics";
import type { BuiltinFunctionName } from "../expression";

export type BinaryOperator = "+" | "-" | "*" | "/";

export type ExpressionNode =
  | NumberLiteralNode
  | ColumnReferenceNode
  | LocalReferenceNode
  | UnaryExpressionNode
  | BinaryExpressionNode
  | BuiltinCallNode
  | FuncCallNode
  | PluginCallNode;

export interface NumberLiteralNode {
  kind: "number_literal";
  value: number;
  range: DiagnosticRange;
}

export interface ColumnReferenceNode {
  kind: "column_reference";
  column: TableColumn;
  range: DiagnosticRange;
}

export interface LocalReferenceNode {
  kind: "local_reference";
  name: string;
  range: DiagnosticRange;
}

export interface UnaryExpressionNode {
  kind: "unary_expression";
  operator: "-";
  operand: ExpressionNode;
  range: DiagnosticRange;
}

export interface BinaryExpressionNode {
  kind: "binary_expression";
  operator: BinaryOperator;
  left: ExpressionNode;
  right: ExpressionNode;
  range: DiagnosticRange;
}

export interface BuiltinCallNode {
  kind: "builtin_call";
  name: BuiltinFunctionName;
  calleeRange: DiagnosticRange;
  args: ExpressionNode[];
  range: DiagnosticRange;
}

export interface AnalyzedFuncBlock {
  kind: "func";
  name: string;
  nameRange?: DiagnosticRange;
  params: FunctionParameter[];
  returnSpec: FuncReturnSpec;
  locals: FunctionValueBinding[];
  statements: AnalyzedFuncStatement[];
  source: SourceRange;
}

export interface AnalyzedFuncAssignmentStatement extends Omit<FuncAssignmentStatement, "expression"> {
  expression: ExpressionNode;
}

export interface AnalyzedFuncReturnStatement {
  kind: "return";
  expression: ExpressionNode;
  expressionRange: DiagnosticRange;
  source: SourceRange;
}

export type AnalyzedFuncStatement = AnalyzedFuncAssignmentStatement | AnalyzedFuncReturnStatement;

export interface FuncCallNode {
  kind: "func_call";
  functionName: string;
  func: AnalyzedFuncBlock;
  calleeRange: DiagnosticRange;
  args: ExpressionNode[];
  range: DiagnosticRange;
}

export interface PluginCallNode {
  kind: "plugin_call";
  pluginAlias: string;
  exportName: string;
  fn: PluginExport;
  calleeRange: DiagnosticRange;
  args: ExpressionNode[];
  range: DiagnosticRange;
}

export interface AnalyzeTarget {
  columnName: string;
  column: TableColumn;
  range?: DiagnosticRange;
}

export interface AnalyzedComputeStatement {
  target: AnalyzeTarget;
  expression: ExpressionNode;
  source: SourceRange;
  isOutput: boolean;
}

export interface AnalyzedComputeBlock {
  kind: "compute";
  tableName: string;
  tableNameRange?: DiagnosticRange;
  outputs: AnalyzeTarget[];
  outputColumns: TableColumn[];
  locals: string[];
  statements: AnalyzedComputeStatement[];
  source: SourceRange;
}

export interface AnalyzedPlotBlock extends PlotBlock {
  resolvedDependencies: TableColumn[];
}

export interface AnalyzedWindowBlock extends Omit<WindowBlock, "statements"> {
  outputs: AnalyzeTarget[];
  outputColumns: TableColumn[];
  locals: string[];
  statements: AnalyzedComputeStatement[];
  resolvedOrderColumn?: TableColumn;
  resolvedGroupColumns: TableColumn[];
}

export type AnalyzedSheetBlock =
  | MetaBlock
  | ResolvedPluginBlock
  | TableBlock
  | AnalyzedFuncBlock
  | AnalyzedWindowBlock
  | AnalyzedPlotBlock
  | AnalyzedComputeBlock;

export interface AnalyzedSheetDocument {
  blocks: AnalyzedSheetBlock[];
  warnings: SheetWarning[];
}

export interface AnalysisContext {
  document: ResolvedSheetDocument;
  tableMap: Record<string, TableBlock>;
  funcMap: Record<string, AnalyzedFuncBlock>;
  pluginMap: Record<string, ResolvedPluginBlock>;
  computeOutputMap: Record<string, Record<string, TableColumn>>;
}

export type ComputeCapableBlock = ComputeBlock | AnalyzedComputeBlock;
