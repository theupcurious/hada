/**
 * Decode the small set of named/numeric HTML entities that leak into short
 * document identifiers (titles, folder names) when the assistant lifts them from
 * HTML sources — e.g. a folder arriving as "Health &amp; Fitness".
 *
 * This is deliberately scoped to *identifiers*, applied at the write boundary
 * (the create/update document paths), NOT to arbitrary document body content at
 * render time. Decoding an entire markdown body on render would corrupt content
 * that legitimately contains entity-like text; a title/folder is a short, safe
 * string where "&amp;" is never the intended literal.
 */
const NAMED_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#x27;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

export function decodeIdentifierEntities(value: string): string {
  if (!value || value.indexOf("&") === -1) return value;
  return value
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp);|&#39;|&#x27;/g, (m) => NAMED_ENTITIES[m] ?? m)
    // Re-run once so double-encoded values like "&amp;amp;" fully resolve.
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g, (m) => NAMED_ENTITIES[m] ?? m);
}
