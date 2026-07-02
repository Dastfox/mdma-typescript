# typescript-mdma

Render one or more Markdown strings from an `.mdma` template and a typed inputs object.

This is the TypeScript reference implementation of [MDMA](https://github.com/Dastfox/mdma). See the [language specification and docs](https://dastfox.github.io/mdma/) for the full grammar, filter reference, and worked examples.

## Install

```bash
npm install typescript-mdma
```

## Usage

```typescript
import { render } from "typescript-mdma";
import { readFileSync } from "node:fs";

const source = readFileSync("release-notes.mdma", "utf-8");
const result = render(source, {
  project: "Acme SDK",
  version: "3.0.0",
  date: "2026-07-01",
  added: ["WebSocket support"],
  breaking: true,
  releases: [{ version: "2.1.0", date: "2026-06-01", added: ["Dark mode"] }],
});

result.slug;             // "Acme SDK-3.0.0"          (string)
result["release-notes"]; // rendered markdown          (string)
result["changelog-entry"]; // one string per release   (string[], from `<multiple:>`)
```

A `<multiple:>` block can also declare `<name:>` to key each item by a computed
name instead of array position:

```mdma
<changelog-by-version>
<multiple: entry in releases>
<name: entry.version>

### {{ entry.version }} — {{ entry.date }}
```

```typescript
result["changelog-by-version"];
// { "2.1.0": "### 2.1.0 — 2026-06-01\n", "2.0.0": "### 2.0.0 — 2026-05-01\n" }
```

`renderFile(path, inputs)` reads `path` as UTF-8 and renders it — equivalent
to `render(readFileSync(path, "utf-8"), inputs)`:

```typescript
import { renderFile } from "typescript-mdma";

const result = renderFile("release-notes.mdma", { project: "Acme SDK", version: "3.0.0", date: "2026-07-01" });
```

`writeOutput(result, outputDir, block?)` writes a `render()`/`renderFile()`
result to `.md` files. Omit `block` to write every top-level block; pass a
block name to write only that one. A string-valued block becomes
`{outputDir}/{block}.md`; a `<multiple:>` block becomes a directory
`{outputDir}/{block}/` with one file per item — `{name}.md` if the block
declared `<name:>`, otherwise `{index}.md`. Returns the list of paths written.

```typescript
import { renderFile, writeOutput } from "typescript-mdma";

const result = renderFile("release-notes.mdma", { ... });
writeOutput(result, "out/");                        // every block
writeOutput(result, "out/", "release-notes");        // just that one
```

`render()` throws one of the errors in the package on failure:

| Error class | Condition |
|---|---|
| `MissingInputError` | a required input (no default) was not supplied |
| `MdmaTypeError` | an input's runtime type doesn't match its declared type, or a `<name:>` expression evaluates to something other than a string/number |
| `MdmaReferenceError` | a forward block reference, or an undefined variable |
| `FilterError` | a filter was applied to a value of the wrong type |
| `MdmaSyntaxError` | the `.mdma` source doesn't conform to the grammar (including `<name:>` used without a preceding `<multiple:>`) |
| `DuplicateNameError` | two items in a `<multiple:>` block computed the same `<name:>` value |

All extend `MdmaError`.

## Behavioral notes not obvious from spec.md

- The blank line conventionally left between one block's content and the next
  block's header (or EOF) is treated as file formatting, not part of either
  block's rendered value — it's stripped from both ends of the block body
  before parsing. This is required for block references (`{{ blockname }}`)
  to be safely embeddable inline; otherwise every block value would carry a
  stray trailing newline from that separator. Blank lines *inside* a body are
  preserved exactly as written.
- Whitespace control (`{%-`/`-%}`) is applied per-tag, exactly as written —
  a conditional branch that renders empty does not retroactively remove
  surrounding blank-line text unless that text is trimmed by an adjacent `-`.
- Accessing a missing property on an `object`/`object[]` value (e.g.
  `entry.description` when `description` wasn't set) yields `null` rather
  than throwing — objects are untyped maps, so this is normal and is what
  makes `| default(...)` useful on them. An undefined *root* identifier
  (typo'd variable/block/input name) still throws `MdmaReferenceError`.
- `default([])` and other array literals (`[a, b]`) are supported in
  expressions even though the formal grammar doesn't enumerate an
  array-literal production — the [filter reference](https://dastfox.github.io/mdma/filters/)
  relies on this syntax (`{{ list | default([]) }}`).
- This implementation is a from-scratch parser/interpreter (no Jinja/Liquid
  dependency), matching the [Python package](https://github.com/Dastfox/mdma-python)
  behavior exactly — both share the same golden-output test fixtures.
- `multiple` is a reserved word (can't be used as a block or input name), but
  `name` is not — `<name:>` is only ever recognized in its fixed position
  right after `<multiple:>`, so an input or block literally named `name`
  (e.g. `name: string`) is unaffected.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```
