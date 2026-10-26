import type { Environment } from "@/env";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Dev: prints to stdout. Production: swaps in a real provider here, keyed on
 * `env.RESEND_API_KEY`. Kept as one function so call sites never change.
 */
export async function sendMail(env: Environment, message: MailMessage): Promise<void> {
  if (env.NODE_ENV === "production" && env.RESEND_API_KEY) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: message.to,
        subject: message.subject,
        text: message.text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Resend rejected the message: ${response.status} ${await response.text()}`);
    }
    return;
  }

  console.info(`[mail] to=${message.to} subject=${message.subject} body=${message.text}`);
}
