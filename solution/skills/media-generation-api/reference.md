# Media Generation API — Reference

## Authentication

```typescript
const BASE_URL = "https://edge.flowith.io/external";
const headers = {
  Authorization: `Bearer ${API_KEY}`,
  "Content-Type": "application/json",
};
```

API key format: `flo_<64-hex-chars>`

---

## Image

```typescript
interface ImageRequest {
  model: string;
  prompt: string;
  image_urls?: string[];
  aspect_ratio?: "16:9" | "1:1" | "9:16" | "4:3" | "3:4";
  image_size?: "1k" | "2k" | "4k";
}

interface ImageResponse {
  success: true;
  data: { url: string };
  cost: number;
  model: string;
  request_id: string;
}
```

---

## Video

```typescript
interface VideoRequest {
  model: string;
  prompt: string;
  image_url?: string;
  aspect_ratio?: string;
  duration?: number;
  audio?: boolean;
}

interface VideoSubmitResponse {
  success: true;
  data: {
    task_id: string;
    estimated_cost: number;
  };
}

interface VideoStatusResponse {
  success: true;
  data: {
    status: "pending" | "processing" | "completed" | "failed";
    progress?: number;
    url?: string;
    error?: string;
    cost?: number;
  };
}
```

---

## Music

```typescript
interface MusicRequest {
  prompt: string;  // 10-300 chars
  lyrics: string;  // 10-3000 chars, with [Verse], [Chorus] markers
}

// Response follows VideoSubmitResponse / VideoStatusResponse pattern
```

---

## 3D Model

```typescript
interface ThreeDRequest {
  image_url: string;
}

// Response follows VideoSubmitResponse / VideoStatusResponse pattern
// Returns GLB file URL on completion
```

---

## Error

```typescript
interface ErrorResponse {
  success: false;
  error: string;
  code?: "INVALID_INPUT" | "INSUFFICIENT_CREDITS" | "RATE_LIMIT" | "GENERATION_FAILED";
}
```

---

## Cost Reference

| Type | Credits |
|------|---------|
| Image | 30,000–100,000 |
| Video (5s) | ~350,000 |
| Music | ~200,000 |
| 3D Model | ~200,000 |
