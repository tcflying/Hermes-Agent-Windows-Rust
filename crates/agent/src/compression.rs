use crate::chat::Message;

const ANTI_THRASHING_THRESHOLD: f32 = 0.10;
const ANTI_THRASHING_CONSECUTIVE_LIMIT: usize = 2;

pub struct ContextCompressor {
    pub threshold: f32,
    pub target_ratio: f32,
    pub protect_head: usize,
    pub protect_tail: usize,
    consecutive_low_savings: usize,
}

impl ContextCompressor {
    pub fn new() -> Self {
        Self {
            threshold: 0.6,
            target_ratio: 0.3,
            protect_head: 3,
            protect_tail: 20,
            consecutive_low_savings: 0,
        }
    }

    pub fn should_compress(&self, messages: &[Message], context_limit: usize) -> bool {
        if self.consecutive_low_savings >= ANTI_THRASHING_CONSECUTIVE_LIMIT {
            return false;
        }
        let total: usize = messages.iter().map(|m| message_tokens(m)).sum();
        total > (context_limit as f32 * self.threshold) as usize
    }

    pub fn compress(&mut self, messages: &[Message]) -> (Vec<Message>, f32, usize) {
        let total_before: usize = messages.iter().map(|m| message_tokens(m)).sum();

        if messages.len() <= self.protect_head + self.protect_tail {
            return (messages.to_vec(), 0.0, 0);
        }

        let deduplicated = self.deduplicate_by_md5(messages);
        let collapsed = self.collapse_tool_outputs(&deduplicated);
        let result = self.prune_middle(&collapsed);

        let total_after: usize = result.iter().map(|m| message_tokens(m)).sum();
        let saved = total_before.saturating_sub(total_after);
        let ratio = if total_before > 0 {
            saved as f32 / total_before as f32
        } else {
            0.0
        };

        if ratio < ANTI_THRASHING_THRESHOLD {
            self.consecutive_low_savings += 1;
        } else {
            self.consecutive_low_savings = 0;
        }

        (result, ratio, saved)
    }

    fn deduplicate_by_md5(&self, messages: &[Message]) -> Vec<Message> {
        let mut out = Vec::with_capacity(messages.len());
        let mut last_hash: Option<[u8; 16]> = None;

        for msg in messages {
            if msg.role == "tool" {
                if let Some(ref content) = msg.content {
                    let hash = md5::compute(content.as_bytes()).0;
                    if Some(hash) == last_hash {
                        continue;
                    }
                    last_hash = Some(hash);
                }
            } else {
                last_hash = None;
            }
            out.push(msg.clone());
        }

        out
    }

    fn collapse_tool_outputs(&self, messages: &[Message]) -> Vec<Message> {
        messages
            .iter()
            .map(|msg| {
                if msg.role == "tool" {
                    if let Some(ref content) = msg.content {
                        if content.len() > 300 {
                            return Message {
                                role: msg.role.clone(),
                                content: Some(tool_summary(msg.name.as_deref(), content)),
                                tool_calls: msg.tool_calls.clone(),
                                tool_call_id: msg.tool_call_id.clone(),
                                name: msg.name.clone(),
                            };
                        }
                    }
                }
                msg.clone()
            })
            .collect()
    }

    fn prune_middle(&self, messages: &[Message]) -> Vec<Message> {
        let target_tokens = {
            let total: usize = messages.iter().map(|m| message_tokens(m)).sum();
            (total as f32 * self.target_ratio) as usize
        };

        let mut result: Vec<Message> = messages.iter().take(self.protect_head).cloned().collect();

        let middle_start = self.protect_head;
        let middle_end = messages.len().saturating_sub(self.protect_tail);

        if middle_end > middle_start {
            let middle = &messages[middle_start..middle_end];
            let middle_tokens: usize = middle.iter().map(|m| message_tokens(m)).sum();
            let middle_target = (target_tokens as f32 * 0.5) as usize;

            let skip_ratio = if middle_tokens > middle_target * 3 {
                3
            } else {
                2
            };

            for (i, msg) in middle.iter().enumerate() {
                if i % skip_ratio == 0 {
                    result.push(msg.clone());
                }
            }
        }

        for msg in messages
            .iter()
            .skip(messages.len().saturating_sub(self.protect_tail))
        {
            result.push(msg.clone());
        }

        result
    }
}

impl Default for ContextCompressor {
    fn default() -> Self {
        Self::new()
    }
}

fn tool_summary(tool_name: Option<&str>, content: &str) -> String {
    let lines: Vec<&str> = content.lines().collect();
    let errors = content.matches("Error").count().min(99);
    let bytes = content.len();

    let summary = match tool_name {
        Some("terminal") | Some("process_spawn") => {
            if errors > 0 {
                format!(
                    "[{} errors, {} lines, {} bytes]",
                    errors,
                    lines.len(),
                    bytes
                )
            } else if lines.len() <= 3 {
                let first = if lines.is_empty() {
                    "no output"
                } else {
                    lines[0]
                };
                format!("{}: {} lines", first, lines.len())
            } else {
                format!("{} lines, {} bytes", lines.len(), bytes)
            }
        }
        Some("file_read") | Some("execute_file_write") => {
            let files = content.matches("---").count().saturating_add(1);
            format!("{} file(s), {} bytes", files, bytes)
        }
        Some("list_directory") => {
            format!("{} item(s)", lines.len().saturating_sub(1).max(0))
        }
        Some("search_files") => {
            format!("{} match(es)", content.matches("-->").count())
        }
        Some("web_search") | Some("web_extract") => {
            format!(
                "{} result(s), {} bytes",
                content.matches("URL:").count().saturating_add(1),
                bytes
            )
        }
        _ => {
            if errors > 0 {
                format!("[{} error(s)]", errors)
            } else if lines.len() <= 2 {
                content.chars().take(80).collect()
            } else {
                format!("{} lines, {} bytes", lines.len(), bytes)
            }
        }
    };

    format!("[{}] {}", tool_name.unwrap_or("tool"), summary)
}

fn message_tokens(msg: &Message) -> usize {
    let mut total = 0;
    if let Some(ref content) = msg.content {
        total += estimate_tokens(content);
    }
    if let Some(ref calls) = msg.tool_calls {
        for call in calls {
            total += estimate_tokens(&call.function.name);
            total += estimate_tokens(&call.function.arguments);
        }
    }
    total
}

fn estimate_tokens(text: &str) -> usize {
    let words = text.split_whitespace().count();
    let chinese = text.chars().filter(|c| c.len_utf8() > 1).count();
    (words * 4 + chinese / 2) / 4
}
