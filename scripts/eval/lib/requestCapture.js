const textOf = (content) => {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : (part?.text ?? "")))
      .join("");
  }
  return "";
};

const squash = (text) => text.replace(/\s+/g, " ").trim();

const userText = (request) =>
  squash(
    (request?.messages ?? [])
      .filter((m) => m?.role === "user")
      .map((m) => textOf(m.content))
      .join("\n"),
  );

/**
 * The engine request that carries THIS case's own input text, out of every
 * request seen since the case began. A request left over from an earlier,
 * timed-out case can arrive after this case starts; taking the last request
 * seen would record that case's persona and reference block here. Matching on
 * the input text cannot pick it up, whatever order requests arrive in.
 *
 * Returns null when no request carries the input, or when the input is empty
 * (nothing identifies the request as this case's). Callers treat null as
 * "unknown": the record's request fields are null and routing is needs-human.
 * If the app rewrote the input before sending (PII scrubbing, redaction) the
 * request will not match either; that is reported, never guessed.
 */
export function selectOwnRequest(captured, input) {
  const needle = squash(String(input ?? ""));
  if (!needle || !Array.isArray(captured)) return null;
  const matches = captured.filter((request) =>
    userText(request).includes(needle),
  );
  return matches.at(-1) ?? null;
}
