import type { DiagnosticRange } from "../diagnostics";
import type { DefinitionInfo, EditorPosition, HoverInfo, ReferenceInfo, SheetSymbol } from "./types";

export interface SymbolTarget {
  path?: string;
  startLine: number;
  startColumn: number;
  startOffset: number;
  endLine: number;
  endColumn: number;
  endOffset: number;
}

export function findSymbolAtPosition(symbols: SheetSymbol[], position: EditorPosition): SheetSymbol | undefined {
  return symbols.find((symbol) => rangeContainsPosition(symbol.range, position));
}

export function toDefinitionInfo(symbol: SheetSymbol): DefinitionInfo | undefined {
  if (!symbol.definitionRange) {
    return undefined;
  }

  return {
    name: symbol.name,
    kind: symbol.kind,
    fromRange: symbol.range,
    toRange: symbol.definitionRange,
    toPath: symbol.definitionPath,
  };
}

export function toHoverInfo(symbol: SheetSymbol): HoverInfo {
  return {
    range: symbol.range,
    contents: symbol.detail ?? `${symbol.kind}: ${symbol.name}`,
  };
}

export function collectReferences(
  symbols: SheetSymbol[],
  symbol: SheetSymbol,
  path?: string,
  options: { includeDeclaration?: boolean } = {},
): ReferenceInfo[] {
  const { includeDeclaration = true } = options;
  const target = symbolTarget(symbol);
  if (!target) {
    return [];
  }

  const targetKey = symbolTargetKey(target);
  const references: ReferenceInfo[] = symbols
    .filter((candidate) => {
      const candidateTarget = symbolTarget(candidate);
      return candidateTarget !== undefined && symbolTargetKey(candidateTarget) === targetKey;
    })
    .map((candidate) => ({
      name: candidate.name,
      kind: candidate.kind,
      range: candidate.range,
      path,
    }));

  if (!includeDeclaration) {
    return references;
  }

  const definitionSymbol = symbols.find((candidate) => {
    const candidateTarget = symbolTarget(candidate);
    return (
      candidateTarget !== undefined &&
      symbolTargetKey(candidateTarget) === targetKey &&
      sameRange(candidate.range, target)
    );
  });

  const declaration: ReferenceInfo = {
    name: definitionSymbol?.name ?? symbol.name,
    kind: definitionSymbol?.kind ?? symbol.kind,
    range: {
      startLine: target.startLine,
      startColumn: target.startColumn,
      startOffset: target.startOffset,
      endLine: target.endLine,
      endColumn: target.endColumn,
      endOffset: target.endOffset,
    },
    path: target.path ?? path,
  };

  const hasDeclaration = references.some((reference) =>
    reference.path === declaration.path && sameRange(reference.range, declaration.range),
  );
  if (!hasDeclaration) {
    references.unshift(declaration);
  }

  return references;
}

export function symbolTarget(symbol: SheetSymbol): SymbolTarget | undefined {
  if (symbol.definitionRange) {
    return {
      path: symbol.definitionPath,
      ...symbol.definitionRange,
    };
  }

  switch (symbol.kind) {
    case "table":
    case "column":
    case "plugin":
    case "func":
    case "local":
      return {
        path: symbol.definitionPath,
        ...symbol.range,
      };
    default:
      return undefined;
  }
}

export function rangeContainsPosition(range: DiagnosticRange, position: EditorPosition): boolean {
  if (position.line < range.startLine || position.line > range.endLine) {
    return false;
  }

  if (position.line === range.startLine && position.column < range.startColumn) {
    return false;
  }

  if (position.line === range.endLine && position.column > range.endColumn) {
    return false;
  }

  return true;
}

export function sameRange(left: DiagnosticRange, right: DiagnosticRange): boolean {
  return (
    left.startLine === right.startLine &&
    left.startColumn === right.startColumn &&
    left.startOffset === right.startOffset &&
    left.endLine === right.endLine &&
    left.endColumn === right.endColumn &&
    left.endOffset === right.endOffset
  );
}

export function symbolTargetKey(target: SymbolTarget): string {
  return [
    target.path ?? "",
    target.startLine,
    target.startColumn,
    target.startOffset,
    target.endLine,
    target.endColumn,
    target.endOffset,
  ].join(":");
}
