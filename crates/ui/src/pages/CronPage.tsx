import { Clock, Pause, Play, Plus, Trash2, Zap } from "lucide-react";
import { useState, useEffect } from "react";
import { getCronJobs, createCronJob, pauseCronJob, resumeCronJob, triggerCronJob, deleteCronJob, CronJob } from "../api";

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

const STATE_COLORS: Record<string, { bg: string; text: string }> = {
  idle: { bg: "rgba(100,100,100,0.15)", text: "#888" },
  running: { bg: "rgba(16,185,129,0.15)", text: "#10b981" },
  paused: { bg: "rgba(245,158,11,0.15)", text: "#f59e0b" },
  error: { bg: "rgba(229,62,62,0.15)", text: "#ef4444" },
};

export function CronPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [schedule, setSchedule] = useState("");
  const [name, setName] = useState("");
  const [deliver, setDeliver] = useState("local");
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const showToast = (msg: string, type: "ok" | "err") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadJobs = () => {
    getCronJobs()
      .then(setJobs)
      .catch(() => showToast("Failed to load jobs", "err"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadJobs(); }, []);

  const handleCreate = async () => {
    if (!prompt.trim() || !schedule.trim()) {
      showToast("Prompt & schedule required", "err");
      return;
    }
    setCreating(true);
    try {
      await createCronJob({ prompt: prompt.trim(), schedule: schedule.trim(), name: name.trim() || undefined, deliver });
      showToast("Created ✓", "ok");
      setPrompt(""); setSchedule(""); setName(""); setDeliver("local");
      loadJobs();
    } catch (e) { showToast(`Failed: ${e}`, "err"); }
    finally { setCreating(false); }
  };

  const handlePauseResume = async (job: CronJob) => {
    try {
      if (!job.enabled) { await resumeCronJob(job.id); showToast(`Resumed: ${job.name || job.prompt.slice(0, 30)}`, "ok"); }
      else { await pauseCronJob(job.id); showToast(`Paused: ${job.name || job.prompt.slice(0, 30)}`, "ok"); }
      loadJobs();
    } catch (e) { showToast(`Error: ${e}`, "err"); }
  };

  const handleTrigger = async (job: CronJob) => {
    try {
      await triggerCronJob(job.id);
      showToast(`Triggered: ${job.name || job.prompt.slice(0, 30)}`, "ok");
      loadJobs();
    } catch (e) { showToast(`Error: ${e}`, "err"); }
  };

  const handleDelete = async (job: CronJob) => {
    try {
      await deleteCronJob(job.id);
      showToast(`Deleted: ${job.name || job.prompt.slice(0, 30)}`, "ok");
      loadJobs();
    } catch (e) { showToast(`Error: ${e}`, "err"); }
  };

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", padding: "80px 0", color: "var(--text-secondary)" }}>Loading...</div>;
  }

  const inputStyle: React.CSSProperties = {
    background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 4,
    padding: "6px 10px", fontSize: 13, color: "var(--text-primary)", width: "100%",
    outline: "none",
  };

  return (
    <div className="page-container" style={{ padding: "24px" }}>
      <div className="page-header"><h1>Cron Jobs</h1></div>

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
        borderRadius: 8, padding: "16px 20px", marginBottom: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Plus size={16} style={{ color: "var(--accent)" }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>New Job</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input placeholder="Name (optional)" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
          <textarea
            placeholder="Prompt to run..."
            value={prompt} onChange={e => setPrompt(e.target.value)}
            style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
            <input placeholder="Schedule (e.g. hourly, daily, */5 * * * *)" value={schedule} onChange={e => setSchedule(e.target.value)} style={inputStyle} />
            <select value={deliver} onChange={e => setDeliver(e.target.value)} style={inputStyle}>
              <option value="local">Local</option>
              <option value="telegram">Telegram</option>
              <option value="discord">Discord</option>
              <option value="slack">Slack</option>
            </select>
            <button onClick={handleCreate} disabled={creating} style={{
              padding: "6px 16px", borderRadius: 4,
              background: "var(--accent)", color: "#000", fontWeight: 600,
              border: "none", cursor: creating ? "not-allowed" : "pointer",
              fontSize: 13, whiteSpace: "nowrap",
            }}>
              {creating ? "..." : "Create"}
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Clock size={16} style={{ color: "var(--text-secondary)" }} />
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>Scheduled Jobs ({jobs.length})</span>
      </div>

      {jobs.length === 0 && (
        <div style={{
          background: "var(--bg-secondary)", border: "1px solid var(--border)",
          borderRadius: 8, padding: "32px 20px", textAlign: "center",
          color: "var(--text-secondary)", fontSize: 13,
        }}>
          No cron jobs yet. Create one above.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {jobs.map(job => {
          const sc = STATE_COLORS[job.state] || STATE_COLORS.idle;
          return (
            <div key={job.id} style={{
              background: "var(--bg-secondary)", border: "1px solid var(--border)",
              borderRadius: 8, padding: "12px 16px",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {job.name || job.prompt.slice(0, 60) + (job.prompt.length > 60 ? "..." : "")}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, textTransform: "uppercase",
                    padding: "1px 6px", borderRadius: 3,
                    background: sc.bg, color: sc.text,
                  }}>
                    {job.state}
                  </span>
                  {job.deliver && job.deliver !== "local" && (
                    <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                      {job.deliver}
                    </span>
                  )}
                </div>
                {job.name && (
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {job.prompt.slice(0, 100)}{job.prompt.length > 100 ? "..." : ""}
                  </p>
                )}
                <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--text-secondary)" }}>
                  <span style={{ fontFamily: "monospace" }}>{job.schedule_display}</span>
                  <span>Last: {formatTime(job.last_run_at)}</span>
                  <span>Next: {formatTime(job.next_run_at)}</span>
                </div>
                {job.last_error && (
                  <p style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{job.last_error}</p>
                )}
              </div>

              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button onClick={() => handlePauseResume(job)} title={job.enabled ? "Pause" : "Resume"} style={{
                  background: "none", border: "1px solid var(--border)", borderRadius: 4,
                  padding: 4, cursor: "pointer", color: "var(--text-secondary)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {job.enabled ? <Pause size={14} /> : <Play size={14} style={{ color: "#10b981" }} />}
                </button>
                <button onClick={() => handleTrigger(job)} title="Trigger now" style={{
                  background: "none", border: "1px solid var(--border)", borderRadius: 4,
                  padding: 4, cursor: "pointer", color: "var(--text-secondary)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Zap size={14} />
                </button>
                <button onClick={() => handleDelete(job)} title="Delete" style={{
                  background: "none", border: "1px solid var(--border)", borderRadius: 4,
                  padding: 4, cursor: "pointer", color: "#ef4444",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
