/** Renders a parsed .mdma template against an inputs object into a named output map. */

import { readFileSync } from "node:fs";
import { DuplicateNameError, MdmaTypeError } from "./errors.js";
import { evaluate, Scope } from "./evaluator.js";
import { parseFile } from "./fileParser.js";
import type { Node } from "./model.js";
import { validateInputs } from "./schema.js";
import type { MdmaInputs } from "./types.js";
import { formatNumber, toDisplayString, truthy, typename } from "./util.js";

export type RenderedValue = string | string[] | Record<string, string>;

/**
 * Render an .mdma source string against an inputs object.
 *
 * Returns an object mapping each block name to its rendered string. A
 * `<multiple:>` block renders to an array of strings, or -- if it also
 * declares `<name:>` -- to an object keyed by each item's computed name.
 *
 * When `source` is an `MdmaSource<I>` (e.g. an import typed by a generated
 * `.d.mdma.ts` file), `inputs` is checked against `I` at compile time.
 */
export function render<S extends string>(
  source: S,
  inputs?: MdmaInputs<S>
): Record<string, RenderedValue>;
export function render(
  source: string,
  inputs: Record<string, unknown> = {}
): Record<string, RenderedValue> {
  const template = parseFile(source);
  const resolvedInputs = validateInputs(template.inputs, inputs);
  const allBlockNames = new Set(template.blocks.map((b) => b.name));

  const rendered: Record<string, RenderedValue> = {};
  for (const block of template.blocks) {
    const scopeBase = new Scope(rendered, resolvedInputs, allBlockNames);
    if (block.multipleVar) {
      const items = (resolvedInputs[block.multipleSource as string] as unknown[] | undefined) ?? [];
      if (block.nameExpr !== null) {
        const namedResults: Record<string, string> = {};
        for (const item of items) {
          const itemScope = scopeBase.child({ [block.multipleVar]: item });
          const computedName = stringifyName(evaluate(block.nameExpr, itemScope));
          if (Object.prototype.hasOwnProperty.call(namedResults, computedName)) {
            throw new DuplicateNameError(computedName, block.name);
          }
          namedResults[computedName] = renderNodes(block.body, itemScope);
        }
        rendered[block.name] = namedResults;
      } else {
        const results: string[] = [];
        for (const item of items) {
          const itemScope = scopeBase.child({ [block.multipleVar]: item });
          results.push(renderNodes(block.body, itemScope));
        }
        rendered[block.name] = results;
      }
    } else {
      rendered[block.name] = renderNodes(block.body, scopeBase);
    }
  }
  return rendered;
}

/** Read `path` as UTF-8 and render it. Equivalent to `render(readFileSync(path, "utf-8"), inputs)`. */
export function renderFile(
  path: string,
  inputs: Record<string, unknown> = {}
): Record<string, RenderedValue> {
  return render(readFileSync(path, "utf-8"), inputs);
}

function stringifyName(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return formatNumber(value);
  throw new MdmaTypeError("string or number", typename(value));
}

function renderNodes(nodes: Node[], scope: Scope): string {
  return nodes.map((node) => renderNode(node, scope)).join("");
}

function renderNode(node: Node, scope: Scope): string {
  switch (node.kind) {
    case "text":
      return node.text;
    case "expr":
      return toDisplayString(evaluate(node.expr, scope));
    case "if": {
      for (const [condition, body] of node.branches) {
        if (condition === null || truthy(evaluate(condition, scope))) {
          return renderNodes(body, scope);
        }
      }
      return "";
    }
    case "for": {
      const iterableRaw = evaluate(node.iterable, scope);
      const iterable = iterableRaw ?? [];
      if (!Array.isArray(iterable)) {
        throw new MdmaTypeError("array", typename(iterable));
      }
      const total = iterable.length;
      const parts: string[] = [];
      iterable.forEach((item, index) => {
        const loopInfo = {
          index: index + 1,
          index0: index,
          first: index === 0,
          last: index === total - 1,
          length: total,
        };
        const childScope = scope.child({ [node.varName]: item, loop: loopInfo });
        parts.push(renderNodes(node.body, childScope));
      });
      return parts.join("");
    }
  }
}
