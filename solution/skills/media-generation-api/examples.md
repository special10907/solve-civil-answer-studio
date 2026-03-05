# Media Generation API — Examples

## Python

```python
import time
import requests

class MediaClient:
    def __init__(self, api_key: str):
        self.base = "https://edge.flowith.io/external"
        self.headers = {"Authorization": f"Bearer {api_key}"}

    def _post(self, endpoint: str, data: dict) -> dict:
        res = requests.post(f"{self.base}{endpoint}", headers=self.headers, json=data)
        res.raise_for_status()
        return res.json()

    def _poll(self, endpoint: str, task_id: str, timeout: int = 300) -> str:
        start = time.time()
        while time.time() - start < timeout:
            res = requests.get(f"{self.base}{endpoint}?task_id={task_id}", headers=self.headers)
            data = res.json()
            if data["data"]["status"] == "completed":
                return data["data"]["url"]
            if data["data"]["status"] == "failed":
                raise Exception("Generation failed")
            time.sleep(5)
        raise TimeoutError()

    def image(self, prompt: str, model: str = "flux-1.1-pro", **kwargs) -> str:
        return self._post("/use/image/generate", {"model": model, "prompt": prompt, **kwargs})["data"]["url"]

    def video(self, prompt: str, model: str = "kling-text-to-video", **kwargs) -> str:
        task_id = self._post("/use/video/generate", {"model": model, "prompt": prompt, **kwargs})["data"]["task_id"]
        return self._poll("/use/video/status", task_id)

    def music(self, prompt: str, lyrics: str) -> str:
        task_id = self._post("/use/music/generate", {"prompt": prompt, "lyrics": lyrics})["data"]["task_id"]
        return self._poll("/use/music/status", task_id)

    def model_3d(self, image_url: str) -> str:
        task_id = self._post("/use/3d/generate", {"image_url": image_url})["data"]["task_id"]
        return self._poll("/use/3d/status", task_id)


# Usage
client = MediaClient("flo_xxx")

logo = client.image("Tech startup logo, minimalist", aspect_ratio="1:1")
video = client.video("Product rotating on display", duration=5)
music = client.music("Ambient electronic", "[Instrumental]")
model = client.model_3d("https://example.com/product.png")
```

---

## TypeScript

```typescript
class MediaClient {
  constructor(
    private apiKey: string,
    private base = "https://edge.flowith.io/external"
  ) {}

  private get headers() {
    return { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" };
  }

  private async post<T>(endpoint: string, data: unknown): Promise<T> {
    const res = await fetch(`${this.base}${endpoint}`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  private async poll(endpoint: string, taskId: string, timeout = 300000): Promise<string> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const res = await fetch(`${this.base}${endpoint}?task_id=${taskId}`, { headers: this.headers });
      const data = await res.json();
      if (data.data.status === "completed") return data.data.url;
      if (data.data.status === "failed") throw new Error("Failed");
      await new Promise((r) => setTimeout(r, 5000));
    }
    throw new Error("Timeout");
  }

  async image(prompt: string, model = "flux-1.1-pro", options?: { aspect_ratio?: string }) {
    const res = await this.post<{ data: { url: string } }>("/use/image/generate", { model, prompt, ...options });
    return res.data.url;
  }

  async video(prompt: string, model = "kling-text-to-video", options?: { duration?: number }) {
    const res = await this.post<{ data: { task_id: string } }>("/use/video/generate", { model, prompt, ...options });
    return this.poll("/use/video/status", res.data.task_id);
  }

  async music(prompt: string, lyrics: string) {
    const res = await this.post<{ data: { task_id: string } }>("/use/music/generate", { prompt, lyrics });
    return this.poll("/use/music/status", res.data.task_id);
  }

  async model3d(imageUrl: string) {
    const res = await this.post<{ data: { task_id: string } }>("/use/3d/generate", { image_url: imageUrl });
    return this.poll("/use/3d/status", res.data.task_id);
  }
}
```

---

## cURL

### Image (Text-to-Image)

```bash
curl -X POST https://edge.flowith.io/external/use/image/generate \
  -H "Authorization: Bearer flo_xxx" \
  -H "Content-Type: application/json" \
  -d '{"model": "flux-1.1-pro", "prompt": "Mascot illustration"}'
```

### Image (Image-to-Image)

```bash
curl -X POST https://edge.flowith.io/external/use/image/generate \
  -H "Authorization: Bearer flo_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3-pro-image",
    "prompt": "Blend these two images together",
    "image_urls": ["https://example.com/a.jpg", "https://example.com/b.jpg"]
  }'
```

### Video

```bash
# Submit
curl -X POST https://edge.flowith.io/external/use/video/generate \
  -H "Authorization: Bearer flo_xxx" \
  -H "Content-Type: application/json" \
  -d '{"model": "kling-text-to-video", "prompt": "Ocean waves", "duration": 5}'

# Poll
curl "https://edge.flowith.io/external/use/video/status?task_id=TASK_ID" \
  -H "Authorization: Bearer flo_xxx"
```

### Music

```bash
curl -X POST https://edge.flowith.io/external/use/music/generate \
  -H "Authorization: Bearer flo_xxx" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Lo-fi beats", "lyrics": "[Instrumental]"}'
```

### 3D Model

```bash
curl -X POST https://edge.flowith.io/external/use/3d/generate \
  -H "Authorization: Bearer flo_xxx" \
  -H "Content-Type: application/json" \
  -d '{"image_url": "https://example.com/object.png"}'
```

---

## Error Handling

```python
from requests.exceptions import HTTPError

def safe_call(func):
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except HTTPError as e:
            if e.response.status_code == 401:
                raise ValueError("Invalid API key")
            if e.response.status_code == 402:
                raise ValueError("Insufficient credits")
            if e.response.status_code == 429:
                time.sleep(60)
                return func(*args, **kwargs)
            raise
    return wrapper
```
