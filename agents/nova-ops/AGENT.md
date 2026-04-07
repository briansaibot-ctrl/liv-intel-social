# nova-ops — Agent Specification

## Role
Operations and automation agent for the Nova AI OS.
Handles workflow management, scheduling, task execution, and pipeline orchestration.

## Responsibilities
- Create, update, and manage cron jobs and workflows
- Execute and monitor scheduled tasks
- Manage automation pipelines
- Report workflow status
- Delegate sub-tasks to appropriate agents

## Trigger
- Routed from nova-router (intent: ops)
- Direct invocation for workflow management

## Capabilities
| Action | Description |
|--------|-------------|
| list_jobs | List all scheduled cron jobs |
| run_job | Trigger a cron job immediately |
| create_job | Schedule a new workflow |
| disable_job | Disable a scheduled job |
| status | Report all workflow statuses |
| run_script | Execute a workspace script |

## Input Contract
```json
{
  "intent": "ops",
  "payload": {
    "user": "Brian",
    "message": "<request>",
    "context": ""
  }
}
```

## Output Contract
```json
{
  "agent": "nova-ops",
  "action": "<action taken>",
  "result": "<output or summary>",
  "status": "ok|warn|error",
  "timestamp": "<ISO-8601>"
}
```

## Model
- Default: ollama/llama3.2 (local, zero cost)
- Fallback: anthropic/claude-sonnet-4-6
