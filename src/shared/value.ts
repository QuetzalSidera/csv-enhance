import type { ColumnType } from "../file-interface/types";
import { ThrowHelper, type DiagnosticRange } from "../diagnostics";

export type DataCellValueType =
  | { type: "string"; value: string }
  | { type: "number"; value: number }
  | { type: "boolean"; value: boolean }
  | { type: "null"; value: null };

// Values stay close to the source file and are not inflated into heavier classes.
export function inferDynamicDataCellValue(rawValue: string, range?: DiagnosticRange): DataCellValueType {
  const parsers = [parseNullValue, parseNumberValue, parseBooleanValue, parseStringValue];

  for (const parser of parsers) {
    const parsedValue = parser(rawValue);
    if (parsedValue) {
      return parsedValue;
    }
  }

  ThrowHelper.parser("dynamic_parse_failed", { rawValue }, range ? { range } : {});
}

export function parseDeclaredDataCellValue(
  rawValue: string,
  declaredType: ColumnType,
  range?: DiagnosticRange,
): DataCellValueType {
  if (declaredType === "dynamic") {
    return inferDynamicDataCellValue(rawValue, range);
  }

  const parserMap: Record<Exclude<ColumnType, "dynamic">, (value: string) => DataCellValueType | null> = {
    null: parseNullValue,
    number: parseNumberValue,
    boolean: parseBooleanValue,
    string: parseStringValue,
  };

  const parsedValue = parserMap[declaredType](rawValue);
  if (!parsedValue) {
    ThrowHelper.parser("declared_type_mismatch", { rawValue, declaredType }, range ? { range } : {});
  }

  return parsedValue;
}

export function inferColumnTypeFromCells(
  cells: DataCellValueType[],
  declaredType: ColumnType,
  isTypeExplicit: boolean,
): ColumnType {
  if (isTypeExplicit) {
    return declaredType;
  }

  const nonNullTypes = cells.filter((cell) => cell.type !== "null").map((cell) => cell.type);
  if (nonNullTypes.length === 0) {
    return "dynamic";
  }

  const firstType = nonNullTypes[0];
  if (nonNullTypes.every((type) => type === firstType)) {
    return firstType;
  }

  return "dynamic";
}

function parseNullValue(rawValue: string): DataCellValueType | null {
  return rawValue.trim() === "" ? { type: "null", value: null } : null;
}

function parseNumberValue(rawValue: string): DataCellValueType | null {
  const trimmedValue = rawValue.trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(trimmedValue)) {
    return null;
  }

  return { type: "number", value: Number(trimmedValue) };
}

function parseBooleanValue(rawValue: string): DataCellValueType | null {
  const trimmedValue = rawValue.trim();
  if (trimmedValue === "true") {
    return { type: "boolean", value: true };
  }
  if (trimmedValue === "false") {
    return { type: "boolean", value: false };
  }
  return null;
}

function parseStringValue(rawValue: string): DataCellValueType {
  return { type: "string", value: rawValue.trim() };
}
