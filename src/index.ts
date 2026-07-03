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
export type { Block, InputDecl, InputType, ParsedTemplate } from "./model.js";
export type { RenderedValue } from "./renderer.js";
export { render, renderFile } from "./renderer.js";
export { writeOutput } from "./output.js";

export const VERSION = "0.2.0";
