import { ChevronDown, ChevronUp, Monitor } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";

const LEVEL_COLORS: Record<string, { bg: string; text: string }> = {
  info: { bg: "rgba(201,162,39,0.15)", text: "#c9a227" },
  warn: { bg: "rgba(245,158,11,0.15)", text: "#f59e0b" },
  error: { bg: "rgba(229,62,62,0.15)", text: "#ef4444" },
  debug: { bg: "rgba(100,100,100,0.15)", text: "#888" },
};

const LEVEL_OPTIONS = ["ALL", "DEBUG", "INFO", "WARNING", "ERROR"] as const;
const LINE_OPTIONS = [50, 100, 200, 500] as const;

const POLL_INTERVAL = 2000;

function parseLine(line: string) {
  const m = line.match(/^\[(\w+)\]\s*(.*)/);
  return { level: m ? m[1].toLowerCase() : "info", message: m ? m[2] : line };
}

const filterBtnStyle = (active: boolean): React.CSSProperties => ({
  fontSize: 10,
  padding: "2px 6px",
  borderRadius: 3,
  border: "1px solid " + (active ? "var(--accent)" : "var(--border)"),
  background: active ? "rgba(201,162,39,0.15)" : "transparent",
  color: active ? "var(--accent)" : "var(--text-secondary)",
  cursor: "pointer",
  fontWeight: active ? 600 : 400,
  transition: "all 0.15s",
});

export function LiveLogsPanel() {
  const [logs, setLogs] = useState<string[]>([]);
  const [height, setHeight] = useState(180);
  const [expanded, setExpanded] = useState(true);
  const [levelFilter, setLevelFilter] = useState<string>("ALL");
  const [lineLimit, setLineLimit] = useState<number>(500);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(0);

  const poll = useCallback(async () => {
    try {
      let url = `http://localhost:3848/api/logs?lines=${lineLimit}`;
      if (levelFilter !== "ALL") url += `&level=${levelFilter}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      const lines: string[] = data.lines || [];
      if (lines.length !== prevCount.current) {
        prevCount.current = lines.length;
        setLogs(lines);
      }
    } catch { /* ignore */ }
  }, [lineLimit, levelFilter]);

  useEffect(() => {
    if (!autoRefresh && logs.length > 0) return;
    poll();
    if (!autoRefresh) return;
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [poll, autoRefresh]);

  useEffect(() => {
    if (expanded && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs.length, expanded]);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = height;
    const move = (ev: MouseEvent) => setHeight(Math.max(60, Math.min(500, startH + startY - ev.clientY)));
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";
  }, [height]);

  return (
    <>
      <div
        onMouseDown={onResizeStart}
        style={{
          height: 4, background: "var(--border)", cursor: "ns-resize", flexShrink: 0,
          transition: "background 0.15s",
        }}
        onMouseOver={e => { e.currentTarget.style.background = "var(--accent)"; }}
        onMouseOut={e => { e.currentTarget.style.background = "var(--border)"; }}
      />
      <div style={{
        height: expanded ? height : 30,
        display: "flex", flexDirection: "column",
        background: "var(--bg-primary)",
        borderTop: "1px solid var(--border)",
        overflow: "hidden", flexShrink: 0,
      }}>
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "5px 16px", background: "var(--bg-secondary)",
            borderBottom: expanded ? "1px solid var(--border)" : "none",
            flexShrink: 0, gap: 8,
          }}
          onClick={() => setExpanded(v => !v)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <Monitor size={13} style={{ color: "var(--accent)" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>Live Logs</span>
            <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>
              {logs.length}/{lineLimit}
            </span>
          </div>

          {expanded && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }} onClick={e => e.stopPropagation()}>
              {LEVEL_OPTIONS.map(lvl => (
                <button key={lvl} style={filterBtnStyle(levelFilter === lvl)} onClick={() => setLevelFilter(lvl)}>
                  {lvl}
                </button>
              ))}
              <span style={{ width: 1, height: 14, background: "var(--border)", margin: "0 4px" }} />
              {LINE_OPTIONS.map(n => (
                <button key={n} style={filterBtnStyle(lineLimit === n)} onClick={() => setLineLimit(n)}>
                  {n}
                </button>
              ))}
              <span style={{ width: 1, height: 14, background: "var(--border)", margin: "0 4px" }} />
              <button style={filterBtnStyle(autoRefresh)} onClick={() => setAutoRefresh(v => !v)}>
                {autoRefresh ? "Auto" : "Paused"}
              </button>
            </div>
          )}

          {!expanded && (
            expanded
              ? <ChevronDown size={14} style={{ color: "var(--text-secondary)" }} />
              : <ChevronUp size={14} style={{ color: "var(--text-secondary)" }} />
          )}
          {expanded && (
            <ChevronDown size={14} style={{ color: "var(--text-secondary)", cursor: "pointer" }} />
          )}
        </div>
        {expanded && (
          <div style={{
            flex: 1, overflowY: "auto", overflowX: "hidden",
            padding: "2px 0", fontFamily: "monospace", fontSize: 11,
          }}>
            {logs.length === 0 ? (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                height: "100%", color: "var(--text-secondary)", fontSize: 12,
              }}>
                Waiting for logs...
              </div>
            ) : (
              logs.map((line, i) => {
                const { level, message } = parseLine(line);
                const c = LEVEL_COLORS[level] || LEVEL_COLORS.info;
                return (
                  <div key={i} style={{
                    display: "flex", alignItems: "flex-start", gap: 6,
                    padding: "1px 16px", lineHeight: 1.5,
                  }}>
                    <span style={{
                      display: "inline-block", width: 46, flexShrink: 0,
                      fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                      padding: "0 3px", borderRadius: 2,
                      background: c.bg, color: c.text,
                      textAlign: "center", lineHeight: "16px",
                    }}>
                      {level}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, wordBreak: "break-all", color: "var(--text-secondary)" }}>
                      {message}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </>
  );
}
