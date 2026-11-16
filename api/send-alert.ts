const RESEND_URL = "https://api.resend.com/emails";
const FROM = "KiberGozetci SOC <onboarding@resend.dev>";
const DEFAULT_RECEIVER = "birlik1020@gmail.com";
const DEFAULT_ORIGIN = "https://kibergozetci.vercel.app";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AlertPayload {
  type: "phishing_trap" | "security_alert";
  alertType: string;
  targetEmployee: string;
  riskScore: number;
  details: string;
  mitreCode: string;
  recipientEmail: string;
  timestamp: string;
  employeeName: string;
  origin: string;
}

interface ApiRequest {
  method?: string;
  body?: unknown;
}

interface ApiResponse {
  status: (code: number) => {
    json: (body: unknown) => void;
  };
}

function clip(value: unknown, max: number): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fallbackReceiver(): string {
  const configured = clip(process.env.ALERT_RECEIVER_EMAIL, 160);
  return EMAIL_PATTERN.test(configured) ? configured : DEFAULT_RECEIVER;
}

function safeOrigin(value: unknown): string {
  try {
    const url = new URL(clip(value, 200));
    if (url.protocol !== "http:" && url.protocol !== "https:") return DEFAULT_ORIGIN;
    return url.origin;
  } catch {
    return DEFAULT_ORIGIN;
  }
}

export function parseAlert(input: unknown): AlertPayload {
  const source = typeof input === "string" ? (JSON.parse(input) as unknown) : input;
  if (!source || typeof source !== "object") throw new Error("Bildiriş məlumatı oxunmadı.");
  const body = source as Record<string, unknown>;
  const type = body.type === "phishing_trap" ? "phishing_trap" : "security_alert";
  const employeeName = clip(body.employeeName || body.targetEmployee, 180);
  const alertType = clip(body.alertType, 140) || (type === "phishing_trap" ? "Fişinq tələsi sınağı" : "Təhlükə bildirişi");
  const targetEmployee = clip(body.targetEmployee, 180) || employeeName;
  const details = String(body.details ?? "").trim().slice(0, 2000) || (type === "phishing_trap" ? "Sınaq fişinq məktubu göndərildi." : "");
  const mitreCode = clip(body.mitreCode, 80) || (type === "phishing_trap" ? "T1566.002 — Spearphishing Link" : "—");
  const timestamp = clip(body.timestamp, 80) || new Date().toLocaleString("az-AZ");
  const risk = Number(body.riskScore);
  if (!targetEmployee || !details) throw new Error("Hədəf və tədbir mətni mütləqdir.");
  if (type === "phishing_trap" && !employeeName) throw new Error("Fişinq tələsi üçün əməkdaş adı mütləqdir.");
  if (!Number.isFinite(risk)) throw new Error("Risk balı rəqəm olmalıdır.");
  const requested = clip(body.recipientEmail, 160);
  const recipientEmail = requested || fallbackReceiver();
  if (recipientEmail.includes(",") || !EMAIL_PATTERN.test(recipientEmail)) {
    throw new Error("Alıcı e-poçt ünvanı düzgün deyil.");
  }
  return {
    type,
    alertType,
    targetEmployee,
    riskScore: Math.max(0, Math.min(100, Math.round(risk))),
    details,
    mitreCode,
    recipientEmail,
    timestamp,
    employeeName: employeeName || targetEmployee,
    origin: safeOrigin(body.origin),
  };
}

function trapLink(alert: AlertPayload): string {
  const url = new URL("/training", alert.origin);
  url.searchParams.set("phish_trap", "1");
  url.searchParams.set("emp", alert.employeeName);
  return url.toString();
}

