import { ThrowHelper, type DiagnosticRange } from "../diagnostics";

export interface ParsedCsvCell {
  value: string;
  startColumn: number;
  endColumn: number;
}

export function parseCsvLine(line: string): string[] {
  return parseCsvLineDetailed(line).map((cell) => cell.value);
}

export function parseCsvLineDetailed(line: string): ParsedCsvCell[] {
  const cells: ParsedCsvCell[] = [];
  let current = "";
  let inQuotes = false;
  let cellStartIndex = 0;

  for (let index = 0; index < line.length; index += 1) {
    const currentChar = line[index];
    const nextChar = line[index + 1];

    if (currentChar === "\"") {
      if (inQuotes && nextChar === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (currentChar === "," && !inQuotes) {
      cells.push(buildParsedCsvCell(line, current, cellStartIndex, index));
      current = "";
      cellStartIndex = index + 1;
      continue;
    }

    current += currentChar;
  }

  if (inQuotes) {
    ThrowHelper.parser("unterminated_csv_quote", { lineText: line }, { range: ThrowHelper.pointRange(1, 1) });
  }

  cells.push(buildParsedCsvCell(line, current, cellStartIndex, line.length));
  return cells;
}

function buildParsedCsvCell(
  line: string,
  rawValue: string,
  cellStartIndex: number,
  cellEndIndexExclusive: number,
): ParsedCsvCell {
  const rawSegment = line.slice(cellStartIndex, cellEndIndexExclusive);
  const trimmedSegment = rawSegment.trim();
  const trimmedValue = rawValue.trim();

  if (trimmedSegment === "") {
    return {
      value: trimmedValue,
      startColumn: cellStartIndex + 1,
      endColumn: cellStartIndex + 1,
    };
  }

  const leadingWhitespaceLength = rawSegment.length - rawSegment.replace(/^\s+/, "").length;
  const trailingWhitespaceLength = rawSegment.length - rawSegment.replace(/\s+$/, "").length;
  const startColumn = cellStartIndex + leadingWhitespaceLength + 1;
  const endColumn = Math.max(
    startColumn,
    cellEndIndexExclusive - trailingWhitespaceLength,
  );

  return {
    value: trimmedValue,
    startColumn,
    endColumn,
  };
}

export function csvCellRange(line: number, cell: ParsedCsvCell): DiagnosticRange {
  return {
    startLine: line,
    startColumn: cell.startColumn,
    startOffset: Math.max(0, cell.startColumn - 1),
    endLine: line,
    endColumn: cell.endColumn,
    endOffset: Math.max(0, cell.endColumn - 1),
  };
}
