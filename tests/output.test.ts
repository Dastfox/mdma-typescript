import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MdmaReferenceError, render, renderFile, writeOutput } from "../src/index.js";
import { EXAMPLES_DIR } from "./helpers.js";

let outDir: string;

beforeEach(() => {
  outDir = mkdtempSync(join(tmpdir(), "mdma-test-"));
});

afterEach(() => {
  rmSync(outDir, { recursive: true, force: true });
});

const releaseNotesInputs = {
  project: "Acme SDK",
  version: "3.0.0",
  date: "2026-07-01",
  releases: [
    { version: "2.1.0", date: "2026-06-01", added: ["Dark mode"] },
    { version: "2.0.0", date: "2026-05-01", added: ["Initial release"] },
  ],
};

describe("renderFile", () => {
  it("matches render() on the same source", () => {
    const path = join(EXAMPLES_DIR, "release-notes.mdma");
    const viaFile = renderFile(path, releaseNotesInputs);
    const viaString = render(readFileSync(path, "utf-8"), releaseNotesInputs);
    expect(viaFile).toEqual(viaString);
  });
});

describe("writeOutput", () => {
  it("writes every block by default", () => {
    const result = renderFile(join(EXAMPLES_DIR, "release-notes.mdma"), releaseNotesInputs);
    const written = writeOutput(result, outDir);

    expect(readFileSync(join(outDir, "slug.md"), "utf-8")).toBe(result.slug as string);
    expect(readFileSync(join(outDir, "title.md"), "utf-8")).toBe(result.title as string);
    expect(readFileSync(join(outDir, "release-notes.md"), "utf-8")).toBe(
      result["release-notes"] as string
    );
    const entries = result["changelog-entry"] as string[];
    expect(readFileSync(join(outDir, "changelog-entry", "0.md"), "utf-8")).toBe(entries[0]);
    expect(readFileSync(join(outDir, "changelog-entry", "1.md"), "utf-8")).toBe(entries[1]);
    expect(written).toHaveLength(5);
  });

  it("writes only the requested block", () => {
    const result = renderFile(join(EXAMPLES_DIR, "release-notes.mdma"), releaseNotesInputs);
    const written = writeOutput(result, outDir, "slug");

    expect(written).toEqual([join(outDir, "slug.md")]);
    expect(existsSync(join(outDir, "title.md"))).toBe(false);
  });

  it("writes named <multiple:> blocks keyed by name", () => {
    const result = renderFile(join(EXAMPLES_DIR, "named-blocks.mdma"), {
      releases: [{ version: "2.1.0", date: "2026-06-01", added: ["Dark mode"] }],
    });

    writeOutput(result, outDir, "changelog-by-version");

    const named = result["changelog-by-version"] as Record<string, string>;
    expect(readFileSync(join(outDir, "changelog-by-version", "2.1.0.md"), "utf-8")).toBe(
      named["2.1.0"]
    );
  });

  it("throws MdmaReferenceError for an unknown block", () => {
    const result = renderFile(join(EXAMPLES_DIR, "release-notes.mdma"), releaseNotesInputs);
    expect(() => writeOutput(result, outDir, "does-not-exist")).toThrow(MdmaReferenceError);
  });

  it("rejects a path-traversal filename", () => {
    const malicious = { "changelog-by-version": { "../../evil": "pwned" } };
    expect(() => writeOutput(malicious, outDir, "changelog-by-version")).toThrow();
  });
});
