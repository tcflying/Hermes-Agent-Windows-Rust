import { Sparkles, Trash2, Plus, ChevronUp, BarChart3, X } from "lucide-react";
import { useState, useEffect, useCallback } from "react";

const API_BASE = "http://localhost:3848";

interface Skill {
  name: string;
  description: string;
  content: string;
  created_at: string;
}

interface GrowthPoint {
  date: string;
  count: number;
  new_skills: number;
}

export function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [growth, setGrowth] = useState<GrowthPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", description: "", content: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchSkills = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/skills`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSkills(Array.isArray(data) ? data : (data.skills ?? []));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch skills");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGrowth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/skills/growth`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setGrowth(data.skills_over_time ?? []);
    } catch {
      // Growth data is optional
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchSkills(), fetchGrowth()]).finally(() => setLoading(false));
  }, [fetchSkills, fetchGrowth]);

  const handleDelete = async (name: string) => {
    if (!window.confirm(`Delete skill "${name}"?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/skills/${encodeURIComponent(name)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSkills(prev => prev.filter(s => s.name !== name));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/skills/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCreateForm({ name: "", description: "", content: "" });
      setShowCreateForm(false);
      await fetchSkills();
      await fetchGrowth();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSubmitting(false);
    }
  };

  const autoCount = skills.filter(s => s.name.startsWith("auto-")).length;
  const manualCount = skills.length - autoCount;

  if (loading) {
    return (
      <div className="page-container" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-secondary)" }}>
        <Sparkles size={24} style={{ marginRight: 8, animation: "spin 2s linear infinite" }} /> Loading skills...
      </div>
    );
  }

  return (
    <div className="page-container" style={{ padding: 24, overflow: "auto", color: "var(--text-primary)" }}>
      {/* Stats Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, margin: 0, color: "var(--text-primary)" }}>
            <Sparkles size={24} style={{ color: "var(--accent)" }} /> Skills
          </h1>
          <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 13, color: "var(--text-secondary)" }}>
            <span>Total: <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{skills.length}</span></span>
            <span>Auto-evolved: <span style={{ color: "#a78bfa", fontWeight: 600 }}>{autoCount}</span></span>
            <span>Manual: <span style={{ color: "#34d399", fontWeight: 600 }}>{manualCount}</span></span>
          </div>
        </div>
        <button
          onClick={() => setShowCreateForm(v => !v)}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
            background: "var(--accent)", color: "#000", border: "none", borderRadius: 8,
            fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
        >
          {showCreateForm ? <ChevronUp size={16} /> : <Plus size={16} />}
          {showCreateForm ? "Close" : "New Skill"}
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{
          background: "rgba(229,62,62,0.15)", border: "1px solid rgba(229,62,62,0.4)",
          borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13,
          color: "#fca5a5", display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer" }}><X size={16} /></button>
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <form onSubmit={handleCreate} style={{
          background: "var(--bg-secondary)", borderRadius: 12, padding: 20,
          marginBottom: 24, border: "1px solid var(--border)",
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: "var(--text-primary)" }}>Create Skill</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Name</label>
              <input
                type="text"
                value={createForm.name}
                onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                style={{
                  width: "100%", background: "var(--bg-primary)", border: "1px solid var(--border)",
                  borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "var(--text-primary)", outline: "none",
                }}
                placeholder="my-skill"
                required
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Description</label>
              <input
                type="text"
                value={createForm.description}
                onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                style={{
                  width: "100%", background: "var(--bg-primary)", border: "1px solid var(--border)",
                  borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "var(--text-primary)", outline: "none",
                }}
                placeholder="What this skill does"
              />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Content</label>
            <textarea
              value={createForm.content}
              onChange={e => setCreateForm(f => ({ ...f, content: e.target.value }))}
              style={{
                width: "100%", background: "var(--bg-primary)", border: "1px solid var(--border)",
                borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "var(--text-primary)",
                height: 128, resize: "vertical", outline: "none", fontFamily: "var(--font-mono)",
              }}
              placeholder="Skill content / instructions..."
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !createForm.name.trim()}
            style={{
              marginTop: 12, padding: "8px 20px",
              background: submitting ? "var(--bg-tertiary)" : "var(--accent)",
              color: submitting ? "var(--text-secondary)" : "#000",
              border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Creating..." : "Create"}
          </button>
        </form>
      )}

      {/* Growth Chart */}
      {growth.length > 0 && (
        <div style={{
          background: "var(--bg-secondary)", borderRadius: 12, padding: 20,
          marginBottom: 24, border: "1px solid var(--border)",
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, marginBottom: 16, color: "var(--text-primary)" }}>
            <BarChart3 size={18} style={{ color: "var(--accent)" }} /> Growth Over Time
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {growth.map(g => {
              const maxCount = Math.max(...growth.map(x => x.count), 1);
              const widthPct = Math.max((g.count / maxCount) * 100, 2);
              return (
                <div key={g.date} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
                  <span style={{ color: "var(--text-secondary)", width: 80, textAlign: "right", fontFamily: "var(--font-mono)", flexShrink: 0 }}>{g.date}</span>
                  <div style={{ flex: 1, background: "var(--bg-tertiary)", borderRadius: 12, height: 20, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%", background: "var(--accent)", borderRadius: 12,
                        width: `${widthPct}%`, display: "flex", alignItems: "center", paddingLeft: 8,
                        fontSize: 11, fontWeight: 600, color: "#000",
                      }}
                    >
                      {g.count}
                    </div>
                  </div>
                  {g.new_skills > 0 && (
                    <span style={{ color: "#34d399", fontSize: 12, flexShrink: 0 }}>+{g.new_skills} new</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Skills Grid */}
      {skills.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 20px", color: "var(--text-secondary)" }}>
          <Sparkles size={48} style={{ marginBottom: 12, opacity: 0.4 }} />
          <h2 style={{ fontSize: 18, fontWeight: 500, color: "var(--text-primary)" }}>No Skills Yet</h2>
          <p style={{ fontSize: 14, marginTop: 4 }}>Create your first skill or wait for auto-evolved skills to appear.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {skills.map(skill => {
            const isAuto = skill.name.startsWith("auto-");
            return (
              <div
                key={skill.name}
                style={{
                  background: "var(--bg-secondary)", borderRadius: 12,
                  border: "1px solid var(--border)", padding: 16,
                  display: "flex", flexDirection: "column", justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Sparkles size={16} style={{ color: isAuto ? "#a78bfa" : "var(--text-secondary)" }} />
                    <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{skill.name}</h3>
                    {isAuto && (
                      <span style={{
                        marginLeft: "auto", fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                        letterSpacing: "0.05em", padding: "2px 8px", borderRadius: 12,
                        background: "rgba(167,139,250,0.2)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)",
                      }}>
                        Auto-evolved
                      </span>
                    )}
                  </div>
                  {skill.description && (
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 8px", lineHeight: 1.5 }}>{skill.description}</p>
                  )}
                  {skill.content && (
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, opacity: 0.7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {skill.content.slice(0, 100)}{skill.content.length > 100 ? "..." : ""}
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    {skill.created_at ? new Date(skill.created_at).toLocaleDateString() : ""}
                  </span>
                  <button
                    onClick={() => handleDelete(skill.name)}
                    style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
