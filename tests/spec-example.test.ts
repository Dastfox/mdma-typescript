/** Golden-output test using the worked example from spec.md section 8. */

import { describe, expect, it } from "vitest";
import { parseFile, render, renderTemplate } from "../src/index.js";

const TEMPLATE = `@inputs
project:  string
version:  string
date:     string
added:    string[] = []
changed:  string[] = []
fixed:    string[] = []
breaking: boolean  = false
releases: object[] = []

<slug>
{{ project }}-{{ version }}

<title>
{{ project }} {{ version }}

<release-notes>
# {{ title }} — {{ date }}

{%- if breaking %}

> **Breaking changes included in this release.**
{%- endif %}

{% if added | length > 0 -%}
### Added
{% for item in added -%}
- {{ item }}
{% endfor -%}
{% endif %}

{% if changed | length > 0 -%}
### Changed
{% for item in changed -%}
- {{ item }}
{% endfor -%}
{% endif %}

{% if fixed | length > 0 -%}
### Fixed
{% for item in fixed -%}
- {{ item }}
{% endfor -%}
{% endif %}

<changelog-entry
multiple: entry in releases
>

### {{ entry.version }} — {{ entry.date }}
{% for item in entry.added -%}
- {{ item }}
{% endfor %}
`;

const INPUTS = {
  project: "Acme SDK",
  version: "3.0.0",
  date: "2026-07-01",
  added: ["WebSocket support"],
  breaking: true,
  releases: [
    { version: "2.1.0", date: "2026-06-01", added: ["Dark mode"] },
    { version: "2.0.0", date: "2026-05-01", added: ["Initial release"] },
  ],
};

describe("spec.md worked example", () => {
  it("renders slug", () => {
    const result = render(TEMPLATE, INPUTS);
    expect(result.slug).toBe("Acme SDK-3.0.0");
  });

  it("renders title", () => {
    const result = render(TEMPLATE, INPUTS);
    expect(result.title).toBe("Acme SDK 3.0.0");
  });

  it("renders release-notes", () => {
    // See the Python test suite's equivalent for why this differs from the
    // abbreviated "Produces" table in spec.md section 8: the added/changed/fixed
    // sections use `{% if ... -%}` (trim only after), unlike breaking's
    // `{%- if %}...{%- endif %}` (trim both sides), so the blank-line text
    // surrounding the (empty) changed/fixed sections is emitted literally.
    const result = render(TEMPLATE, INPUTS);
    const expected =
      "# Acme SDK 3.0.0 — 2026-07-01\n" +
      "\n" +
      "> **Breaking changes included in this release.**\n" +
      "\n" +
      "### Added\n" +
      "- WebSocket support\n" +
      "\n" +
      "\n" +
      "\n" +
      "\n";
    expect(result["release-notes"]).toBe(expected);
  });

  it("renderTemplate on a pre-parsed template matches render on the source", () => {
    expect(renderTemplate(parseFile(TEMPLATE), INPUTS)).toEqual(render(TEMPLATE, INPUTS));
  });

  it("renders changelog-entry as an array of two", () => {
    const result = render(TEMPLATE, INPUTS);
    const entries = result["changelog-entry"];
    expect(Array.isArray(entries)).toBe(true);
    expect(entries).toHaveLength(2);
    expect((entries as string[])[0]).toBe("### 2.1.0 — 2026-06-01\n- Dark mode\n");
    expect((entries as string[])[1]).toBe("### 2.0.0 — 2026-05-01\n- Initial release\n");
  });
});
