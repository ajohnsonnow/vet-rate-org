function groupLines(content) {
  const groups = [];
  for (const [i, line] of content.split("\n").entries()) {
    const isBullet = line.startsWith("• ") || line.startsWith("- ");
    const last = groups.at(-1);
    if (isBullet && last?.type === "list") {
      last.items.push({ i, text: line.slice(2) });
    } else if (isBullet) {
      groups.push({ type: "list", items: [{ i, text: line.slice(2) }] });
    } else {
      groups.push({ type: "line", i, line });
    }
  }
  return groups;
}

export default function AssistantMarkdown({ content, spacingClass }) {
  return groupLines(content).map((group) => {
    if (group.type === "list") {
      return (
        <ul key={group.items[0].i} className="list-disc ml-4">
          {group.items.map((item) => (
            <li key={item.i}>{item.text}</li>
          ))}
        </ul>
      );
    }
    const { i, line } = group;
    if (line.startsWith("**") && line.endsWith("**")) {
      return (
        <p key={i} className={`font-bold ${spacingClass}`}>
          {line.slice(2, -2)}
        </p>
      );
    }
    if (line.trim()) {
      return (
        <p key={i} className={spacingClass}>
          {line}
        </p>
      );
    }
    return <br key={i} />;
  });
}
