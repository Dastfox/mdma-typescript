import { MdmaTypeError } from "./errors.js";

/** Map a JS runtime value to the type name used in mdma error messages. */
export function typename(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  return typeof value;
}

/** Falsy values: null/undefined, false, 0, "", [], {}. Everything else is truthy. */
export function truthy(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (isPlainObject(value)) return Object.keys(value).length > 0;
  return Boolean(value);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(value);
}

/** Render a value for direct output inside a {{ }} interpolation. */
export function toDisplayString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return formatNumber(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(toDisplayString).join("");
  if (isPlainObject(value)) throw new MdmaTypeError("string", "object");
  return String(value);
}
