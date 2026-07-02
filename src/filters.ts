/** Built-in filters, per spec.md section 6 and docs/filters.md. */

import { FilterError, MdmaSyntaxError } from "./errors.js";
import { toDisplayString, truthy } from "./util.js";

type Filter = (value: unknown, args: unknown[]) => unknown;

function isStr(v: unknown): v is string {
  return typeof v === "string";
}

function isList(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

function fLength(value: unknown): number {
  if (isStr(value) || isList(value)) return value.length;
  throw new FilterError("length", "string or array");
}

function fLower(value: unknown): string {
  if (!isStr(value)) throw new FilterError("lower", "string");
  return value.toLowerCase();
}

function fUpper(value: unknown): string {
  if (!isStr(value)) throw new FilterError("upper", "string");
  return value.toUpperCase();
}

function fTrim(value: unknown): string {
  if (!isStr(value)) throw new FilterError("trim", "string");
  return value.trim();
}

function fJoin(value: unknown, args: unknown[]): string {
  if (!isList(value)) throw new FilterError("join", "array");
  const sep = args.length > 0 ? String(args[0]) : "";
  return value.map(toDisplayString).join(sep);
}

function fFirst(value: unknown): unknown {
  if (!isList(value)) throw new FilterError("first", "array");
  return value.length > 0 ? value[0] : null;
}

function fLast(value: unknown): unknown {
  if (!isList(value)) throw new FilterError("last", "array");
  return value.length > 0 ? value[value.length - 1] : null;
}

function fDefault(value: unknown, args: unknown[]): unknown {
  const fallback = args.length > 0 ? args[0] : null;
  return truthy(value) ? value : fallback;
}

function fReverse(value: unknown): unknown {
  if (isStr(value)) return [...value].reverse().join("");
  if (isList(value)) return [...value].reverse();
  throw new FilterError("reverse", "array or string");
}

function fSort(value: unknown): unknown {
  if (!isList(value)) throw new FilterError("sort", "array");
  return [...value].sort((a, b) => {
    const av = a as string | number;
    const bv = b as string | number;
    if (av < bv) return -1;
    if (av > bv) return 1;
    return 0;
  });
}

function fUnique(value: unknown): unknown {
  if (!isList(value)) throw new FilterError("unique", "array");
  const seen = new Set<string>();
  const result: unknown[] = [];
  for (const v of value) {
    const key = JSON.stringify(v);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(v);
    }
  }
  return result;
}

const FILTERS: Record<string, Filter> = {
  length: fLength,
  lower: fLower,
  upper: fUpper,
  trim: fTrim,
  join: fJoin,
  first: fFirst,
  last: fLast,
  default: fDefault,
  reverse: fReverse,
  sort: fSort,
  unique: fUnique,
};

export function applyFilter(name: string, value: unknown, args: unknown[]): unknown {
  const fn = FILTERS[name];
  if (fn === undefined) {
    throw new MdmaSyntaxError(`Unknown filter: '${name}'`);
  }
  return fn(value, args);
}
