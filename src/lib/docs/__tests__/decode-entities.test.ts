import { describe, expect, it } from "vitest";
import { decodeIdentifierEntities } from "@/lib/docs/decode-entities";

describe("decodeIdentifierEntities", () => {
  it("decodes the ampersand leak from HTML sources", () => {
    expect(decodeIdentifierEntities("Health &amp; Fitness")).toBe("Health & Fitness");
  });

  it("decodes the common named and numeric entities", () => {
    expect(decodeIdentifierEntities("A &lt;b&gt; &quot;c&quot; &#39;d&#39;")).toBe('A <b> "c" \'d\'');
  });

  it("resolves double-encoded values", () => {
    expect(decodeIdentifierEntities("Q&amp;amp;A")).toBe("Q&A");
  });

  it("leaves plain strings untouched", () => {
    expect(decodeIdentifierEntities("Work")).toBe("Work");
    expect(decodeIdentifierEntities("")).toBe("");
  });
});
