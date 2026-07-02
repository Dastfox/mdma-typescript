import { describe, expect, it } from "vitest";
import { FilterError, MdmaSyntaxError } from "../src/errors.js";
import { render } from "../src/index.js";

function renderExpr(expr: string): string {
  const source = `@inputs\n<out>\n{{ ${expr} }}\n`;
  return render(source, {}).out as string;
}

describe("filters", () => {
  it("length works on strings and arrays", () => {
    expect(renderExpr('"hello" | length')).toBe("5");
    const src = "@inputs\ntags: string[] = []\n<out>\n{{ tags | length }}\n";
    expect(render(src, { tags: ["a", "b", "c"] }).out).toBe("3");
  });

  it("lower, upper, trim", () => {
    expect(renderExpr('"HeLLo" | lower')).toBe("hello");
    expect(renderExpr('"HeLLo" | upper')).toBe("HELLO");
    expect(renderExpr('"  hi  " | trim')).toBe("hi");
  });

  it("join with default and custom separator", () => {
    const src = '@inputs\ntags: string[] = []\n<out>\n{{ tags | join(", ") }}\n';
    expect(render(src, { tags: ["a", "b"] }).out).toBe("a, b");
    const src2 = "@inputs\ntags: string[] = []\n<out>\n{{ tags | join }}\n";
    expect(render(src2, { tags: ["a", "b"] }).out).toBe("ab");
  });

  it("first/last on empty array feed into default", () => {
    const src = '@inputs\ntags: string[] = []\n<out>\n{{ tags | first | default("none") }}\n';
    expect(render(src, { tags: [] }).out).toBe("none");
    const src2 = '@inputs\ntags: string[] = []\n<out>\n{{ tags | last | default("none") }}\n';
    expect(render(src2, { tags: [] }).out).toBe("none");
  });

  it("first/last on non-empty array", () => {
    const src = "@inputs\ntags: string[] = []\n<out>\n{{ tags | first }}-{{ tags | last }}\n";
    expect(render(src, { tags: ["a", "b", "c"] }).out).toBe("a-c");
  });

  it("default on a missing object property", () => {
    const src = '@inputs\nitem: object\n<out>\n{{ item.description | default("N/A") }}\n';
    expect(render(src, { item: {} }).out).toBe("N/A");
    expect(render(src, { item: { description: "hi" } }).out).toBe("hi");
  });

  it("default with an empty array literal", () => {
    const src = "@inputs\ntags: string[] = []\n<out>\n{{ tags | default([]) | length }}\n";
    expect(render(src, { tags: [] }).out).toBe("0");
  });

  it("reverse on strings and arrays", () => {
    expect(renderExpr('"abc" | reverse')).toBe("cba");
    const src = '@inputs\ntags: string[] = []\n<out>\n{{ tags | reverse | join(",") }}\n';
    expect(render(src, { tags: ["a", "b", "c"] }).out).toBe("c,b,a");
  });

  it("sort then unique", () => {
    const src = '@inputs\ntags: string[] = []\n<out>\n{{ tags | sort | unique | join(", ") }}\n';
    expect(render(src, { tags: ["beta", "api", "beta", "stable"] }).out).toBe("api, beta, stable");
  });

  it("chains filters left to right", () => {
    const src = "@inputs\nname: string\n<out>\n{{ name | lower | trim }}\n";
    expect(render(src, { name: "  ACME  " }).out).toBe("acme");
  });

  it.each([
    ["123 | length", "length"],
    ["123 | lower", "lower"],
    ["123 | upper", "upper"],
    ["123 | trim", "trim"],
    ['"x" | join(",")', "join"],
    ['"x" | first', "first"],
    ['"x" | last', "last"],
    ['"x" | sort', "sort"],
    ['"x" | unique', "unique"],
  ])("%s raises FilterError('%s')", (expr, filterName) => {
    try {
      renderExpr(expr);
      expect.unreachable("expected FilterError");
    } catch (err) {
      expect(err).toBeInstanceOf(FilterError);
      expect((err as FilterError).filterName).toBe(filterName);
    }
  });

  it("reverse accepts strings without raising", () => {
    expect(() => renderExpr('"x" | reverse')).not.toThrow();
  });

  it("unknown filter raises MdmaSyntaxError", () => {
    expect(() => renderExpr('"x" | notafilter')).toThrow(MdmaSyntaxError);
  });
});
