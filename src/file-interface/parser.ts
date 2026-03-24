import type { ParsedSheetBlock, ParsedSheetDocument, TableBlock } from "./types";
import { ThrowHelper } from "../diagnostics";
import type { BlockBuffer, ParserTableRegistry } from "./parser/block-buffer";
import { DEFAULT_TABLE_NAME, DIRECTIVE_PATTERN, FUNC_DIRECTIVE_PATTERN } from "./parser/parser-config";
import { ParserSupport } from "./parser/parser-support";
import {
  ComputeBlockParser,
  FuncBlockParser,
  MetaBlockParser,
  PlotBlockParser,
  PluginBlockParser,
  TableBlockParser,
  WindowBlockParser,
} from "./parser/blocks";

export class SheetSyntaxParser {
  private readonly support = new ParserSupport();

  private readonly metaBlockParser = new MetaBlockParser(this.support);

  private readonly pluginBlockParser = new PluginBlockParser(this.support);

  private readonly tableBlockParser = new TableBlockParser(this.support);

  private readonly funcBlockParser = new FuncBlockParser(this.support);

  private readonly computeBlockParser = new ComputeBlockParser(this.support);

  private readonly windowBlockParser = new WindowBlockParser(this.support);

  private readonly plotBlockParser = new PlotBlockParser(this.support);

  parse(source: string): ParsedSheetDocument {
    const normalizedSource = source.replace(/\r\n?/g, "\n").trim();
    if (normalizedSource === "") {
      return { blocks: [] };
    }

    const lines = normalizedSource.split("\n");
    const blocks: ParsedSheetBlock[] = [];
    const tableMap: ParserTableRegistry = {};
    let index = 0;

    while (index < lines.length) {
      if (this.support.shouldIgnoreLine(lines[index])) {
        index += 1;
        continue;
      }

      const headerLine = lines[index].trim();
      const funcDirectiveMatch = headerLine.match(FUNC_DIRECTIVE_PATTERN);
      if (funcDirectiveMatch) {
        const startLine = index + 1;
        index += 1;

        const body: string[] = [];
        while (index < lines.length && !lines[index].replace(/^\s+/, "").startsWith("@")) {
          body.push(lines[index]);
          index += 1;
        }

        blocks.push(
          this.funcBlockParser.parse({
            directive: "func",
            name: funcDirectiveMatch[1],
            nameRange: ThrowHelper.lineFragmentRange(
              startLine,
              headerLine,
              funcDirectiveMatch[1],
              headerLine.indexOf(funcDirectiveMatch[1]) + 1,
            ),
            headerLine,
            body,
            source: {
              startLine,
              endLine: Math.max(startLine, index),
            },
            bodyStartLine: startLine + 1,
          }),
        );
        continue;
      }

      const directiveMatch = headerLine.match(DIRECTIVE_PATTERN);
      if (!directiveMatch && blocks.length === 0) {
        const block = this.parseImplicitFirstTable(lines, index);
        blocks.push(block.table);
        tableMap[block.table.name] = block.table;
        index = block.nextIndex;
        continue;
      }

      if (!directiveMatch) {
        ThrowHelper.parser(
          "expected_directive",
          { lineText: lines[index] },
          {
            range: ThrowHelper.pointRange(index + 1, 1),
            suggestion: 'Start the block with a supported directive such as "@table" or "@compute".',
          },
        );
      }

      const startLine = index + 1;
      const directive = directiveMatch[1];
      const name = directiveMatch[2];
      index += 1;

      const body: string[] = [];
      while (index < lines.length && !lines[index].replace(/^\s+/, "").startsWith("@")) {
        body.push(lines[index]);
        index += 1;
      }

      const blockBuffer: BlockBuffer = {
        directive,
        name,
        nameRange:
          name !== undefined
            ? ThrowHelper.lineFragmentRange(startLine, headerLine, name, headerLine.indexOf(name) + 1)
            : undefined,
        headerLine,
        body,
        source: {
          startLine,
          endLine: Math.max(startLine, index),
        },
        bodyStartLine: startLine + 1,
      };

      const block = this.parseBlock(blockBuffer, tableMap);
      blocks.push(block);

      if (block.kind === "table") {
        tableMap[block.name] = block;
      }
    }

    return { blocks };
  }

  private parseImplicitFirstTable(
    lines: string[],
    startIndex: number,
  ): {
    table: TableBlock;
    nextIndex: number;
  } {
    const body: string[] = [];
    let index = startIndex;

    while (index < lines.length && !lines[index].replace(/^\s+/, "").startsWith("@")) {
      body.push(lines[index]);
      index += 1;
    }

    const table = this.tableBlockParser.parse({
      directive: "table",
      name: DEFAULT_TABLE_NAME,
      nameRange: undefined,
      headerLine: `@table ${DEFAULT_TABLE_NAME}`,
      body,
      source: {
        startLine: startIndex + 1,
        endLine: Math.max(startIndex + 1, index),
      },
      bodyStartLine: startIndex + 1,
    });

    return {
      table,
      nextIndex: index,
    };
  }

  private parseBlock(blockBuffer: BlockBuffer, tableMap: ParserTableRegistry): ParsedSheetBlock {
    if (blockBuffer.directive === "meta") {
      if (blockBuffer.name) {
        ThrowHelper.parser("meta_name_not_allowed", {}, { range: ThrowHelper.pointRange(blockBuffer.source.startLine, 1) });
      }
      return this.metaBlockParser.parse(blockBuffer);
    }

    if (!blockBuffer.name) {
      ThrowHelper.parser(
        "block_name_required",
        { directive: blockBuffer.directive },
        { range: ThrowHelper.pointRange(blockBuffer.source.startLine, 1) },
      );
    }

    switch (blockBuffer.directive) {
      case "plugin":
        return this.pluginBlockParser.parse(blockBuffer);
      case "table":
        return this.tableBlockParser.parse(blockBuffer);
      case "func":
        return this.funcBlockParser.parse(blockBuffer);
      case "compute":
        return this.computeBlockParser.parse(blockBuffer);
      case "plot":
        return this.plotBlockParser.parse(blockBuffer, tableMap);
      case "window":
        return this.windowBlockParser.parse(blockBuffer);
      default:
        ThrowHelper.parser(
          "unsupported_directive",
          { directive: blockBuffer.directive },
          { range: ThrowHelper.pointRange(blockBuffer.source.startLine, 1) },
        );
    }
  }
}
