import type { ParserDiagnosticKey } from "../keys";

type MessageFormatter = (params: Record<string, string | number>) => string;

export const PARSER_ERROR_MESSAGES: Record<ParserDiagnosticKey, MessageFormatter> = {
  expected_directive: ({ lineText }) => `Expected a directive but found "${lineText}"`,
  meta_name_not_allowed: () => `@meta does not accept a block name`,
  block_name_required: ({ directive }) => `@${directive} requires a block name`,
  unsupported_directive: ({ directive }) => `Unsupported directive @${directive}`,
  invalid_meta_entry: ({ lineText }) => `Invalid @meta entry "${lineText}"`,
  invalid_meta_key: ({ key }) => `Invalid @meta key "${key}"`,
  invalid_entry: ({ lineText }) => `Invalid key-value entry "${lineText}"`,
  empty_table: ({ table }) => `@table ${table} is empty`,
  table_row_width_mismatch: ({ table, actual, expected }) =>
    `@table ${table} row width mismatch: expected ${expected} cells but received ${actual}`,
  compute_target_required: ({ table }) => `@compute ${table} must declare target:`,
  plot_deps_required: ({ table }) => `@plot ${table} must declare deps:`,
  invalid_identifier: ({ identifier, context }) => `Invalid identifier "${identifier}" in ${context}`,
  duplicate_identifier: ({ identifier, context }) => `Duplicate identifier "${identifier}" in ${context}`,
  invalid_column_declaration: ({ declaration, table }) =>
    `Invalid column declaration "${declaration}" in @table ${table}`,
  list_must_contain_name: ({ context }) => `${context} must contain at least one name`,
  invalid_function_parameter: ({ param, context }) => `Invalid function parameter "${param}" in ${context}`,
  plugin_path_required: ({ alias }) => `@plugin ${alias} requires a path`,
  unknown_plot_table: ({ table }) => `Unknown table for @plot ${table}`,
  empty_plot: ({ table }) => `@plot ${table} is empty`,
  plot_axes_required: ({ table }) => `Bar plot for table ${table} must define x and y`,
  invalid_plot_shorthand: ({ value }) => `Invalid shorthand plot definition: ${value}`,
  unsupported_plot_type: ({ value }) => `Only bar plots are supported in this demo: ${value}`,
  unsupported_plot_key: ({ key }) => `Unsupported plot key "${key}"`,
  invalid_func_signature: ({ signature }) => `Invalid @func signature: ${signature}`,
  func_body_expression_count: ({ name }) => `@func ${name} must define exactly one expression body`,
  invalid_compute_statement: ({ lineText }) => `Invalid @compute statement "${lineText}"`,
  invalid_compute_target: ({ target }) => `Invalid computed column name "${target}"`,
  unterminated_csv_quote: ({ lineText }) => `Unterminated quoted value in CSV line: ${lineText}`,
  dynamic_parse_failed: ({ rawValue }) => `Unable to parse dynamic cell value: ${rawValue}`,
  declared_type_mismatch: ({ rawValue, declaredType }) =>
    `Value "${rawValue}" does not match declared column type "${declaredType}"`,
  invalid_numeric_literal: ({ value }) => `Invalid numeric literal: ${value}`,
  unexpected_expression_character: ({ character }) => `Unexpected character in expression: ${character}`,
  unexpected_expression_token: ({ token }) => `Unexpected token in expression: ${token}`,
  expected_expression_token: ({ expected, actual }) => `Expected ${expected} but found ${actual}`,
};
