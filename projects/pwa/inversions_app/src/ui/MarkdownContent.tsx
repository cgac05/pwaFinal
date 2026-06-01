import React from "react";

function parseInline(text: string, key: number): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  if (parts.length === 1) return text;
  return (
    <React.Fragment key={key}>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("*") && part.endsWith("*")) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={i}
              style={{
                background: "rgba(255,255,255,0.08)",
                padding: "1px 5px",
                borderRadius: 3,
                fontFamily: "monospace",
                fontSize: "0.9em",
              }}
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return part;
      })}
    </React.Fragment>
  );
}

interface Props {
  content: string;
}

export function MarkdownContent({ content }: Props) {
  const lines = content.split("\n");
  const nodes: React.ReactNode[] = [];
  let listItems: string[] = [];
  let i = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    nodes.push(
      <ul
        key={`ul-${nodes.length}`}
        style={{
          margin: "0.5rem 0",
          paddingLeft: "1.4rem",
          color: "var(--color-text)",
          fontSize: "var(--font-size-sm)",
          lineHeight: 1.65,
        }}
      >
        {listItems.map((item, idx) => (
          <li key={idx}>{parseInline(item, idx)}</li>
        ))}
      </ul>
    );
    listItems = [];
  };

  while (i < lines.length) {
    const line = lines[i];

    // Heading
    const h3 = line.match(/^### (.+)/);
    const h2 = line.match(/^## (.+)/);
    const h1 = line.match(/^# (.+)/);

    if (h3) {
      flushList();
      nodes.push(
        <h3
          key={i}
          style={{ margin: "1rem 0 0.35rem", fontSize: "var(--font-size-sm)", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}
        >
          {parseInline(h3[1], i)}
        </h3>
      );
    } else if (h2) {
      flushList();
      nodes.push(
        <h2
          key={i}
          style={{ margin: "1.2rem 0 0.4rem", fontSize: "var(--font-size-md)", fontWeight: 700, color: "var(--color-text)" }}
        >
          {parseInline(h2[1], i)}
        </h2>
      );
    } else if (h1) {
      flushList();
      nodes.push(
        <h1
          key={i}
          style={{ margin: "0 0 0.5rem", fontSize: "var(--font-size-lg)", fontWeight: 700, color: "var(--color-text)" }}
        >
          {parseInline(h1[1], i)}
        </h1>
      );
    } else if (/^[-*] (.+)/.test(line)) {
      // Bullet list item
      listItems.push(line.replace(/^[-*] /, ""));
    } else if (/^\d+\. (.+)/.test(line)) {
      // Ordered list — collect and flush as <ol>
      flushList();
      const olItems: string[] = [];
      while (i < lines.length && /^\d+\. (.+)/.test(lines[i])) {
        olItems.push(lines[i].replace(/^\d+\. /, ""));
        i++;
      }
      nodes.push(
        <ol
          key={`ol-${nodes.length}`}
          style={{ margin: "0.5rem 0", paddingLeft: "1.4rem", color: "var(--color-text)", fontSize: "var(--font-size-sm)", lineHeight: 1.65 }}
        >
          {olItems.map((item, idx) => (
            <li key={idx}>{parseInline(item, idx)}</li>
          ))}
        </ol>
      );
      continue;
    } else if (/^---+$/.test(line.trim())) {
      flushList();
      nodes.push(<hr key={i} style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.08)", margin: "1rem 0" }} />);
    } else if (line.trim() === "") {
      flushList();
    } else {
      flushList();
      nodes.push(
        <p
          key={i}
          style={{ margin: "0.35rem 0", color: "var(--color-text)", fontSize: "var(--font-size-sm)", lineHeight: 1.65 }}
        >
          {parseInline(line, i)}
        </p>
      );
    }

    i++;
  }

  flushList();

  return (
    <div style={{ overflowWrap: "break-word" }}>
      {nodes}
    </div>
  );
}
