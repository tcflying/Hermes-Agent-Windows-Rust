import { BarChart3, Cpu, Hash, TrendingUp } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { getAnalytics, AnalyticsResponse } from "../api";

const PERIODS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

const CHART_HEIGHT = 160;

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtDate(day: string): string {
  try {
    const d = new Date(day + "T00:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch { return day; }
}

function SummaryCard({ icon: Icon, label, value, sub }: {
  icon: React.ComponentType<{ size?: number | string; style?: React.CSSProperties }>;
  label: string; value: string; sub?: string;
}) {
  return (
    <div style={{
      background: "var(--bg-secondary)", border: "1px solid var(--border)",
      borderRadius: 8, padding: "16px 20px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>{label}</span>
        <Icon size={16} style={{ color: "var(--text-secondary)" }} />
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function TokenBarChart({ daily }: { daily: AnalyticsResponse["daily"] }) {
  if (daily.length === 0) return null;
  const maxTokens = Math.max(...daily.map(d => d.input_tokens + d.output_tokens), 1);

  return (
    <div style={{
      background: "var(--bg-secondary)", border: "1px solid var(--border)",
      borderRadius: 8, padding: "16px 20px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <BarChart3 size={16} style={{ color: "var(--text-secondary)" }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Daily Token Usage</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 12, fontSize: 11, color: "var(--text-secondary)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(201,162,39,0.7)" }} /> Input
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(16,185,129,0.7)" }} /> Output
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: CHART_HEIGHT }}>
        {daily.map(d => {
          const total = d.input_tokens + d.output_tokens;
          const inputH = Math.round((d.input_tokens / maxTokens) * CHART_HEIGHT);
          const outputH = Math.round((d.output_tokens / maxTokens) * CHART_HEIGHT);
          return (
            <div key={d.day} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: CHART_HEIGHT, position: "relative" }}>
              <div style={{ width: "100%", background: "rgba(201,162,39,0.5)", height: Math.max(inputH, total > 0 ? 1 : 0) }} title={`${fmtDate(d.day)}: in=${formatTokens(d.input_tokens)} out=${formatTokens(d.output_tokens)}`} />
              <div style={{ width: "100%", background: "rgba(16,185,129,0.5)", height: Math.max(outputH, d.output_tokens > 0 ? 1 : 0) }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 10, color: "var(--text-secondary)" }}>
        <span>{daily.length > 0 ? fmtDate(daily[0].day) : ""}</span>
        {daily.length > 2 && <span>{fmtDate(daily[Math.floor(daily.length / 2)].day)}</span>}
        <span>{daily.length > 1 ? fmtDate(daily[daily.length - 1].day) : ""}</span>
      </div>
    </div>
  );
}

function DailyTable({ daily }: { daily: AnalyticsResponse["daily"] }) {
  if (daily.length === 0) return null;
  const sorted = [...daily].reverse();

  return (
    <div style={{
      background: "var(--bg-secondary)", border: "1px solid var(--border)",
      borderRadius: 8, padding: "16px 20px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <TrendingUp size={16} style={{ color: "var(--text-secondary)" }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Daily Breakdown</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-secondary)", fontSize: 11 }}>
              <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 500 }}>Date</th>
              <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: 500 }}>Sessions</th>
              <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: 500 }}>Input</th>
              <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: 500 }}>Output</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(d => (
              <tr key={d.day} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "6px 8px", fontWeight: 500, color: "var(--text-primary)" }}>{fmtDate(d.day)}</td>
                <td style={{ textAlign: "right", padding: "6px 8px", color: "var(--text-secondary)" }}>{d.sessions}</td>
                <td style={{ textAlign: "right", padding: "6px 8px", color: "#c9a227" }}>{formatTokens(d.input_tokens)}</td>
                <td style={{ textAlign: "right", padding: "6px 8px", color: "#10b981" }}>{formatTokens(d.output_tokens)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ModelTable({ models }: { models: AnalyticsResponse["by_model"] }) {
  if (models.length === 0) return null;
  const sorted = [...models].sort((a, b) => (b.input_tokens + b.output_tokens) - (a.input_tokens + a.output_tokens));

  return (
    <div style={{
      background: "var(--bg-secondary)", border: "1px solid var(--border)",
      borderRadius: 8, padding: "16px 20px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Cpu size={16} style={{ color: "var(--text-secondary)" }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Per-Model Breakdown</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-secondary)", fontSize: 11 }}>
              <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 500 }}>Model</th>
              <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: 500 }}>Sessions</th>
              <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: 500 }}>Tokens</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(m => (
              <tr key={m.model} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "6px 8px", fontFamily: "monospace", fontSize: 12, color: "var(--text-primary)" }}>{m.model || "unknown"}</td>
                <td style={{ textAlign: "right", padding: "6px 8px", color: "var(--text-secondary)" }}>{m.sessions}</td>
                <td style={{ textAlign: "right", padding: "6px 8px" }}>
                  <span style={{ color: "#c9a227" }}>{formatTokens(m.input_tokens)}</span>
                  {" / "}
                  <span style={{ color: "#10b981" }}>{formatTokens(m.output_tokens)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getAnalytics(days)
      .then(setData)
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="page-container" style={{ padding: "24px" }}>
      <div className="page-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1>Analytics</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Period:</span>
          {PERIODS.map(p => (
            <button key={p.label} onClick={() => setDays(p.days)} style={{
              fontSize: 12, padding: "4px 10px", borderRadius: 4,
              border: "1px solid " + (days === p.days ? "var(--accent)" : "var(--border)"),
              background: days === p.days ? "rgba(201,162,39,0.15)" : "transparent",
              color: days === p.days ? "var(--accent)" : "var(--text-secondary)",
              cursor: "pointer", fontWeight: days === p.days ? 600 : 400,
            }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !data && (
        <div style={{ display: "flex", justifyContent: "center", padding: "80px 0", color: "var(--text-secondary)" }}>
          Loading...
        </div>
      )}

      {error && (
        <div style={{
          background: "var(--bg-secondary)", border: "1px solid var(--border)",
          borderRadius: 8, padding: 24, textAlign: "center", color: "#ef4444", fontSize: 14,
        }}>
          {error}
        </div>
      )}

      {data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <SummaryCard icon={Hash} label="Total Tokens" value={formatTokens(data.totals.total_input + data.totals.total_output)} sub={`In: ${formatTokens(data.totals.total_input)} / Out: ${formatTokens(data.totals.total_output)}`} />
            <SummaryCard icon={BarChart3} label="Total Sessions" value={String(data.totals.total_sessions)} sub={`~${(data.totals.total_sessions / days).toFixed(1)}/day`} />
            <SummaryCard icon={TrendingUp} label="API Calls" value={String(data.daily.reduce((s, d) => s + d.sessions, 0))} sub={`${data.by_model.length} model(s)`} />
          </div>

          <TokenBarChart daily={data.daily} />
          <DailyTable daily={data.daily} />
          <ModelTable models={data.by_model} />

          {data.daily.length === 0 && data.by_model.length === 0 && (
            <div style={{
              background: "var(--bg-secondary)", border: "1px solid var(--border)",
              borderRadius: 8, padding: "48px 24px", textAlign: "center",
            }}>
              <BarChart3 size={32} style={{ color: "var(--text-secondary)", opacity: 0.4, margin: "0 auto 12px" }} />
              <p style={{ fontSize: 14, color: "var(--text-secondary)", fontWeight: 500 }}>No usage data yet</p>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>Start a chat session to see analytics</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
