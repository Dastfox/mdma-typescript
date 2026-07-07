/**
 * Compile-time assertions for MdmaSource/MdmaInputs and the typed render
 * signature. This file is validated by `npm run typecheck`; it is never
 * executed.
 */

import type { MdmaInputs, MdmaSource } from "../src/index.js";
import { render } from "../src/index.js";

declare const branded: MdmaSource<{ existing_zone_ids: string[]; comment?: string }>;
declare const plain: string;

// A branded source constrains the inputs object.
render(branded, { existing_zone_ids: ["a"] });
render(branded, { existing_zone_ids: ["a"], comment: "hi" });
// @ts-expect-error -- missing required input
render(branded, { comment: "hi" });
// @ts-expect-error -- wrong input type
render(branded, { existing_zone_ids: [1] });
// @ts-expect-error -- undeclared input
render(branded, { existing_zone_ids: ["a"], extra: true });

// A plain string keeps the permissive legacy signature.
render(plain);
render(plain, { anything: 1 });

// MdmaInputs extracts the declared shape from a branded source.
const inputs: MdmaInputs<typeof branded> = { existing_zone_ids: [] };
// @ts-expect-error -- undeclared input
const bad: MdmaInputs<typeof branded> = { existing_zone_ids: [], extra: 1 };
void inputs;
void bad;

// A no-inputs template rejects any input.
declare const noInputs: MdmaSource<Record<string, never>>;
render(noInputs, {});
// @ts-expect-error -- template declares no inputs
render(noInputs, { anything: 1 });
