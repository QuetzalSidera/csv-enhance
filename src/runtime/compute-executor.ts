import type { AnalyzedComputeBlock } from "../analysis/types";
import { ThrowHelper } from "../diagnostics";
import type { TableBlock, TableColumn } from "../file-interface/types";
import type { DataCellValueType } from "../shared/value";
import { ExpressionEvaluator } from "./expression-evaluator";
import type { EvaluatedTable, RuntimeRow } from "./types";

export class ComputeExecutor {
  constructor(private readonly evaluator: ExpressionEvaluator = new ExpressionEvaluator()) {}

  execute(table: TableBlock, computeBlock: AnalyzedComputeBlock): EvaluatedTable {
    if (table.name !== computeBlock.tableName) {
      ThrowHelper.runtime("compute_table_mismatch", { expected: computeBlock.tableName, actual: table.name });
    }

    const rows = this.buildRuntimeRows(table);

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const locals: Record<string, DataCellValueType> = {};

      for (const statement of computeBlock.statements) {
        const value = this.evaluator.evaluate(statement.expression, {
          row,
          locals,
          aggregateRows: rows,
        });

        if (statement.isOutput) {
          row[statement.target.columnName] = value;
          continue;
        }

        locals[statement.target.columnName] = value;
      }
    }

    const outputColumns = computeBlock.outputs.map((output) => this.resolveOutputColumn(computeBlock, output.columnName));

    return {
      name: table.name,
      columns: [...table.columns, ...outputColumns],
      rows,
    };
  }

  private buildRuntimeRows(table: TableBlock): RuntimeRow[] {
    return table.rows.map((rowCells) => {
      const row: RuntimeRow = {};
      for (let index = 0; index < table.columns.length; index += 1) {
        row[table.columns[index].name] = rowCells[index];
      }
      return row;
    });
  }

  private resolveOutputColumn(computeBlock: AnalyzedComputeBlock, columnName: string): TableColumn {
    const outputStatement = computeBlock.statements.find(
      (statement) => statement.target.columnName === columnName && statement.isOutput,
    );
    if (!outputStatement) {
      ThrowHelper.runtime("missing_output_statement", { name: columnName });
    }

    const matchedColumn = computeBlock.outputColumns.find((column) => column.name === columnName);
    if (matchedColumn) {
      return matchedColumn;
    }

    return {
      name: columnName,
      declaredType: "dynamic",
      columnType: "dynamic",
      isTypeExplicit: false,
    };
  }
}
