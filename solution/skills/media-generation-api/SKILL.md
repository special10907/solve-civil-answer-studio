---
name: media-generation-api
description: |
  Generate images, videos, music, and 3D models via API.
  Use when user needs programmatic media generation.
---

# Media Generation API

Programmatic generation of images, videos, music, and 3D models.

## Authentication

API key location: `~/.flowith/credentials.json`

```json
{
  "apiKey": "flo_xxx",
  "name": "default",
  "updatedAt": "2025-01-30T..."
}
```

Reading example:
```python
import json, os
def get_api_key():
    with open(os.path.expanduser("~/.flowith/credentials.json")) as f:
        return json.load(f)["apiKey"]
```

## Overview

| Need | Endpoint | Latency |
|------|----------|---------|
| Image | `POST /use/image/generate` | ~5-15s |
| Video | `POST /use/video/generate` | ~2-5 min |
| Music | `POST /use/music/generate` | ~1-3 min |
| 3D Model | `POST /use/3d/generate` | ~1-2 min |

```
Base URL: https://edge.flowith.io/external
Header:   Authorization: Bearer flo_<api_key>
```

## Discover Models

```bash
GET /use/image/models
GET /use/video/models
```

Music uses `minimax-music-v2`. 3D uses `trellis-2`.

---

## Image

Synchronous. Returns URL on completion.

```bash
POST /use/image/generate
```

```json
{
  "model": "flux-1.1-pro",
  "prompt": "Minimalist coffee shop logo, vector art",
  "aspect_ratio": "1:1"
}
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `model` | Yes | Model identifier |
| `prompt` | Yes | Description of desired image |
| `aspect_ratio` | No | `1:1`, `16:9`, `9:16`, `4:3` |
| `image_urls` | No | Reference images for editing |

```json
{
  "success": true,
  "data": { "url": "https://..." },
  "cost": 40000
}
```

---

## Video

Asynchronous. Submit, then poll for result.

```bash
POST /use/video/generate
GET /use/video/status?task_id=xxx
```

```json
{
  "model": "kling-text-to-video",
  "prompt": "Steam rising from a coffee cup, cinematic lighting",
  "duration": 5
}
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `model` | Yes | Model identifier |
| `prompt` | Yes | Description of desired video |
| `image_url` | No | Starting frame |
| `duration` | No | Length in seconds |
| `audio` | No | Generate audio track |

**Submit response:**
```json
{ "data": { "task_id": "xxx", "estimated_cost": 350000 } }
```

**Status response:**
```json
{ "data": { "status": "completed", "url": "https://..." } }
```

Status values: `pending` → `processing` → `completed` | `failed`

---

## Music

Asynchronous. Generates complete songs with vocals.

```bash
POST /use/music/generate
GET /use/music/status?task_id=xxx
```

```json
{
  "prompt": "Upbeat indie pop with acoustic guitar",
  "lyrics": "[Verse]\nMorning light\n[Chorus]\nThis is where we belong"
}
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `prompt` | Yes | Style description (10-300 chars) |
| `lyrics` | Yes | Lyrics with section markers (10-3000 chars) |

---

## 3D Model

Asynchronous. Converts image to GLB mesh.

```bash
POST /use/3d/generate
GET /use/3d/status?task_id=xxx
```

```json
{
  "image_url": "https://example.com/chair.png"
}
```

Output: `.glb` file compatible with Three.js, Unity, Blender.

---

## Polling

```python
import time, requests

def poll(base, endpoint, task_id, headers, timeout=300):
    start = time.time()
    while time.time() - start < timeout:
        res = requests.get(f"{base}{endpoint}?task_id={task_id}", headers=headers)
        status = res.json()["data"]["status"]
        if status == "completed":
            return res.json()["data"]["url"]
        if status == "failed":
            raise Exception("Generation failed")
        time.sleep(5)
    raise TimeoutError()
```

---

## Complete Example

```python
import requests, time, json, os

def get_api_key():
    with open(os.path.expanduser("~/.flowith/credentials.json")) as f:
        return json.load(f)["apiKey"]

API_KEY = get_api_key()
BASE = "https://edge.flowith.io/external"
headers = {"Authorization": f"Bearer {API_KEY}"}

# Image (sync)
img = requests.post(f"{BASE}/use/image/generate", headers=headers, json={
    "model": "flux-1.1-pro",
    "prompt": "Robot mascot, flat design",
    "aspect_ratio": "1:1"
}).json()
print(img["data"]["url"])

# Video (async)
task = requests.post(f"{BASE}/use/video/generate", headers=headers, json={
    "model": "kling-text-to-video",
    "prompt": "Robot waving hello",
    "duration": 3
}).json()

task_id = task["data"]["task_id"]
while True:
    status = requests.get(f"{BASE}/use/video/status?task_id={task_id}", headers=headers).json()
    if status["data"]["status"] == "completed":
        print(status["data"]["url"])
        break
    time.sleep(5)
```

---

## Errors

| HTTP | Meaning |
|------|---------|
| 400 | Invalid parameters |
| 401 | Invalid API key |
| 402 | Insufficient credits |
| 429 | Rate limited |
| 500 | Server error |

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `/use/image/generate` | 30/min |
| `/use/video/generate` | 12/min |
| `/use/music/generate` | 12/min |
| `/use/3d/generate` | 12/min |

## Cost Reference

| Type | Credits |
|------|---------|
| Image | 30,000–100,000 |
| Video (5s) | ~350,000 |
| Music | ~200,000 |
| 3D Model | ~200,000 |

---

## See Also

- [reference.md](reference.md) — TypeScript types
- [examples.md](examples.md) — Additional examples
