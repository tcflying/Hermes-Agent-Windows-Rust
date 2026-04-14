use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{delete, get, post},
    Router,
};
use serde::{Deserialize, Serialize};
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

fn not_found(msg: impl std::fmt::Display) -> ApiError {
    (
        StatusCode::NOT_FOUND,
        Json(crate::handlers::ErrorResponse {
            error: msg.to_string(),
        }),
    )
}

fn bad_request(msg: impl std::fmt::Display) -> ApiError {
    (
        StatusCode::BAD_REQUEST,
        Json(crate::handlers::ErrorResponse {
            error: msg.to_string(),
        }),
    )
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CronSchedule {
    pub kind: String,
    pub expr: String,
    pub display: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CronJob {
    pub id: String,
    pub name: Option<String>,
    pub prompt: String,
    pub schedule: CronSchedule,
    #[serde(default)]
    pub schedule_display: String,
    pub enabled: bool,
    pub state: String,
    pub deliver: Option<String>,
    pub last_run_at: Option<String>,
    pub next_run_at: Option<String>,
    pub last_error: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCronJobRequest {
    pub prompt: String,
    pub schedule: String,
    pub name: Option<String>,
    pub deliver: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct GenericOk {
    pub ok: bool,
}

fn hermes_home() -> PathBuf {
    std::env::var("HERMES_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            dirs::home_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join(".hermes")
        })
}

fn cron_jobs_path() -> PathBuf {
    hermes_home().join("cron_jobs.json")
}

fn load_jobs() -> Vec<CronJob> {
    let path = cron_jobs_path();
    let content = std::fs::read_to_string(&path).unwrap_or_default();
    serde_json::from_str(&content).unwrap_or_default()
}

fn save_jobs(jobs: &[CronJob]) -> std::io::Result<()> {
    let path = cron_jobs_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let content = serde_json::to_string_pretty(jobs)?;
    std::fs::write(path, content)
}

fn parse_schedule(input: &str) -> Result<CronSchedule, String> {
    let input_lower = input.to_lowercase();

    let known = [
        ("every minute", "every minute", "* * * * *"),
        ("hourly", "every hour", "0 * * * *"),
        ("daily", "every day at midnight", "0 0 * * *"),
        ("weekly", "every week on Monday", "0 0 * * 1"),
        ("monthly", "every month on the 1st", "0 0 1 * *"),
    ];

    for (keyword, display, expr) in &known {
        if input_lower.contains(keyword) {
            return Ok(CronSchedule {
                kind: "interval".into(),
                expr: (*expr).to_string(),
                display: (*display).to_string(),
            });
        }
    }

    let parts: Vec<&str> = input.split_whitespace().collect();
    if parts.len() == 5 {
        return Ok(CronSchedule {
            kind: "cron".into(),
            expr: input.to_string(),
            display: input.to_string(),
        });
    }

    if let Some(secs) = input_lower.strip_prefix("every ").and_then(|s| s.strip_suffix('s')) {
        if let Ok(n) = secs.parse::<u32>() {
            return Ok(CronSchedule {
                kind: "interval_seconds".into(),
                expr: format!("{}s", n),
                display: format!("every {} seconds", n),
            });
        }
    }

    if let Some(mins) = input_lower.strip_prefix("every ").and_then(|s| s.strip_suffix("min")) {
        if let Ok(n) = mins.parse::<u32>() {
            return Ok(CronSchedule {
                kind: "interval".into(),
                expr: format!("*/{} * * * *", n),
                display: format!("every {} minutes", n),
            });
        }
    }

    if let Some(hours) = input_lower.strip_prefix("every ").and_then(|s| s.strip_suffix('h')) {
        if let Ok(n) = hours.parse::<u32>() {
            return Ok(CronSchedule {
                kind: "interval".into(),
                expr: format!("0 */{} * * *", n),
                display: format!("every {} hours", n),
            });
        }
    }

    Ok(CronSchedule {
        kind: "custom".into(),
        expr: input.to_string(),
        display: input.to_string(),
    })
}

pub async fn list_jobs(
    State(_state): State<AppState>,
) -> Result<Json<Vec<CronJob>>, ApiError> {
    let jobs = load_jobs();
    Ok(Json(jobs))
}

pub async fn create_job(
    State(_state): State<AppState>,
    Json(body): Json<CreateCronJobRequest>,
) -> Result<Json<CronJob>, ApiError> {
    if body.prompt.trim().is_empty() {
        return Err(bad_request("prompt must not be empty"));
    }
    if body.schedule.trim().is_empty() {
        return Err(bad_request("schedule must not be empty"));
    }

    let schedule = parse_schedule(&body.schedule)
        .map_err(|e| bad_request(e))?;

    let schedule_display = schedule.display.clone();

    let job = CronJob {
        id: uuid::Uuid::new_v4().to_string(),
        name: body.name,
        prompt: body.prompt,
        schedule,
        schedule_display,
        enabled: true,
        state: "idle".into(),
        deliver: body.deliver,
        last_run_at: None,
        next_run_at: None,
        last_error: None,
    };

    let mut jobs = load_jobs();
    jobs.push(job.clone());
    save_jobs(&jobs).map_err(|e| server_error(e))?;

    Ok(Json(job))
}

pub async fn pause_job(
    State(_state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<CronJob>, ApiError> {
    let mut jobs = load_jobs();
    let job = jobs
        .iter_mut()
        .find(|j| j.id == id)
        .ok_or_else(|| not_found(format!("cron job '{}' not found", id)))?;
    job.enabled = false;
    let updated = job.clone();
    save_jobs(&jobs).map_err(|e| server_error(e))?;
    Ok(Json(updated))
}

pub async fn resume_job(
    State(_state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<CronJob>, ApiError> {
    let mut jobs = load_jobs();
    let job = jobs
        .iter_mut()
        .find(|j| j.id == id)
        .ok_or_else(|| not_found(format!("cron job '{}' not found", id)))?;
    job.enabled = true;
    job.state = "idle".into();
    let updated = job.clone();
    save_jobs(&jobs).map_err(|e| server_error(e))?;
    Ok(Json(updated))
}

pub async fn trigger_job(
    State(_state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<GenericOk>, ApiError> {
    let mut jobs = load_jobs();
    let job = jobs
        .iter_mut()
        .find(|j| j.id == id)
        .ok_or_else(|| not_found(format!("cron job '{}' not found", id)))?;

    job.state = "running".into();
    job.last_run_at = Some(chrono::Utc::now().to_rfc3339());
    save_jobs(&jobs).map_err(|e| server_error(e))?;

    Ok(Json(GenericOk { ok: true }))
}

pub async fn delete_job(
    State(_state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<GenericOk>, ApiError> {
    let mut jobs = load_jobs();
    let before = jobs.len();
    jobs.retain(|j| j.id != id);
    if jobs.len() == before {
        return Err(not_found(format!("cron job '{}' not found", id)));
    }
    save_jobs(&jobs).map_err(|e| server_error(e))?;
    Ok(Json(GenericOk { ok: true }))
}

pub fn cron_routes() -> Router<AppState> {
    Router::new()
        .route("/api/cron/jobs", get(list_jobs).post(create_job))
        .route("/api/cron/jobs/{id}/pause", post(pause_job))
        .route("/api/cron/jobs/{id}/resume", post(resume_job))
        .route("/api/cron/jobs/{id}/trigger", post(trigger_job))
        .route("/api/cron/jobs/{id}", delete(delete_job))
}
