/**
 * mdma -- a typed Markdown templating format.
 *
 * See the project README for the full language specification.
 */

export {
  DuplicateNameError,
  FilterError,
  MdmaError,
  MdmaReferenceError,
  MdmaSyntaxError,
  MdmaTypeError,
  MissingInputError,
} from "./errors.js";
export { parseFile } from "./fileParser.js";
export { getInputs, validateInputs } from "./inputs.js";
export type { Block, InputDecl, InputType, ParsedTemplate, ScalarType } from "./model.js";
export type { RenderedValue } from "./renderer.js";
export { render, renderFile, renderTemplate } from "./renderer.js";
export { writeOutput } from "./output.js";
export { dtsPathFor, generateDts } from "./typegen.js";
export type { MdmaInputs, MdmaSource } from "./types.js";

export const VERSION = "0.5.0";
