import { describe, expect, it } from "vitest";
import { getInputs, MdmaTypeError, MissingInputError, validateInputs } from "../src/index.js";

const SOURCE = `@inputs
title: string
count: number = 3
tags: string[] = []
draft: boolean

<body>
{title}
`;

describe("getInputs", () => {
  it("returns the declared inputs in order", () => {
    const inputs = getInputs(SOURCE);
    expect(inputs.map((d) => d.name)).toEqual(["title", "count", "tags", "draft"]);
    expect(inputs.map((d) => d.type)).toEqual(["string", "number", "string[]", "boolean"]);
  });

  it("carries defaults", () => {
    const byName = new Map(getInputs(SOURCE).map((d) => [d.name, d]));
    expect(byName.get("count")).toMatchObject({ hasDefault: true, default: 3 });
    expect(byName.get("tags")).toMatchObject({ hasDefault: true, default: [] });
    expect(byName.get("title")).toMatchObject({ hasDefault: false, default: null });
  });
});

describe("validateInputs", () => {
  it("returns resolved inputs with defaults applied", () => {
    expect(validateInputs(SOURCE, { title: "Hi", draft: false })).toEqual({
      title: "Hi",
      count: 3,
      tags: [],
      draft: false,
    });
  });

  it("throws MissingInputError for an absent required input", () => {
    expect(() => validateInputs(SOURCE, { title: "Hi" })).toThrow(MissingInputError);
  });

  it("throws MdmaTypeError for a mistyped input", () => {
    expect(() => validateInputs(SOURCE, { title: 1, draft: false })).toThrow(MdmaTypeError);
  });

  it("ignores undeclared inputs, matching render behavior", () => {
    const resolved = validateInputs(SOURCE, { title: "Hi", draft: true, extra: "x" });
    expect(resolved).not.toHaveProperty("extra");
  });
});
