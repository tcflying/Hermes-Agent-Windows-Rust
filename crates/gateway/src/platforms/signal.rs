use super::{MediaAttachment, MessageEvent, PlatformAdapter, SendMessage};
use async_trait::async_trait;

pub struct SignalAdapter {
    http_url: String,
    account: String,
    connected: bool,
    client: reqwest::Client,
}

impl SignalAdapter {
    pub fn new(http_url: &str, account: &str) -> Self {
        Self {
            http_url: http_url.trim_end_matches('/').to_string(),
            account: account.to_string(),
            connected: false,
            client: reqwest::Client::new(),
        }
    }

    pub async fn poll_messages(&self) -> Result<Vec<MessageEvent>, Box<dyn std::error::Error + Send + Sync>> {
        let url = format!("{}/v1/receive/{}", self.http_url, self.account);
        let resp = self.client.get(&url).send().await?;
        let body: serde_json::Value = resp.json().await?;

        let mut events = Vec::new();
        if let Some(messages) = body.as_array() {
            for msg in messages {
                let envelope = msg.get("envelope").unwrap_or(msg);
                let text = envelope.get("dataMessage")
                    .and_then(|d| d.get("message"))
                    .and_then(|m| m.as_str())
                    .unwrap_or("")
                    .to_string();
                let source = envelope.get("source")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown")
                    .to_string();
                let timestamp = envelope.get("dataMessage")
                    .and_then(|d| d.get("timestamp"))
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0)
                    .to_string();
                let group_id = envelope.get("dataMessage")
                    .and_then(|d| d.get("groupInfo"))
                    .and_then(|g| g.get("groupId"))
                    .and_then(|v| v.as_str())
                    .map(String::from);

                let media = envelope.get("dataMessage")
                    .and_then(|d| d.get("attachments"))
                    .and_then(|a| a.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|att| {
                        let content_type = att.get("contentType").and_then(|v| v.as_str()).unwrap_or("");
                        let id = att.get("id").and_then(|v| v.as_str()).unwrap_or("");
                        if content_type.starts_with("image/") {
                            Some(MediaAttachment {
                                media_type: "photo".to_string(),
                                url: id.to_string(),
                                mime_type: Some(content_type.to_string()),
                            })
                        } else if content_type.starts_with("audio/") {
                            Some(MediaAttachment {
                                media_type: "voice".to_string(),
                                url: id.to_string(),
                                mime_type: Some(content_type.to_string()),
                            })
                        } else {
                            None
                        }
                    });

                if !text.is_empty() || media.is_some() {
                    events.push(MessageEvent {
                        text,
                        source: "signal".to_string(),
                        user_id: source,
                        chat_id: group_id.unwrap_or_else(|| "direct".to_string()),
                        chat_type: "private".to_string(),
                        reply_to: Some(timestamp),
                        media,
                    });
                }
            }
        }
        Ok(events)
    }
}

#[async_trait]
impl PlatformAdapter for SignalAdapter {
    fn name(&self) -> &str {
        "signal"
    }

    async fn connect(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let url = format!("{}/v1/about", self.http_url);
        let resp = self.client.get(&url).send().await?;
        if resp.status().is_success() {
            self.connected = true;
            Ok(())
        } else {
            let body = resp.text().await?;
            Err(format!("Signal daemon not reachable at {}: {}", self.http_url, body).into())
        }
    }

    async fn disconnect(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.connected = false;
        Ok(())
    }

    async fn send(&self, message: SendMessage) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let url = format!("{}/v2/send", self.http_url);
        let mut body = serde_json::json!({
            "account": self.account,
            "message": message.text,
        });
        if message.chat_id != "direct" && !message.chat_id.is_empty() {
            body["recipient"] = serde_json::Value::String(message.chat_id.clone());
        }
        let resp = self.client.post(&url).json(&body).send().await?;
        if resp.status().is_success() {
            Ok(())
        } else {
            let err = resp.text().await?;
            Err(format!("Signal send failed: {}", err).into())
        }
    }

    async fn send_image(&self, chat_id: &str, image_url: &str, caption: Option<&str>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let url = format!("{}/v2/send", self.http_url);
        let mut body = serde_json::json!({
            "account": self.account,
            "attachments": [{"url": image_url}],
        });
        if let Some(cap) = caption {
            body["message"] = serde_json::Value::String(cap.to_string());
        }
        if chat_id != "direct" && !chat_id.is_empty() {
            body["recipient"] = serde_json::Value::String(chat_id.to_string());
        }
        let resp = self.client.post(&url).json(&body).send().await?;
        if resp.status().is_success() {
            Ok(())
        } else {
            let err = resp.text().await?;
            Err(format!("Signal send image failed: {}", err).into())
        }
    }

    async fn send_document(&self, chat_id: &str, file_url: &str, caption: Option<&str>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let url = format!("{}/v2/send", self.http_url);
        let mut body = serde_json::json!({
            "account": self.account,
            "attachments": [{"url": file_url}],
        });
        if let Some(cap) = caption {
            body["message"] = serde_json::Value::String(cap.to_string());
        }
        if chat_id != "direct" && !chat_id.is_empty() {
            body["recipient"] = serde_json::Value::String(chat_id.to_string());
        }
        let resp = self.client.post(&url).json(&body).send().await?;
        if resp.status().is_success() {
            Ok(())
        } else {
            let err = resp.text().await?;
            Err(format!("Signal send document failed: {}", err).into())
        }
    }

    async fn send_typing(&self, chat_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let url = format!("{}/v1/typing/{}", self.http_url, self.account);
        let body = serde_json::json!({"recipient": chat_id});
        let _ = self.client.put(&url).json(&body).send().await?;
        Ok(())
    }

    async fn edit_message(&self, _chat_id: &str, _message_id: &str, _text: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        Ok(())
    }

    fn is_connected(&self) -> bool {
        self.connected
    }
}
