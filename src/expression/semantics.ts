import type { ColumnType } from "../file-interface/types";
import { ThrowHelper } from "../diagnostics";
import type { DiagnosticRange } from "../diagnostics";
import type { DataCellValueType } from "../shared/value";
import type { BinaryOperator } from "../analysis/types";

export type ExpressionContextKind = "compute" | "func" | "window";
export type BuiltinFunctionName =
  | "if"
  | "coalesce"
  | "and"
  | "or"
  | "current"
  | "lag"
  | "lead"
  | "first"
  | "last"
  | "row_number"
  | "rank"
  | "cumsum";

interface BuiltinArgumentType {
  type: ColumnType;
  range?: DiagnosticRange;
}

interface BuiltinFunctionDefinition {
  allowedContexts: ExpressionContextKind[];
  inferReturnType: (args: BuiltinArgumentType[], callRange?: DiagnosticRange) => ColumnType;
  evaluate: (args: Array<() => DataCellValueType>) => DataCellValueType;
}

const BUILTIN_FUNCTIONS: Record<BuiltinFunctionName, BuiltinFunctionDefinition> = {
  if: {
    allowedContexts: ["compute", "func", "window"],
    inferReturnType(args, callRange) {
      if (args.length !== 3) {
        ThrowHelper.analysis("builtin_if_arity", {}, callRange ? { range: callRange } : {});
      }

      assertBooleanCompatibleType(args[0].type, "Argument 1 of if", args[0].range ?? callRange);
      return mergeBranchTypes(args[1].type, args[2].type);
    },
    evaluate(args) {
      if (args.length !== 3) {
        ThrowHelper.runtime("builtin_if_arity");
      }

      const condition = args[0]();
      if (condition.type !== "boolean") {
        ThrowHelper.runtime("boolean_compatible_required", { context: "Argument 1 of if", actual: condition.type });
      }

      return condition.value ? args[1]() : args[2]();
    },
  },
  coalesce: {
    allowedContexts: ["compute", "func", "window"],
    inferReturnType(args, callRange) {
      if (args.length === 0) {
        ThrowHelper.analysis("builtin_coalesce_arity", {}, callRange ? { range: callRange } : {});
      }

      let mergedType: ColumnType = "null";
      for (const arg of args) {
        mergedType = mergeBranchTypes(mergedType, arg.type);
      }

      return mergedType;
    },
    evaluate(args) {
      if (args.length === 0) {
        ThrowHelper.runtime("builtin_coalesce_arity");
      }

      let lastValue: DataCellValueType = { type: "null", value: null };
      for (const arg of args) {
        const value = arg();
        lastValue = value;
        if (value.type !== "null") {
          return value;
        }
      }

      return lastValue;
    },
  },
  and: {
    allowedContexts: ["compute", "func", "window"],
    inferReturnType(args, callRange) {
      if (args.length === 0) {
        ThrowHelper.analysis("builtin_and_arity", {}, callRange ? { range: callRange } : {});
      }

      args.forEach((arg, index) => {
        assertBooleanCompatibleType(arg.type, `Argument ${index + 1} of and`, arg.range ?? callRange);
      });

      return "boolean";
    },
    evaluate(args) {
      if (args.length === 0) {
        ThrowHelper.runtime("builtin_and_arity");
      }

      for (let index = 0; index < args.length; index += 1) {
        const value = args[index]();
        if (value.type !== "boolean") {
          ThrowHelper.runtime("boolean_compatible_required", { context: `Argument ${index + 1} of and`, actual: value.type });
        }
        if (!value.value) {
          return { type: "boolean", value: false };
        }
      }

      return { type: "boolean", value: true };
    },
  },
  or: {
    allowedContexts: ["compute", "func", "window"],
    inferReturnType(args, callRange) {
      if (args.length === 0) {
        ThrowHelper.analysis("builtin_or_arity", {}, callRange ? { range: callRange } : {});
      }

      args.forEach((arg, index) => {
        assertBooleanCompatibleType(arg.type, `Argument ${index + 1} of or`, arg.range ?? callRange);
      });

      return "boolean";
    },
    evaluate(args) {
      if (args.length === 0) {
        ThrowHelper.runtime("builtin_or_arity");
      }

      for (let index = 0; index < args.length; index += 1) {
        const value = args[index]();
        if (value.type !== "boolean") {
          ThrowHelper.runtime("boolean_compatible_required", { context: `Argument ${index + 1} of or`, actual: value.type });
        }
        if (value.value) {
          return { type: "boolean", value: true };
        }
      }

      return { type: "boolean", value: false };
    },
  },
  current: createWindowOnlyBuiltin("current", 1),
  lag: createWindowOnlyBuiltin("lag", 2),
  lead: createWindowOnlyBuiltin("lead", 2),
  first: createWindowOnlyBuiltin("first", 1),
  last: createWindowOnlyBuiltin("last", 1),
  row_number: createWindowOnlyBuiltin("row_number", 0),
  rank: createWindowOnlyBuiltin("rank", 0),
  cumsum: createWindowOnlyBuiltin("cumsum", 1),
};

export const BUILTIN_FUNCTION_NAMES = Object.keys(BUILTIN_FUNCTIONS) as BuiltinFunctionName[];

