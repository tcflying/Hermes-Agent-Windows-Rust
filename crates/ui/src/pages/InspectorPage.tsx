import { Activity, Clock, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { listSessions, listTools, fetchLogs, SessionInfo } from "../api";

interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
  details?: string;
}

const LEVEL_COLORS: Record<string, { bg: string; text: string }> = {
  info: { bg: "rgba(201,162,39,0.15)", text: "#c9a227" },
  warn: { bg: "rgba(245,158,11,0.15)", text: "#f59e0b" },
  error: { bg: "rgba(229,62,62,0.15)", text: "#ef4444" },
  success: { bg: "rgba(34,197,94,0.15)", text: "#22c55e" },
};

export function InspectorPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"logs" | "sessions" | "tools">("logs");
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [tools, setTools] = useState<{ name: string; description: string }[]>([]);

  useEffect(() => {
    fetchLogs(50)
      .then(data => {
        const rawLines = data.lines || [];
        const entries = rawLines.map((line, i) => {
          const levelMatch = line.match(/^\[(\w+)\]/);
          const level = (levelMatch ? levelMatch[1].toLowerCase() : "info") as "info" | "warn" | "error" | "success";
          const message = line.replace(/^\[\w+\]\s*/, "");
          return {
            id: String(i),
            timestamp: new Date().toISOString(),
            level,
            message,
            details: undefined,
          };
        });
        setLogs(entries);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    listSessions().then(s => setSessions(s)).catch(() => {});
  }, []);

  useEffect(() => {
    listTools()
      .then(data => setTools(data.map(t => ({ name: t.name, description: t.description }))))
      .catch(() => {});
  }, []);

  const clearLogs = () => setLogs([]);

  return (
    <div className="page-container inspector-page">
      <div className="page-header">
        <h1>Inspector</h1>
        <div className="inspector-status">
          <span className="status-dot online" />
          <span>Live</span>
        </div>
      </div>

      <div className="inspector-tabs">
        <button
          className={`tab-btn ${activeTab === "logs" ? "active" : ""}`}
          onClick={() => setActiveTab("logs")}
        >
          <Activity size={14} /> Logs ({logs.length})
        </button>
        <button
          className={`tab-btn ${activeTab === "sessions" ? "active" : ""}`}
          onClick={() => setActiveTab("sessions")}
        >
          Sessions ({sessions.length})
        </button>
        <button
          className={`tab-btn ${activeTab === "tools" ? "active" : ""}`}
          onClick={() => setActiveTab("tools")}
        >
          Tools ({tools.length})
        </button>
      </div>

      <div className="inspector-content" style={{ padding: "0 24px 24px", overflow: "auto" }}>
        {activeTab === "logs" && (
          <div className="logs-panel">
            <div className="logs-actions">
              <button className="logs-clear-btn" onClick={clearLogs}>Clear Logs</button>
            </div>
            <div className="logs-list">
              {logs.map(log => {
                const colors = LEVEL_COLORS[log.level] || LEVEL_COLORS.info;
                return (
                  <div key={log.id} className={`log-entry ${log.level}`}>
                    <div className="log-icon">
                      {log.level === "info" && <Activity size={14} />}
                      {log.level === "warn" && <AlertTriangle size={14} />}
                      {log.level === "error" && <XCircle size={14} />}
                      {log.level === "success" && <CheckCircle2 size={14} />}
                    </div>
                    <div className="log-content">
                      <div className="log-header">
                        <span className="log-message" style={{ color: "var(--text-primary)" }}>
                          <span style={{
                            display: "inline-block", padding: "1px 6px", borderRadius: 4,
                            fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                            background: colors.bg, color: colors.text, marginRight: 8,
                          }}>
                            {log.level}
                          </span>
                          {log.message}
                        </span>
                        <span className="log-time">
                          <Clock size={11} /> {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      {log.details && <div className="log-details">{log.details}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "sessions" && (
          <div className="sessions-panel">
            {sessions.length === 0 ? (
              <div className="inspector-empty">No sessions found</div>
            ) : (
              <div className="sessions-list">
                {sessions.map(s => (
                  <div key={s.id} className="session-row">
                    <div className="session-info">
                      <span className="session-name" style={{ color: "var(--text-primary)" }}>{s.model || "Chat"}</span>
                      <span className="session-id">{s.id.slice(0, 8)}...</span>
                    </div>
                    <span className="session-time">
                      {s.updated_at ? new Date(s.updated_at).toLocaleString() : s.last_active ? new Date(s.last_active * 1000).toLocaleString() : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "tools" && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
            gap: 8,
          }}>
            {tools.map(t => (
              <div key={t.name} className="tool-row">
                <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
                  <span className="tool-name" style={{ color: "var(--text-primary)" }}>{t.name}</span>
                  {t.description && (
                    <span style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.description}
                    </span>
                  )}
                </div>
                <span className="tool-status enabled">enabled</span>
              </div>
            ))}
            {tools.length === 0 && <div className="inspector-empty" style={{ gridColumn: "1 / -1" }}>No tools loaded</div>}
          </div>
        )}
      </div>
    </div>
  );
}
