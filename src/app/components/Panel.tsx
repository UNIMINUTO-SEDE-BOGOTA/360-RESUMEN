import { useState } from "react";

export function Panel({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      style={{
        border: "1px solid #b0bbd8",
        borderRadius: 6,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        height: open ? "100%" : "auto",
      }}
    >
      {/* Header clicable */}
      <div
        onClick={() => setOpen(!open)}
        style={{
          backgroundColor: "#1a3a6b",
          color: "#fff",
          fontSize: 11,
          fontWeight: 700,
          padding: "6px",
          textAlign: "center",
          cursor: "pointer",
          display: "flex",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: 9 }}>{open ? "▲" : "▼"}</span>
      </div>

      {open && <div style={{ flex: 1 }}>{children}</div>}
    </div>
  );
}
