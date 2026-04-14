import { Eye, EyeOff, ExternalLink, KeyRound, Pencil, Save, Trash2, X, Zap, MessageSquare, Settings, ChevronDown, ChevronRight } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { getEnvVars, setEnvVar, deleteEnvVar, revealEnvVar, EnvVarEntry } from "../api";

const PROVIDER_GROUPS = [
  { prefix: "ANTHROPIC_", name: "Anthropic" },
  { prefix: "GOOGLE_", name: "Gemini" },
  { prefix: "OPENROUTER_", name: "OpenRouter" },
  { prefix: "MINIMAX_", name: "MiniMax" },
  { prefix: "DEEPSEEK_", name: "DeepSeek" },
  { prefix: "ZHIPU_", name: "Zhipu AI" },
  { prefix: "MOONSHOT_", name: "Moonshot" },
  { prefix: "MISTRAL_", name: "Mistral" },
  { prefix: "OPENAI_", name: "OpenAI" },
  { prefix: "ELEVENLABS_", name: "ElevenLabs" },
  { prefix: "TELEGRAM_", name: "Telegram" },
  { prefix: "DISCORD_", name: "Discord" },
  { prefix: "SLACK_", name: "Slack" },
  { prefix: "SIGNAL_", name: "Signal" },
];

function getProviderGroup(key: string): string {
  for (const g of PROVIDER_GROUPS) {
    if (key.startsWith(g.prefix)) return g.name;
  }
  return "Other";
}

const CATEGORY_ICONS: Record<string, typeof KeyRound> = {
  provider: Zap,
  messaging: MessageSquare,
  setting: Settings,
};

