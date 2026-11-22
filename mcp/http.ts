import type { IncomingMessage, ServerResponse } from "node:http";

export const DEFAULT_WEB_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

export function buildAllowedOrigins(extra?: string): Set<string> {
  const fromEnv = (extra ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_WEB_ORIGINS, ...fromEnv]);
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}

export function isOriginAllowed(
  origin: string | undefined,
  allowed: Set<string>,
): boolean {
  if (!origin) return true;
  return allowed.has(origin) || isLoopbackOrigin(origin);
}

/** 返回 false 表示 Origin 不在白名单，调用方应直接 403 */
export function applyCors(
  req: IncomingMessage,
  res: ServerResponse,
  allowed: Set<string>,
): boolean {
  const origin = req.headers.origin;
  if (!isOriginAllowed(origin, allowed)) return false;

  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,PUT,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type,x-sh-token,x-sh-bridge");
    res.setHeader("Access-Control-Max-Age", "600");
  }
  return true;
}

export function readJson(
  req: IncomingMessage,
  maxBytes = 2 * 1024 * 1024,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];

    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("请求体过大"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("JSON 解析失败"));
      }
    });

    req.on("error", reject);
  });
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

export function startSse(req: IncomingMessage, res: ServerResponse): () => void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(": connected\n\n");

  const timer = setInterval(() => {
    res.write(": ping\n\n");
  }, 15_000);

  const close = () => {
    clearInterval(timer);
  };
  req.on("close", close);
  return close;
}

export function writeSse(res: ServerResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
