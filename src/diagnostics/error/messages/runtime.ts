import type { RuntimeDiagnosticKey } from "../keys";

type MessageFormatter = (params: Record<string, string | number>) => string;

export const RUNTIME_ERROR_MESSAGES: Record<RuntimeDiagnosticKey, MessageFormatter> = {
  builtin_if_arity: () => `Builtin function if expects exactly 3 arguments`,
  builtin_coalesce_arity: () => `Builtin function coalesce expects at least 1 argument`,
  builtin_and_arity: () => `Builtin function and expects at least 1 argument`,
  builtin_or_arity: () => `Builtin function or expects at least 1 argument`,
  boolean_compatible_required: ({ context, actual }) => `${context} must be boolean-compatible, received ${actual}`,
  plot_axes_required: ({ table }) => `Bar plot for table ${table} must define x and y`,
  number_runtime_required: ({ context, actual }) => `${context} must evaluate to number, received ${actual}`,
  division_by_zero: () => `Division by zero`,
  runtime_unknown_reference: ({ label, name }) => `Unknown ${label} reference "${name}" during expression evaluation`,
  plugin_scalar_return_required: ({ functionName }) => `Plugin function ${functionName} must return a scalar value`,
  compute_before_table: ({ table }) => `Cannot execute @compute ${table} before its table is materialized`,
  plot_before_table: ({ table }) => `Cannot execute @plot ${table} before its table is materialized`,
  plot_dependency_not_materialized: ({ table, names }) =>
    `@plot ${table} depends on columns that are not materialized yet: ${names}`,
  runtime_missing_plot_dependency: ({ name }) => `Missing runtime value for plot dependency "${name}"`,
  runtime_missing_table_value: ({ column, table }) => `Missing runtime value for column "${column}" in table "${table}"`,
  compute_table_mismatch: ({ expected, actual }) =>
    `Compute block targets table "${expected}" but executor received "${actual}"`,
  missing_output_statement: ({ name }) => `Missing output statement for compute target "${name}"`,
  plot_field_unknown: ({ field, table }) => `Unknown plot field "${field}" for table "${table}"`,
  plugin_export_not_function: ({ exportName, modulePath }) => `Plugin export "${exportName}" in ${modulePath} is not a function`,
  plugin_module_extension_unsupported: ({ extension }) => `Unsupported plugin module extension: ${extension}`,
  plugin_import_path_must_be_local: ({ request }) => `Plugin imports must be local paths: ${request}`,
  plugin_default_export_unsupported: () => `Default exports are not supported in plugin modules`,
  relative_plugin_path_requires_file: ({ modulePath }) =>
    `Cannot resolve relative plugin path without a sheet file path: ${modulePath}`,
};
