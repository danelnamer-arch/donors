/**
 * AI-powered outreach email and LOI generation.
 * Uses Gemini to produce context-aware outreach drafts.
 */

import { callGemini } from "@/lib/gemini";
import { formatGrantAmount } from "@/lib/utils/format-amount";

export type TemplateType =
  | "introduction"
  | "follow_up"
  | "grant_inquiry"
  | "thank_you"
  | "loi";

export const TEMPLATE_LABELS: Record<TemplateType, string> = {
  introduction: "Introduction",
  follow_up: "Follow-up",
  grant_inquiry: "Grant Inquiry",
  thank_you: "Thank You",
  loi: "Letter of Intent",
};

export const TEMPLATE_DESCRIPTIONS: Record<TemplateType, string> = {
  introduction: "First contact — introduce your organization and why you're reaching out",
  follow_up: "Follow up after initial contact or meeting",
  grant_inquiry: "Ask about open grant opportunities and application process",
  thank_you: "Thank them after a meeting, call, or response",
  loi: "Formal Letter of Intent for a grant application",
};

interface OutreachContext {
  orgName: string;
  orgMission: string | null;
  orgCauses: string[];
  orgGeoFocus: string[];
  orgWebsite: string | null;
  donorName: string;
  donorType: string;
  donorDescription: string | null;
  donorCauses: string[];
  donorGeoFocus: string[];
  matchReasoning: string | null;
  topGrants: { recipientName: string; amount: number | null; year: number | null }[];
  existingNotes: string[];
  templateType: TemplateType;
}

export async function generateOutreachEmail(
  ctx: OutreachContext
): Promise<{ subject: string; body: string }> {
  const grantDetails = ctx.topGrants
    .slice(0, 5)
    .map((g) => {
      const parts = [g.recipientName];
      if (g.amount) parts.push(formatGrantAmount(g.amount));
      if (g.year) parts.push(`(${g.year})`);
      return parts.join(" — ");
    })
    .join("\n");

  const notesContext = ctx.existingNotes.length > 0
    ? `\nExisting notes/communications:\n${ctx.existingNotes.slice(0, 5).join("\n")}`
    : "";

  const templateInstructions = getTemplateInstructions(ctx.templateType);

  const prompt = `You are writing a professional outreach email from "${ctx.orgName}" to "${ctx.donorName}".

ORGANIZATION PROFILE:
- Name: ${ctx.orgName}
- Mission: ${ctx.orgMission || "N/A"}
- Focus areas: ${ctx.orgCauses.join(", ") || "N/A"}
- Geographic focus: ${ctx.orgGeoFocus.join(", ") || "N/A"}
${ctx.orgWebsite ? `- Website: ${ctx.orgWebsite}` : ""}

DONOR PROFILE:
- Name: ${ctx.donorName}
- Type: ${ctx.donorType}
- Description: ${ctx.donorDescription || "N/A"}
- Focus areas: ${ctx.donorCauses.join(", ") || "N/A"}
- Geographic focus: ${ctx.donorGeoFocus.join(", ") || "N/A"}
${grantDetails ? `\nRecent grants:\n${grantDetails}` : ""}
${ctx.matchReasoning ? `\nWhy they're a good match: ${ctx.matchReasoning}` : ""}
${notesContext}

EMAIL TYPE: ${TEMPLATE_LABELS[ctx.templateType]}
${templateInstructions}

FORMATTING RULES:
- Write a compelling subject line (under 60 chars)
- Write the email body in plain text (no HTML)
- Be professional but warm, not stiff or overly formal
- Keep it concise — 150-250 words for emails, 400-600 for LOIs
- Reference specific overlaps between the org and donor (grants they've made, causes they share)
- Never be generic — every sentence should be specific to THIS donor and THIS org
- Include a clear call-to-action

OUTPUT FORMAT:
Return ONLY valid JSON in this exact format:
{"subject": "...", "body": "..."}`;

  const result = await callGemini(
    [{ role: "user", parts: [{ text: prompt }] }],
    { temperature: 0.7, maxTokens: 2000 }
  );

  try {
    // Extract JSON from the response (handle markdown code blocks)
    const jsonStr = result.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(jsonStr);
    return {
      subject: parsed.subject || `Regarding partnership with ${ctx.donorName}`,
      body: parsed.body || "Failed to generate email body. Please try again.",
    };
  } catch {
    // Fallback: try to extract subject and body from non-JSON response
    console.error("[outreach] Failed to parse Gemini response as JSON");
    return {
      subject: `Introduction from ${ctx.orgName}`,
      body: result.trim() || "Failed to generate email. Please try again.",
    };
  }
}

function getTemplateInstructions(type: TemplateType): string {
  switch (type) {
    case "introduction":
      return `INSTRUCTIONS:
- This is the FIRST contact with this donor — they don't know who you are
- Briefly introduce the organization and its impact
- Explain WHY you're reaching out to them specifically (mention their grants, shared causes)
- End with a soft ask (meeting request, info sharing, not a direct funding ask)`;

    case "follow_up":
      return `INSTRUCTIONS:
- Reference a previous conversation or meeting (use notes if available)
- Remind them briefly of your organization and the discussion
- Move the conversation forward with a specific next step
- Be warm and appreciative of their time`;

    case "grant_inquiry":
      return `INSTRUCTIONS:
- Express interest in their grant programs
- Reference specific grants they've made to similar organizations
- Ask about current funding cycles, deadlines, and application process
- Briefly explain how your work aligns with their funding priorities`;

    case "thank_you":
      return `INSTRUCTIONS:
- Express genuine gratitude for their time, meeting, or response
- Reference specific points from the interaction (use notes if available)
- Briefly reinforce a key point of alignment
- Mention next steps if applicable`;

    case "loi":
      return `INSTRUCTIONS:
- This is a formal Letter of Intent for a grant application
- Include: organization overview, the specific program/project seeking funding,
  amount requested (leave as [AMOUNT]), timeline, expected outcomes
- Reference the donor's past grants to show alignment
- Be more formal and structured than an email
- Include sections: Introduction, Organization Background, Project Description,
  Budget Summary, Expected Impact, Conclusion`;
  }
}
