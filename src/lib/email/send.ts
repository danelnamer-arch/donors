import { resend, FROM_EMAIL } from "./resend";
import { prisma } from "@/lib/prisma";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  template: string;
  organizationId?: string | null;
  userId?: string | null;
}

/**
 * Send an email via Resend and log it to the database.
 * Safe for fire-and-forget usage — never throws.
 */
export async function sendEmail({
  to,
  subject,
  html,
  template,
  organizationId,
  userId,
}: SendEmailParams): Promise<{ success: boolean; messageId?: string }> {
  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    const resendId = result.data?.id ?? null;

    // Log to DB (non-blocking)
    prisma.emailLog
      .create({
        data: {
          to,
          subject,
          template,
          status: "sent",
          resendId,
          organizationId: organizationId ?? undefined,
          userId: userId ?? undefined,
        },
      })
      .catch((err) => console.error("[email] Failed to log email:", err));

    return { success: true, messageId: resendId ?? undefined };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[email] Send failed (${template} to ${to}):`, errorMsg);

    // Log failure
    prisma.emailLog
      .create({
        data: {
          to,
          subject,
          template,
          status: "failed",
          error: errorMsg,
          organizationId: organizationId ?? undefined,
          userId: userId ?? undefined,
        },
      })
      .catch(() => {});

    return { success: false };
  }
}
