/**
 * Extract text from non-PDF documents (DOCX, PPTX, DOC, PPT) using Gemini's
 * multimodal capabilities. Gemini 2.0 Flash can natively process these file
 * types when sent as inline data.
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

interface GeminiInlineDataPart {
  inlineData: {
    mimeType: string;
    data: string; // base64
  };
}

interface GeminiTextPart {
  text: string;
}

type GeminiPart = GeminiInlineDataPart | GeminiTextPart;

interface GeminiResponse {
  candidates: {
    content: {
      parts: { text: string }[];
    };
  }[];
}

/**
 * Extract plain text from a document (DOCX, PPTX, DOC, PPT) using Gemini.
 * Falls back to a basic description if extraction fails.
 *
 * @param base64Data - The file content as a base64-encoded string
 * @param mimeType - The MIME type of the file
 * @returns Extracted plain text
 */
export async function extractTextFromDocument(
  base64Data: string,
  mimeType: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const parts: GeminiPart[] = [
    {
      inlineData: {
        mimeType,
        data: base64Data,
      },
    },
    {
      text: `Extract ALL the text content from this document. Include headings, body text, bullet points, slide content, table data, and any other readable text. Return ONLY the extracted text, no commentary. Preserve the general structure with line breaks between sections.`,
    },
  ];

  const maxRetries = 3;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(
      `${GEMINI_BASE}/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (response.ok) {
      const data: GeminiResponse = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      return text;
    }

    // Retry on rate limits
    if ((response.status === 429 || response.status === 503) && attempt < maxRetries) {
      const delay = Math.min(2000 * Math.pow(2, attempt), 30000) + Math.random() * 2000;
      console.warn(
        `[doc-parser] Rate limited (${response.status}), retrying in ${Math.round(delay / 1000)}s`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }

    const error = await response.text();
    throw new Error(`Gemini document extraction failed (${response.status}): ${error}`);
  }

  throw new Error("Document extraction: max retries exceeded");
}

/**
 * Check if a MIME type is a supported document format (non-PDF).
 */
export function isSupportedDocumentType(mimeType: string): boolean {
  const supported = [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
    "application/msword", // .doc
    "application/vnd.ms-powerpoint", // .ppt
  ];
  return supported.includes(mimeType);
}
