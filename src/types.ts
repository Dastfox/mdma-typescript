/**
 * Compile-time typing for .mdma templates.
 *
 * An `MdmaSource<I>` is a plain string carrying a phantom record of the
 * template's `@inputs` shape. The brand is an optional property on a
 * module-private symbol, so it exists only in the type system: any
 * `MdmaSource` is a regular string at runtime, and a generated
 * `foo.d.mdma.ts` file can declare a `.mdma` import as
 * `MdmaSource<{...}>` without changing what the bundler emits.
 */

import type { ParsedTemplate } from "./model.js";

declare const mdmaInputsBrand: unique symbol;

/** A .mdma source string branded with the shape of its `@inputs` section. */
export type MdmaSource<I extends Record<string, unknown> = Record<string, unknown>> = string & {
  readonly [mdmaInputsBrand]?: I;
};

/**
 * The inputs object expected by an .mdma source or parsed template.
 *
 * For a branded `MdmaSource<I>` or `ParsedTemplate<I>` (e.g. an import typed
 * by a generated `.d.mdma.ts` file) this resolves to `I`, so mismatched keys
 * are flagged by the IDE and `tsc`. Otherwise it falls back to
 * `Record<string, unknown>` — validation then happens at render time only.
 */
export type MdmaInputs<S> = [S] extends [MdmaSource<infer I>]
  ? I
  : [S] extends [ParsedTemplate<infer I>]
    ? I
    : Record<string, unknown>;
