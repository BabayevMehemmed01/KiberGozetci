import type { IncomingMessage, ServerResponse } from "node:http";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { deliverAlert } from "./api/send-alert.ts";

const SMTP_KEYS = ["SMTP_USER", "SMTP_PASS", "SMTP_HOST", "SMTP_PORT", "ALERT_RECEIVER_EMAIL"] as const;

function applySmtpEnv(env: Record<string, string>) {
  for (const key of SMTP_KEYS) {
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
      applySmtpEnv(env);
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
    res.end(JSON.stringify({ ok: true, recipient: result.recipient }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "E-poçt göndərilmədi.";
    res.statusCode = message.startsWith("SMTP") || message.startsWith("E-poçt serveri") ? 502 : 400;
    res.end(JSON.stringify({ ok: false, error: message }));
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [tailwindcss(), react(), alertApiPlugin(env)],
  };
});