function EnvVarRow({ entry, onSave, onClear, onReveal }: {
  entry: EnvVarEntry;
  onSave: (key: string, value: string) => void;
  onClear: (key: string) => void;
  onReveal: (key: string) => Promise<string>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [revealedValue, setRevealedValue] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(entry.key, value); setEditing(false); setValue(""); }
    finally { setSaving(false); }
  };

  const handleReveal = async () => {
    if (revealed) { setRevealed(false); return; }
    try {
      const r = await onReveal(entry.key);
      setRevealedValue(r);
      setRevealed(true);
    } catch {}
  };

  const displayValue = revealed ? revealedValue : (entry.redacted_value || "—");

  const rowBase: React.CSSProperties = {
    border: "1px solid var(--border)", borderRadius: 6, padding: "10px 14px",
  };

  if (!entry.is_set && !editing) {
    return (
      <div style={{ ...rowBase, opacity: 0.6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text-secondary)" }}>{entry.key}</span>
            <span style={{ fontSize: 11, color: "var(--text-secondary)", opacity: 0.6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.description}</span>
          </div>
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            {entry.url && (
              <a href={entry.url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "var(--accent)", textDecoration: "none", display: "flex", alignItems: "center", gap: 2 }}>
                Get key <ExternalLink size={10} />
              </a>
            )}
            <button onClick={() => setEditing(true)} style={{
              background: "none", border: "1px solid var(--border)", borderRadius: 3,
              padding: "2px 8px", fontSize: 10, cursor: "pointer", color: "var(--text-secondary)",
              display: "flex", alignItems: "center", gap: 3,
            }}>
              <Pencil size={10} /> Set
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={rowBase}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text-primary)" }}>{entry.key}</span>
          <span style={{
            fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 2,
            background: entry.is_set ? "rgba(16,185,129,0.15)" : "rgba(100,100,100,0.15)",
            color: entry.is_set ? "#10b981" : "#888",
          }}>
            {entry.is_set ? "SET" : "NOT SET"}
          </span>
        </div>
        {entry.url && (
          <a href={entry.url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "var(--accent)", textDecoration: "none", display: "flex", alignItems: "center", gap: 2 }}>
            Get key <ExternalLink size={10} />
          </a>
        )}
      </div>

      {entry.description && (
        <p style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>{entry.description}</p>
      )}

      {!editing && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            flex: 1, fontFamily: "monospace", fontSize: 12, padding: "4px 8px",
            border: "1px solid var(--border)", borderRadius: 3,
            background: revealed ? "var(--bg-primary)" : "rgba(100,100,100,0.05)",
            color: revealed ? "var(--text-primary)" : "var(--text-secondary)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {displayValue}
          </div>
          {entry.is_set && (
            <button onClick={handleReveal} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", padding: 4 }}>
              {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          )}
          <button onClick={() => setEditing(true)} style={{
            background: "none", border: "1px solid var(--border)", borderRadius: 3,
            padding: "2px 8px", fontSize: 10, cursor: "pointer", color: "var(--text-secondary)",
            display: "flex", alignItems: "center", gap: 3,
          }}>
            <Pencil size={10} /> {entry.is_set ? "Replace" : "Set"}
          </button>
          {entry.is_set && (
            <button onClick={() => onClear(entry.key)} style={{
              background: "none", border: "1px solid var(--border)", borderRadius: 3,
              padding: "2px 8px", fontSize: 10, cursor: "pointer", color: "#ef4444",
              display: "flex", alignItems: "center", gap: 3,
            }}>
              <Trash2 size={10} /> Clear
            </button>
          )}
        </div>
      )}

      {editing && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            autoFocus
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={entry.is_set ? `Replace ${entry.redacted_value}` : "Enter value..."}
            style={{
              flex: 1, fontFamily: "monospace", fontSize: 12, padding: "4px 8px",
              border: "1px solid var(--border)", borderRadius: 3,
              background: "var(--bg-primary)", color: "var(--text-primary)", outline: "none",
            }}
          />
          <button onClick={handleSave} disabled={saving || !value} style={{
            background: "var(--accent)", border: "none", borderRadius: 3,
            padding: "4px 10px", fontSize: 11, cursor: "pointer", color: "#000", fontWeight: 600,
            display: "flex", alignItems: "center", gap: 3,
          }}>
            <Save size={11} /> {saving ? "..." : "Save"}
          </button>
          <button onClick={() => { setEditing(false); setValue(""); }} style={{
            background: "none", border: "1px solid var(--border)", borderRadius: 3,
            padding: "4px 8px", fontSize: 11, cursor: "pointer", color: "var(--text-secondary)",
            display: "flex", alignItems: "center", gap: 3,
          }}>
            <X size={11} /> Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function ProviderGroup({ name, entries, onSave, onClear, onReveal }: {
  name: string;
  entries: EnvVarEntry[];
  onSave: (key: string, value: string) => void;
  onClear: (key: string) => void;
  onReveal: (key: string) => Promise<string>;
}) {
  const [expanded, setExpanded] = useState(entries.some(e => e.is_set));
  const configuredCount = entries.filter(e => e.is_set).length;

  return (
    <div style={{ border: "1px solid var(--border)" }}>
      <button onClick={() => setExpanded(!expanded)} style={{
        display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center",
        padding: "10px 14px", background: "transparent", border: "none",
        cursor: "pointer", color: "var(--text-primary)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {expanded ? <ChevronDown size={14} style={{ color: "var(--text-secondary)" }} /> : <ChevronRight size={14} style={{ color: "var(--text-secondary)" }} />}
          <span style={{ fontSize: 13, fontWeight: 600 }}>{name}</span>
          {configuredCount > 0 && (
            <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 2, background: "rgba(16,185,129,0.15)", color: "#10b981", fontWeight: 600 }}>
              {configuredCount} set
            </span>
          )}
        </div>
        <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>{entries.length} key(s)</span>
      </button>
      {expanded && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "8px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
          {entries.map(e => (
            <EnvVarRow key={e.key} entry={e} onSave={onSave} onClear={onClear} onReveal={onReveal} />
          ))}
        </div>
      )}
    </div>
  );
}

export function EnvPage() {
  const [vars, setVars] = useState<EnvVarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const showToast = (msg: string, type: "ok" | "err") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    getEnvVars()
      .then(setVars)
      .catch(() => showToast("Failed to load env vars", "err"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (key: string, value: string) => {
    try {
      await setEnvVar(key, value);
      setVars(prev => prev.map(v => v.key === key ? { ...v, is_set: true, redacted_value: value.slice(0, 4) + "****" } : v));
      showToast(`${key} saved`, "ok");
    } catch (e) { showToast(`Failed: ${e}`, "err"); }
  };

  const handleClear = async (key: string) => {
    try {
      await deleteEnvVar(key);
      setVars(prev => prev.map(v => v.key === key ? { ...v, is_set: false, redacted_value: "" } : v));
      showToast(`${key} cleared`, "ok");
    } catch (e) { showToast(`Failed: ${e}`, "err"); }
  };

  const handleReveal = async (key: string): Promise<string> => {
    const r = await revealEnvVar(key);
    return r.value;
  };

  const { providerGroups, otherCategories } = useMemo(() => {
    const providers = vars.filter(v => v.category === "provider");
    const groupMap = new Map<string, EnvVarEntry[]>();
    for (const entry of providers) {
      const groupName = getProviderGroup(entry.key);
      if (!groupMap.has(groupName)) groupMap.set(groupName, []);
      groupMap.get(groupName)!.push(entry);
    }
    const providerGroups = Array.from(groupMap.entries())
      .map(([name, entries]) => ({ name, entries }))
      .sort((a, b) => {
        const aSet = a.entries.some(e => e.is_set) ? 0 : 1;
        const bSet = b.entries.some(e => e.is_set) ? 0 : 1;
        return aSet - bSet || a.name.localeCompare(b.name);
      });

    const otherCats = ["messaging", "tool", "setting"];
    const otherCategories = otherCats.map(cat => ({
      category: cat,
      entries: vars.filter(v => v.category === cat),
    })).filter(c => c.entries.length > 0);

    return { providerGroups, otherCategories };
  }, [vars]);

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", padding: "80px 0", color: "var(--text-secondary)" }}>Loading...</div>;
  }

  return (
    <div className="page-container" style={{ padding: "24px" }}>
      <div className="page-header">
        <h1>Environment Variables</h1>
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>~/.hermes/.env</span>
      </div>

      {toast && (
        <div style={{
          position: "fixed", top: 16, right: 16, zIndex: 1000,
          background: toast.type === "ok" ? "rgba(16,185,129,0.15)" : "rgba(229,62,62,0.15)",
          border: `1px solid ${toast.type === "ok" ? "#10b981" : "#ef4444"}`,
          borderRadius: 6, padding: "8px 16px", fontSize: 13,
          color: toast.type === "ok" ? "#10b981" : "#ef4444",
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{
        background: "var(--bg-secondary)", border: "1px solid var(--border)",
        borderRadius: 8, overflow: "hidden", marginBottom: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <Zap size={16} style={{ color: "var(--text-secondary)" }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>LLM Providers</span>
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
            {providerGroups.filter(g => g.entries.some(e => e.is_set)).length}/{providerGroups.length} configured
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {providerGroups.map(g => (
            <ProviderGroup key={g.name} name={g.name} entries={g.entries} onSave={handleSave} onClear={handleClear} onReveal={handleReveal} />
          ))}
        </div>
      </div>

      {otherCategories.map(({ category, entries }) => {
        const Icon = CATEGORY_ICONS[category] || KeyRound;
        const label = category.charAt(0).toUpperCase() + category.slice(1);
        return (
          <div key={category} style={{
            background: "var(--bg-secondary)", border: "1px solid var(--border)",
            borderRadius: 8, marginBottom: 16, overflow: "hidden",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <Icon size={16} style={{ color: "var(--text-secondary)" }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{label}</span>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                {entries.filter(e => e.is_set).length}/{entries.length} configured
              </span>
            </div>
            <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
              {entries.map(e => (
                <EnvVarRow key={e.key} entry={e} onSave={handleSave} onClear={handleClear} onReveal={handleReveal} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
