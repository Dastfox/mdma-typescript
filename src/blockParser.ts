/**
 * Tokenizes a block body into text/expr/tag spans, applies whitespace control,
 * and builds the nested if/for AST.
 */

import { MdmaSyntaxError } from "./errors.js";
import { parseExpression } from "./exprParser.js";
import type { ForNode, IfNode, Node } from "./model.js";

const TAG_SPAN_RE = /\{\{.*?\}\}|\{%.*?%\}|\{#.*?#\}/gs;

const IF_RE = /^if\s+([\s\S]+)$/;
const ELIF_RE = /^elif\s+([\s\S]+)$/;
const ELSE_RE = /^else$/;
const ENDIF_RE = /^endif$/;
const FOR_RE = /^for\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\s+([\s\S]+)$/;
const ENDFOR_RE = /^endfor$/;

type TagKind = "if" | "elif" | "else" | "endif" | "for" | "endfor" | null;

interface RawToken {
  kind: "text" | "expr" | "tag" | "comment";
  content: string;
  trimLeft: boolean;
  trimRight: boolean;
}

function splitDelims(rawInner: string): [string, boolean, boolean] {
  const trimLeft = rawInner.startsWith("-");
  let body = trimLeft ? rawInner.slice(1) : rawInner;
  const trimRight = body.endsWith("-");
  if (trimRight) body = body.slice(0, -1);
  return [body.trim(), trimLeft, trimRight];
}

export function tokenizeBody(body: string): RawToken[] {
  const tokens: RawToken[] = [];
  let pos = 0;
  TAG_SPAN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TAG_SPAN_RE.exec(body)) !== null) {
    if (m.index > pos) {
      tokens.push({ kind: "text", content: body.slice(pos, m.index), trimLeft: false, trimRight: false });
    }
    const raw = m[0];
    const inner = raw.slice(2, -2);
    const [content, trimLeft, trimRight] = splitDelims(inner);
    const kind = raw.startsWith("{{") ? "expr" : raw.startsWith("{%") ? "tag" : "comment";
    tokens.push({ kind, content, trimLeft, trimRight });
    pos = m.index + raw.length;
  }
  if (pos < body.length) {
    tokens.push({ kind: "text", content: body.slice(pos), trimLeft: false, trimRight: false });
  }
  for (const tok of tokens) {
    if (tok.kind === "text" && tok.content.includes("{#")) {
      throw new MdmaSyntaxError("Unclosed comment: missing '#}'");
    }
  }
  return tokens;
}

// A comment is "standalone" when nothing but whitespace shares its line; the
// whole line then vanishes from the output, so authors can annotate templates
// without leaving blank lines behind.
const STANDALONE_LEFT_RE = /(^|\n)[ \t]*$/;
const STANDALONE_RIGHT_RE = /^[ \t]*\n/;
const ONLY_INDENT_RE = /^[ \t]*$/;

export function stripCommentLines(tokens: RawToken[]): RawToken[] {
  const result = [...tokens];

  // Decide standalone-ness on the untouched token stream first: removals
  // mutate the very text tokens the line-position checks rely on.
  const plans: Array<[number, "newline" | "eof"]> = [];
  for (let i = 0; i < result.length; i++) {
    if (result[i].kind !== "comment") continue;
    if (i > 0) {
      const prev = result[i - 1];
      if (prev.kind !== "text") continue;
      const m = STANDALONE_LEFT_RE.exec(prev.content);
      // A match on '^' only proves line-start if the text token itself
      // opens the body; otherwise another tag sits on the same line.
      if (!m || (m[1] === "" && i !== 1)) continue;
    }
    const nxt = i + 1 < result.length ? result[i + 1] : null;
    if (nxt === null) {
      plans.push([i, "eof"]);
    } else if (nxt.kind === "text" && STANDALONE_RIGHT_RE.test(nxt.content)) {
      plans.push([i, "newline"]);
    } else if (nxt.kind === "text" && i + 2 === result.length && ONLY_INDENT_RE.test(nxt.content)) {
      plans.push([i, "eof"]);
    }
  }

  for (const [i, mode] of plans) {
    if (i > 0) {
      const prev = result[i - 1];
      // 'eof': the comment is the last line, so the line it vanishes
      // with includes the newline that started it.
      const pattern = mode === "eof" ? /\n?[ \t]*$/ : /[ \t]*$/;
      result[i - 1] = { ...prev, content: prev.content.replace(pattern, "") };
    }
    if (i + 1 < result.length) {
      const nxt = result[i + 1];
      const content = mode === "newline" ? nxt.content.replace(STANDALONE_RIGHT_RE, "") : "";
      result[i + 1] = { ...nxt, content };
    }
  }
  return result;
}

/**
 * Removes comment tokens, honoring their trim markers, and merges the text
 * tokens left adjacent so later whitespace control sees the same stream it
 * would have without the comment.
 */
