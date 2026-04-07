# nova-memory — Agent Specification

## Role
Context, history, and memory recall agent.
Manages MEMORY.md, daily notes, router logs, context history.

## Capabilities
- Recall recent memory (last 7 days)
- Long-term memory (MEMORY.md)
- Write/append notes to daily memory
- Show routing decisions and agent logs

## Model
- Default: ollama/llama3.2
- Fallback: anthropic/claude-sonnet-4-6
