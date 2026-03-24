import { csvCellRange, parseCsvLine, parseCsvLineDetailed } from "../../shared/csv";
import { ThrowHelper } from "../../diagnostics";
import { inferColumnTypeFromCells, parseDeclaredDataCellValue } from "../../shared/value";
import type {
  ColumnType,
  ComputeBlockTargets,
  FuncReturnSpec,
  FunctionParameter,
  FunctionValueBinding,
  PlotDependencies,
  PlotFieldMap,
  SourceRange,
  TableBlock,
  TableColumn,
  ValueShape,
} from "../types";
import { COLUMN_PATTERN, FUNCTION_VALUE_PATTERN, IDENTIFIER_PATTERN } from "./parser-config";
import type { BlockBuffer } from "./block-buffer";

export class ParserSupport {
  shouldIgnoreLine(line: string): boolean {
    const trimmedLine = line.trim();
    return trimmedLine === "" || trimmedLine.startsWith("#");
  }

  lineSource(blockBuffer: BlockBuffer, offset: number): SourceRange {
    const line = blockBuffer.bodyStartLine + offset;
    return {
      startLine: line,
      endLine: line,
    };
  }

  parseKeyValueBody(blockBuffer: BlockBuffer): Record<string, string> {
    const entries: Record<string, string> = {};

    blockBuffer.body.forEach((rawLine, offset) => {
      const line = rawLine.trim();
      if (this.shouldIgnoreLine(rawLine)) {
        return;
      }

      const separatorIndex = line.indexOf(":");
      if (separatorIndex < 1) {
        ThrowHelper.parser("invalid_entry", { lineText: line }, { range: ThrowHelper.pointRange(blockBuffer.bodyStartLine + offset, 1) });
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      entries[key] = value;
    });

    return entries;
  }

  parseTableBlockContent(blockBuffer: BlockBuffer): Pick<TableBlock, "columns" | "rows"> {
    const contentLines = blockBuffer.body.filter((line) => !this.shouldIgnoreLine(line));
    if (contentLines.length === 0) {
      ThrowHelper.parser("empty_table", { table: blockBuffer.name! }, { range: ThrowHelper.pointRange(blockBuffer.source.startLine, 1) });
    }

    const headerLineNumber = blockBuffer.body.findIndex((line) => !this.shouldIgnoreLine(line));
    const headerRawLine = contentLines[0];
    const columns = this.parseTableColumns(
      parseCsvLine(headerRawLine),
      blockBuffer.name!,
      blockBuffer.bodyStartLine + headerLineNumber,
      headerRawLine,
    );
    const rows = contentLines.slice(1).map((line, index) => {
      const lineNumber = blockBuffer.bodyStartLine + index + 1;
      const parsedRow = parseCsvLineDetailed(line);
      if (parsedRow.length !== columns.length) {
        ThrowHelper.parser(
          "table_row_width_mismatch",
          { table: blockBuffer.name!, actual: parsedRow.length, expected: columns.length },
          { range: ThrowHelper.pointRange(lineNumber, 1) },
        );
      }

      return parsedRow.map((cell, cellIndex) =>
        parseDeclaredDataCellValue(
          cell.value,
          columns[cellIndex].declaredType,
          csvCellRange(lineNumber, cell),
        ),
      );
    });

    const resolvedColumns = columns.map((column, columnIndex) => ({
      ...column,
      columnType: inferColumnTypeFromCells(
        rows.map((row) => row[columnIndex]),
        column.declaredType,
        column.isTypeExplicit,
      ),
    }));

    return {
      columns: resolvedColumns,
      rows,
    };
  }

  parseComputeTargets(blockBuffer: BlockBuffer): ComputeBlockTargets {
    return this.parseTargetColumns(blockBuffer, "@compute", "compute_target_required");
  }

  parseWindowTargets(blockBuffer: BlockBuffer): ComputeBlockTargets {
    return this.parseTargetColumns(blockBuffer, "@window", "window_target_required");
  }

  private parseTargetColumns(
    blockBuffer: BlockBuffer,
    contextLabel: "@compute" | "@window",
    missingKey: "compute_target_required" | "window_target_required",
  ): ComputeBlockTargets {
    for (let offset = 0; offset < blockBuffer.body.length; offset += 1) {
      const line = blockBuffer.body[offset].trim();
      if (this.shouldIgnoreLine(blockBuffer.body[offset])) {
        continue;
      }

      if (!line.startsWith("target:")) {
        continue;
      }

      const rawLine = blockBuffer.body[offset];
      const rawValue = line.slice("target:".length);
      const columns = this.parseComputeTargetColumns(
        rawValue,
        `${contextLabel} target`,
        blockBuffer.bodyStartLine + offset,
        rawLine,
      );
      return {
        columns,
        source: this.lineSource(blockBuffer, offset),
      };
    }

    ThrowHelper.parser(
      missingKey,
      { table: blockBuffer.name! },
      {
        range: ThrowHelper.pointRange(blockBuffer.source.startLine, 1),
        suggestion: 'Add a line such as "target: total[number]".',
      },
    );
  }

  parsePlotDependencies(blockBuffer: BlockBuffer, fields: PlotFieldMap): PlotDependencies {
    for (let offset = 0; offset < blockBuffer.body.length; offset += 1) {
      const rawLine = blockBuffer.body[offset];
      const line = rawLine.trim();
      if (this.shouldIgnoreLine(rawLine)) {
        continue;
      }

      if (!line.startsWith("deps:")) {
        continue;
      }

      const rawValue = line.slice("deps:".length);
      const names = this.parseNameList(rawValue, "@plot deps", blockBuffer.bodyStartLine + offset, rawLine);
      return {
        names,
        nameRanges: this.buildNameRangeMap(rawValue, names, blockBuffer.bodyStartLine + offset, rawLine),
        source: this.lineSource(blockBuffer, offset),
      };
    }

    const inferredDependencies = [fields.x, fields.y, fields.color].filter(Boolean) as string[];
    if (inferredDependencies.length === 0) {
      ThrowHelper.parser("plot_deps_required", { table: blockBuffer.name! }, { range: ThrowHelper.pointRange(blockBuffer.source.startLine, 1) });
    }

    return {
      names: inferredDependencies,
      source: blockBuffer.source,
    };
  }

  ensureUniqueIdentifiers(
    values: string[],
    context: string,
    ranges?: Record<string, import("../../diagnostics").DiagnosticRange>,
  ): void {
    const seen = new Set<string>();

    values.forEach((value) => {
      if (!IDENTIFIER_PATTERN.test(value)) {
        ThrowHelper.parser("invalid_identifier", { identifier: value, context }, ranges?.[value] ? { range: ranges[value] } : {});
      }

      if (seen.has(value)) {
        ThrowHelper.parser("duplicate_identifier", { identifier: value, context }, ranges?.[value] ? { range: ranges[value] } : {});
      }

      seen.add(value);
    });
  }

  private parseTableColumns(headerCells: string[], tableName: string, line?: number, rawLine?: string): TableColumn[] {
    const columns = headerCells.map((headerCell) => {
      const trimmedHeaderCell = headerCell.trim();
      const match = trimmedHeaderCell.match(COLUMN_PATTERN);
      if (!match) {
        ThrowHelper.parser(
          "invalid_column_declaration",
          { declaration: headerCell, table: tableName },
          line !== undefined && rawLine !== undefined
            ? { range: this.findValueRange(rawLine, rawLine, trimmedHeaderCell, line) }
            : {},
        );
      }

      const declaredType = (match[2] ?? "dynamic") as ColumnType;
      return {
        name: match[1],
        nameRange:
          line !== undefined && rawLine !== undefined
            ? this.findValueRange(rawLine, rawLine, trimmedHeaderCell, line)
            : undefined,
        declaredType,
        columnType: declaredType,
        isTypeExplicit: match[2] !== undefined,
      };
    });

    const columnRanges: Record<string, import("../../diagnostics").DiagnosticRange> = {};
    if (line !== undefined && rawLine !== undefined) {
      headerCells.forEach((headerCell) => {
        const trimmedHeaderCell = headerCell.trim();
        const match = trimmedHeaderCell.match(COLUMN_PATTERN);
        if (match) {
          columnRanges[match[1]] = this.findValueRange(rawLine, rawLine, trimmedHeaderCell, line);
        }
      });
    }

    this.ensureUniqueIdentifiers(
      columns.map((column) => column.name),
      `@table ${tableName} header`,
      columnRanges,
    );

    return columns;
  }

  private parseComputeTargetColumns(rawValue: string, context: string, line?: number, rawLine?: string): TableColumn[] {
    const targetCells = rawValue
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (targetCells.length === 0) {
      ThrowHelper.parser("list_must_contain_name", { context });
    }

    const columns = targetCells.map((targetCell) => {
      const match = targetCell.match(COLUMN_PATTERN);
      if (!match) {
        ThrowHelper.parser(
          "invalid_identifier",
          { identifier: targetCell, context },
          line !== undefined && rawLine !== undefined
            ? { range: this.findValueRange(rawLine, rawValue, targetCell, line) }
            : {},
        );
      }

      const declaredType = (match[2] ?? "dynamic") as ColumnType;
      return {
        name: match[1],
        nameRange:
          line !== undefined && rawLine !== undefined
            ? this.findValueRange(rawLine, rawValue, targetCell, line)
            : undefined,
        declaredType,
        columnType: declaredType,
        isTypeExplicit: match[2] !== undefined,
      };
    });

    this.ensureUniqueIdentifiers(
      columns.map((column) => column.name),
      context,
      line !== undefined && rawLine !== undefined
        ? this.buildNameRangeMap(rawValue, targetCells, line, rawLine)
        : undefined,
    );

    return columns;
  }

  parseNameList(rawValue: string, context: string, line?: number, rawLine?: string): string[] {
    const names = rawValue
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (names.length === 0) {
      ThrowHelper.parser("list_must_contain_name", { context });
    }

    names.forEach((name) => {
      if (!IDENTIFIER_PATTERN.test(name)) {
        ThrowHelper.parser(
          "invalid_identifier",
          { identifier: name, context },
          line !== undefined && rawLine !== undefined
            ? { range: this.findValueRange(rawLine, rawValue, name, line) }
            : {},
        );
      }
    });

    return names;
  }

  parseFunctionParameters(rawValue: string, context: string, line?: number, rawLine?: string): FunctionParameter[] {
    const trimmedValue = rawValue.trim();
    if (trimmedValue === "") {
      return [];
    }

    const paramValues = trimmedValue
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const params = paramValues.map((paramValue) => {
      return this.parseFunctionValueBinding(paramValue, context, "scalar", line, rawLine, rawValue);
    });

    this.ensureUniqueIdentifiers(
      params.map((param) => param.name),
      context,
      line !== undefined && rawLine !== undefined
        ? this.buildNameRangeMap(rawValue, paramValues, line, rawLine)
        : undefined,
    );

    return params;
  }

  parseFunctionValueBinding(
    rawValue: string,
    context: string,
    defaultShape: ValueShape,
    line?: number,
    rawLine?: string,
    parentRawValue?: string,
  ): FunctionValueBinding {
    const trimmedValue = rawValue.trim();
    const match = trimmedValue.match(FUNCTION_VALUE_PATTERN);
    if (!match) {
      ThrowHelper.parser(
        "invalid_function_parameter",
        { param: trimmedValue, context },
        line !== undefined && rawLine !== undefined
          ? { range: this.findValueRange(rawLine, parentRawValue ?? rawLine, trimmedValue, line) }
          : {},
      );
    }

    return {
      name: match[1],
      nameRange:
        line !== undefined && rawLine !== undefined
          ? this.findValueRange(rawLine, parentRawValue ?? rawLine, trimmedValue, line)
          : undefined,
      shape: this.resolveValueShape(match[2], defaultShape),
      type: match[3] as ColumnType,
    };
  }

  parseFunctionReturnSpec(
    scalarType: string | undefined,
    shapedType: string | undefined,
    shapedShape: string | undefined,
    line: number,
    rawLine: string,
  ): FuncReturnSpec {
    if (scalarType) {
      return {
        type: scalarType as ColumnType,
        shape: "scalar",
        range: this.findValueRange(rawLine, rawLine, scalarType, line),
      };
    }

    if (!shapedType) {
      ThrowHelper.parser("invalid_func_signature", { signature: rawLine.trim() }, { range: ThrowHelper.pointRange(line, 1) });
    }

    const returnToken = shapedShape ? `[${shapedShape}:${shapedType}]` : `[${shapedType}]`;
    return {
      type: shapedType as ColumnType,
      shape: this.resolveValueShape(shapedShape, "col"),
      range: this.findValueRange(rawLine, rawLine, returnToken, line),
    };
  }

  splitSemicolonStatements(rawLine: string, line: number): Array<{ value: string; range: import("../../diagnostics").DiagnosticRange }> {
    const statements: Array<{ value: string; range: import("../../diagnostics").DiagnosticRange }> = [];
    let statementStart = 0;

    for (let index = 0; index <= rawLine.length; index += 1) {
      const isBoundary = index === rawLine.length || rawLine[index] === ";";
      if (!isBoundary) {
        continue;
      }

      const segment = rawLine.slice(statementStart, index);
      const trimmedSegment = segment.trim();
      if (trimmedSegment !== "") {
        const leadingWhitespaceMatch = segment.match(/^\s*/);
        const leadingWhitespace = leadingWhitespaceMatch ? leadingWhitespaceMatch[0].length : 0;
        const startColumn = statementStart + leadingWhitespace + 1;
        statements.push({
          value: trimmedSegment,
          range: ThrowHelper.lineFragmentRange(line, rawLine, trimmedSegment, startColumn),
        });
      }

      statementStart = index + 1;
    }

    return statements;
  }

  findValueRange(rawLine: string, rawValue: string, value: string, line: number): import("../../diagnostics").DiagnosticRange {
    const rawValueStart = rawLine.indexOf(rawValue);
    const valueStartInRawValue = rawValue.indexOf(value);
    const column = (rawValueStart >= 0 ? rawValueStart : 0) + Math.max(valueStartInRawValue, 0) + 1;
    return ThrowHelper.lineFragmentRange(line, rawLine, value, column);
  }

  buildNameRangeMap(
    rawValue: string,
    names: string[],
    line: number,
    rawLine: string,
  ): Record<string, import("../../diagnostics").DiagnosticRange> {
    const ranges: Record<string, import("../../diagnostics").DiagnosticRange> = {};
    names.forEach((name) => {
      ranges[name] = this.findValueRange(rawLine, rawValue, name, line);
    });
    return ranges;
  }

  private resolveValueShape(rawShape: string | undefined, defaultShape: ValueShape): ValueShape {
    if (rawShape === "row" || rawShape === "col") {
      return rawShape;
    }
    return defaultShape;
  }
}
