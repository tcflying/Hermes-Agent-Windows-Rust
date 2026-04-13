use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

use crate::AppState;

type ApiError = (StatusCode, Json<crate::handlers::ErrorResponse>);

fn server_error(msg: impl std::fmt::Display) -> ApiError {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(crate::handlers::ErrorResponse {
            error: msg.to_string(),
        }),
    )
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

#[derive(Clone, Debug, Serialize)]
pub struct PlatformStatus {
    pub connected: bool,
    pub state: String,
}

#[derive(Debug, Serialize)]
pub struct StatusResponse {
    pub version: String,
    pub hermes_home: String,
    pub config_path: String,
    pub env_path: String,
    pub active_sessions: usize,
    pub gateway_running: bool,
    pub gateway_pid: Option<u32>,
    pub gateway_state: Option<String>,
    pub gateway_platforms: HashMap<String, PlatformStatus>,
    pub config_version: usize,
    pub latest_config_version: usize,
    pub release_date: String,
    pub gateway_exit_reason: Option<String>,
    pub gateway_updated_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AnalyticsQuery {
    pub days: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct DailyUsage {
    pub date: String,
    pub model: String,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub sessions: u64,
}

#[derive(Debug, Serialize)]
pub struct AnalyticsResponse {
    pub days: Vec<DailyUsage>,
    pub total_input_tokens: u64,
    pub total_output_tokens: u64,
    pub total_sessions: u64,
}

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SearchResult {
    pub session_id: String,
    pub created_at: String,
    pub updated_at: String,
    pub model: Option<String>,
    pub snippet: String,
}

#[derive(Debug, Serialize)]
pub struct SearchResponse {
    pub results: Vec<SearchResult>,
    pub total: usize,
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

fn hermes_home() -> PathBuf {
    std::env::var("HERMES_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            dirs::home_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join(".hermes")
        })
}

fn config_path() -> PathBuf {
    std::env::var("HERMES_CONFIG")
        .map(PathBuf::from)
        .unwrap_or_else(|_| hermes_home().join("config.yaml"))
}

fn env_path() -> PathBuf {
    hermes_home().join(".env")
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

pub async fn get_status(
    State(state): State<AppState>,
) -> Result<Json<StatusResponse>, ApiError> {
    let sessions = state
        .session_db
        .read()
        .await
        .list_sessions()
        .await
        .map_err(|e| server_error(e))?;

    let uptime_secs = state.start_time.elapsed().as_secs();

    let gateway_platforms = HashMap::new();

    Ok(Json(StatusResponse {
        version: "0.5.0".into(),
        hermes_home: hermes_home().to_string_lossy().to_string(),
        config_path: config_path().to_string_lossy().to_string(),
        env_path: env_path().to_string_lossy().to_string(),
        active_sessions: sessions.len(),
        gateway_running: true,
        gateway_pid: Some(std::process::id()),
        gateway_state: Some(if uptime_secs < 60 {
            "starting".into()
        } else {
            "running".into()
        }),
        gateway_platforms,
        config_version: 5,
        latest_config_version: 5,
        release_date: "2025-04-14".into(),
        gateway_exit_reason: None,
        gateway_updated_at: None,
    }))
}

pub async fn get_analytics(
    State(state): State<AppState>,
    Query(query): Query<AnalyticsQuery>,
) -> Result<Json<AnalyticsResponse>, ApiError> {
    let _days = query.days.unwrap_or(30);

    let sessions = state
        .session_db
        .read()
        .await
        .list_sessions()
        .await
        .map_err(|e| server_error(e))?;

    let mut days_map: HashMap<String, DailyUsage> = HashMap::new();

    for session in &sessions {
        let date_key = session.created_at.get(..10).unwrap_or(&session.created_at).to_string();
        let model = session.model.clone().unwrap_or_default();

        let key = format!("{}:{}", date_key, model);
        let entry = days_map.entry(key).or_insert_with(|| DailyUsage {
            date: date_key.clone(),
            model: model.clone(),
            input_tokens: 0,
            output_tokens: 0,
            sessions: 0,
        });
        entry.sessions += 1;
    }

    let mut days: Vec<DailyUsage> = days_map.into_values().collect();
    days.sort_by(|a, b| b.date.cmp(&a.date));

    let total_sessions = days.iter().map(|d| d.sessions).sum();

    Ok(Json(AnalyticsResponse {
        days,
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_sessions,
    }))
}

pub async fn search_sessions(
    State(state): State<AppState>,
    Query(query): Query<SearchQuery>,
) -> Result<Json<SearchResponse>, ApiError> {
    let q = query.q.unwrap_or_default();
    if q.trim().is_empty() {
        return Ok(Json(SearchResponse {
            results: vec![],
            total: 0,
        }));
    }

    let results = state
        .session_db
        .read()
        .await
        .search_sessions(&q, 50)
        .await
        .map_err(|e| server_error(e))?;

    let total = results.len();
    let results = results
        .into_iter()
        .map(|r| SearchResult {
            session_id: r.session_id,
            created_at: r.created_at,
            updated_at: r.updated_at,
            model: r.model,
            snippet: r.snippet,
        })
        .collect();

    Ok(Json(SearchResponse { results, total }))
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

pub fn status_routes() -> Router<AppState> {
    Router::new()
        .route("/api/status", get(get_status))
        .route("/api/analytics/usage", get(get_analytics))
        .route("/api/sessions/search", get(search_sessions))
}
