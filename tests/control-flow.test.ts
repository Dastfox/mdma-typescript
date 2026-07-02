import { describe, expect, it } from "vitest";
import { DuplicateNameError, MdmaSyntaxError, MdmaTypeError } from "../src/errors.js";
import { render } from "../src/index.js";

describe("control flow", () => {
  it("if/elif/else", () => {
    const src =
      "@inputs\nn: number\n<out>\n" +
      "{% if n > 10 %}big{% elif n > 0 %}small{% else %}non-positive{% endif %}\n";
    expect((render(src, { n: 20 }).out as string).trim()).toBe("big");
    expect((render(src, { n: 5 }).out as string).trim()).toBe("small");
    expect((render(src, { n: -1 }).out as string).trim()).toBe("non-positive");
  });

  it("logical operators", () => {
    const src =
      "@inputs\na: boolean = false\nb: boolean = false\n<out>\n" +
      "{% if a and b %}both{% elif a or b %}one{% else %}neither{% endif %}\n";
    expect((render(src, { a: true, b: true }).out as string).trim()).toBe("both");
    expect((render(src, { a: true, b: false }).out as string).trim()).toBe("one");
    expect((render(src, { a: false, b: false }).out as string).trim()).toBe("neither");
  });

  it("not operator", () => {
    const src = "@inputs\nflag: boolean = false\n<out>\n{% if not flag %}yes{% else %}no{% endif %}\n";
    expect((render(src, { flag: false }).out as string).trim()).toBe("yes");
    expect((render(src, { flag: true }).out as string).trim()).toBe("no");
  });

  it("nested if inside for with loop.first/last", () => {
    const src =
      "@inputs\nitems: string[] = []\n<out>\n" +
      "{% for item in items -%}\n" +
      "{% if loop.first %}[{% endif %}{{ item }}{% if not loop.last %}, {% endif %}" +
      "{% if loop.last %}]{% endif %}\n" +
      "{%- endfor %}";
    const result = render(src, { items: ["a", "b", "c"] });
    expect(result.out).toBe("[a, b, c]");
  });

  it("loop variables", () => {
    const src =
      "@inputs\nitems: string[] = []\n<out>\n" +
      "{% for item in items -%}\n" +
      "{{ loop.index }}:{{ loop.index0 }}:{{ loop.length }} " +
      "{% endfor %}";
    const result = render(src, { items: ["x", "y"] });
    expect(result.out).toBe("1:0:2 2:1:2 ");
  });

  it("whitespace control matches spec.md section 5.3's example", () => {
    const src =
      "@inputs\nbreaking: boolean = false\n<out>\n" +
      "before\n" +
      "{%- if breaking %}\n" +
      "\n" +
      "> **Breaking changes included in this release.**\n" +
      "{%- endif %}\n" +
      "after";
    const withBreaking = render(src, { breaking: true }).out;
    const withoutBreaking = render(src, { breaking: false }).out;
    expect(withBreaking).toBe("before\n\n> **Breaking changes included in this release.**\nafter");
    expect(withoutBreaking).toBe("before\nafter");
  });

  it("multiple modifier produces an array", () => {
    const src = "@inputs\nreleases: object[] = []\n<entry\nmultiple: r in releases\n>\n{{ r.version }}\n";
    const result = render(src, { releases: [{ version: "1.0" }, { version: "2.0" }] });
    expect(result.entry).toEqual(["1.0", "2.0"]);
  });

  it("multiple modifier with an empty array", () => {
    const src = "@inputs\nreleases: object[] = []\n<entry\nmultiple: r in releases\n>\n{{ r.version }}\n";
    const result = render(src, { releases: [] });
    expect(result.entry).toEqual([]);
  });

  it("open angle alone with name on the next line", () => {
    const src =
      "@inputs\nreleases: object[] = []\n<\nentry\nmultiple: r in releases\n>\n{{ r.version }}\n";
    const result = render(src, { releases: [{ version: "1.0" }] });
    expect(result.entry).toEqual(["1.0"]);
  });

  it("name modifier produces an object keyed by computed name", () => {
    const src =
      "@inputs\nreleases: object[] = []\n<entry\n" +
      "multiple: r in releases\nname: r.version\n>\n{{ r.date }}\n";
    const result = render(src, {
      releases: [
        { version: "2.1.0", date: "2026-06-01" },
        { version: "2.0.0", date: "2026-05-01" },
      ],
    });
    expect(result.entry).toEqual({ "2.1.0": "2026-06-01", "2.0.0": "2026-05-01" });
  });

  it("name modifier may precede multiple modifier", () => {
    const src =
      "@inputs\nreleases: object[] = []\n<entry\n" +
      "name: r.version\nmultiple: r in releases\n>\n{{ r.date }}\n";
    const result = render(src, { releases: [{ version: "2.1.0", date: "2026-06-01" }] });
    expect(result.entry).toEqual({ "2.1.0": "2026-06-01" });
  });

  it("name modifier with an empty array produces an empty object", () => {
    const src =
      "@inputs\nreleases: object[] = []\n<entry\n" +
      "multiple: r in releases\nname: r.version\n>\n{{ r.date }}\n";
    const result = render(src, { releases: [] });
    expect(result.entry).toEqual({});
  });

  it("name modifier stringifies a numeric name", () => {
    const src =
      "@inputs\nitems: object[] = []\n<entry\n" +
      "multiple: it in items\nname: it.id\n>\n{{ it.label }}\n";
    const result = render(src, {
      items: [
        { id: 1, label: "a" },
        { id: 2, label: "b" },
      ],
    });
    expect(result.entry).toEqual({ "1": "a", "2": "b" });
  });

  it("name modifier raises DuplicateNameError on collision", () => {
    const src =
      "@inputs\nitems: object[] = []\n<entry\n" +
      "multiple: it in items\nname: it.id\n>\n{{ it.label }}\n";
    try {
      render(src, {
        items: [
          { id: "x", label: "a" },
          { id: "x", label: "b" },
        ],
      });
      expect.unreachable("expected DuplicateNameError");
    } catch (err) {
      expect(err).toBeInstanceOf(DuplicateNameError);
      expect((err as Error).message).toBe("DuplicateName: 'x' in block 'entry'");
    }
  });

  it("name modifier raises MdmaTypeError on a non-scalar name", () => {
    const src =
      "@inputs\nitems: object[] = []\n<entry\n" +
      "multiple: it in items\nname: it.tags\n>\n{{ it.label }}\n";
    expect(() => render(src, { items: [{ tags: ["a", "b"], label: "x" }] })).toThrow(
      MdmaTypeError
    );
  });

  it("name modifier without a preceding multiple modifier is a syntax error", () => {
    const src = "@inputs\nflag: boolean = false\n<out\nname: flag\n>\nhi\n";
    expect(() => render(src, {})).toThrow(MdmaSyntaxError);
  });

  it("duplicate multiple modifier is a syntax error", () => {
    const src =
      "@inputs\nreleases: object[] = []\n<entry\n" +
      "multiple: r in releases\nmultiple: r in releases\n>\n{{ r.version }}\n";
    expect(() => render(src, { releases: [] })).toThrow(MdmaSyntaxError);
  });

  it("unterminated block header is a syntax error", () => {
    const src = "@inputs\nreleases: object[] = []\n<entry\nmultiple: r in releases\n{{ r.version }}\n";
    expect(() => render(src, { releases: [] })).toThrow(MdmaSyntaxError);
  });

  it("dangling endif is a syntax error", () => {
    const src = "@inputs\nflag: boolean = false\n<out>\n{% endif %}\n";
    expect(() => render(src, {})).toThrow(MdmaSyntaxError);
  });

  it("missing endfor is a syntax error", () => {
    const src = "@inputs\nitems: string[] = []\n<out>\n{% for x in items %}{{ x }}\n";
    expect(() => render(src, { items: [] })).toThrow(MdmaSyntaxError);
  });
});
