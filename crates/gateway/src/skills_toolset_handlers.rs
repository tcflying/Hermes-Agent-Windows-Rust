use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, put},
    Router,
};
use hermes_agent::tools::skill_manager::SkillManager;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::AppState;
use crate::handlers::ErrorResponse;

#[derive(Debug, Deserialize)]
pub struct ToggleSkillRequest {
    pub name: String,
    pub enabled: bool,
}

#[derive(Debug, Serialize)]
pub struct ToggleSkillResponse {
    pub ok: bool,
}

#[derive(Debug, Serialize, Clone)]
pub struct ToolsetInfo {
    pub name: String,
    pub label: String,
    pub description: String,
    pub enabled: bool,
    pub configured: bool,
    pub tools: Vec<String>,
}

struct ToolsetDef {
    name: &'static str,
    label: &'static str,
    description: &'static str,
    tools: &'static [&'static str],
    required_env: &'static str,
}

static TOOLSETS: &[ToolsetDef] = &[
    ToolsetDef {
        name: "core",
        label: "Core",
        description: "Terminal execution, file I/O, directory listing, patching, and search",
        tools: &[
            "terminal",
            "file_read",
            "file_write",
            "list_directory",
            "patch",
            "search_files",
        ],
        required_env: "",
    },
    ToolsetDef {
        name: "web",
        label: "Web",
        description: "Web search and page extraction",
        tools: &["web_search", "web_extract"],
        required_env: "",
    },
    ToolsetDef {
        name: "browser",
        label: "Browser",
        description: "Browser automation — navigate, back, snapshot",
        tools: &["browser_navigate", "browser_back", "browser_snapshot"],
        required_env: "",
    },
    ToolsetDef {
        name: "memory",
        label: "Memory",
        description: "Persistent memory stores for agent notes and user profile",
        tools: &["memory"],
        required_env: "",
    },
    ToolsetDef {
        name: "skills",
        label: "Skills",
        description: "Create, list, view, and delete reusable skills",
        tools: &["skill_create", "skill_list", "skill_view"],
        required_env: "",
    },
    ToolsetDef {
        name: "code",
        label: "Code Execution",
        description: "Sandboxed code execution in multiple languages",
        tools: &["execute_code"],
        required_env: "",
    },
    ToolsetDef {
        name: "process",
        label: "Process Management",
        description: "Spawn, track, and manage background processes",
        tools: &[
            "process_spawn",
            "process_status",
            "process_list",
            "process_output",
            "process_kill",
        ],
        required_env: "",
    },
    ToolsetDef {
        name: "cron",
        label: "Cron / Scheduler",
        description: "Scheduled recurring tasks",
        tools: &["cron_add", "cron_list", "cron_remove"],
        required_env: "",
    },
    ToolsetDef {
        name: "session",
        label: "Session Search",
        description: "Full-text search across past conversation sessions",
        tools: &["session_search"],
        required_env: "",
    },
    ToolsetDef {
        name: "vision",
        label: "Vision",
        description: "Image analysis using vision AI",
        tools: &["image_analyze"],
        required_env: "",
    },
    ToolsetDef {
        name: "mcp",
        label: "MCP",
        description: "Model Context Protocol server integration",
        tools: &["mcp_list_servers", "mcp_discover_tools", "mcp_call_tool"],
        required_env: "",
    },
    ToolsetDef {
        name: "meta",
        label: "Meta / Utility",
        description: "Approval checks and task management",
        tools: &["approval_check", "todo"],
        required_env: "",
    },
];

fn get_toolsets_state_path() -> std::path::PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join(".hermes")
        .join("toolsets_state.json")
}

fn load_toolsets_state() -> HashMap<String, bool> {
    let path = get_toolsets_state_path();
    let content = match std::fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return HashMap::new(),
    };
    serde_json::from_str(&content).unwrap_or_default()
}

pub fn create_skills_toolset_router() -> Router<AppState> {
    Router::new()
        .route("/api/skills/toggle", put(toggle_skill))
        .route("/api/tools/toolsets", get(list_toolsets))
}

async fn toggle_skill(
    State(_state): State<AppState>,
    Json(req): Json<ToggleSkillRequest>,
) -> Result<Json<ToggleSkillResponse>, (StatusCode, Json<ErrorResponse>)> {
    let mut mgr = SkillManager::new();
    let result = mgr.toggle(&req.name, req.enabled);
    let parsed: serde_json::Value = serde_json::from_str(&result)
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: format!("Failed to parse toggle result: {}", e),
                }),
            )
        })?;

    if parsed.get("error").is_some() {
        Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: parsed["error"]
                    .as_str()
                    .unwrap_or("Unknown error")
                    .to_string(),
            }),
        ))
    } else {
        Ok(Json(ToggleSkillResponse { ok: true }))
    }
}

async fn list_toolsets(
    State(_state): State<AppState>,
) -> Json<Vec<ToolsetInfo>> {
    let enabled_map = load_toolsets_state();

    let known_tools: std::collections::HashSet<String> =
        hermes_agent::get_tool_definitions()
            .iter()
            .filter_map(|v| v.get("function").and_then(|f| f.get("name")))
            .filter_map(|n| n.as_str().map(|s| s.to_string()))
            .collect();

    let mut toolsets = Vec::with_capacity(TOOLSETS.len());

    for def in TOOLSETS {
        let configured = if def.required_env.is_empty() {
            true
        } else {
            std::env::var(def.required_env)
                .map(|v| !v.is_empty())
                .unwrap_or(false)
        };

        let enabled = enabled_map
            .get(def.name)
            .copied()
            .unwrap_or(true);

        let tools: Vec<String> = def
            .tools
            .iter()
            .filter(|t| known_tools.contains(**t))
            .map(|s| s.to_string())
            .collect();

        toolsets.push(ToolsetInfo {
            name: def.name.to_string(),
            label: def.label.to_string(),
            description: def.description.to_string(),
            enabled,
            configured,
            tools,
        });
    }

    let assigned: std::collections::HashSet<&str> = TOOLSETS
        .iter()
        .flat_map(|d| d.tools.iter().copied())
        .collect();

    let mut unassigned: Vec<String> = known_tools
        .iter()
        .filter(|t| !assigned.contains(t.as_str()))
        .cloned()
        .collect();
    unassigned.sort();

    if !unassigned.is_empty() {
        toolsets.push(ToolsetInfo {
            name: "other".to_string(),
            label: "Other".to_string(),
            description: "Tools not assigned to a specific toolset".to_string(),
            enabled: true,
            configured: true,
            tools: unassigned,
        });
    }

    Json(toolsets)
}
