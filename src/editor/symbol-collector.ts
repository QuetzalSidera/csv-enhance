import type { AnalyzedSheetDocument, AnalyzeTarget, ExpressionNode } from "../analysis/types";
import type { DiagnosticRange } from "../diagnostics";
import { ThrowHelper } from "../diagnostics";
import type { PlotBlock, ResolvedPluginBlock, SheetFile, TableBlock, TableColumn } from "../file-interface/types";
import type { SheetSymbol } from "./types";
import { findBuiltinDefinition } from "./builtin-definition-map";
import { findPluginExportDefinitions } from "./plugin-definition-map";

export function collectSymbols(file: SheetFile, analyzedDocument: AnalyzedSheetDocument): SheetSymbol[] {
  const symbols: SheetSymbol[] = [];
  const tableDefinitions = new Map<string, TableBlock>();
  const columnDefinitions = new Map<string, TableColumn>();
  const pluginDefinitions = new Map<string, ResolvedPluginBlock>();
  const pluginExportDefinitions = new Map<string, Map<string, DiagnosticRange>>();

  for (const block of file.document.blocks) {
    if (block.kind === "table") {
      tableDefinitions.set(block.name, block);
      if (block.nameRange) {
        symbols.push({
          kind: "table",
          name: block.name,
          range: block.nameRange,
          definitionRange: block.nameRange,
          detail: describeTable(block),
        });
      }

      block.columns.forEach((column) => {
        if (!column.nameRange) {
          return;
        }
        columnDefinitions.set(columnKey(block.name, column.name), column);
        symbols.push({
          kind: "column",
          name: column.name,
          range: column.nameRange,
          definitionRange: column.nameRange,
          detail: describeColumn(block.name, column),
        });
      });
    }

    if (block.kind === "plugin") {
      pluginDefinitions.set(block.alias, block);
      if (block.aliasRange) {
        symbols.push({
          kind: "plugin",
          name: block.alias,
          range: block.aliasRange,
          definitionRange: block.aliasRange,
          detail: `plugin ${block.alias}`,
        });
      }

      collectPluginSymbols(block, pluginExportDefinitions, symbols);
    }

    if (block.kind === "func" && block.nameRange) {
      symbols.push({
        kind: "func",
        name: block.name,
        range: block.nameRange,
        definitionRange: block.nameRange,
        detail: describeFunction(block),
      });
    }
  }

  for (const block of analyzedDocument.blocks) {
    if (block.kind === "compute" && block.tableNameRange) {
      const definitionRange = tableDefinitions.get(block.tableName)?.nameRange;
      symbols.push({
        kind: "compute_table_reference",
        name: block.tableName,
        range: block.tableNameRange,
        definitionRange,
        detail: `@compute ${block.tableName}`,
      });

      block.outputColumns.forEach((column) => {
        if (!column.nameRange) {
          return;
        }
        columnDefinitions.set(columnKey(block.tableName, column.name), column);
        symbols.push({
          kind: "column",
          name: column.name,
          range: column.nameRange,
          definitionRange: column.nameRange,
          detail: describeColumn(block.tableName, column),
        });
      });
    }

    if (block.kind === "plot" && block.tableNameRange) {
      const definitionRange = tableDefinitions.get(block.tableName)?.nameRange;
      symbols.push({
        kind: "plot_table_reference",
        name: block.tableName,
        range: block.tableNameRange,
        definitionRange,
        detail: `@plot ${block.tableName}`,
      });
      collectPlotSymbols(block, columnDefinitions, symbols);
    }

    if (block.kind === "window" && block.tableNameRange) {
      const definitionRange = tableDefinitions.get(block.tableName)?.nameRange;
      symbols.push({
        kind: "window_table_reference",
        name: block.tableName,
        range: block.tableNameRange,
        definitionRange,
        detail: `@window ${block.tableName}`,
      });

      block.outputColumns.forEach((column) => {
        if (!column.nameRange) {
          return;
        }
        columnDefinitions.set(columnKey(block.tableName, column.name), column);
        symbols.push({
          kind: "column",
          name: column.name,
          range: column.nameRange,
          definitionRange: column.nameRange,
          detail: describeColumn(block.tableName, column),
        });
      });

      const localDefinitions = new Map<string, AnalyzeTarget>();
      block.statements.forEach((statement) => {
        collectExpressionSymbols(
          statement.expression,
          block.tableName,
          columnDefinitions,
          localDefinitions,
          pluginDefinitions,
          pluginExportDefinitions,
          symbols,
        );

        if (!statement.isOutput && statement.target.range) {
          localDefinitions.set(statement.target.columnName, statement.target);
          symbols.push({
            kind: "local",
            name: statement.target.columnName,
            range: statement.target.range,
            definitionRange: statement.target.range,
            detail: describeLocal(statement.target),
          });
        }
      });
    }

    if (block.kind === "func") {
      const localDefinitions = new Map<string, AnalyzeTarget>();
      block.statements.forEach((statement) => {
        collectExpressionSymbols(statement.expression, "__func__", columnDefinitions, localDefinitions, pluginDefinitions, pluginExportDefinitions, symbols);
        if (statement.kind === "assign" && statement.target.nameRange) {
          const localTarget: AnalyzeTarget = {
            columnName: statement.target.name,
            column: {
              name: statement.target.name,
              nameRange: statement.target.nameRange,
              declaredType: statement.target.type,
              columnType: statement.target.type,
              isTypeExplicit: statement.target.type !== "dynamic",
            },
            range: statement.targetRange,
          };
          localDefinitions.set(statement.target.name, localTarget);
          symbols.push({
            kind: "local",
            name: statement.target.name,
            range: statement.targetRange,
            definitionRange: statement.targetRange,
            detail: describeLocal(localTarget),
          });
        }
      });
    }

    if (block.kind === "compute") {
      const localDefinitions = new Map<string, AnalyzeTarget>();
      block.statements.forEach((statement) => {
        collectExpressionSymbols(
          statement.expression,
          block.tableName,
          columnDefinitions,
          localDefinitions,
          pluginDefinitions,
          pluginExportDefinitions,
          symbols,
        );

        if (!statement.isOutput && statement.target.range) {
          localDefinitions.set(statement.target.columnName, statement.target);
          symbols.push({
            kind: "local",
            name: statement.target.columnName,
            range: statement.target.range,
            definitionRange: statement.target.range,
            detail: describeLocal(statement.target),
          });
        }
      });
    }
  }

  return symbols;
}

