// Renders the markdown a model tends to write (bold, italics, inline code,
// headings, bullet and numbered lists, nested lists) as React elements. Model
// text is never turned into HTML: every piece is a text node, so a tag, a
// script or a link written by the model shows as the characters it is.

const WHOLE_LINE_BOLD = /^\*\*([^*]+)\*\*$/;

const isSpace = (ch) => ch === " " || ch === "\t" || ch === "\n";

function boldSpan(text, i) {
  const j = text.indexOf("**", i + 2);
  const inner = j > i + 2 ? text.slice(i + 2, j) : "";
  return inner && !inner.includes("*")
    ? { kind: "strong", inner, end: j + 2 }
    : null;
}

function codeSpan(text, i) {
  const j = text.indexOf("`", i + 1);
  return j > i + 1
    ? { kind: "code", inner: text.slice(i + 1, j), end: j + 1 }
    : null;
}

function italicSpan(text, i) {
  if (!text[i + 1] || isSpace(text[i + 1])) return null;
  const j = text.indexOf("*", i + 1);
  const inner = j > i + 1 ? text.slice(i + 1, j) : "";
  return inner && !isSpace(inner.at(-1))
    ? { kind: "em", inner, end: j + 1 }
    : null;
}

// The span that starts at text[i], or null when text[i] opens nothing:
// **bold**, `code` or *italic* (no space after the opening star or
// before the closing one, so "5 * 3 *" stays as typed).
function spanAt(text, i) {
  if (text.startsWith("**", i)) return boldSpan(text, i);
  if (text[i] === "`") return codeSpan(text, i);
  if (text[i] === "*") return italicSpan(text, i);
  return null;
}

const TAGS = { strong: "strong", code: "code", em: "em" };

function renderInline(text, keyPrefix) {
  const nodes = [];
  let plain = "";
  let n = 0;
  let i = 0;
  while (i < text.length) {
    const span = spanAt(text, i);
    if (span) {
      if (plain) nodes.push(plain);
      plain = "";
      const Tag = TAGS[span.kind];
      nodes.push(<Tag key={`${keyPrefix}-${n++}`}>{span.inner}</Tag>);
      i = span.end;
    } else {
      plain += text[i];
      i += 1;
    }
  }
  if (plain) nodes.push(plain);
  return nodes;
}

// A list line: leading spaces, a bullet (* • -) or a number with . or ), a space.
function parseListLine(line) {
  const trimmed = line.trimStart();
  const indent = line.length - trimmed.length;
  const marker = trimmed[0];
  if (
    (marker === "*" || marker === "•" || marker === "-") &&
    trimmed[1] === " "
  ) {
    return {
      indent,
      ordered: false,
      number: null,
      text: trimmed.slice(2).trimStart(),
    };
  }
  let d = 0;
  while (d < trimmed.length && trimmed[d] >= "0" && trimmed[d] <= "9") d += 1;
  const closer = trimmed[d];
  if (d > 0 && d <= 3 && (closer === "." || closer === ")")) {
    if (trimmed[d + 1] === " ") {
      return {
        indent,
        ordered: true,
        number: Number.parseInt(trimmed.slice(0, d), 10),
        text: trimmed.slice(d + 2).trimStart(),
      };
    }
  }
  return null;
}

// "### Title" gives "Title"; one to six hashes and a space.
function headingText(line) {
  let n = 0;
  while (line[n] === "#") n += 1;
  return n >= 1 && n <= 6 && line[n] === " " ? line.slice(n + 1).trim() : null;
}

function parseLines(content) {
  return content.split("\n").map((line, i) => {
    const item = parseListLine(line);
    return item ? { type: "item", i, ...item } : { type: "line", i, line };
  });
}

function buildList(items, start) {
  const first = items[start];
  const Tag = first.ordered ? "ol" : "ul";
  const entries = [];
  let idx = start;
  while (
    idx < items.length &&
    items[idx].type === "item" &&
    items[idx].indent >= first.indent &&
    (items[idx].indent >= first.indent + 2 ||
      items[idx].ordered === first.ordered)
  ) {
    const item = items[idx];
    idx += 1;
    let child = null;
    if (items[idx]?.type === "item" && items[idx].indent >= item.indent + 2) {
      [child, idx] = buildList(items, idx);
    }
    entries.push(
      <li key={item.i}>
        {renderInline(item.text, `l${item.i}`)}
        {child}
      </li>,
    );
  }
  const props = first.ordered
    ? { start: first.number, className: "list-decimal ml-4" }
    : { className: "list-disc ml-4" };
  return [
    <Tag key={`list-${first.i}`} {...props}>
      {entries}
    </Tag>,
    idx,
  ];
}

function renderLine({ i, line }, spacingClass) {
  const heading = headingText(line);
  const bold = WHOLE_LINE_BOLD.exec(line);
  if (bold || heading) {
    return (
      <p key={i} className={`font-bold ${spacingClass}`}>
        {bold ? bold[1] : renderInline(heading, `h${i}`)}
      </p>
    );
  }
  if (line.trim()) {
    return (
      <p key={i} className={spacingClass}>
        {renderInline(line, `p${i}`)}
      </p>
    );
  }
  return <br key={i} />;
}

export default function AssistantMarkdown({ content, spacingClass }) {
  const items = parseLines(content);
  const out = [];
  let idx = 0;
  while (idx < items.length) {
    if (items[idx].type === "item") {
      const [list, next] = buildList(items, idx);
      out.push(list);
      idx = next;
    } else {
      out.push(renderLine(items[idx], spacingClass));
      idx += 1;
    }
  }
  return out;
}
