/** Validates and applies defaults to a raw inputs object against @inputs declarations. */

import { MdmaTypeError, MissingInputError } from "./errors.js";
import type { InputDecl } from "./model.js";
import { typename } from "./util.js";

const SCALAR_CHECKERS: Record<string, (v: unknown) => boolean> = {
  string: (v) => typeof v === "string",
  boolean: (v) => typeof v === "boolean",
  number: (v) => typeof v === "number",
  object: (v) => typeof v === "object" && v !== null && !Array.isArray(v),
};

export function validateInputs(
  decls: InputDecl[],
  rawInputs: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const decl of decls) {
    let value: unknown;
    if (Object.prototype.hasOwnProperty.call(rawInputs, decl.name)) {
      value = rawInputs[decl.name];
    } else if (decl.hasDefault) {
      value = decl.default;
    } else {
      throw new MissingInputError(decl.name);
    }
    checkType(decl.type, value);
    result[decl.name] = value;
  }
  return result;
}

function checkType(type: string, value: unknown): void {
  if (type.endsWith("[]")) {
    const scalar = type.slice(0, -2);
    if (!Array.isArray(value)) {
      throw new MdmaTypeError(type, typename(value));
    }
    const checker = SCALAR_CHECKERS[scalar];
    for (const item of value) {
      if (!checker(item)) {
        throw new MdmaTypeError(type, `${scalar}[] containing ${typename(item)}`);
      }
    }
    return;
  }
  if (!SCALAR_CHECKERS[type](value)) {
    throw new MdmaTypeError(type, typename(value));
  }
}
