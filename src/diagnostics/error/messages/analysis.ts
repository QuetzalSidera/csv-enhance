import type { AnalysisDiagnosticKey } from "../keys";

type MessageFormatter = (params: Record<string, string | number>) => string;

export const ANALYSIS_ERROR_MESSAGES: Record<AnalysisDiagnosticKey, MessageFormatter> = {
  duplicate_table_name: ({ name }) => `Duplicate table name "${name}"`,
  duplicate_function_name: ({ name }) => `Duplicate function name "${name}"`,
  builtin_function_name_reserved: ({ name }) => `@func ${name} conflicts with reserved builtin function "${name}"`,
  duplicate_plugin_alias: ({ name }) => `Duplicate plugin alias "${name}"`,
  unknown_compute_table: ({ table }) => `Unknown table for @compute ${table}`,
  unknown_function: ({ name }) => `Unknown function "${name}"`,
  recursive_function_call: ({ path }) => `Recursive @func call detected: ${path}`,
  unknown_plot_dependency: ({ dependency, table }) => `Unknown plot dependency "${dependency}" in @plot ${table}`,
  unknown_plot_table: ({ table }) => `Unknown table for @plot ${table}`,
  unknown_reference: ({ name, table }) => `Unknown reference "${name}" in @compute ${table}`,
  function_arity_mismatch: ({ name, expected, actual }) =>
    `Function "${name}" expects ${expected} arguments but received ${actual}`,
  unsupported_function_call: ({ callee }) => `Unsupported function call "${callee}"`,
  unknown_plugin_alias: ({ alias }) => `Unknown plugin alias "${alias}"`,
  unknown_plugin_export: ({ callee }) => `Unknown plugin export "${callee}"`,
  unknown_function_parameter_reference: ({ name, func }) => `Unknown parameter reference "${name}" in @func ${func}`,
  type_mismatch: ({ context, expected, actual }) => `${context} expects ${expected} but expression resolves to ${actual}`,
  plot_field_missing: ({ table, field }) => `@plot ${table} must define ${field}`,
  plot_field_not_in_deps: ({ field, value }) => `Plot field "${field}" must be declared in deps: ${value}`,
  builtin_if_arity: () => `Builtin function if expects exactly 3 arguments`,
  builtin_coalesce_arity: () => `Builtin function coalesce expects at least 1 argument`,
  builtin_and_arity: () => `Builtin function and expects at least 1 argument`,
  builtin_or_arity: () => `Builtin function or expects at least 1 argument`,
  boolean_compatible_required: ({ context, actual }) => `${context} must be boolean-compatible, received ${actual}`,
  number_compatible_required: ({ context, actual }) => `${context} must be number-compatible, received ${actual}`,
};
