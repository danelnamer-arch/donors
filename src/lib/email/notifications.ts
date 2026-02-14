import { prisma } from "@/lib/prisma";
import { sendEmail } from "./send";
import { fundedCongratulationsEmail } from "./templates";

/**
 * Send a FUNDED congratulations email to all users in the organization.
 * Fire-and-forget safe — never throws.
 */
export async function notifyFunded(
  organizationId: string,
  donorName: string
): Promise<void> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        name: true,
        users: { select: { id: true, email: true } },
      },
    });

    if (!org) return;

    const { subject, html } = fundedCongratulationsEmail(
      org.name,
      donorName
    );

    // Send to all org users in parallel
    await Promise.allSettled(
      org.users.map((user) =>
        sendEmail({
          to: user.email,
          subject,
          html,
          template: "funded-congrats",
          organizationId,
          userId: user.id,
        })
      )
    );
  } catch (error) {
    console.error("[email] notifyFunded failed:", error);
  }
}
