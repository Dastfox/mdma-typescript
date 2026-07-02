/**
 * Tokenizer and recursive-descent parser for expressions inside {{ }} / {% %}.
 *
 * Precedence, low to high: or > and > not > comparison > filter (|) > primary.
 */

import { MdmaSyntaxError } from "./errors.js";
import type { ArrayLiteral, BinOp, CompareOp, Expr, FilterCall, Literal, Not, Var } from "./model.js";

type TokenKind = "string" | "number" | "op" | "ident";

interface Token {
  kind: TokenKind;
  value: string;
}

const WS_RE = /\s+/y;
const TOKEN_RE =
  /"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?|==|!=|>=|<=|[><|,().[\]]|[A-Za-z_][A-Za-z0-9_]*/y;

const COMPARATORS: ReadonlySet<string> = new Set(["==", "!=", ">", ">=", "<", "<="]);

export function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  const n = src.length;
  while (pos < n) {
    WS_RE.lastIndex = pos;
    const ws = WS_RE.exec(src);
    if (ws) {
      pos = ws.index + ws[0].length;
      if (pos >= n) break;
    }
    TOKEN_RE.lastIndex = pos;
    const m = TOKEN_RE.exec(src);
    if (!m || m.index !== pos) {
      throw new MdmaSyntaxError(
        `Unexpected character in expression: ${JSON.stringify(src.slice(pos, pos + 20))}`
      );
    }
    const text = m[0];
    if (text[0] === '"') {
      tokens.push({ kind: "string", value: text });
    } else if (/^[0-9]/.test(text) || (text[0] === "-" && text.length > 1)) {
      tokens.push({ kind: "number", value: text });
    } else if (COMPARATORS.has(text) || '><|,().[]'.includes(text)) {
      tokens.push({ kind: "op", value: text });
    } else {
      tokens.push({ kind: "ident", value: text });
    }
    pos += text.length;
  }
  return tokens;
}

class Parser {
  private pos = 0;

  constructor(private readonly tokens: Token[]) {}

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private advance(): Token | undefined {
    const t = this.peek();
    this.pos += 1;
    return t;
  }

  private isOp(value: string): boolean {
    const t = this.peek();
    return t !== undefined && t.kind === "op" && t.value === value;
  }

  private expectOp(value: string): Token {
    const t = this.advance();
    if (t === undefined || t.kind !== "op" || t.value !== value) {
      throw new MdmaSyntaxError(`Expected '${value}' in expression`);
    }
    return t;
  }

  private matchIdent(keyword: string): boolean {
    const t = this.peek();
    if (t !== undefined && t.kind === "ident" && t.value === keyword) {
      this.advance();
      return true;
    }
    return false;
  }

  parse(): Expr {
    const expr = this.parseOr();
    if (this.pos !== this.tokens.length) {
      throw new MdmaSyntaxError(`Unexpected token in expression: ${JSON.stringify(this.peek())}`);
    }
    return expr;
  }

  private parseOr(): Expr {
    let left = this.parseAnd();
    while (this.matchIdent("or")) {
      const right = this.parseAnd();
      left = { kind: "binop", op: "or", left, right };
    }
    return left;
  }

  private parseAnd(): Expr {
    let left = this.parseNot();
    while (this.matchIdent("and")) {
      const right = this.parseNot();
      left = { kind: "binop", op: "and", left, right };
    }
    return left;
  }

  private parseNot(): Expr {
    if (this.matchIdent("not")) {
      const operand = this.parseNot();
      const node: Not = { kind: "not", operand };
      return node;
    }
    return this.parseComparison();
  }

  private parseComparison(): Expr {
    const left = this.parseFilterExpr();
    const t = this.peek();
    if (t !== undefined && t.kind === "op" && COMPARATORS.has(t.value)) {
      this.advance();
      const right = this.parseFilterExpr();
      const node: BinOp = { kind: "binop", op: t.value as CompareOp, left, right };
      return node;
    }
    return left;
  }

  private parseFilterExpr(): Expr {
    let expr = this.parsePrimary();
    while (this.isOp("|")) {
      this.advance();
      const nameTok = this.advance();
      if (nameTok === undefined || nameTok.kind !== "ident") {
        throw new MdmaSyntaxError("Expected filter name after '|'");
      }
      const args: Expr[] = [];
      if (this.isOp("(")) {
        this.advance();
        if (!this.isOp(")")) {
          args.push(this.parseOr());
          while (this.isOp(",")) {
            this.advance();
            args.push(this.parseOr());
          }
        }
        this.expectOp(")");
      }
      const node: FilterCall = { kind: "filter", target: expr, name: nameTok.value, args };
      expr = node;
    }
    return expr;
  }

  private parsePrimary(): Expr {
    const t = this.advance();
    if (t === undefined) {
      throw new MdmaSyntaxError("Unexpected end of expression");
    }
    if (t.kind === "string") {
      const literal: Literal = { kind: "literal", value: JSON.parse(t.value) };
      return literal;
    }
    if (t.kind === "number") {
      const value = t.value.includes(".") ? parseFloat(t.value) : parseInt(t.value, 10);
      const literal: Literal = { kind: "literal", value };
      return literal;
    }
    if (t.kind === "op" && t.value === "[") {
      const items: Expr[] = [];
      if (!this.isOp("]")) {
        items.push(this.parseOr());
        while (this.isOp(",")) {
          this.advance();
          items.push(this.parseOr());
        }
      }
      this.expectOp("]");
      const literal: ArrayLiteral = { kind: "array", items };
      return literal;
    }
    if (t.kind === "ident") {
      if (t.value === "true") return { kind: "literal", value: true };
      if (t.value === "false") return { kind: "literal", value: false };
      const path = [t.value];
      while (this.isOp(".")) {
        this.advance();
        const next = this.advance();
        if (next === undefined || next.kind !== "ident") {
          throw new MdmaSyntaxError("Expected identifier after '.'");
        }
        path.push(next.value);
      }
      const v: Var = { kind: "var", path };
      return v;
    }
    throw new MdmaSyntaxError(`Unexpected token in expression: ${JSON.stringify(t)}`);
  }
}

export function parseExpression(src: string): Expr {
  if (src.trim() === "") {
    throw new MdmaSyntaxError("Empty expression");
  }
  return new Parser(tokenize(src)).parse();
}
