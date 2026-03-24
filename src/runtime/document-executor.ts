import type { AnalyzedPlotBlock, AnalyzedSheetDocument } from "../analysis/types";
import { ThrowHelper } from "../diagnostics";
import type { DataCellValueType } from "../shared/value";
import { ComputeExecutor } from "./compute-executor";
import { WindowExecutor } from "./window-executor";
import type { EvaluatedPlot, EvaluatedSheetDocument, EvaluatedTable, RuntimeRow } from "./types";

export class DocumentExecutor {
  constructor(
    private readonly computeExecutor: ComputeExecutor = new ComputeExecutor(),
    private readonly windowExecutor: WindowExecutor = new WindowExecutor(),
  ) {}

  execute(document: AnalyzedSheetDocument): EvaluatedSheetDocument {
    const tables: Record<string, EvaluatedTable> = {};
    const plots: EvaluatedPlot[] = [];
    const blocks: EvaluatedSheetDocument["blocks"] = [];

    for (const block of document.blocks) {
      if (block.kind === "table") {
        const evaluatedTable = this.materializeTable(block.name, block.columns, block.rows);
        tables[block.name] = evaluatedTable;
        blocks.push(evaluatedTable);
        continue;
      }

      if (block.kind === "compute") {
        const currentTable = tables[block.tableName];
        if (!currentTable) {
          ThrowHelper.runtime("compute_before_table", { table: block.tableName });
        }

        const nextTable = this.computeExecutor.execute(this.toTableBlock(currentTable), block);
        tables[block.tableName] = nextTable;
        blocks.push({
          kind: "compute",
          tableName: block.tableName,
          table: nextTable,
          source: block.source,
        });
        continue;
      }

      if (block.kind === "window") {
        const currentTable = tables[block.tableName];
        if (!currentTable) {
          ThrowHelper.runtime("compute_before_table", { table: block.tableName });
        }

        const nextTable = this.windowExecutor.execute(this.toTableBlock(currentTable), block);
        tables[block.tableName] = nextTable;
        blocks.push({
          kind: "window",
          tableName: block.tableName,
          table: nextTable,
          source: block.source,
        });
        continue;
      }

      if (block.kind === "plot") {
        const evaluatedPlot = this.evaluatePlotBlock(block, tables);
        plots.push(evaluatedPlot);
        blocks.push(evaluatedPlot);
        continue;
      }

      blocks.push(block);
    }

    return {
      blocks,
      tables,
      plots,
    };
  }

  private evaluatePlotBlock(
    block: AnalyzedPlotBlock,
    tables: Record<string, EvaluatedTable>,
  ): EvaluatedPlot {
    const table = tables[block.tableName];
    if (!table) {
      ThrowHelper.runtime("plot_before_table", { table: block.tableName });
    }

    const missingDependencies = block.resolvedDependencies.filter(
      (dependency) => !table.columns.some((column) => column.name === dependency.name),
    );
    if (missingDependencies.length > 0) {
      const missingNames = missingDependencies.map((dependency) => dependency.name).join(", ");
      ThrowHelper.runtime("plot_dependency_not_materialized", { table: block.tableName, names: missingNames });
    }

    return {
      kind: "plot",
      tableName: block.tableName,
      fields: { ...block.fields },
      resolvedDependencies: block.resolvedDependencies.map((dependency) => ({ ...dependency })),
      rows: table.rows.map((row) => this.projectPlotRow(row, block.resolvedDependencies)),
      source: block.source,
    };
  }

  private materializeTable(
    name: string,
    columns: EvaluatedTable["columns"],
    rows: DataCellValueType[][],
  ): EvaluatedTable {
    return {
      name,
      columns: columns.map((column) => ({ ...column })),
      rows: rows.map((rowCells) => {
        const row: RuntimeRow = {};
        for (let index = 0; index < columns.length; index += 1) {
          row[columns[index].name] = rowCells[index];
        }
        return row;
      }),
    };
  }

  private projectPlotRow(row: RuntimeRow, dependencies: AnalyzedPlotBlock["resolvedDependencies"]): RuntimeRow {
    const projectedRow: RuntimeRow = {};

    for (const dependency of dependencies) {
      const value = row[dependency.name];
      if (value === undefined) {
        ThrowHelper.runtime("runtime_missing_plot_dependency", { name: dependency.name });
      }
      projectedRow[dependency.name] = value;
    }

    return projectedRow;
  }

  private toTableBlock(table: EvaluatedTable) {
    return {
      kind: "table" as const,
      name: table.name,
      columns: table.columns.map((column) => ({ ...column })),
      rows: table.rows.map((row) =>
        table.columns.map((column) => {
          const value = row[column.name];
          if (value === undefined) {
            ThrowHelper.runtime("runtime_missing_table_value", { column: column.name, table: table.name });
          }
          return value;
        }),
      ),
      source: {
        startLine: 0,
        endLine: 0,
      },
    };
  }
}
