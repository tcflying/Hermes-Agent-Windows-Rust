import { Wrench, MessageSquare, Search, ChevronDown, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { listSessions, listTools, getSessionMessages, searchSessions, SessionInfo } from "../api";

function MessageBubble({ msg }: { msg: { role: string; content: string; timestamp?: string } }) {
  const isUser = msg.role === "user";
  const isSystem = msg.role === "system";
  const isTool = msg.role === "tool";

  const bg = isUser ? "rgba(201,162,39,0.1)" : isSystem ? "rgba(100,100,100,0.1)" : isTool ? "rgba(16,185,129,0.1)" : "var(--bg-secondary)";
  const border = isUser ? "rgba(201,162,39,0.3)" : isSystem ? "rgba(100,100,100,0.3)" : isTool ? "rgba(16,185,129,0.3)" : "var(--border)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{
          fontSize: 10, fontWeight: 600, textTransform: "uppercase",
          padding: "1px 5px", borderRadius: 2,
          background: bg, color: isUser ? "#c9a227" : isTool ? "#10b981" : isSystem ? "#888" : "var(--text-primary)",
          border: `1px solid ${border}`,
        }}>
          {msg.role}
        </span>
        {msg.timestamp && (
          <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>
            {new Date(msg.timestamp).toLocaleTimeString()}
          </span>
        )}
      </div>
      <div style={{
        fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5,
        background: bg, border: `1px solid ${border}`, borderRadius: 4,
        padding: "6px 10px", maxHeight: 200, overflow: "auto",
        whiteSpace: "pre-wrap", wordBreak: "break-word",
      }}>
        {msg.content}
      </div>
    </div>
  );
}

export function InspectorPage() {
  const [activeTab, setActiveTab] = useState<"tools" | "sessions">("tools");
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [tools, setTools] = useState<{ name: string; description: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ session_id: string; snippet: string; model: string | null }[]>([]);
  const [searching, setSearching] = useState(false);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: string; content: string; timestamp?: string }[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  useEffect(() => { listSessions().then(s => setSessions(s)).catch(() => {}); }, []);
  useEffect(() => {
    listTools()
      .then(data => {
        const mapped = data.map(t => {
          if (t.function && t.function.name) return { name: t.function.name, description: t.function.description || "" };
          return { name: t.name || "unknown", description: t.description || "" };
        });
        setTools(mapped);
      })
      .catch(() => {});
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await searchSessions(searchQuery.trim());
      setSearchResults(results);
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  };

  const toggleSession = async (id: string) => {
    if (expandedSession === id) { setExpandedSession(null); setMessages([]); return; }
    setExpandedSession(id);
    setLoadingMsgs(true);
    try {
      const msgs = await getSessionMessages(id);
      setMessages(msgs);
    } catch { setMessages([]); }
    finally { setLoadingMsgs(false); }
  };

  return (
    <div className="page-container inspector-page">
      <div className="page-header"><h1>Inspector</h1></div>

      <div className="inspector-tabs">
        <button className={`tab-btn ${activeTab === "tools" ? "active" : ""}`} onClick={() => setActiveTab("tools")}>
          <Wrench size={14} /> Tools ({tools.length})
        </button>
        <button className={`tab-btn ${activeTab === "sessions" ? "active" : ""}`} onClick={() => setActiveTab("sessions")}>
          <MessageSquare size={14} /> Sessions ({sessions.length})
        </button>
      </div>

      <div className="inspector-content" style={{ padding: "0 24px 24px" }}>
        {activeTab === "tools" && (
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 6,
          }}>
            {tools.map(t => (
              <div key={t.name} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px", background: "var(--bg-secondary)",
                border: "1px solid var(--border)", borderRadius: 8,
              }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 600, color: "var(--accent)" }}>
                    {t.name}
                  </span>
                  {t.description && (
                    <span style={{
                      fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {t.description}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "sessions" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
                <input
                  placeholder="Search sessions..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSearch()}
                  style={{
                    width: "100%", padding: "8px 10px 8px 30px", fontSize: 13,
                    background: "var(--bg-secondary)", border: "1px solid var(--border)",
                    borderRadius: 4, color: "var(--text-primary)", outline: "none",
                  }}
                />
              </div>
              <button onClick={handleSearch} disabled={searching} style={{
                padding: "8px 16px", borderRadius: 4, background: "var(--accent)",
                color: "#000", fontWeight: 600, border: "none", cursor: "pointer", fontSize: 13,
              }}>
                {searching ? "..." : "Search"}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500 }}>
                  Search results ({searchResults.length})
                </span>
                {searchResults.map(r => {
                  const session = sessions.find(s => s.id === r.session_id);
                  return (
                    <div key={r.session_id} style={{
                      padding: "8px 12px", background: "var(--bg-secondary)",
                      border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer",
                    }} onClick={() => toggleSession(r.session_id)}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>
                          {r.session_id.slice(0, 8)}...
                        </span>
                        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                          {r.model || session?.model || "unknown"}
                        </span>
                        {expandedSession === r.session_id
                          ? <ChevronDown size={12} style={{ color: "var(--text-secondary)" }} />
                          : <ChevronRight size={12} style={{ color: "var(--text-secondary)" }} />
                        }
                      </div>
                      <p style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.snippet}
                      </p>
                      {expandedSession === r.session_id && (
                        <div style={{ marginTop: 8 }}>
                          {loadingMsgs ? <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Loading messages...</span>
                            : messages.map((m, i) => <MessageBubble key={i} msg={m} />)
                          }
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {searchResults.length === 0 && (
              <div className="sessions-list">
                {sessions.length === 0 ? (
                  <div className="inspector-empty">No sessions found</div>
                ) : (
                  sessions.map(s => (
                    <div key={s.id} style={{
                      padding: "10px 12px", background: "var(--bg-secondary)",
                      border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer",
                    }} onClick={() => toggleSession(s.id)}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {expandedSession === s.id
                            ? <ChevronDown size={14} style={{ color: "var(--text-secondary)" }} />
                            : <ChevronRight size={14} style={{ color: "var(--text-secondary)" }} />
                          }
                          <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>
                            {s.model || "Chat"}
                          </span>
                          <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-secondary)" }}>
                            {s.id.slice(0, 8)}...
                          </span>
                          {s.message_count != null && (
                            <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>
                              {s.message_count} msgs
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                          {s.updated_at ? new Date(s.updated_at).toLocaleString() : "—"}
                        </span>
                      </div>
                      {expandedSession === s.id && (
                        <div style={{ marginTop: 8, paddingLeft: 22 }}>
                          {loadingMsgs ? <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Loading messages...</span>
                            : messages.length === 0 ? <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>No messages</span>
                            : messages.map((m, i) => <MessageBubble key={i} msg={m} />)
                          }
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
