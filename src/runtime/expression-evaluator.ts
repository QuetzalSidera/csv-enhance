import type { ExpressionNode } from "../analysis/types";
import { ThrowHelper } from "../diagnostics";
import { evaluateBinaryOperator, evaluateBuiltinFunction, evaluateUnaryOperator } from "../expression";
import type { DataCellValueType } from "../shared/value";
import type { ExpressionEvaluationContext, RuntimeRow } from "./types";

export class ExpressionEvaluator {
  evaluate(expression: ExpressionNode, context: ExpressionEvaluationContext): DataCellValueType {
    switch (expression.kind) {
      case "number_literal":
        return { type: "number", value: expression.value };
      case "column_reference":
        return this.resolveRowValue(context.row, expression.column.name, "column");
      case "local_reference":
        return this.resolveRowValue(context.locals, expression.name, "local");
      case "unary_expression":
        return evaluateUnaryOperator(expression.operator, this.evaluate(expression.operand, context));
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
    context: ExpressionEvaluationContext,
  ): DataCellValueType {
    return evaluateBinaryOperator(
      expression.operator,
      this.evaluate(expression.left, context),
      this.evaluate(expression.right, context),
    );
  }

  private evaluateBuiltinCall(
    expression: Extract<ExpressionNode, { kind: "builtin_call" }>,
    context: ExpressionEvaluationContext,
  ): DataCellValueType {
    return evaluateBuiltinFunction(
      expression.name,
      expression.args.map((arg) => () => this.evaluate(arg, context)),
    );
  }

  private evaluatePluginCall(
    expression: Extract<ExpressionNode, { kind: "plugin_call" }>,
    context: ExpressionEvaluationContext,
  ): DataCellValueType {
    const args = expression.args.map((arg) => this.toScalarValue(this.evaluate(arg, context)));
    const result = expression.fn(...args);
    return this.fromScalarValue(result, `${expression.pluginAlias}.${expression.exportName}`);
  }

  private evaluateFuncCall(
    expression: Extract<ExpressionNode, { kind: "func_call" }>,
    context: ExpressionEvaluationContext,
  ): DataCellValueType {
    const locals: Record<string, DataCellValueType> = {};

    for (let index = 0; index < expression.func.params.length; index += 1) {
      locals[expression.func.params[index].name] = this.evaluate(expression.args[index], context);
    }

    return this.evaluate(expression.func.expression, {
      row: context.row,
      locals,
      aggregateRows: context.aggregateRows,
    });
  }

  private resolveRowValue(
    row: RuntimeRow | Record<string, DataCellValueType>,
    name: string,
    label: "column" | "local",
  ): DataCellValueType {
    const value = row[name];
    if (!value) {
      ThrowHelper.runtime("runtime_unknown_reference", { label, name });
    }
    return value;
  }
  private toScalarValue(value: DataCellValueType): string | number | boolean | null {
    return value.value;
  }

  private fromScalarValue(
    value: unknown,
    functionName: string,
  ): DataCellValueType {
    if (value === null) {
      return { type: "null", value: null };
    }
    if (typeof value === "number") {
      return { type: "number", value };
    }
    if (typeof value === "string") {
      return { type: "string", value };
    }
    if (typeof value === "boolean") {
      return { type: "boolean", value };
    }

    ThrowHelper.runtime("plugin_scalar_return_required", { functionName });
  }
}
