use super::{MediaAttachment, MessageEvent, PlatformAdapter, SendMessage};
use async_trait::async_trait;

pub struct WhatsAppAdapter {
    bridge_url: String,
    api_token: String,
    connected: bool,
    client: reqwest::Client,
}

impl WhatsAppAdapter {
    pub fn new(bridge_url: &str, api_token: &str) -> Self {
        Self {
            bridge_url: bridge_url.trim_end_matches('/').to_string(),
            api_token: api_token.to_string(),
            connected: false,
            client: reqwest::Client::new(),
        }
    }

    pub async fn poll_messages(&self) -> Result<Vec<MessageEvent>, Box<dyn std::error::Error + Send + Sync>> {
        let url = format!("{}/api/messages", self.bridge_url);
        let resp = self.client
            .get(&url)
            .header("Authorization", format!("Bearer {}", self.api_token))
            .send()
            .await?;
        let body: serde_json::Value = resp.json().await?;

        let mut events = Vec::new();
        if let Some(messages) = body.get("messages").and_then(|m| m.as_array()) {
            for msg in messages {
                let text = msg.get("text").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let chat_id = msg.get("chat_id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown")
                    .to_string();
                let user_id = msg.get("sender")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown")
                    .to_string();
                let reply_to = msg.get("reply_to")
                    .and_then(|v| v.as_str())
                    .map(String::from);

                let media = if let Some(image) = msg.get("image") {
                    Some(MediaAttachment {
                        media_type: "photo".to_string(),
                        url: image.as_str().unwrap_or("").to_string(),
                        mime_type: Some("image/jpeg".to_string()),
                    })
                } else if let Some(audio) = msg.get("audio") {
                    Some(MediaAttachment {
                        media_type: "voice".to_string(),
                        url: audio.as_str().unwrap_or("").to_string(),
                        mime_type: Some("audio/ogg".to_string()),
                    })
                } else if let Some(doc) = msg.get("document") {
                    Some(MediaAttachment {
                        media_type: "document".to_string(),
                        url: doc.as_str().unwrap_or("").to_string(),
                        mime_type: msg.get("mime_type").and_then(|v| v.as_str()).map(String::from),
                    })
                } else {
                    None
                };

                if !text.is_empty() || media.is_some() {
                    let chat_type = if chat_id.contains("@g.us") { "group" } else { "private" };
                    events.push(MessageEvent {
                        text,
                        source: "whatsapp".to_string(),
                        user_id,
                        chat_id,
                        chat_type: chat_type.to_string(),
                        reply_to,
                        media,
                    });
                }
            }
        }
        Ok(events)
    }
}

#[async_trait]
impl PlatformAdapter for WhatsAppAdapter {
    fn name(&self) -> &str {
        "whatsapp"
    }

    async fn connect(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let url = format!("{}/api/status", self.bridge_url);
        let resp = self.client
            .get(&url)
            .header("Authorization", format!("Bearer {}", self.api_token))
            .send()
            .await?;
        if resp.status().is_success() {
            self.connected = true;
            Ok(())
        } else {
            let body = resp.text().await?;
            Err(format!("WhatsApp bridge not reachable at {}: {}", self.bridge_url, body).into())
        }
    }

    async fn disconnect(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.connected = false;
        Ok(())
    }

    async fn send(&self, message: SendMessage) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let url = format!("{}/api/send", self.bridge_url);
        let body = serde_json::json!({
            "chat_id": message.chat_id,
            "text": message.text,
        });
        let resp = self.client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_token))
            .json(&body)
            .send()
            .await?;
        if resp.status().is_success() {
            Ok(())
        } else {
            let err = resp.text().await?;
            Err(format!("WhatsApp send failed: {}", err).into())
        }
    }

    async fn send_image(&self, chat_id: &str, image_url: &str, caption: Option<&str>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let url = format!("{}/api/send/image", self.bridge_url);
        let mut body = serde_json::json!({
            "chat_id": chat_id,
            "image": image_url,
        });
        if let Some(cap) = caption {
            body["caption"] = serde_json::Value::String(cap.to_string());
        }
        let resp = self.client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_token))
            .json(&body)
            .send()
            .await?;
        if resp.status().is_success() {
            Ok(())
        } else {
            let err = resp.text().await?;
            Err(format!("WhatsApp send image failed: {}", err).into())
        }
    }

    async fn send_document(&self, chat_id: &str, file_url: &str, caption: Option<&str>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let url = format!("{}/api/send/document", self.bridge_url);
        let mut body = serde_json::json!({
            "chat_id": chat_id,
            "document": file_url,
        });
        if let Some(cap) = caption {
            body["caption"] = serde_json::Value::String(cap.to_string());
        }
        let resp = self.client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_token))
            .json(&body)
            .send()
            .await?;
        if resp.status().is_success() {
            Ok(())
        } else {
            let err = resp.text().await?;
            Err(format!("WhatsApp send document failed: {}", err).into())
        }
    }

    async fn send_typing(&self, chat_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let url = format!("{}/api/typing", self.bridge_url);
        let body = serde_json::json!({"chat_id": chat_id});
        let _ = self.client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_token))
            .json(&body)
            .send()
            .await?;
        Ok(())
    }

    async fn edit_message(&self, _chat_id: &str, _message_id: &str, _text: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        Ok(())
    }

    fn is_connected(&self) -> bool {
        self.connected
    }
}
