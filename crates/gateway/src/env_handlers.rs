use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

use crate::AppState;

// ---------------------------------------------------------------------------
// Env var metadata registry
// ---------------------------------------------------------------------------

#[derive(Clone, Debug, Serialize)]
pub struct EnvVarMeta {
    pub description: String,
    pub url: Option<String>,
    pub category: String,
    pub is_password: bool,
}

fn optional_env_vars() -> &'static HashMap<&'static str, EnvVarMeta> {
    use std::sync::OnceLock;
    static MAP: OnceLock<HashMap<&str, EnvVarMeta>> = OnceLock::new();
    MAP.get_or_init(|| {
        let mut m = HashMap::new();
        // Provider keys
        m.insert("OPENAI_API_KEY", EnvVarMeta {
            description: "OpenAI API key for GPT-4/o3 models".into(),
            url: Some("https://platform.openai.com/api-keys".into()),
            category: "provider".into(),
            is_password: true,
        });
        m.insert("ANTHROPIC_API_KEY", EnvVarMeta {
            description: "Anthropic API key for Claude models".into(),
            url: Some("https://console.anthropic.com/".into()),
            category: "provider".into(),
            is_password: true,
        });
        m.insert("GOOGLE_API_KEY", EnvVarMeta {
            description: "Google AI API key for Gemini models".into(),
            url: Some("https://aistudio.google.com/apikey".into()),
            category: "provider".into(),
            is_password: true,
        });
        m.insert("OPENROUTER_API_KEY", EnvVarMeta {
            description: "OpenRouter API key for multi-provider routing".into(),
            url: Some("https://openrouter.ai/keys".into()),
            category: "provider".into(),
            is_password: true,
        });
        m.insert("MINIMAX_API_KEY", EnvVarMeta {
            description: "MiniMax API key (default provider)".into(),
            url: Some("https://platform.minimaxi.com/".into()),
            category: "provider".into(),
            is_password: true,
        });
        m.insert("DEEPSEEK_API_KEY", EnvVarMeta {
            description: "DeepSeek API key for DeepSeek models".into(),
            url: Some("https://platform.deepseek.com/".into()),
            category: "provider".into(),
            is_password: true,
        });
        m.insert("ZHIPU_API_KEY", EnvVarMeta {
            description: "Zhipu AI API key for GLM models".into(),
            url: Some("https://open.bigmodel.cn/".into()),
            category: "provider".into(),
            is_password: true,
        });
        m.insert("MOONSHOT_API_KEY", EnvVarMeta {
            description: "Moonshot API key for Kimi models".into(),
            url: Some("https://platform.moonshot.cn/".into()),
            category: "provider".into(),
            is_password: true,
        });
        m.insert("MISTRAL_API_KEY", EnvVarMeta {
            description: "Mistral API key for Mistral/Codestral models".into(),
            url: Some("https://console.mistral.ai/".into()),
            category: "provider".into(),
            is_password: true,
        });
        m.insert("ELEVENLABS_API_KEY", EnvVarMeta {
            description: "ElevenLabs API key for TTS/voice".into(),
            url: Some("https://elevenlabs.io/".into()),
            category: "provider".into(),
            is_password: true,
        });
        // Messaging keys
        m.insert("TELEGRAM_BOT_TOKEN", EnvVarMeta {
            description: "Telegram Bot API token".into(),
            url: Some("https://t.me/BotFather".into()),
            category: "messaging".into(),
            is_password: true,
        });
        m.insert("DISCORD_BOT_TOKEN", EnvVarMeta {
            description: "Discord Bot token".into(),
            url: Some("https://discord.com/developers/applications".into()),
            category: "messaging".into(),
            is_password: true,
        });
        m.insert("SLACK_BOT_TOKEN", EnvVarMeta {
            description: "Slack Bot OAuth token".into(),
            url: Some("https://api.slack.com/apps".into()),
            category: "messaging".into(),
            is_password: true,
        });
        m.insert("SIGNAL_PHONE_NUMBER", EnvVarMeta {
            description: "Signal account phone number".into(),
            url: None,
            category: "messaging".into(),
            is_password: false,
        });
        m
    })
}

// ---------------------------------------------------------------------------
// .env file helpers
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

fn env_path() -> PathBuf {
    hermes_home().join(".env")
}

/// Parse .env file into ordered key=value pairs. Ignores comments & blanks.
fn parse_dotenv(path: &PathBuf) -> Vec<(String, String)> {
    let content = std::fs::read_to_string(path).unwrap_or_default();
    let mut pairs = Vec::new();
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        if let Some((k, v)) = trimmed.split_once('=') {
            pairs.push((k.trim().to_string(), v.trim().to_string()));
        }
    }
    pairs
}

/// Write ordered key=value pairs back to .env, preserving comments.
fn write_dotenv(path: &PathBuf, pairs: &[(String, String)]) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut lines: Vec<String> = pairs
        .iter()
        .map(|(k, v)| format!("{}={}", k, v))
        .collect();
    if !lines.is_empty() {
        lines.push(String::new());
    }
    std::fs::write(path, lines.join("\n"))
}

/// Redact a value for display: show first 4 chars + "***" for non-empty.
fn redact(value: &str) -> String {
    if value.is_empty() {
        String::new()
    } else if value.len() <= 4 {
        "****".to_string()
    } else {
        format!("{}****", &value[..4])
    }
}

// ---------------------------------------------------------------------------
// Session token store (ephemeral, in-process)
// ---------------------------------------------------------------------------

use std::sync::Mutex as StdMutex;

static SESSION_TOKENS: StdMutex<Vec<String>> = StdMutex::new(Vec::new());

fn generate_session_token() -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(uuid::Uuid::new_v4().as_bytes());
    hasher.update(chrono::Utc::now().timestamp_micros().to_le_bytes());
    let result = hasher.finalize();
    format!("{:x}", result)
}

