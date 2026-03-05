---
name: llm-api
description: |
  Call LLM APIs (GPT, Gemini, Claude, DeepSeek) programmatically.
  Use when user needs to integrate LLM calls into code or batch-process text.
---

# LLM API

Unified endpoint for multiple LLM providers with automatic fallback.

## Authentication

API key location: `~/.flowith/credentials.json`

```json
{
  "apiKey": "flo_xxx",
  "name": "default",
  "updatedAt": "2025-01-30T..."
}
```

Reading example (Python):
```python
import json
import os

def get_api_key():
    path = os.path.expanduser("~/.flowith/credentials.json")
    with open(path) as f:
        return json.load(f)["apiKey"]
```

Reading example (TypeScript/Node.js):
```typescript
import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

function getApiKey(): string {
  const path = join(homedir(), '.flowith', 'credentials.json')
  return JSON.parse(readFileSync(path, 'utf8')).apiKey
}
```

## Endpoint

```bash
POST https://edge.flowith.io/external/use/llm
Authorization: Bearer flo_<api_key>
```

## Request

```json
{
  "models": ["gpt-4.1", "gemini-2.5-flash"],
  "messages": [{"role": "user", "content": "Hello"}],
  "stream": true
}
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `models` | Yes | Priority list; falls back on failure |
| `messages` | Yes | Conversation history |
| `stream` | No | Stream response (default: true) |
| `thinking` | No | Enable reasoning mode (default: true) |
| `online` | No | Enable web search (default: false) |

## Models

Common options:

- `gpt-4.1`, `gpt-4.1-mini`
- `gemini-2.5-flash`, `gemini-2.5-pro`
- `claude-sonnet-4`
- `deepseek-chat`, `deepseek-reasoner`

## Example

```python
import requests
import json
import os

def get_api_key():
    path = os.path.expanduser("~/.flowith/credentials.json")
    with open(path) as f:
        return json.load(f)["apiKey"]

response = requests.post(
    "https://edge.flowith.io/external/use/llm",
    headers={"Authorization": f"Bearer {get_api_key()}"},
    json={
        "models": ["gpt-4.1"],
        "messages": [{"role": "user", "content": "Explain quantum computing briefly."}],
        "stream": False
    }
)

print(response.json()["choices"][0]["message"]["content"])
```

## Rate Limit

60 requests/min
