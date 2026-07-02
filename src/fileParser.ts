/** Parses a full .mdma source into an @inputs declaration list and blocks. */

import { parseBlockBody } from "./blockParser.js";
import { MdmaSyntaxError } from "./errors.js";
import { parseExpression } from "./exprParser.js";
import type { Block, Expr, InputDecl, InputType, ParsedTemplate } from "./model.js";

const INPUT_DECL_RE =
  /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(string\[\]|number\[\]|object\[\]|string|number|boolean|object)\s*(?:=\s*([\s\S]+))?$/;
// Simple, single-line header: no modifiers, e.g. "<title>".
const SIMPLE_HEADER_RE = /^<([A-Za-z0-9][A-Za-z0-9-]*)>$/;
// Opening line of a multi-line header with modifiers: "<" alone, or "<name" with
// no closing '>' yet. The name may be inline here, or given on the next line.
const OPEN_HEADER_RE = /^<\s*([A-Za-z0-9][A-Za-z0-9-]*)?\s*$/;
const BARE_NAME_LINE_RE = /^([A-Za-z0-9][A-Za-z0-9-]*)$/;
const CLOSE_HEADER_RE = /^>\s*$/;
const MULTIPLE_MOD_RE = /^multiple\s*:\s*([A-Za-z_][A-Za-z0-9_]*)\s+in\s+([A-Za-z_][A-Za-z0-9_]*)$/;
const NAME_MOD_RE = /^name\s*:\s*(.+)$/;

const RESERVED = new Set(["multiple"]);

function looksLikeBlockHeader(strippedLine: string): boolean {
  return SIMPLE_HEADER_RE.test(strippedLine) || OPEN_HEADER_RE.test(strippedLine);
}

export function parseFile(source: string): ParsedTemplate {
  const text = source.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = text.split("\n");

  if (lines.length === 0 || lines[0].trim() !== "@inputs") {
    throw new MdmaSyntaxError("File must begin with '@inputs' on its own line");
  }

  let idx = 1;
  const inputs: InputDecl[] = [];
  const seenNames = new Set<string>();
  while (idx < lines.length) {
    const stripped = lines[idx].trim();
    if (stripped === "" || looksLikeBlockHeader(stripped)) break;
    const decl = parseInputDecl(stripped, idx + 1);
    if (RESERVED.has(decl.name)) {
      throw new MdmaSyntaxError(`'${decl.name}' is a reserved word and cannot be used as an input name`);
    }
    if (seenNames.has(decl.name)) {
      throw new MdmaSyntaxError(`Duplicate input declaration: '${decl.name}'`);
    }
    seenNames.add(decl.name);
    inputs.push(decl);
    idx += 1;
  }

  while (idx < lines.length && lines[idx].trim() === "") idx += 1;

  const inputTypes = new Map(inputs.map((d) => [d.name, d.type]));
  const blocks: Block[] = [];
  const blockNames = new Set<string>();

  while (idx < lines.length) {
    const header = lines[idx].trim();
    const simpleM = SIMPLE_HEADER_RE.exec(header);
    let name: string;
    let multipleVar: string | null;
    let multipleSource: string | null;
    let nameExpr: Expr | null;
    if (simpleM) {
      name = simpleM[1];
      idx += 1;
      multipleVar = multipleSource = nameExpr = null;
    } else {
      const parsed = parseOpenHeader(lines, idx, inputTypes);
      name = parsed.name;
      multipleVar = parsed.multipleVar;
      multipleSource = parsed.multipleSource;
      nameExpr = parsed.nameExpr;
      idx = parsed.nextIdx;
    }

    if (RESERVED.has(name)) {
      throw new MdmaSyntaxError(`'${name}' is a reserved word and cannot be used as a block name`);
    }
    if (blockNames.has(name)) {
      throw new MdmaSyntaxError(`Duplicate block declaration: '${name}'`);
    }
    blockNames.add(name);

    const bodyLines: string[] = [];
    while (idx < lines.length && !looksLikeBlockHeader(lines[idx].trim())) {
      bodyLines.push(lines[idx]);
      idx += 1;
    }
    // The blank line conventionally left between one block's content and the
    // next block's header (or EOF) is file formatting, not part of the block's
    // rendered value -- otherwise every block reference would carry a stray
    // trailing newline into whatever embeds it. Strip only the blank lines
    // touching the edges; blank lines in the middle of a body are preserved.
    const bodyText = stripBlankEdges(bodyLines).join("\n");

    let bodyNodes;
    try {
      bodyNodes = parseBlockBody(bodyText);
    } catch (exc) {
      if (exc instanceof MdmaSyntaxError) {
        throw new MdmaSyntaxError(`In block '<${name}>': ${exc.message}`);
      }
      throw exc;
    }

    blocks.push({ name, multipleVar, multipleSource, nameExpr, body: bodyNodes });
  }

  if (blocks.length === 0) {
    throw new MdmaSyntaxError("File must declare at least one block");
  }

  return { inputs, blocks };
}