function trapHtml(alert: AlertPayload): string {
  const link = escapeHtml(trapLink(alert));
  const name = escapeHtml(alert.employeeName);
  return `<!DOCTYPE html>
<html lang="az">
<body style="margin:0;background:#f4f7fb;padding:24px;font-family:Segoe UI,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;">
    <tr>
      <td style="padding:28px 32px 8px;">
        <div style="font-size:12px;letter-spacing:0.14em;color:#0369a1;font-weight:700;">KİBER TƏHLÜKƏSİZLİK</div>
        <h1 style="margin:10px 0 0;font-size:24px;line-height:1.3;">Hesab təsdiqi tələb olunur</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 32px 28px;font-size:15px;line-height:1.6;color:#334155;">
        <p>Hörmətli ${name},</p>
        <p>Korporativ hesabınızın sessiyası təhlükəsizlik yoxlanışına düşüb. Girişin aktiv qalması üçün şəxsiyyətinizi bu gün təsdiqləyin.</p>
        <p style="margin:28px 0;">
          <a href="${link}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:700;">Təcili Hesab Təsdiqi</a>
        </p>
        <p style="font-size:12px;color:#64748b;">Əgər düymə açılmırsa, bu keçidi istifadə edin:<br><a href="${link}" style="color:#0369a1;">${link}</a></p>
        <p style="margin-top:24px;font-size:12px;color:#94a3b8;">KiberGözətçi sayıqlıq sınağı · ${escapeHtml(alert.timestamp)}</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function trapText(alert: AlertPayload): string {
  const link = trapLink(alert);
  return [`Hörmətli ${alert.employeeName},`, "Hesabınızın təsdiqi tələb olunur.", `Təcili Hesab Təsdiqi: ${link}`, "KiberGözətçi sayıqlıq sınağı."].join("\n");
}

function reportHtml(alert: AlertPayload): string {
  const rows: [string, string][] = [
    ["Təhdid növü", alert.alertType],
    ["Hədəf əməkdaş", alert.targetEmployee],
    ["Risk balı", `${alert.riskScore}/100`],
    ["MITRE ATT&CK kodu", alert.mitreCode],
    ["Vaxt", alert.timestamp],
    ["Görülən avtomatik bloklama tədbiri", alert.details],
  ];
  const body = rows
    .map(
      ([label, value]) => `<tr>
        <td style="padding:12px 0;border-bottom:1px solid #1e293b;width:40%;color:#94a3b8;font-size:13px;vertical-align:top;">${escapeHtml(label)}</td>
        <td style="padding:12px 0;border-bottom:1px solid #1e293b;color:#f8fafc;font-size:14px;font-weight:650;vertical-align:top;white-space:pre-wrap;">${escapeHtml(value)}</td>
      </tr>`,
    )
    .join("");
  return `<!DOCTYPE html>
<html lang="az">
<body style="margin:0;background:#0b1220;padding:24px;font-family:Segoe UI,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#111827;border:1px solid #1e293b;border-radius:16px;">
    <tr>
      <td style="padding:22px 24px;border-bottom:1px solid #1e293b;">
        <div style="font-size:12px;letter-spacing:0.16em;color:#22d3ee;font-weight:700;">KİBERGÖZƏTÇİ · SOC</div>
        <div style="margin-top:6px;font-size:22px;font-weight:800;color:#ffffff;">Təhlükəsizlik bildirişi</div>
      </td>
    </tr>
    <tr>
      <td style="padding:4px 24px 18px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function reportText(alert: AlertPayload): string {
  return [
    "KiberGözətçi SOC bildirişi",
    `Təhdid növü: ${alert.alertType}`,
    `Hədəf əməkdaş: ${alert.targetEmployee}`,
    `Risk balı: ${alert.riskScore}/100`,
    `MITRE ATT&CK kodu: ${alert.mitreCode}`,
    `Vaxt: ${alert.timestamp}`,
    `Görülən avtomatik bloklama tədbiri: ${alert.details}`,
  ].join("\n");
}

function resendKey(): string {
  return (process.env.RESEND_API_KEY ?? "").trim();
}

function safeMessage(raw: string, key: string): string {
  return raw.replaceAll(key, "").replace(/\s+/g, " ").trim().slice(0, 280);
}

async function postResend(to: string, subject: string, html: string, text: string): Promise<{ ok: boolean; status: number; error: string }> {
  const key = resendKey();
  if (!key) return { ok: false, status: 500, error: "RESEND_API_KEY tapılmadı. .env faylına yazın." };
  const response = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, text }),
  });
  if (response.ok) return { ok: true, status: response.status, error: "" };
  const payload = (await response.json().catch(() => null)) as { message?: unknown } | null;
  const message = safeMessage(typeof payload?.message === "string" ? payload.message : "", key);
  return { ok: false, status: response.status, error: message || "Resend məktubu qəbul etmədi." };
}

export async function deliverAlert(input: unknown): Promise<{ recipient: string; fallback: boolean }> {
  const alert = parseAlert(input);
  const subject = alert.type === "phishing_trap" ? `Təcili: ${alert.employeeName} hesabının təsdiqi` : `KiberGözətçi: ${alert.alertType} — ${alert.riskScore}/100`;
  const html = alert.type === "phishing_trap" ? trapHtml(alert) : reportHtml(alert);
  const text = alert.type === "phishing_trap" ? trapText(alert) : reportText(alert);
  const requested = alert.recipientEmail;
  const backup = fallbackReceiver();
  const first = await postResend(requested, subject, html, text);
  if (first.ok) return { recipient: requested, fallback: false };
  const domainLimited = first.status === 403 && requested.toLowerCase() !== backup.toLowerCase();
  if (!domainLimited) throw new Error(first.error);
  const second = await postResend(backup, subject, html, text);
  if (!second.ok) throw new Error(second.error);
  return { recipient: backup, fallback: true };
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Yalnız POST qəbul edilir." });
    return;
  }
  try {
    const result = await deliverAlert(req.body);
    res.status(200).json({ ok: true, recipient: result.recipient, fallback: result.fallback });
  } catch (error) {
    const message = error instanceof Error ? error.message : "E-poçt göndərilmədi.";
    const clientError = message.includes("mütləqdir") || message.includes("düzgün deyil") || message.includes("oxunmadı") || message.includes("rəqəm");
    res.status(clientError ? 400 : 502).json({ ok: false, error: message });
  }
}