function collectPluginSymbols(
  block: ResolvedPluginBlock,
  pluginExportDefinitions: Map<string, Map<string, DiagnosticRange>>,
  symbols: SheetSymbol[],
): void {
  if (block.pathRange) {
    symbols.push({
      kind: "plugin_path_reference",
      name: block.modulePath,
      range: block.pathRange,
      definitionPath: block.modulePath,
      definitionRange: ThrowHelper.pointRange(1, 1),
      detail: `plugin path ${block.modulePath}`,
    });
  }

  const exportDefinitions = findPluginExportDefinitions(block.modulePath);
  pluginExportDefinitions.set(block.modulePath, exportDefinitions);
  block.exportNames.forEach((exportName) => {
    const range = block.exportNameRanges?.[exportName];
    if (!range) {
      return;
    }

    symbols.push({
      kind: "plugin_export_reference",
      name: exportName,
      range,
      definitionPath: block.modulePath,
      definitionRange: exportDefinitions.get(exportName) ?? ThrowHelper.pointRange(1, 1),
      detail: `plugin export ${block.alias}.${exportName}`,
    });
  });
}

function collectExpressionSymbols(
  expression: ExpressionNode,
  tableName: string,
  columnDefinitions: Map<string, TableColumn>,
  localDefinitions: Map<string, AnalyzeTarget>,
  pluginDefinitions: Map<string, ResolvedPluginBlock>,
  pluginExportDefinitions: Map<string, Map<string, DiagnosticRange>>,
  symbols: SheetSymbol[],
): void {
  switch (expression.kind) {
    case "number_literal":
      return;
    case "local_reference": {
      const local = localDefinitions.get(expression.name);
      if (!local?.range) {
        return;
      }
      symbols.push({
        kind: "local_reference",
        name: expression.name,
        range: expression.range,
        definitionRange: local.range,
        detail: describeLocal(local),
      });
      return;
    }
    case "column_reference": {
      const definitionRange = columnDefinitions.get(columnKey(tableName, expression.column.name))?.nameRange;
      symbols.push({
        kind: "column_reference",
        name: expression.column.name,
        range: expression.range,
        definitionRange,
        detail: describeColumn(tableName, expression.column),
      });
      return;
    }
    case "unary_expression":
      collectExpressionSymbols(expression.operand, tableName, columnDefinitions, localDefinitions, pluginDefinitions, pluginExportDefinitions, symbols);
      return;
    case "binary_expression":
      collectExpressionSymbols(expression.left, tableName, columnDefinitions, localDefinitions, pluginDefinitions, pluginExportDefinitions, symbols);
      collectExpressionSymbols(expression.right, tableName, columnDefinitions, localDefinitions, pluginDefinitions, pluginExportDefinitions, symbols);
      return;
    case "builtin_call":
      {
        const builtinDefinition = findBuiltinDefinition(expression.name);
        symbols.push({
          kind: "builtin_reference",
          name: expression.name,
          range: expression.calleeRange,
          definitionPath: builtinDefinition?.path,
          definitionRange: builtinDefinition?.range,
          detail: builtinDefinition?.detail ?? `builtin ${expression.name}`,
        });
      }
      expression.args.forEach((arg) =>
        collectExpressionSymbols(arg, tableName, columnDefinitions, localDefinitions, pluginDefinitions, pluginExportDefinitions, symbols),
      );
      return;
    case "plugin_call": {
      const pluginBlock = pluginDefinitions.get(expression.pluginAlias);
      const definitionPath = pluginBlock?.modulePath;
      const definitionRange = definitionPath
        ? pluginExportDefinitions.get(definitionPath)?.get(expression.exportName)
        : undefined;
      symbols.push({
        kind: "plugin_reference",
        name: `${expression.pluginAlias}.${expression.exportName}`,
        range: expression.calleeRange,
        definitionPath,
        definitionRange,
        detail: describePluginCall(expression.pluginAlias, expression.exportName, expression.fn.length, expression.fn.__sheetReturnType),
      });
      expression.args.forEach((arg) =>
        collectExpressionSymbols(arg, tableName, columnDefinitions, localDefinitions, pluginDefinitions, pluginExportDefinitions, symbols),
      );
      return;
    }
    case "func_call": {
      symbols.push({
        kind: "func_reference",
        name: expression.functionName,
        range: expression.calleeRange,
        definitionRange: expression.func.nameRange,
        detail: describeFunction(expression.func),
      });
      expression.args.forEach((arg) =>
        collectExpressionSymbols(arg, tableName, columnDefinitions, localDefinitions, pluginDefinitions, pluginExportDefinitions, symbols),
      );
      return;
    }
  }
}

