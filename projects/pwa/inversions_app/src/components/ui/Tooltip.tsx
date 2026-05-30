import { useState } from "react";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  placement?: "top" | "bottom";
}

export function Tooltip({ content, children, placement = "top" }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      <span
        role="tooltip"
        style={{
          position: "absolute",
          ...(placement === "top" ? { bottom: "calc(100% + 6px)" } : { top: "calc(100% + 6px)" }),
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "var(--color-surface-raised)",
          color: "var(--color-text)",
          fontSize: "var(--font-size-xs)",
          lineHeight: 1.5,
          padding: "5px 10px",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--color-border)",
          whiteSpace: "pre-line",
          pointerEvents: "none",
          zIndex: 9999,
          opacity: visible ? 1 : 0,
          visibility: visible ? "visible" : "hidden",
          transition: `opacity var(--duration-fast) var(--easing-standard)`,
          maxWidth: 240,
          textAlign: "center",
        }}
      >
        {content}
      </span>
    </span>
  );
}
