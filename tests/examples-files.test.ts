/** Render the repo's example .mdma files end to end as a smoke + golden test. */

import { describe, expect, it } from "vitest";
import { render } from "../src/index.js";
import { readExample } from "./helpers.js";

describe("examples/simple.mdma", () => {
  it("renders with tags and no draft flag", () => {
    const source = readExample("simple.mdma");
    const result = render(source, {
      name: "Widget",
      description: "A small reusable widget.",
      tags: ["ui", "core"],
    });
    expect(result["badge-line"]).toBe("Widget — ui, core");
    expect(result.body).toBe("## Widget\n\nA small reusable widget.\n\n**Tags:** ui, core");
  });

  it("renders draft badge and omits tags section when empty", () => {
    // `{% if tags | length > 0 -%}` has no leading `-`, so the blank line before
    // it is emitted even though the branch is false and renders empty (same
    // whitespace-control behavior verified in spec-example.test.ts).
    const source = readExample("simple.mdma");
    const result = render(source, { name: "Widget", description: "Desc.", draft: true });
    expect(result["badge-line"]).toBe("**[DRAFT]** Widget");
    expect(result.body).toBe("## Widget\n\nDesc.\n\n");
  });
});

describe("examples/release-notes.mdma", () => {
  it("renders slug, title, and changelog entries", () => {
    const source = readExample("release-notes.mdma");
    const result = render(source, {
      project: "Acme SDK",
      version: "3.0.0",
      date: "2026-07-01",
      added: ["WebSocket support"],
      breaking: true,
      releases: [{ version: "2.1.0", date: "2026-06-01", added: ["Dark mode"] }],
    });
    expect(result.slug).toBe("Acme SDK-3.0.0");
    expect(result.title).toBe("Acme SDK 3.0.0");
    const entries = result["changelog-entry"] as string[];
    expect(Array.isArray(entries)).toBe(true);
    expect(entries[0]).toBe("### 2.1.0 — 2026-06-01\n- Dark mode\n");
  });
});

describe("examples/comments.mdma", () => {
  it("renders with all comments stripped", () => {
    const source = readExample("comments.mdma");
    const result = render(source, { name: "Widget", tags: ["ui", "core"] });
    expect(result.header).toBe("## Widget");
    expect(result["tag-line"]).toBe("Tags: ui, core");
  });

  it("renders the tag line empty without tags", () => {
    const source = readExample("comments.mdma");
    expect(render(source, { name: "Widget" })["tag-line"]).toBe("");
  });
});

describe("examples/named-blocks.mdma", () => {
  it("renders an object keyed by version", () => {
    const source = readExample("named-blocks.mdma");
    const result = render(source, {
      releases: [
        { version: "2.1.0", date: "2026-06-01", added: ["Dark mode"] },
        { version: "2.0.0", date: "2026-05-01", added: ["Initial release"] },
      ],
    });
    expect(result["changelog-by-version"]).toEqual({
      "2.1.0": "### 2.1.0 — 2026-06-01\n- Dark mode\n",
      "2.0.0": "### 2.0.0 — 2026-05-01\n- Initial release\n",
    });
  });
});