interface OpenHeaderResult {
  name: string;
  multipleVar: string | null;
  multipleSource: string | null;
  nameExpr: Expr | null;
  nextIdx: number;
}

/**
 * Parses a multi-line block header, e.g.:
 *
 *   <changelog-entry
 *   multiple: entry in releases
 *   name: entry.version
 *   >
 *
 * The name may also be given alone on the line right after `<`:
 *
 *   <
 *   changelog-entry
 *   multiple: entry in releases
 *   >
 *
 * `multiple` and `name` may appear in either order; `name` requires `multiple`.
 */
function parseOpenHeader(
  lines: string[],
  idx: number,
  inputTypes: Map<string, InputType>
): OpenHeaderResult {
  const om = OPEN_HEADER_RE.exec(lines[idx].trim());
  if (!om) {
    throw new MdmaSyntaxError(
      `Expected a block header ('<name>') at line ${idx + 1}, got: ${JSON.stringify(lines[idx])}`
    );
  }
  let name = om[1];
  idx += 1;

  if (name === undefined) {
    if (idx >= lines.length) {
      throw new MdmaSyntaxError("Unterminated block header: expected a block name");
    }
    const nm = BARE_NAME_LINE_RE.exec(lines[idx].trim());
    if (!nm) {
      throw new MdmaSyntaxError(`Expected a block name at line ${idx + 1}, got: ${JSON.stringify(lines[idx])}`);
    }
    name = nm[1];
    idx += 1;
  }

  let multipleVar: string | null = null;
  let multipleSource: string | null = null;
  let nameExprRaw: string | null = null;
  const seen = new Set<string>();
  for (;;) {
    if (idx >= lines.length) {
      throw new MdmaSyntaxError(`Unterminated block header for '<${name}>': missing closing '>'`);
    }
    const line = lines[idx].trim();
    if (CLOSE_HEADER_RE.test(line)) {
      idx += 1;
      break;
    }
    if (line === "") {
      throw new MdmaSyntaxError(
        `Unterminated block header for '<${name}>': blank line before closing '>'`
      );
    }
    const mm = MULTIPLE_MOD_RE.exec(line);
    if (mm) {
      if (seen.has("multiple")) {
        throw new MdmaSyntaxError(`Block '<${name}>' declares 'multiple' more than once`);
      }
      seen.add("multiple");
      multipleVar = mm[1];
      multipleSource = mm[2];
      idx += 1;
      continue;
    }
    const nmm = NAME_MOD_RE.exec(line);
    if (nmm) {
      if (seen.has("name")) {
        throw new MdmaSyntaxError(`Block '<${name}>' declares 'name' more than once`);
      }
      seen.add("name");
      nameExprRaw = nmm[1];
      idx += 1;
      continue;
    }
    throw new MdmaSyntaxError(`Unknown block modifier at line ${idx + 1}: ${JSON.stringify(lines[idx])}`);
  }

  if (nameExprRaw !== null && multipleVar === null) {
    throw new MdmaSyntaxError(`Block '<${name}>': 'name' modifier requires a 'multiple' modifier`);
  }

  if (multipleVar !== null) {
    const sourceType = inputTypes.get(multipleSource as string);
    if (sourceType === undefined) {
      throw new MdmaSyntaxError(
        `Block '<${name}>' multiple modifier references unknown input '${multipleSource}'`
      );
    }
    if (!sourceType.endsWith("[]")) {
      throw new MdmaSyntaxError(
        `Block '<${name}>' multiple modifier requires an array input, but '${multipleSource}' is '${sourceType}'`
      );
    }
  }

  const nameExpr = nameExprRaw !== null ? parseExpression(nameExprRaw) : null;
  return { name, multipleVar, multipleSource, nameExpr, nextIdx: idx };
}

function stripBlankEdges(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === "") start += 1;
  while (end > start && lines[end - 1].trim() === "") end -= 1;
  return lines.slice(start, end);
}

function parseInputDecl(stripped: string, lineNo: number): InputDecl {
  const m = INPUT_DECL_RE.exec(stripped);
  if (!m) {
    throw new MdmaSyntaxError(`Invalid input declaration at line ${lineNo}: ${JSON.stringify(stripped)}`);
  }
  const [, name, type, defaultRaw] = m;
  if (defaultRaw === undefined) {
    return { name, type: type as InputType, hasDefault: false, default: null };
  }
  const defaultValue = parseDefault(defaultRaw.trim(), lineNo);
  return { name, type: type as InputType, hasDefault: true, default: defaultValue };
}

function parseDefault(raw: string, lineNo: number): unknown {
  if (raw === "[]") return [];
  if (raw === '""') return "";
  if (raw === "true" || raw === "false") return raw === "true";
  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    return raw.includes(".") ? parseFloat(raw) : parseInt(raw, 10);
  }
  if (raw.startsWith('"') && raw.endsWith('"')) {
    return JSON.parse(raw);
  }
  throw new MdmaSyntaxError(`Invalid default value at line ${lineNo}: ${JSON.stringify(raw)}`);
}
