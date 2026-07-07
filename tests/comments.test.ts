/** {# ... #} comments: stripped at parse time, never rendered. */

import { describe, expect, it } from "vitest";
import { MdmaSyntaxError } from "../src/errors.js";
import { render } from "../src/index.js";

describe("comments", () => {
  it("inline comment is stripped", () => {
    const src = "@inputs\nname: string\n<out>\nHello {# note #}world\n";
    expect(render(src, { name: "x" }).out).toBe("Hello world");
  });

  it("full-line comment vanishes with its line", () => {
    const src = "@inputs\nname: string\n<out>\nline one\n{# gone #}\nline two\n";
    expect(render(src, { name: "x" }).out).toBe("line one\nline two");
  });

  it("indented full-line comment vanishes", () => {
    const src = "@inputs\nname: string\n<out>\nline one\n   {# gone #}   \nline two\n";
    expect(render(src, { name: "x" }).out).toBe("line one\nline two");
  });

  it("consecutive full-line comments", () => {
    const src = "@inputs\nname: string\n<out>\nline one\n{# a #}\n{# b #}\nline two\n";
    expect(render(src, { name: "x" }).out).toBe("line one\nline two");
  });

  it("multi-line comment at end of body", () => {
    const src = "@inputs\nname: string\n<out>\nline one\n{# spans\nseveral\nlines #}\n";
    expect(render(src, { name: "x" }).out).toBe("line one");
  });

  it("commented-out template code is not evaluated", () => {
    const src = "@inputs\nname: string\n<out>\n{{ name }}{# {{ missing_var }} {% if broken %} #}\n";
    expect(render(src, { name: "x" }).out).toBe("x");
  });

  it("comment trim markers", () => {
    const src = "@inputs\nname: string\n<out>\na  {#- note -#}  b\n";
    expect(render(src, { name: "x" }).out).toBe("ab");
  });

  it("comment ends at first closer", () => {
    const src = "@inputs\nname: string\n<out>\nx{# a #} b #}\n";
    expect(render(src, { name: "x" }).out).toBe("x b #}");
  });

  it("comment line inside a for loop", () => {
    const src =
      "@inputs\nitems: string[] = []\n<out>\n" +
      "{% for item in items -%}\n" +
      "{# per-item note #}\n" +
      "- {{ item }}\n" +
      "{% endfor %}";
    expect(render(src, { items: ["a", "b"] }).out).toBe("- a\n- b\n");
  });

  it("comment-only body renders empty", () => {
    const src = "@inputs\nname: string\n<out>\n{# nothing to see #}\n";
    expect(render(src, { name: "x" }).out).toBe("");
  });

  it("comments in the @inputs section", () => {
    const src =
      "@inputs\n" +
      "{# who is greeted #}\n" +
      "name: string\n" +
      "count: number = 2  {# how many times #}\n" +
      "<out>\n" +
      "{{ name }} x{{ count }}\n";
    expect(render(src, { name: "bob" }).out).toBe("bob x2");
  });

  it("comment-like span inside a quoted default is preserved", () => {
    const src = '@inputs\nnote: string = "keep {# this #}"\n<out>\n{{ note }}\n';
    expect(render(src, {}).out).toBe("keep {# this #}");
  });

  it("comment lines between blocks", () => {
    const src =
      "@inputs\n" +
      "name: string\n" +
      "\n" +
      "{# separator before the first block #}\n" +
      "<first>\n" +
      "{{ name }}\n" +
      "\n" +
      "{# separator between blocks #}\n" +
      "\n" +
      "<second>\n" +
      "{{ first }}!\n";
    const result = render(src, { name: "bob" });
    expect(result.first).toBe("bob");
    expect(result.second).toBe("bob!");
  });

  it("literal comment delimiter via interpolation", () => {
    const src = '@inputs\nname: string\n<out>\n{{ "{#" }}comment{{ "#}" }}\n';
    expect(render(src, { name: "x" }).out).toBe("{#comment#}");
  });

  it("unclosed comment raises", () => {
    const src = "@inputs\nname: string\n<out>\noops {# never closed\n";
    expect(() => render(src, { name: "x" })).toThrow(MdmaSyntaxError);
  });

  it("unclosed comment in @inputs raises", () => {
    const src = "@inputs\n{# oops\nname: string\n<out>\nhi\n";
    expect(() => render(src, { name: "x" })).toThrow(MdmaSyntaxError);
  });
});
