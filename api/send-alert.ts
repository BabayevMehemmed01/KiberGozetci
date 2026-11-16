import { createTransport } from "nodemailer";

const DEFAULT_RECEIVER = "birlik1020@gmail.com";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AlertPayload {
  alertType: string;
  targetEmployee: string;
  riskScore: number;
  details: string;
  mitreCode: string;
  recipientEmail: string;
  timestamp: string;
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

function smtpPassword(): string {
  return (process.env.SMTP_PASS ?? "").replace(/\s+/g, "");
}

export function parseAlert(input: unknown): AlertPayload {
  const source = typeof input === "string" ? (JSON.parse(input) as unknown) : input;
  if (!source || typeof source !== "object") throw new Error("Bildiriş məlumatı oxunmadı.");
  const body = source as Record<string, unknown>;
  const alertType = clip(body.alertType, 140);
  const targetEmployee = clip(body.targetEmployee, 180);
  const details = String(body.details ?? "").trim().slice(0, 2000);
  const mitreCode = clip(body.mitreCode, 80);
  const timestamp = clip(body.timestamp, 80) || new Date().toLocaleString("az-AZ");
  const risk = Number(body.riskScore);
  if (!alertType || !targetEmployee || !details) throw new Error("Təhdid növü, hədəf və tədbir mətni mütləqdir.");
  if (!Number.isFinite(risk)) throw new Error("Risk balı rəqəm olmalıdır.");
  const requested = clip(body.recipientEmail, 160);
  const fallback = clip(process.env.ALERT_RECEIVER_EMAIL, 160) || DEFAULT_RECEIVER;
  const recipientEmail = requested || fallback;
  if (recipientEmail.includes(",") || !EMAIL_PATTERN.test(recipientEmail)) {
    throw new Error("Alıcı e-poçt ünvanı düzgün deyil.");
  }
  return {
    alertType,
    targetEmployee,
    riskScore: Math.max(0, Math.min(100, Math.round(risk))),
    details,
    mitreCode: mitreCode || "—",
    recipientEmail,
    timestamp,
  };
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
        <div style="margin-top:6px;font-size:22px;font-weight:800;color:#ffffff;">Avtomatik təhlükə bildirişi</div>
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

export async function deliverAlert(input: unknown): Promise<{ recipient: string }> {
  const alert = parseAlert(input);
  const user = (process.env.SMTP_USER ?? "").trim();
  const pass = smtpPassword();
  if (!user || !pass) throw new Error("SMTP ayarları tapılmadı. .env faylında SMTP_USER və SMTP_PASS yazın.");
  const transporter = createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: true,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  try {
    await transporter.sendMail({
      from: `"KiberGözətçi SOC" <${user}>`,
      to: alert.recipientEmail,
      subject: `KiberGözətçi: ${alert.alertType} — ${alert.riskScore}/100`,
      text: reportText(alert),
      html: reportHtml(alert),
    });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    const safe = (pass && raw.includes(pass) ? "" : raw).replace(/\s+/g, " ").trim();
    if (/535|BadCredentials|Username and Password not accepted/i.test(safe)) {
      throw new Error("Gmail giriş məlumatını qəbul etmədi. Hesabda yeni tətbiq şifrəsi yaradın və yerli .env faylındakı SMTP_PASS dəyərini yeniləyin.");
    }
    throw new Error(safe ? `E-poçt serveri məktubu qəbul etmədi: ${safe.slice(0, 280)}` : "E-poçt serveri məktubu qəbul etmədi.");
  }
  return { recipient: alert.recipientEmail };
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Yalnız POST qəbul edilir." });
    return;
  }
  try {
    const result = await deliverAlert(req.body);
    res.status(200).json({ ok: true, recipient: result.recipient });
  } catch (error) {
    const message = error instanceof Error ? error.message : "E-poçt göndərilmədi.";
    res.status(message.startsWith("SMTP") || message.startsWith("E-poçt serveri") ? 502 : 400).json({ ok: false, error: message });
  }
}
