import type { ParsedPluginBlock } from "../../types";
import { ThrowHelper } from "../../../diagnostics";
import type { BlockBuffer } from "../block-buffer";
import { ParserSupport } from "../parser-support";

export class PluginBlockParser {
  constructor(private readonly support: ParserSupport) {}

  parse(blockBuffer: BlockBuffer): ParsedPluginBlock {
    const entries = this.support.parseKeyValueBody(blockBuffer);
    const path = entries.path;
    if (!path) {
      ThrowHelper.parser("plugin_path_required", { alias: blockBuffer.name! }, { range: ThrowHelper.pointRange(blockBuffer.source.startLine, 1) });
    }

    const pathLine = this.findBodyLine(blockBuffer, "path");
    const pathRawLine = this.findRawBodyLine(blockBuffer, "path");
    const exportsLine = this.findBodyLine(blockBuffer, "exports");
    const exportsRawLine = this.findRawBodyLine(blockBuffer, "exports");

    const exportsList = entries.exports && exportsLine !== undefined && exportsRawLine !== undefined
      ? this.support.parseNameList(entries.exports, "@plugin exports", exportsLine, exportsRawLine)
      : [];

    return {
      kind: "plugin",
      alias: blockBuffer.name!,
      aliasRange: blockBuffer.nameRange,
      pathRange:
        path && pathLine !== undefined && pathRawLine !== undefined
          ? this.support.findValueRange(pathRawLine, entries.path, path, pathLine)
          : undefined,
      exportNameRanges:
        entries.exports && exportsLine !== undefined && exportsRawLine !== undefined
          ? this.support.buildNameRangeMap(entries.exports, exportsList, exportsLine, exportsRawLine)
          : undefined,
      binding: {
        path,
        exportNames: exportsList,
      },
      source: blockBuffer.source,
    };
  }

  private findBodyLine(blockBuffer: BlockBuffer, key: string): number | undefined {
    const offset = blockBuffer.body.findIndex((rawLine) => rawLine.trim().startsWith(`${key}:`));
    return offset >= 0 ? blockBuffer.bodyStartLine + offset : undefined;
  }

  private findRawBodyLine(blockBuffer: BlockBuffer, key: string): string | undefined {
    return blockBuffer.body.find((rawLine) => rawLine.trim().startsWith(`${key}:`));
  }
}
