import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const EXAMPLES_DIR = join(HERE, "examples");

export function readExample(name: string): string {
  return readFileSync(join(EXAMPLES_DIR, name), "utf-8");
}
