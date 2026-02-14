/**
 * Extract plain text from a PDF buffer.
 * Thin wrapper around pdf-parse — no file storage needed.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (
  buffer: Buffer
) => Promise<{ text: string; numpages: number; info: Record<string, unknown> }>;

/**
 * Extract text content from a PDF file buffer.
 * Returns plain text suitable for feeding into Gemini extraction.
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const result = await pdfParse(buffer);
  return result.text;
}