export function dropComments(tokens: RawToken[]): RawToken[] {
  const result: RawToken[] = [];
  let pendingTrim = false;
  for (const tok of tokens) {
    if (tok.kind === "comment") {
      const last = result[result.length - 1];
      if (tok.trimLeft && last?.kind === "text") {
        result[result.length - 1] = { ...last, content: last.content.replace(/\s+$/, "") };
      }
      pendingTrim = pendingTrim || tok.trimRight;
      continue;
    }
    if (tok.kind === "text") {
      const content = pendingTrim ? tok.content.replace(/^\s+/, "") : tok.content;
      pendingTrim = false;
      const last = result[result.length - 1];
      if (last?.kind === "text") {
        result[result.length - 1] = { ...last, content: last.content + content };
      } else {
        result.push({ ...tok, content });
      }
      continue;
    }
    pendingTrim = false;
    result.push(tok);
  }
  return result;
}

export function applyWhitespaceControl(tokens: RawToken[]): RawToken[] {
  const result = [...tokens];
  for (let i = 0; i < result.length; i++) {
    const tok = result[i];
    if (tok.kind === "text") continue;
    if (tok.trimLeft && i > 0 && result[i - 1].kind === "text") {
      const prev = result[i - 1];
      result[i - 1] = { ...prev, content: prev.content.replace(/\s+$/, "") };
    }
    if (tok.trimRight && i + 1 < result.length && result[i + 1].kind === "text") {
      const next = result[i + 1];
      result[i + 1] = { ...next, content: next.content.replace(/^\s+/, "") };
    }
  }
  return result;
}

function classifyTag(stmt: string): TagKind {
  if (IF_RE.test(stmt)) return "if";
  if (ELIF_RE.test(stmt)) return "elif";
  if (ELSE_RE.test(stmt)) return "else";
  if (ENDIF_RE.test(stmt)) return "endif";
  if (FOR_RE.test(stmt)) return "for";
  if (ENDFOR_RE.test(stmt)) return "endfor";
  return null;
}

export function parseNodes(
  tokens: RawToken[],
  start: number,
  stopKinds: ReadonlySet<TagKind>
): [Node[], number] {
  const nodes: Node[] = [];
  let i = start;
  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok.kind === "tag") {
      const kind = classifyTag(tok.content);
      if (stopKinds.has(kind)) return [nodes, i];
      if (kind === "if") {
        const [node, next] = parseIf(tokens, i);
        nodes.push(node);
        i = next;
        continue;
      }
      if (kind === "for") {
        const [node, next] = parseFor(tokens, i);
        nodes.push(node);
        i = next;
        continue;
      }
      throw new MdmaSyntaxError(`Unexpected tag: {% ${tok.content} %}`);
    }
    if (tok.kind === "text") {
      if (tok.content) nodes.push({ kind: "text", text: tok.content });
      i += 1;
      continue;
    }
    nodes.push({ kind: "expr", expr: parseExpression(tok.content) });
    i += 1;
  }
  return [nodes, i];
}

function parseIf(tokens: RawToken[], i: number): [IfNode, number] {
  const m = IF_RE.exec(tokens[i].content);
  if (!m) throw new MdmaSyntaxError("Malformed if tag");
  const cond = parseExpression(m[1]);
  let [body, next] = parseNodes(tokens, i + 1, new Set(["elif", "else", "endif"]));
  const branches: IfNode["branches"] = [[cond, body]];
  i = next;

  while (i < tokens.length && classifyTag(tokens[i].content) === "elif") {
    const em = ELIF_RE.exec(tokens[i].content);
    if (!em) throw new MdmaSyntaxError("Malformed elif tag");
    const cond2 = parseExpression(em[1]);
    let body2: Node[];
    [body2, next] = parseNodes(tokens, i + 1, new Set(["elif", "else", "endif"]));
    branches.push([cond2, body2]);
    i = next;
  }

  if (i < tokens.length && classifyTag(tokens[i].content) === "else") {
    let elseBody: Node[];
    [elseBody, next] = parseNodes(tokens, i + 1, new Set(["endif"]));
    branches.push([null, elseBody]);
    i = next;
  }

  if (!(i < tokens.length && classifyTag(tokens[i].content) === "endif")) {
    throw new MdmaSyntaxError("Missing {% endif %}");
  }
  i += 1;
  return [{ kind: "if", branches }, i];
}

function parseFor(tokens: RawToken[], i: number): [ForNode, number] {
  const m = FOR_RE.exec(tokens[i].content);
  if (!m) throw new MdmaSyntaxError("Malformed for tag");
  const varName = m[1];
  const iterable = parseExpression(m[2]);
  const [body, next] = parseNodes(tokens, i + 1, new Set(["endfor"]));
  if (!(next < tokens.length && classifyTag(tokens[next].content) === "endfor")) {
    throw new MdmaSyntaxError("Missing {% endfor %}");
  }
  return [{ kind: "for", varName, iterable, body }, next + 1];
}

export function parseBlockBody(body: string): Node[] {
  const tokens = applyWhitespaceControl(dropComments(stripCommentLines(tokenizeBody(body))));
  const [nodes, end] = parseNodes(tokens, 0, new Set());
  if (end !== tokens.length) {
    const stray = tokens[end];
    throw new MdmaSyntaxError(`Unmatched control tag: {% ${stray.content} %}`);
  }
  return nodes;
}
