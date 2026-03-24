import type { ComputeBlock, ComputeStatement } from "../../types";
import { ThrowHelper } from "../../../diagnostics";
import { COLUMN_PATTERN } from "../parser-config";
import { ParserSupport } from "../parser-support";
import type { BlockBuffer } from "../block-buffer";
import type { ColumnType } from "../../types";

export class ComputeBlockParser {
  constructor(private readonly support: ParserSupport) {}

  parse(blockBuffer: BlockBuffer): ComputeBlock {
    const targets = this.support.parseComputeTargets(blockBuffer);
    const statements: ComputeStatement[] = [];

    blockBuffer.body.forEach((rawLine, offset) => {
      const line = rawLine.trim();
      if (this.support.shouldIgnoreLine(rawLine)) {
        return;
      }
      if (line.startsWith("target:")) {
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
      kind: "compute",
      tableName: blockBuffer.name!,
      tableNameRange: blockBuffer.nameRange,
      targets,
      statements,
      source: blockBuffer.source,
    };
  }
}