function collectPlotSymbols(
  block: PlotBlock,
  columnDefinitions: Map<string, TableColumn>,
  symbols: SheetSymbol[],
): void {
  block.dependencies.names.forEach((name) => {
    const range = block.dependencies.nameRanges?.[name];
    const column = columnDefinitions.get(columnKey(block.tableName, name));
    if (!range || !column?.nameRange) {
      return;
    }
    symbols.push({
      kind: "column_reference",
      name,
      range,
      definitionRange: column.nameRange,
      detail: describeColumn(block.tableName, column),
    });
  });

  (["x", "y", "color"] as const).forEach((fieldName) => {
    const value = block.fields[fieldName];
    const range = block.fieldRanges?.[fieldName];
    const column = value ? columnDefinitions.get(columnKey(block.tableName, value)) : undefined;
    if (!value || !range || !column?.nameRange) {
      return;
    }
    symbols.push({
      kind: "column_reference",
      name: value,
      range,
      definitionRange: column.nameRange,
      detail: describeColumn(block.tableName, column),
    });
  });
}

function columnKey(tableName: string, columnName: string): string {
  return `${tableName}::${columnName}`;
}

function describeTable(table: TableBlock): string {
  const columnSummary = table.columns.map((column) => `${column.name}[${column.columnType}]`).join(", ");
  return `table ${table.name}\n${columnSummary}`;
}

function describeFunction(func: {
  name: string;
  params: { name: string; type: string; shape?: string }[];
  returnSpec: { type: string; shape: string };
}): string {
  const params = func.params.map((param) => `${param.name}[${formatValueShape(param.shape ?? "scalar", param.type)}]`).join(", ");
  return `${func.name}(${params}) => ${formatReturnShape(func.returnSpec.shape, func.returnSpec.type)}`;
}

function describeLocal(target: AnalyzeTarget): string {
  return `local ${target.columnName}[${target.column.columnType}]`;
}

function describePluginCall(
  pluginAlias: string,
  exportName: string,
  arity: number,
  returnType?: TableColumn["columnType"],
): string {
  const params = arity > 0 ? new Array(arity).fill("...").join(", ") : "";
  const resolvedReturnType = returnType ?? "dynamic";
  return `plugin ${pluginAlias}.${exportName}(${params}) -> ${resolvedReturnType}`;
}

function describeColumn(tableName: string, column: TableColumn): string {
  return `${tableName}.${column.name}[${column.columnType}]`;
}

function formatValueShape(shape: string, type: string): string {
  if (shape === "row" || shape === "col") {
    return `${shape}:${type}`;
  }
  return type;
}

function formatReturnShape(shape: string, type: string): string {
  if (shape === "scalar") {
    return type;
  }
  if (shape === "row") {
    return `[row:${type}]`;
  }
  return `[${type}]`;
}
