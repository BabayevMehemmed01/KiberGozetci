export type AlertKind = "phishing_trap" | "security_alert";

export interface SecurityAlertInput {
  type?: AlertKind;
  alertType: string;
  targetEmployee: string;
  riskScore: number;
  details: string;
  mitreCode: string;
  employeeName?: string;
}

export interface AlertResult {
  ok: boolean;
  skipped: boolean;
  message: string;
}

export const DEFAULT_ALERT_EMAIL = "birlik1020@gmail.com";
const ENABLED_KEY = "kibergozetci-mail-enabled";
const EMAIL_KEY = "kibergozetci-mail-recipient";

export function loadMailSettings(): { enabled: boolean; recipientEmail: string } {
  try {
    const enabled = localStorage.getItem(ENABLED_KEY);
    const email = localStorage.getItem(EMAIL_KEY)?.trim() ?? "";
    return {
      enabled: enabled === null ? true : enabled === "1",
      recipientEmail: email || DEFAULT_ALERT_EMAIL,
    };
  } catch {
    return { enabled: true, recipientEmail: DEFAULT_ALERT_EMAIL };
  }
}

export function saveMailSettings(enabled: boolean, recipientEmail: string): void {
  localStorage.setItem(ENABLED_KEY, enabled ? "1" : "0");
  localStorage.setItem(EMAIL_KEY, recipientEmail.trim());
}

export async function postSecurityAlert(
  alert: SecurityAlertInput,
  options?: { force?: boolean; recipientEmail?: string },
): Promise<AlertResult> {
  const settings = loadMailSettings();
  const recipientEmail = (options?.recipientEmail ?? settings.recipientEmail).trim() || DEFAULT_ALERT_EMAIL;
  if (!options?.force && !settings.enabled) {
    return { ok: false, skipped: true, message: "Avtomatik e-poçt bildirişləri söndürülüb." };
  }
  try {
    const response = await fetch("/api/send-alert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...alert,
        type: alert.type ?? "security_alert",
        employeeName: (alert.employeeName || alert.targetEmployee).trim(),
        targetEmployee: alert.targetEmployee.trim(),
        recipientEmail,
        timestamp: new Date().toLocaleString("az-AZ"),
        origin: window.location.origin,
      }),
    });
    const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; recipient?: string; fallback?: boolean } | null;
    if (!response.ok || !data?.ok) {
      return { ok: false, skipped: false, message: data?.error || "E-poçt göndərilmədi." };
    }
    const recipient = data.recipient ?? recipientEmail;
    const message = data.fallback ? `Bildiriş ehtiyat ünvana göndərildi: ${recipient}` : `Bildiriş göndərildi: ${recipient}`;
    return { ok: true, skipped: false, message };
  } catch {
    return { ok: false, skipped: false, message: "E-poçt xidmətinə qoşulmaq alınmadı." };
  }
}
