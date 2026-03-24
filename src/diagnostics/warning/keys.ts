import type { DiagnosticKeySpec } from "../error/keys";

export const WARNING_DIAGNOSTIC_SPECS = [
  {
    key: "boolean_compatible_required",
    zh: "当前写法合法，但布尔位置使用了 `dynamic`，运行时可能失败。",
    en: "The current code is legal, but a boolean-only position received `dynamic` and may fail at runtime.",
    example: "示例 / Example: if(flag, a, b) where flag is dynamic",
    params: { context: "Argument 1 of if", actual: "dynamic" },
  },
  {
    key: "number_compatible_required",
    zh: "当前写法合法，但数值位置使用了 `dynamic`，运行时可能失败。",
    en: "The current code is legal, but a numeric-only position received `dynamic` and may fail at runtime.",
    example: "示例 / Example: total = maybeNumber * 2 where maybeNumber is dynamic",
    params: { context: "Left operand of \"*\"", actual: "dynamic" },
  },
  {
    key: "type_mismatch",
    zh: "当前写法可继续分析，但动态结果可能与后续期望类型不一致。",
    en: "The current code can continue, but a dynamic result may not match a later expected type.",
    example: "示例 / Example: plugin.tax(...) returns dynamic but target expects number",
    params: { context: "Plugin call finance.tax", expected: "known", actual: "dynamic" },
  },
] as const satisfies readonly DiagnosticKeySpec<string>[];

export type WarningDiagnosticKey = (typeof WARNING_DIAGNOSTIC_SPECS)[number]["key"];
