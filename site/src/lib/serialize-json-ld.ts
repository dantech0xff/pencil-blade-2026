export function serializeJsonLd(value: unknown): string {
  if (typeof value === "string") {
    throw new TypeError("JSON-LD must be structured data, not a pre-serialized string.");
  }

  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new TypeError("JSON-LD value is not serializable.");
  }

  return serialized
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}