export function isBuiltinFunction(name: string, context?: ExpressionContextKind): name is BuiltinFunctionName {
  if (!Object.prototype.hasOwnProperty.call(BUILTIN_FUNCTIONS, name)) {
    return false;
  }
  if (!context) {
    return true;
  }
  return BUILTIN_FUNCTIONS[name as BuiltinFunctionName].allowedContexts.includes(context);
}

export function isKnownBuiltinFunction(name: string): name is BuiltinFunctionName {
  return Object.prototype.hasOwnProperty.call(BUILTIN_FUNCTIONS, name);
}

export function inferBuiltinFunctionType(name: BuiltinFunctionName, argTypes: ColumnType[], context: ExpressionContextKind): ColumnType {
  assertBuiltinAvailableInContext(name, context);
  return BUILTIN_FUNCTIONS[name].inferReturnType(argTypes.map((type) => ({ type })));
}

export function inferBuiltinFunctionTypeWithRanges(
  name: BuiltinFunctionName,
  args: BuiltinArgumentType[],
  context: ExpressionContextKind,
  callRange?: DiagnosticRange,
): ColumnType {
  assertBuiltinAvailableInContext(name, context, callRange);
  return BUILTIN_FUNCTIONS[name].inferReturnType(args, callRange);
}

export function evaluateBuiltinFunction(
  name: BuiltinFunctionName,
  args: Array<() => DataCellValueType>,
  context: ExpressionContextKind,
): DataCellValueType {
  assertBuiltinAvailableInContext(name, context);
  return BUILTIN_FUNCTIONS[name].evaluate(args);
}

export function inferUnaryOperatorType(operator: "-", operandType: ColumnType): ColumnType {
  assertNumericCompatibleType(operandType, `Unary "${operator}" operand`);
  return "number";
}

export function inferBinaryOperatorType(
  operator: BinaryOperator,
  leftType: ColumnType,
  rightType: ColumnType,
): ColumnType {
  assertNumericCompatibleType(leftType, `Left operand of "${operator}"`);
  assertNumericCompatibleType(rightType, `Right operand of "${operator}"`);
  return "number";
}

export function evaluateUnaryOperator(operator: "-", operand: DataCellValueType): DataCellValueType {
  const numericOperand = toNumber(operand, `Unary "${operator}" operand`);
  return {
    type: "number",
    value: -numericOperand,
  };
}

export function evaluateBinaryOperator(
  operator: BinaryOperator,
  left: DataCellValueType,
  right: DataCellValueType,
): DataCellValueType {
  const leftNumber = toNumber(left, `Left operand of "${operator}"`);
  const rightNumber = toNumber(right, `Right operand of "${operator}"`);

  switch (operator) {
    case "+":
      return { type: "number", value: leftNumber + rightNumber };
    case "-":
      return { type: "number", value: leftNumber - rightNumber };
    case "*":
      return { type: "number", value: leftNumber * rightNumber };
    case "/":
      if (rightNumber === 0) {
        ThrowHelper.runtime("division_by_zero");
      }
      return { type: "number", value: leftNumber / rightNumber };
  }
}

function mergeBranchTypes(leftType: ColumnType, rightType: ColumnType): ColumnType {
  if (leftType === rightType) {
    return leftType;
  }
  if (leftType === "null") {
    return rightType;
  }
  if (rightType === "null") {
    return leftType;
  }
  return "dynamic";
}

function assertNumericCompatibleType(type: ColumnType, context: string, range?: DiagnosticRange): void {
  if (type === "string" || type === "boolean" || type === "null") {
    ThrowHelper.analysis("number_compatible_required", { context, actual: type }, range ? { range } : {});
  }
}

function assertBooleanCompatibleType(type: ColumnType, context: string, range?: DiagnosticRange): void {
  if (type === "number" || type === "string" || type === "null") {
    ThrowHelper.analysis("boolean_compatible_required", { context, actual: type }, range ? { range } : {});
  }
}

function toNumber(value: DataCellValueType, context: string): number {
  if (value.type !== "number") {
    ThrowHelper.runtime("number_runtime_required", { context, actual: value.type });
  }
  return value.value;
}

function createWindowOnlyBuiltin(name: BuiltinFunctionName, arity: number): BuiltinFunctionDefinition {
  return {
    allowedContexts: ["window"],
    inferReturnType(args, callRange) {
      if (args.length !== arity) {
        ThrowHelper.analysis(
          "function_arity_mismatch",
          { name, expected: arity, actual: args.length },
          callRange ? { range: callRange } : {},
        );
      }
      return "dynamic";
    },
    evaluate() {
      ThrowHelper.runtime("runtime_unknown_reference", { label: "local", name: `${name}.window` });
    },
  };
}

function assertBuiltinAvailableInContext(
  name: BuiltinFunctionName,
  context: ExpressionContextKind,
  range?: DiagnosticRange,
): void {
  if (!BUILTIN_FUNCTIONS[name].allowedContexts.includes(context)) {
    ThrowHelper.analysis(
      "builtin_context_not_allowed",
      { name, context },
      range ? { range } : {},
    );
  }
}
