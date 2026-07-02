import { describe, expect, it } from "vitest";
import { MdmaReferenceError, MdmaTypeError, MissingInputError } from "../src/errors.js";
import { render } from "../src/index.js";

describe("error conditions", () => {
  it("missing required input", () => {
    const src = "@inputs\nname: string\n<out>\n{{ name }}\n";
    try {
      render(src, {});
      expect.unreachable("expected MissingInputError");
    } catch (err) {
      expect(err).toBeInstanceOf(MissingInputError);
      expect((err as Error).message).toBe("MissingInput: name");
      expect((err as MissingInputError).inputName).toBe("name");
    }
  });

  it("input type mismatch", () => {
    const src = "@inputs\ncount: number\n<out>\n{{ count }}\n";
    try {
      render(src, { count: "not a number" });
      expect.unreachable("expected MdmaTypeError");
    } catch (err) {
      expect(err).toBeInstanceOf(MdmaTypeError);
      expect((err as Error).message).toBe("TypeError: expected number, got string");
    }
  });

  it("array input type mismatch", () => {
    const src = "@inputs\ntags: string[] = []\n<out>\n{{ tags }}\n";
    expect(() => render(src, { tags: "not an array" })).toThrow(MdmaTypeError);
  });

  it("array item type mismatch", () => {
    const src = "@inputs\ntags: string[] = []\n<out>\n{{ tags }}\n";
    expect(() => render(src, { tags: ["ok", 5] })).toThrow(MdmaTypeError);
  });

  it("forward block reference", () => {
    const src = "@inputs\nname: string\n<a>\n{{ b }}\n<b>\n{{ name }}\n";
    try {
      render(src, { name: "x" });
      expect.unreachable("expected MdmaReferenceError");
    } catch (err) {
      expect(err).toBeInstanceOf(MdmaReferenceError);
      expect((err as Error).message).toBe("ReferenceError: block 'b' not yet rendered");
    }
  });

  it("undefined variable reference", () => {
    const src = "@inputs\nname: string\n<out>\n{{ nope }}\n";
    try {
      render(src, { name: "x" });
      expect.unreachable("expected MdmaReferenceError");
    } catch (err) {
      expect(err).toBeInstanceOf(MdmaReferenceError);
      expect((err as Error).message).toBe("ReferenceError: 'nope' is not defined");
    }
  });

  it("backward block reference is allowed", () => {
    const src = "@inputs\nname: string\n<a>\n{{ name }}\n<b>\n{{ a }}!\n";
    const result = render(src, { name: "hi" });
    expect(result.a).toBe("hi");
    expect(result.b).toBe("hi!");
  });

  it("block reference resolves before a same-named input", () => {
    // Resolution order: previously rendered blocks first, then inputs. A block
    // named the same as an input cannot reference itself (it isn't rendered
    // yet), but a later block referencing that name gets the block's output.
    const src = "@inputs\ntitle: string\n<title>\nCustom Title\n<out>\n{{ title }}\n";
    const result = render(src, { title: "Report" });
    expect(result.title).toBe("Custom Title");
    expect(result.out).toBe("Custom Title");
  });
});