fn validate_session_token(token: &str) -> bool {
    if let Ok(tokens) = SESSION_TOKENS.lock() {
        tokens.iter().any(|t| t == token)
    } else {
        false
    }
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct EnvVarEntry {
    pub key: String,
    pub is_set: bool,
    pub redacted_value: String,
    pub description: Option<String>,
    pub url: Option<String>,
    pub category: Option<String>,
    pub is_password: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct EnvListResponse {
    pub vars: Vec<EnvVarEntry>,
}

#[derive(Debug, Deserialize)]
pub struct EnvSetRequest {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Deserialize)]
pub struct EnvDeleteRequest {
    pub key: String,
}

#[derive(Debug, Deserialize)]
pub struct EnvRevealRequest {
    pub key: String,
    pub auth_token: String,
}

#[derive(Debug, Serialize)]
pub struct EnvRevealResponse {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Serialize)]
pub struct SessionTokenResponse {
    pub token: String,
}

#[derive(Debug, Serialize)]
pub struct GenericOk {
    pub ok: bool,
}

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------

type ApiError = (StatusCode, Json<crate::handlers::ErrorResponse>);

fn server_error(msg: impl std::fmt::Display) -> ApiError {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
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

fn unauthorized() -> ApiError {
    (
        StatusCode::UNAUTHORIZED,
        Json(crate::handlers::ErrorResponse {
            error: "Invalid or missing auth token".into(),
        }),
    )
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

pub async fn list_env(
    State(_state): State<AppState>,
) -> Result<Json<EnvListResponse>, ApiError> {
    let path = env_path();
    let file_pairs = parse_dotenv(&path);
    let file_map: HashMap<String, String> = file_pairs.iter().cloned().collect();
    let registry = optional_env_vars();

    let mut entries: Vec<EnvVarEntry> = Vec::new();

    // First: all known/registered keys (preserve registry order)
    for (key, meta) in registry.iter() {
        let value = file_map.get(*key).cloned().unwrap_or_default();
        entries.push(EnvVarEntry {
            key: (*key).to_string(),
            is_set: !value.is_empty(),
            redacted_value: if value.is_empty() { String::new() } else { redact(&value) },
            description: Some(meta.description.clone()),
            url: meta.url.clone(),
            category: Some(meta.category.clone()),
            is_password: Some(meta.is_password),
        });
    }

    // Then: any extra keys in .env that aren't in the registry
    for (key, value) in &file_pairs {
        if !registry.contains_key(key.as_str()) {
            entries.push(EnvVarEntry {
                key: key.clone(),
                is_set: !value.is_empty(),
                redacted_value: if value.is_empty() { String::new() } else { redact(value) },
                description: None,
                url: None,
                category: None,
                is_password: None,
            });
        }
    }

    Ok(Json(EnvListResponse { vars: entries }))
}

pub async fn set_env(
    State(_state): State<AppState>,
    Json(body): Json<EnvSetRequest>,
) -> Result<Json<GenericOk>, ApiError> {
    if body.key.is_empty() {
        return Err(bad_request("key must not be empty"));
    }
    let path = env_path();
    let mut pairs = parse_dotenv(&path);
    if let Some(entry) = pairs.iter_mut().find(|(k, _)| k == &body.key) {
        entry.1 = body.value;
    } else {
        pairs.push((body.key, body.value));
    }
    write_dotenv(&path, &pairs).map_err(|e| server_error(e))?;
    Ok(Json(GenericOk { ok: true }))
}

pub async fn delete_env(
    State(_state): State<AppState>,
    Json(body): Json<EnvDeleteRequest>,
) -> Result<Json<GenericOk>, ApiError> {
    if body.key.is_empty() {
        return Err(bad_request("key must not be empty"));
    }
    let path = env_path();
    let mut pairs = parse_dotenv(&path);
    let before = pairs.len();
    pairs.retain(|(k, _)| k != &body.key);
    if pairs.len() == before {
        return Ok(Json(GenericOk { ok: true }));
    }
    write_dotenv(&path, &pairs).map_err(|e| server_error(e))?;
    Ok(Json(GenericOk { ok: true }))
}

pub async fn reveal_env(
    State(_state): State<AppState>,
    Json(body): Json<EnvRevealRequest>,
) -> Result<Json<EnvRevealResponse>, ApiError> {
    if !validate_session_token(&body.auth_token) {
        return Err(unauthorized());
    }
    if body.key.is_empty() {
        return Err(bad_request("key must not be empty"));
    }
    let path = env_path();
    let pairs = parse_dotenv(&path);
    let value = pairs
        .into_iter()
        .find(|(k, _)| *k == body.key)
        .map(|(_, v)| v)
        .unwrap_or_default();
    // Also check process env as fallback
    let value = if value.is_empty() {
        std::env::var(&body.key).unwrap_or_default()
    } else {
        value
    };
    Ok(Json(EnvRevealResponse {
        key: body.key,
        value,
    }))
}

pub async fn get_session_token(
    State(_state): State<AppState>,
) -> Result<Json<SessionTokenResponse>, ApiError> {
    let token = generate_session_token();
    if let Ok(mut tokens) = SESSION_TOKENS.lock() {
        tokens.push(token.clone());
        // Keep only last 100 tokens
        while tokens.len() > 100 {
            tokens.remove(0);
        }
    }
    Ok(Json(SessionTokenResponse { token }))
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

pub fn env_routes() -> Router<AppState> {
    Router::new()
        .route("/api/env", get(list_env).put(set_env).delete(delete_env))
        .route("/api/env/reveal", post(reveal_env))
        .route("/api/auth/session-token", get(get_session_token))
}
