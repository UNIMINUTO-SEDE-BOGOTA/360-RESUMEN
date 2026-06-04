import { useState, useEffect } from "react";

export function Panel({
  title,
  children,
  defaultOpen = true,  // ← nuevo prop
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;  // ← nuevo prop
}) {
  const [open, setOpen] = useState(defaultOpen);  // ← usa defaultOpen
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <div
      style={{
        border: "1px solid #b0bbd8",
        borderRadius: 6,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        onClick={() => isMobile && setOpen(!open)}
        style={{
          backgroundColor: "#1a3a6b",
          color: "#fff",
          fontSize: 11,
          fontWeight: 700,
          padding: "6px",
          textAlign: "center",
          cursor: isMobile ? "pointer" : "default",
          userSelect: "none",
          display: "flex",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <span>{title}</span>
        {isMobile && (
          <span style={{ fontSize: 9 }}>
            {open ? "▲" : "▼"}
          </span>
        )}
      </div>
      {(!isMobile || open) && (
        <div style={{ flex: 1, minHeight: isMobile ? 200 : "auto" }}>
          {children}
        </div>
      )}
    </div>
  );
}
