import type { ComputeStatement, WindowBlock } from "../../types";
import { ThrowHelper } from "../../../diagnostics";
import { COLUMN_PATTERN, IDENTIFIER_PATTERN } from "../parser-config";
import { ParserSupport } from "../parser-support";
import type { BlockBuffer } from "../block-buffer";
import type { ColumnType } from "../../types";

export class WindowBlockParser {
  constructor(private readonly support: ParserSupport) {}

  parse(blockBuffer: BlockBuffer): WindowBlock {
    const targets = this.support.parseWindowTargets(blockBuffer);
    const statements: ComputeStatement[] = [];
    let orderBy: string | undefined;
    let orderByRange: import("../../../diagnostics").DiagnosticRange | undefined;
    let groupBy: string[] | undefined;
    let groupByRanges: Record<string, import("../../../diagnostics").DiagnosticRange> | undefined;

    blockBuffer.body.forEach((rawLine, offset) => {
      const line = rawLine.trim();
      if (this.support.shouldIgnoreLine(rawLine)) {
        return;
      }
      if (line.startsWith("target:")) {
        return;
      }
      if (line.startsWith("order:")) {
        const rawValue = line.slice("order:".length).trim();
        const lineNumber = blockBuffer.bodyStartLine + offset;
        if (!IDENTIFIER_PATTERN.test(rawValue)) {
          ThrowHelper.parser("invalid_identifier", { identifier: rawValue, context: "@window order" }, { range: this.support.findValueRange(rawLine, rawLine.trim().slice("order:".length), rawValue, lineNumber) });
        }
        orderBy = rawValue;
        orderByRange = this.support.findValueRange(rawLine, rawLine.trim().slice("order:".length), rawValue, lineNumber);
        return;
      }
      if (line.startsWith("group:")) {
        const rawValue = line.slice("group:".length);
        const lineNumber = blockBuffer.bodyStartLine + offset;
        groupBy = this.support.parseNameList(rawValue, "@window group", lineNumber, rawLine);
        groupByRanges = this.support.buildNameRangeMap(rawValue, groupBy, lineNumber, rawLine);
        return;
      }

      const lineNumber = blockBuffer.bodyStartLine + offset;
      const separatorIndex = line.indexOf("=");
      if (separatorIndex < 1) {
        ThrowHelper.parser("invalid_compute_statement", { lineText: line }, { range: ThrowHelper.pointRange(lineNumber, 1) });
      }

      const target = line.slice(0, separatorIndex).trim();
      const expression = line.slice(separatorIndex + 1).trim();
      const targetColumn = rawLine.indexOf(target) + 1;
      const expressionColumn = rawLine.indexOf(expression, separatorIndex + 1) + 1;
      const targetMatch = target.match(COLUMN_PATTERN);
      if (!targetMatch) {
        ThrowHelper.parser("invalid_compute_target", { target }, { range: ThrowHelper.lineFragmentRange(lineNumber, rawLine, target, targetColumn) });
      }

      const declaredType = (targetMatch[2] ?? "dynamic") as ColumnType;
      statements.push({
        target: targetMatch[1],
        targetColumn: {
          name: targetMatch[1],
          declaredType,
          columnType: declaredType,
          isTypeExplicit: targetMatch[2] !== undefined,
        },
        targetRange: ThrowHelper.lineFragmentRange(lineNumber, rawLine, target, targetColumn),
        expression,
        expressionRange: ThrowHelper.lineFragmentRange(lineNumber, rawLine, expression, expressionColumn),
        source: this.support.lineSource(blockBuffer, offset),
      });
    });

    return {
      kind: "window",
      tableName: blockBuffer.name!,
      tableNameRange: blockBuffer.nameRange,
      orderBy,
      orderByRange,
      groupBy,
      groupByRanges,
      targets,
      statements,
      source: blockBuffer.source,
    };
  }
}
