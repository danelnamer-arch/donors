import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/send";
import { passwordResetEmail } from "@/lib/email/templates";
import crypto from "crypto";

/**
 * POST /api/auth/forgot-password
 * Generate a password reset token and send email.
 * Always returns 200 to prevent email enumeration.
 *
 * Body: { email }
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Always return success — no email enumeration
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, name: true, email: true, passwordHash: true },
    });

    if (user && user.passwordHash) {
      // Delete any existing tokens for this email
      await prisma.passwordResetToken.deleteMany({
        where: { email: user.email },
      });

      // Create new token (64 hex chars)
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.passwordResetToken.create({
        data: {
          email: user.email,
          token,
          expiresAt,
        },
      });

      const baseUrl = process.env.NEXTAUTH_URL || "https://funderra.app";
      const resetUrl = `${baseUrl}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;

      const { subject, html } = passwordResetEmail(user.name || "there", resetUrl);

      // Fire and forget
      sendEmail({
        to: user.email,
        subject,
        html,
        template: "password-reset",
        userId: user.id,
      }).catch(() => {});
    }

    // Always return 200 — don't reveal whether email exists
    return NextResponse.json({
      message: "If an account with that email exists, we've sent a password reset link.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
