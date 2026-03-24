import type { AnalyzedWindowBlock, ExpressionNode } from "../analysis/types";
import { ThrowHelper } from "../diagnostics";
import type { TableBlock, TableColumn } from "../file-interface/types";
import type { DataCellValueType } from "../shared/value";
import type { EvaluatedTable, RuntimeRow } from "./types";

interface WindowExecutionContext {
  allRows: RuntimeRow[];
  partitionRows: RuntimeRow[];
  currentRow: RuntimeRow;
  currentPartitionIndex: number;
  locals: Record<string, DataCellValueType>;
  orderColumnName?: string;
}

export class WindowExecutor {
  execute(table: TableBlock, windowBlock: AnalyzedWindowBlock): EvaluatedTable {
    if (table.name !== windowBlock.tableName) {
      ThrowHelper.runtime("compute_table_mismatch", { expected: windowBlock.tableName, actual: table.name });
    }

    const rows = this.buildRuntimeRows(table);
    const partitionGroups = this.buildPartitionGroups(rows, windowBlock);

    for (const partitionRows of partitionGroups) {
      // Ordering is optional: when omitted, the original file order is preserved.
      const orderColumnName = windowBlock.orderBy;
      if (orderColumnName) {
        partitionRows.sort((left, right) => this.compareValues(left[orderColumnName], right[orderColumnName]));
      }

      for (let index = 0; index < partitionRows.length; index += 1) {
        const currentRow = partitionRows[index];
        const locals: Record<string, DataCellValueType> = {};

        for (const statement of windowBlock.statements) {
          const value = this.evaluateExpression(statement.expression, {
            allRows: rows,
            partitionRows,
            currentRow,
            currentPartitionIndex: index,
            locals,
            orderColumnName: windowBlock.orderBy,
          });

          if (statement.isOutput) {
            currentRow[statement.target.columnName] = value;
            continue;
          }

          locals[statement.target.columnName] = value;
        }
      }
    }

    return {
      name: table.name,
      columns: [...table.columns, ...windowBlock.outputColumns.map((column) => ({ ...column }))],
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

  private buildPartitionGroups(rows: RuntimeRow[], windowBlock: AnalyzedWindowBlock): RuntimeRow[][] {
    // When no group key is declared, keep the file order as the implicit window order.
    if (windowBlock.resolvedGroupColumns.length === 0) {
      return [rows.slice()];
    }

    const groups = new Map<string, RuntimeRow[]>();
    rows.forEach((row) => {
      const key = windowBlock.resolvedGroupColumns.map((column) => this.serializeValue(row[column.name])).join("::");
      const group = groups.get(key) ?? [];
      group.push(row);
      groups.set(key, group);
    });
    return [...groups.values()];
  }

  private evaluateExpression(expression: ExpressionNode, context: WindowExecutionContext): DataCellValueType {
    switch (expression.kind) {
      case "number_literal":
        return { type: "number", value: expression.value };
      case "column_reference":
        return context.currentRow[expression.column.name];
      case "local_reference": {
        const value = context.locals[expression.name];
        if (!value) {
          ThrowHelper.runtime("runtime_unknown_reference", { label: "local", name: expression.name });
        }
        return value;
      }
      case "unary_expression": {
        const operand = this.evaluateExpression(expression.operand, context);
        if (operand.type !== "number") {
          ThrowHelper.runtime("number_runtime_required", { context: `Unary "${expression.operator}" operand`, actual: operand.type });
        }
        return { type: "number", value: -operand.value };
      }
      case "binary_expression":
        return this.evaluateBinaryExpression(expression, context);
      case "builtin_call":
        return this.evaluateBuiltinCall(expression, context);
      case "func_call":
        return this.evaluateFuncCall(expression, context);
      case "plugin_call":
        return this.evaluatePluginCall(expression, context);
    }
  }

  private evaluateBinaryExpression(
    expression: Extract<ExpressionNode, { kind: "binary_expression" }>,
    context: WindowExecutionContext,
  ): DataCellValueType {
    const left = this.evaluateExpression(expression.left, context);
    const right = this.evaluateExpression(expression.right, context);
    if (left.type !== "number") {
      ThrowHelper.runtime("number_runtime_required", { context: `Left operand of "${expression.operator}"`, actual: left.type });
    }
    if (right.type !== "number") {
      ThrowHelper.runtime("number_runtime_required", { context: `Right operand of "${expression.operator}"`, actual: right.type });
    }

    switch (expression.operator) {
      case "+":
        return { type: "number", value: left.value + right.value };
      case "-":
        return { type: "number", value: left.value - right.value };
      case "*":
        return { type: "number", value: left.value * right.value };
      case "/":
        if (right.value === 0) {
          ThrowHelper.runtime("division_by_zero");
        }
        return { type: "number", value: left.value / right.value };
    }
  }

  private evaluateBuiltinCall(
    expression: Extract<ExpressionNode, { kind: "builtin_call" }>,
    context: WindowExecutionContext,
  ): DataCellValueType {
    switch (expression.name) {
      case "current":
        return this.resolveColumnArgument(expression.args[0], context.currentRow);
      case "lag":
        return this.offsetColumnValue(expression.args[0], expression.args[1], context, -1);
      case "lead":
        return this.offsetColumnValue(expression.args[0], expression.args[1], context, 1);
      case "first":
        return this.resolveColumnArgument(expression.args[0], context.partitionRows[0]);
      case "last":
        return this.resolveColumnArgument(expression.args[0], context.partitionRows[context.partitionRows.length - 1]);
      case "row_number":
        return { type: "number", value: context.currentPartitionIndex + 1 };
      case "rank":
        return { type: "number", value: this.rankForCurrentRow(context) };
      case "cumsum":
        return this.cumulativeSum(expression.args[0], context);
      case "if":
      case "coalesce":
      case "and":
      case "or":
        return this.evaluateGenericBuiltin(expression, context);
    }
  }

  private evaluateGenericBuiltin(
    expression: Extract<ExpressionNode, { kind: "builtin_call" }>,
    context: WindowExecutionContext,
  ): DataCellValueType {
    if (expression.name === "if") {
      const condition = this.evaluateExpression(expression.args[0], context);
      if (condition.type !== "boolean") {
        ThrowHelper.runtime("boolean_compatible_required", { context: "Argument 1 of if", actual: condition.type });
      }
      return condition.value
        ? this.evaluateExpression(expression.args[1], context)
        : this.evaluateExpression(expression.args[2], context);
    }

    if (expression.name === "coalesce") {
      let lastValue: DataCellValueType = { type: "null", value: null };
      for (const arg of expression.args) {
        const value = this.evaluateExpression(arg, context);
        lastValue = value;
        if (value.type !== "null") {
          return value;
        }
      }
      return lastValue;
    }

    if (expression.name === "and" || expression.name === "or") {
      const defaultValue = expression.name === "and";
      for (let index = 0; index < expression.args.length; index += 1) {
        const value = this.evaluateExpression(expression.args[index], context);
        if (value.type !== "boolean") {
          ThrowHelper.runtime("boolean_compatible_required", { context: `Argument ${index + 1} of ${expression.name}`, actual: value.type });
        }
        if (expression.name === "and" && !value.value) {
          return { type: "boolean", value: false };
        }
        if (expression.name === "or" && value.value) {
          return { type: "boolean", value: true };
        }
      }
      return { type: "boolean", value: defaultValue };
    }

    ThrowHelper.runtime("runtime_unknown_reference", { label: "local", name: `builtin.${expression.name}` });
  }

  private evaluateFuncCall(
    expression: Extract<ExpressionNode, { kind: "func_call" }>,
    context: WindowExecutionContext,
  ): DataCellValueType {
    const locals: Record<string, DataCellValueType> = {};
    for (let index = 0; index < expression.func.params.length; index += 1) {
      locals[expression.func.params[index].name] = this.evaluateExpression(expression.args[index], context);
    }

    for (const statement of expression.func.statements) {
      if (statement.kind === "assign") {
        locals[statement.target.name] = this.evaluateExpression(statement.expression, {
          ...context,
          locals,
        });
        continue;
      }
      return this.evaluateExpression(statement.expression, {
        ...context,
        locals,
      });
    }

    ThrowHelper.runtime("runtime_unknown_reference", { label: "local", name: `${expression.functionName}.return` });
  }

  private evaluatePluginCall(
    expression: Extract<ExpressionNode, { kind: "plugin_call" }>,
    context: WindowExecutionContext,
  ): DataCellValueType {
    const args = expression.args.map((arg) => this.evaluateExpression(arg, context).value);
    const result = expression.fn(...args);
    if (result === null) {
      return { type: "null", value: null };
    }
    if (typeof result === "number") {
      return { type: "number", value: result };
    }
    if (typeof result === "string") {
      return { type: "string", value: result };
    }
    if (typeof result === "boolean") {
      return { type: "boolean", value: result };
    }
    ThrowHelper.runtime("plugin_scalar_return_required", { functionName: `${expression.pluginAlias}.${expression.exportName}` });
  }

  private resolveColumnArgument(expression: ExpressionNode | undefined, row: RuntimeRow): DataCellValueType {
    if (!expression || expression.kind !== "column_reference") {
      ThrowHelper.runtime("runtime_unknown_reference", { label: "column", name: "window-arg" });
    }
    return row[expression.column.name];
  }

  private offsetColumnValue(
    columnExpression: ExpressionNode | undefined,
    offsetExpression: ExpressionNode | undefined,
    context: WindowExecutionContext,
    direction: -1 | 1,
  ): DataCellValueType {
    const offsetValue = offsetExpression ? this.evaluateExpression(offsetExpression, context) : { type: "number", value: 1 as const };
    if (offsetValue.type !== "number") {
      ThrowHelper.runtime("number_runtime_required", { context: "Window offset", actual: offsetValue.type });
    }

    if (!columnExpression || columnExpression.kind !== "column_reference") {
      ThrowHelper.runtime("runtime_unknown_reference", { label: "column", name: "window-arg" });
    }

    const targetIndex = context.currentPartitionIndex + direction * offsetValue.value;
    if (targetIndex < 0 || targetIndex >= context.partitionRows.length) {
      return { type: "null", value: null };
    }
    return context.partitionRows[targetIndex][columnExpression.column.name];
  }

  private cumulativeSum(columnExpression: ExpressionNode | undefined, context: WindowExecutionContext): DataCellValueType {
    if (!columnExpression || columnExpression.kind !== "column_reference") {
      ThrowHelper.runtime("runtime_unknown_reference", { label: "column", name: "cumsum" });
    }

    let total = 0;
    for (let index = 0; index <= context.currentPartitionIndex; index += 1) {
      const value = context.partitionRows[index][columnExpression.column.name];
      if (value.type !== "number") {
        ThrowHelper.runtime("number_runtime_required", { context: "Builtin cumsum argument 1", actual: value.type });
      }
      total += value.value;
    }
    return { type: "number", value: total };
  }

  private rankForCurrentRow(context: WindowExecutionContext): number {
    // Without an explicit order column, rank follows the same stable file order as row_number.
    if (!context.orderColumnName) {
      return context.currentPartitionIndex + 1;
    }
    const currentOrderValue = context.currentRow[context.orderColumnName];
    let rank = 1;
    for (let index = 0; index < context.currentPartitionIndex; index += 1) {
      if (this.compareValues(context.partitionRows[index][context.orderColumnName], currentOrderValue) < 0) {
        rank += 1;
      }
    }
    return rank;
  }

  private compareValues(left: DataCellValueType, right: DataCellValueType): number {
    if (left.type === "null" && right.type === "null") {
      return 0;
    }
    if (left.type === "null") {
      return 1;
    }
    if (right.type === "null") {
      return -1;
    }
    if (left.type === "number" && right.type === "number") {
      return left.value - right.value;
    }
    return String(left.value).localeCompare(String(right.value));
  }

  private serializeValue(value: DataCellValueType): string {
    return `${value.type}:${String(value.value)}`;
  }
}
