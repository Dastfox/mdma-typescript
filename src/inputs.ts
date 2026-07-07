/** Public helpers to inspect and validate a template's @inputs without rendering. */

import { parseFile } from "./fileParser.js";
import type { InputDecl } from "./model.js";
import { validateInputs as validateAgainstDecls } from "./schema.js";

/** Parse an .mdma source string and return its `@inputs` declarations. */
export function getInputs(source: string): InputDecl[] {
  return parseFile(source).inputs;
}

/**
 * Check an inputs object against an .mdma source's `@inputs` declarations
 * without rendering.
 *
 * Returns the resolved inputs (declared defaults applied). Throws
 * `MissingInputError` when a required input is absent and `MdmaTypeError`
 * when a value does not match its declared type.
 */
export function validateInputs(
  source: string,
  inputs: Record<string, unknown> = {}
): Record<string, unknown> {
  return validateAgainstDecls(parseFile(source).inputs, inputs);
}
