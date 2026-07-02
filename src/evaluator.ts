/** Scope model and expression evaluator. */

import { MdmaReferenceError } from "./errors.js";
import { applyFilter } from "./filters.js";
import type { Expr } from "./model.js";
import { isPlainObject, truthy } from "./util.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
const COMPARATORS: Record<string, (a: unknown, b: unknown) => boolean> = {
  "==": (a, b) => a === b,
  "!=": (a, b) => a !== b,
  ">": (a, b) => (a as any) > (b as any),
  ">=": (a, b) => (a as any) >= (b as any),
  "<": (a, b) => (a as any) < (b as any),
  "<=": (a, b) => (a as any) <= (b as any),
};
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Variable resolution: innermost loop bindings, then rendered blocks, then inputs. */
export class Scope {
  constructor(
    private readonly blocks: Record<string, unknown>,
    private readonly inputs: Record<string, unknown>,
    private readonly allBlockNames: ReadonlySet<string>,
    private readonly layers: Record<string, unknown>[] = []
  ) {}

  child(bindings: Record<string, unknown>): Scope {
    return new Scope(this.blocks, this.inputs, this.allBlockNames, [...this.layers, bindings]);
  }

  resolveRoot(name: string): unknown {
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const layer = this.layers[i];
      if (Object.prototype.hasOwnProperty.call(layer, name)) return layer[name];
    }
    if (Object.prototype.hasOwnProperty.call(this.blocks, name)) return this.blocks[name];
    if (this.allBlockNames.has(name)) throw MdmaReferenceError.forwardBlock(name);
    if (Object.prototype.hasOwnProperty.call(this.inputs, name)) return this.inputs[name];
    throw MdmaReferenceError.undefined_(name);
  }
}

export function resolveVar(path: string[], scope: Scope): unknown {
  let value = scope.resolveRoot(path[0]);
  for (let i = 1; i < path.length; i++) {
    if (isPlainObject(value)) {
      value = Object.prototype.hasOwnProperty.call(value, path[i]) ? value[path[i]] : null;
    } else {
      throw MdmaReferenceError.undefined_(path.join("."));
    }
  }
  return value;
}

export function evaluate(expr: Expr, scope: Scope): unknown {
  switch (expr.kind) {
    case "literal":
      return expr.value;
    case "array":
      return expr.items.map((item) => evaluate(item, scope));
    case "var":
      return resolveVar(expr.path, scope);
    case "not":
      return !truthy(evaluate(expr.operand, scope));
    case "binop": {
      if (expr.op === "and") {
        const left = evaluate(expr.left, scope);
        return truthy(left) ? evaluate(expr.right, scope) : left;
      }
      if (expr.op === "or") {
        const left = evaluate(expr.left, scope);
        return truthy(left) ? left : evaluate(expr.right, scope);
      }
      const left = evaluate(expr.left, scope);
      const right = evaluate(expr.right, scope);
      return COMPARATORS[expr.op](left, right);
    }
    case "filter": {
      const target = evaluate(expr.target, scope);
      const args = expr.args.map((a) => evaluate(a, scope));
      return applyFilter(expr.name, target, args);
    }
  }
}
