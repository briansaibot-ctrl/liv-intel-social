# nova-comms — Agent Specification

## Role
Communications agent for messaging and notifications.
Handles WhatsApp messages, drafts, follow-ups, notifications.

## Capabilities
- Send notifications via OpenClaw
- Draft messages for review before sending
- Manage pending drafts
- Track communication status

## Model
- Default: ollama/llama3.2
- Fallback: anthropic/claude-sonnet-4-6
