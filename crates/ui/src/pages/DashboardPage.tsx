import { MessageSquare, Zap, Activity, Users, Terminal, Clock, Wrench, Cpu } from "lucide-react";
import { useState, useEffect } from "react";
import { listSessions, getConfig, healthCheck, SessionInfo } from "../api";

interface HudStats {
  uptime_seconds: number;
  total_sessions: number;
  total_messages: number;
  total_skills: number;
  backend_status: string;
  active_model: string;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ${seconds % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return "";
  }
}

export function DashboardPage() {
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalMessages: 0,
    recentSessions: [] as SessionInfo[],
  });
  const [model, setModel] = useState("MiniMax-M2.7-highspeed");
  const [backendUp, setBackendUp] = useState(false);
  const [hudStats, setHudStats] = useState<HudStats | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [sessions, cfg, up] = await Promise.all([
          listSessions(),
          getConfig().catch(() => ({ model: "MiniMax-M2.7-highspeed", api_key: "" })),
          healthCheck().then(() => true).catch(() => false),
        ]);
        setBackendUp(up);
        setModel(cfg.model);
        setStats({
          totalSessions: sessions.length,
          totalMessages: 0,
          recentSessions: sessions.slice(0, 5),
        });
      } catch { }
    };
    load();
  }, []);

  useEffect(() => {
    fetch("http://localhost:3848/api/hud/stats")
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setHudStats(data);
      })
      .catch(() => {});
  }, []);

  const uptime = hudStats?.uptime_seconds ?? 0;
  const totalMessages = hudStats?.total_messages ?? stats.totalMessages;
  const totalSkills = hudStats?.total_skills ?? 0;
  const activeModel = hudStats?.active_model ?? model;

  return (
    <div className="page-container dashboard-page">
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <MessageSquare size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.totalSessions}</div>
            <div className="stat-label">Total Sessions</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Activity size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{backendUp ? "Online" : "Offline"}</div>
            <div className="stat-label">Backend Status</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Zap size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{activeModel.split("/").pop() || activeModel}</div>
            <div className="stat-label">Current Model</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Terminal size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">v0.6.1</div>
            <div className="stat-label">Hermes Version</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Clock size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{uptime > 0 ? formatUptime(uptime) : "—"}</div>
            <div className="stat-label">Uptime</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Wrench size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{totalSkills}</div>
            <div className="stat-label">Total Skills</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Cpu size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{totalMessages}</div>
            <div className="stat-label">Total Messages</div>
          </div>
        </div>
      </div>

      {stats.recentSessions.length > 0 && (
        <div className="dashboard-section">
          <h2>Recent Sessions</h2>
          <div className="recent-sessions-list">
            {stats.recentSessions.map(s => (
              <div key={s.id} className="recent-session-item">
                <MessageSquare size={16} />
                <div className="recent-session-info">
                  <span className="recent-session-model">{s.model || "Chat"}</span>
                  <span className="recent-session-date">{formatDate(s.updated_at || "")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="dashboard-section">
        <h2>Quick Start</h2>
        <div className="quickstart-cards">
          <div className="quickstart-card">
            <MessageSquare size={20} />
            <div>
              <h3>Start Chatting</h3>
              <p>Go to the Chat tab and start a conversation with Hermes</p>
            </div>
          </div>
          <div className="quickstart-card">
            <Terminal size={20} />
            <div>
              <h3>Terminal Access</h3>
              <p>Use the Terminal tab to run shell commands</p>
            </div>
          </div>
          <div className="quickstart-card">
            <Users size={20} />
            <div>
              <h3>Memory</h3>
              <p>Hermes remembers your preferences across sessions</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
