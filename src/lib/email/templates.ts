// ─── Shared styles ──────────────────────────────────
const BRAND_COLOR = "#4f46e5";
const BG_COLOR = "#f9fafb";

function layout(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BG_COLOR};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden">
    <div style="background:${BRAND_COLOR};padding:24px 32px">
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700">Funderra</h1>
    </div>
    <div style="padding:32px">
      ${content}
    </div>
    <div style="padding:16px 32px;border-top:1px solid #f4f4f5;text-align:center">
      <p style="margin:0;color:#a1a1aa;font-size:12px">Funderra — AI-powered donor matching for nonprofits</p>
    </div>
  </div>
</body>
</html>`;
}

function button(text: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin:16px 0">${text}</a>`;
}

// ─── Templates ──────────────────────────────────────

export function welcomeEmail(userName: string): { subject: string; html: string } {
  return {
    subject: "Welcome to Funderra!",
    html: layout(`
      <h2 style="margin:0 0 8px;color:#18181b;font-size:22px">Welcome, ${userName}!</h2>
      <p style="color:#52525b;font-size:15px;line-height:1.6">
        You're all set to start finding the right donors for your organization.
        Here's what to do next:
      </p>
      <ol style="color:#52525b;font-size:14px;line-height:1.8;padding-left:20px">
        <li><strong>Complete your profile</strong> — add your mission, focus areas, and sources</li>
        <li><strong>Discover matches</strong> — our AI will find donors aligned with your work</li>
        <li><strong>Build your pipeline</strong> — swipe right on the best fits and start outreach</li>
      </ol>
      ${button("Go to Dashboard", `${process.env.NEXTAUTH_URL || "https://funderra.app"}/dashboard`)}
      <p style="color:#a1a1aa;font-size:13px;margin-top:24px">
        If you have questions, just reply to this email — we read every one.
      </p>
    `),
  };
}

export function passwordResetEmail(
  userName: string,
  resetUrl: string
): { subject: string; html: string } {
  return {
    subject: "Reset your Funderra password",
    html: layout(`
      <h2 style="margin:0 0 8px;color:#18181b;font-size:22px">Password Reset</h2>
      <p style="color:#52525b;font-size:15px;line-height:1.6">
        Hi ${userName}, we received a request to reset your password.
        Click the button below to choose a new one:
      </p>
      ${button("Reset Password", resetUrl)}
      <p style="color:#71717a;font-size:13px;line-height:1.6;margin-top:16px">
        This link expires in 1 hour. If you didn't request a password reset,
        you can safely ignore this email.
      </p>
    `),
  };
}

export interface DigestData {
  newMatchCount: number;
  topMatches: string[]; // donor names
  pipelineChanges: number;
  fundedCount: number;
  fundedNames: string[];
}

export function weeklyDigestEmail(
  orgName: string,
  data: DigestData
): { subject: string; html: string } {
  const matchSection =
    data.newMatchCount > 0
      ? `<p style="color:#52525b;font-size:15px">
          <strong>${data.newMatchCount} new matches</strong> found this week${
            data.topMatches.length > 0
              ? `, including ${data.topMatches.slice(0, 3).join(", ")}`
              : ""
          }.
        </p>`
      : `<p style="color:#71717a;font-size:14px">No new matches this week — check back soon!</p>`;

  const fundedSection =
    data.fundedCount > 0
      ? `<div style="background:#ecfdf5;border-radius:8px;padding:16px;margin:16px 0">
          <p style="margin:0;color:#065f46;font-size:14px;font-weight:600">
            🎉 ${data.fundedCount} donor${data.fundedCount > 1 ? "s" : ""} moved to Funded!
          </p>
          <p style="margin:4px 0 0;color:#047857;font-size:13px">${data.fundedNames.join(", ")}</p>
        </div>`
      : "";

  return {
    subject: `Your weekly Funderra digest — ${data.newMatchCount} new matches`,
    html: layout(`
      <h2 style="margin:0 0 8px;color:#18181b;font-size:22px">Weekly Digest for ${orgName}</h2>
      ${matchSection}
      ${fundedSection}
      ${
        data.pipelineChanges > 0
          ? `<p style="color:#52525b;font-size:14px">${data.pipelineChanges} pipeline updates this week.</p>`
          : ""
      }
      ${button("View Dashboard", `${process.env.NEXTAUTH_URL || "https://funderra.app"}/dashboard`)}
    `),
  };
}

export function fundedCongratulationsEmail(
  orgName: string,
  donorName: string
): { subject: string; html: string } {
  return {
    subject: `🎉 ${donorName} moved to Funded!`,
    html: layout(`
      <div style="text-align:center;padding:8px 0">
        <div style="font-size:48px;margin-bottom:8px">🎉</div>
        <h2 style="margin:0 0 8px;color:#18181b;font-size:22px">Congratulations!</h2>
      </div>
      <p style="color:#52525b;font-size:15px;line-height:1.6;text-align:center">
        <strong>${donorName}</strong> has been marked as <strong style="color:${BRAND_COLOR}">Funded</strong>
        in ${orgName}'s pipeline.
      </p>
      <p style="color:#71717a;font-size:14px;text-align:center;line-height:1.6">
        Keep the momentum going — check your pipeline for more opportunities.
      </p>
      ${`<div style="text-align:center">${button("View Pipeline", `${process.env.NEXTAUTH_URL || "https://funderra.app"}/pipeline`)}</div>`}
    `),
  };
}
