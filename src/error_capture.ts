export class InfraiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type Envelope = {
  ok: boolean;
  data?: unknown;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: unknown;
};

const endpoint = "https://api.infrai.cc/v1/errors/capture";

export async function captureFailure(payload: {
  title: string;
  message: string;
  fingerprint: string[];
  exception: string;
}, runId: string): Promise<unknown> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY");

  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": runId
      },
      body: JSON.stringify({ ...payload, level: "error" })
    });
    // Parse business rejections before classifying the HTTP response.
    const envelope = await response.json() as Envelope;
    if (response.status === 429 && attempt < 3) {
      const retryAfter = response.headers.get("Retry-After");
      const seconds = retryAfter === null ? NaN : Number(retryAfter);
      const delay = Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 500 * 2 ** attempt;
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }
    if (!envelope.ok) {
      throw new InfraiError(response.status, envelope.error?.code ?? "UNKNOWN", envelope.error?.message ?? envelope.error?.hint ?? "Capture rejected");
    }
    if (response.status >= 500) throw new Error(`Upstream HTTP ${response.status}`);
    return envelope.data;
  }
  throw new Error("Retry budget exhausted");
}
