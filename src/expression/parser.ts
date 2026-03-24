import type { BinaryOperator } from "../analysis/types";
import type { DiagnosticRange } from "../diagnostics";
import { ThrowHelper } from "../diagnostics";

interface Token {
  type: "number" | "identifier" | "operator" | "paren" | "comma" | "eof";
  value: string;
  range: DiagnosticRange;
}

export type ParsedExpressionNode =
  | { kind: "number_literal"; value: number; range: DiagnosticRange }
  | { kind: "identifier"; name: string; range: DiagnosticRange }
  | { kind: "unary_expression"; operator: "-"; operand: ParsedExpressionNode; range: DiagnosticRange }
  | {
      kind: "binary_expression";
      operator: BinaryOperator;
      left: ParsedExpressionNode;
      right: ParsedExpressionNode;
      range: DiagnosticRange;
    }
  | { kind: "call_expression"; callee: string; calleeRange: DiagnosticRange; args: ParsedExpressionNode[]; range: DiagnosticRange };

interface ExpressionOrigin {
  line?: number;
  column?: number;
}

export class ExpressionParser {
  private readonly tokens: Token[];

  private index = 0;

  constructor(source: string, origin: ExpressionOrigin = {}) {
    this.tokens = tokenizeExpression(source, origin);
  }

  parse(): ParsedExpressionNode {
    const expression = this.parseExpression();
    this.expect("eof");
    return expression;
  }

  private parseExpression(): ParsedExpressionNode {
    let node = this.parseTerm();

    while (this.match("operator", "+") || this.match("operator", "-")) {
      const operator = this.consume().value as BinaryOperator;
      const right = this.parseTerm();
      node = {
        kind: "binary_expression",
        operator,
        left: node,
        right,
        range: mergeRanges(node.range, right.range),
      };
    }

    return node;
  }

  private parseTerm(): ParsedExpressionNode {
    let node = this.parseFactor();

    while (this.match("operator", "*") || this.match("operator", "/")) {
      const operator = this.consume().value as BinaryOperator;
      const right = this.parseFactor();
      node = {
        kind: "binary_expression",
        operator,
        left: node,
        right,
        range: mergeRanges(node.range, right.range),
      };
    }

    return node;
  }

  private parseFactor(): ParsedExpressionNode {
    if (this.match("operator", "-")) {
      const operatorToken = this.consume();
      const operand = this.parseFactor();
      return {
        kind: "unary_expression",
        operator: "-",
        operand,
        range: mergeRanges(operatorToken.range, operand.range),
      };
    }

    if (this.match("paren", "(")) {
      this.consume();
      const expression = this.parseExpression();
      this.expect("paren", ")");
      return expression;
    }

    if (this.match("number")) {
      const token = this.consume();
      return {
        kind: "number_literal",
        value: Number(token.value),
        range: token.range,
      };
    }

    if (this.match("identifier")) {
      const identifierToken = this.consume();
      const identifier = identifierToken.value;
      if (this.match("paren", "(")) {
        this.consume();
        const args: ParsedExpressionNode[] = [];
        if (!this.match("paren", ")")) {
          do {
            args.push(this.parseExpression());
          } while (this.match("comma") && this.consume());
        }
        const closingParen = this.expect("paren", ")");
        return {
          kind: "call_expression",
          callee: identifier,
          calleeRange: identifierToken.range,
          args,
          range: mergeRanges(identifierToken.range, closingParen.range),
        };
      }

      return {
        kind: "identifier",
        name: identifier,
        range: identifierToken.range,
      };
    }

    const token = this.peek();
    ThrowHelper.parser("unexpected_expression_token", { token: token.value }, { range: token.range });
  }

  private match(type: Token["type"], value?: string): boolean {
    const token = this.peek();
    return token.type === type && (value === undefined || token.value === value);
  }

  private expect(type: Token["type"], value?: string): Token {
    const token = this.peek();
    if (!this.match(type, value)) {
      ThrowHelper.parser(
        "expected_expression_token",
        { expected: value ?? type, actual: token.value },
        { range: token.range },
      );
    }
    return this.consume();
  }

  private consume(): Token {
    const token = this.tokens[this.index];
    this.index += 1;
    return token;
  }

  private peek(): Token {
    return this.tokens[this.index];
  }
}

const IDENTIFIER_START_PATTERN = /[\p{L}_]/u;
const IDENTIFIER_CONTINUE_PATTERN = /[\p{L}\p{N}\p{M}_]/u;

function tokenizeExpression(source: string, origin: ExpressionOrigin): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  const line = origin.line ?? 1;
  const baseColumn = origin.column ?? 1;

  while (index < source.length) {
    const currentChar = source[index];

    if (/\s/.test(currentChar)) {
      index += 1;
      continue;
    }

    if (/[0-9.]/.test(currentChar)) {
      let endIndex = index + 1;
      while (endIndex < source.length && /[0-9.]/.test(source[endIndex])) {
        endIndex += 1;
      }

      const value = source.slice(index, endIndex);
      if (!/^\d+(?:\.\d+)?$/.test(value)) {
        ThrowHelper.parser(
          "invalid_numeric_literal",
          { value },
          { range: createRange(line, baseColumn + index, baseColumn + endIndex - 1) },
        );
      }

      tokens.push({ type: "number", value, range: createRange(line, baseColumn + index, baseColumn + endIndex - 1) });
      index = endIndex;
      continue;
    }

    if (IDENTIFIER_START_PATTERN.test(currentChar)) {
      let endIndex = index + 1;
      while (
        endIndex < source.length &&
        (IDENTIFIER_CONTINUE_PATTERN.test(source[endIndex]) || source[endIndex] === ".")
      ) {
        endIndex += 1;
      }

      tokens.push({
        type: "identifier",
        value: source.slice(index, endIndex),
        range: createRange(line, baseColumn + index, baseColumn + endIndex - 1),
      });
      index = endIndex;
      continue;
    }

    if ("+-*/".includes(currentChar)) {
      tokens.push({ type: "operator", value: currentChar, range: createRange(line, baseColumn + index, baseColumn + index) });
      index += 1;
      continue;
    }

    if ("()".includes(currentChar)) {
      tokens.push({ type: "paren", value: currentChar, range: createRange(line, baseColumn + index, baseColumn + index) });
      index += 1;
      continue;
    }

    if (currentChar === ",") {
      tokens.push({ type: "comma", value: currentChar, range: createRange(line, baseColumn + index, baseColumn + index) });
      index += 1;
      continue;
    }

    ThrowHelper.parser(
      "unexpected_expression_character",
      { character: currentChar },
      { range: createRange(line, baseColumn + index, baseColumn + index) },
    );
  }

  tokens.push({ type: "eof", value: "<eof>", range: createRange(line, baseColumn + source.length, baseColumn + source.length) });
  return tokens;
}

function createRange(line: number, startColumn: number, endColumn: number): DiagnosticRange {
  return {
    startLine: line,
    startColumn,
    startOffset: Math.max(0, startColumn - 1),
    endLine: line,
    endColumn,
    endOffset: Math.max(0, endColumn - 1),
  };
}

function mergeRanges(start: DiagnosticRange, end: DiagnosticRange): DiagnosticRange {
  return {
    startLine: start.startLine,
    startColumn: start.startColumn,
    startOffset: start.startOffset,
    endLine: end.endLine,
    endColumn: end.endColumn,
    endOffset: end.endOffset,
  };
}
