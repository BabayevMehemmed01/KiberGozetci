import type { IncomingMessage, ServerResponse } from "node:http";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { deliverAlert } from "./api/send-alert.ts";

const ENV_KEYS = ["RESEND_API_KEY", "ALERT_RECEIVER_EMAIL"] as const;

function applyAlertEnv(env: Record<string, string>) {
  for (const key of ENV_KEYS) {
    if (env[key] && !process.env[key]) process.env[key] = env[key];
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > 16000) {
        reject(new Error("Sorğu çox böyükdür."));
        req.destroy();
        return;
      }
      chunks.push(buffer);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function alertApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: "kibergozetci-alert-api",
    configureServer(server) {
      applyAlertEnv(env);
      server.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] !== "/api/send-alert") {
          next();
          return;
        }
        void handleAlert(req, res);
      });
    },
  };
}

async function handleAlert(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ ok: false, error: "Yalnız POST qəbul edilir." }));
    return;
  }
  try {
    const result = await deliverAlert(await readBody(req));
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, recipient: result.recipient, fallback: result.fallback, from: result.from }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "E-poçt göndərilmədi.";
    const clientError = message.includes("mütləqdir") || message.includes("düzgün deyil") || message.includes("oxunmadı") || message.includes("rəqəm");
    res.statusCode = clientError ? 400 : 502;
    res.end(JSON.stringify({ ok: false, error: message }));
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [tailwindcss(), react(), alertApiPlugin(env)],
  };
});
