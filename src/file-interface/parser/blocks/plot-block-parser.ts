import type { PlotBlock, PlotFieldMap, TableBlock } from "../../types";
import { ThrowHelper } from "../../../diagnostics";
import type { BlockBuffer, ParserTableRegistry } from "../block-buffer";
import { SUPPORTED_PLOT_KEYS } from "../parser-config";
import { ParserSupport } from "../parser-support";

export class PlotBlockParser {
  constructor(private readonly support: ParserSupport) {}

  parse(blockBuffer: BlockBuffer, tableMap: ParserTableRegistry): PlotBlock {
    const table = tableMap[blockBuffer.name!];
    if (!table) {
      ThrowHelper.parser("unknown_plot_table", { table: blockBuffer.name! }, { range: ThrowHelper.pointRange(blockBuffer.source.startLine, 1) });
    }

    const contentLines = blockBuffer.body
      .filter((line) => !this.support.shouldIgnoreLine(line))
      .map((line) => line.trim())
      .filter(Boolean);
    if (contentLines.length === 0) {
      ThrowHelper.parser("empty_plot", { table: blockBuffer.name! }, { range: ThrowHelper.pointRange(blockBuffer.source.startLine, 1) });
    }

    const { fields, fieldRanges } = this.parseFields(blockBuffer, contentLines);
    if (!fields.x || !fields.y) {
      ThrowHelper.parser("plot_axes_required", { table: blockBuffer.name! }, { range: ThrowHelper.pointRange(blockBuffer.source.startLine, 1) });
    }

    return {
      kind: "plot",
      tableName: blockBuffer.name!,
      dependencies: this.support.parsePlotDependencies(blockBuffer, fields),
      fields,
      fieldRanges,
      source: blockBuffer.source,
    };
  }

  private parseFields(
    blockBuffer: BlockBuffer,
    contentLines: string[],
  ): { fields: PlotFieldMap; fieldRanges: Partial<Record<keyof PlotFieldMap, import("../../../diagnostics").DiagnosticRange>> } {
    if (contentLines.length === 1 && !contentLines[0].includes(":")) {
      const parts = contentLines[0].split(/\s+/);
      if (parts.length < 3 || parts.length > 4) {
        ThrowHelper.parser("invalid_plot_shorthand", { value: contentLines[0] }, { range: ThrowHelper.pointRange(blockBuffer.bodyStartLine, 1) });
      }
      if (parts[0] !== "bar") {
        ThrowHelper.parser("unsupported_plot_type", { value: contentLines[0] }, { range: ThrowHelper.pointRange(blockBuffer.bodyStartLine, 1) });
      }

      const rawLine = blockBuffer.body.find((line) => !this.support.shouldIgnoreLine(line)) ?? contentLines[0];
      const lineNumber = blockBuffer.body.findIndex((line) => !this.support.shouldIgnoreLine(line));
      return {
        fields: {
          x: parts[1],
          y: parts[2],
          color: parts[3],
        },
        fieldRanges: {
          x: this.support.findValueRange(rawLine, rawLine, parts[1], blockBuffer.bodyStartLine + lineNumber),
          y: this.support.findValueRange(rawLine, rawLine, parts[2], blockBuffer.bodyStartLine + lineNumber),
          ...(parts[3]
            ? { color: this.support.findValueRange(rawLine, rawLine, parts[3], blockBuffer.bodyStartLine + lineNumber) }
            : {}),
        },
      };
    }

    const entries = this.support.parseKeyValueBody(blockBuffer);
    const fieldRanges: Partial<Record<keyof PlotFieldMap, import("../../../diagnostics").DiagnosticRange>> = {};
    Object.keys(entries).forEach((key) => {
      if (!SUPPORTED_PLOT_KEYS.has(key)) {
        const entryOffset = blockBuffer.body.findIndex((line) => {
          if (this.support.shouldIgnoreLine(line)) {
            return false;
          }
          return line.trim().startsWith(`${key}:`);
        });
        const rawLine = entryOffset >= 0 ? blockBuffer.body[entryOffset] : key;
        ThrowHelper.parser(
          "unsupported_plot_key",
          { key },
          {
            range:
              entryOffset >= 0
                ? ThrowHelper.lineFragmentRange(blockBuffer.bodyStartLine + entryOffset, rawLine, key, rawLine.indexOf(key) + 1)
                : ThrowHelper.pointRange(blockBuffer.source.startLine, 1),
          },
        );
      }
      const entryOffset = blockBuffer.body.findIndex((line) => {
        if (this.support.shouldIgnoreLine(line)) {
          return false;
        }
        const trimmed = line.trim();
        return trimmed.startsWith(`${key}:`);
      });
      if (entryOffset >= 0 && (key === "x" || key === "y" || key === "color" || key === "title")) {
        const rawLine = blockBuffer.body[entryOffset];
        fieldRanges[key] = this.support.findValueRange(
          rawLine,
          rawLine.trim().slice(`${key}:`.length),
          entries[key],
          blockBuffer.bodyStartLine + entryOffset,
        );
      }
    });

    return {
      fields: {
        x: entries.x,
        y: entries.y,
        color: entries.color,
        title: entries.title,
      },
      fieldRanges,
    };
  }
}
