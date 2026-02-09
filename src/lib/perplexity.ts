/**
 * Perplexity API client for deep research with citations.
 * Uses the Sonar model which provides grounded answers with source URLs.
 */

interface PerplexityMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface PerplexityCitation {
  url: string;
  title?: string;
}

interface PerplexityResponse {
  id: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
  }[];
  citations?: string[];
}

export interface DeepResearchResult {
  content: string;
  citations: PerplexityCitation[];
}

async function callPerplexity(
  messages: PerplexityMessage[],
  model: string = "sonar"
): Promise<PerplexityResponse> {
  if (!process.env.PERPLEXITY_API_KEY) {
    throw new Error("PERPLEXITY_API_KEY is not set");
  }

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 2000,
      temperature: 0.2,
      return_citations: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Perplexity API error (${response.status}): ${error}`);
  }

  return response.json();
}

function parseResponse(response: PerplexityResponse): DeepResearchResult {
  const content = response.choices[0]?.message?.content ?? "";
  const citations = (response.citations ?? []).map((url) => ({ url }));
  return { content, citations };
}

/**
 * Deep research on a specific donor/foundation.
 * Returns detailed information with source citations.
 */
export async function researchDonor(donorName: string): Promise<DeepResearchResult> {
  const messages: PerplexityMessage[] = [
    {
      role: "system",
      content:
        "You are a philanthropy research assistant. Provide detailed, factual information about donors and foundations. Always include specific details like grant amounts, recipient organizations, geographic focus, and cause areas. Be precise and cite your sources.",
    },
    {
      role: "user",
      content: `Research the donor/foundation "${donorName}". Provide:
1. Description and mission
2. Key cause areas and focus populations
3. Geographic focus of their giving
4. Notable recent grants (organization name, amount if known, purpose)
5. Key people (executive director, board members if notable)
6. Contact information (website, email if public)
7. Political or ideological affiliation if discernible
8. Any relevant publications, interviews, or public statements`,
    },
  ];

  const response = await callPerplexity(messages);
  return parseResponse(response);
}

/**
 * Research donors that support a specific cause/population/region.
 * Used to discover new donors for the database.
 */
export async function discoverDonors(params: {
  cause: string;
  targetPopulation?: string;
  region?: string;
}): Promise<DeepResearchResult> {
  const { cause, targetPopulation, region } = params;

  let query = `List foundations, donors, and grant-makers that fund ${cause}`;
  if (targetPopulation) query += ` focused on ${targetPopulation}`;
  if (region) query += ` in ${region}`;
  query += `. For each, provide: name, description, website, typical grant size, and recent notable grants. Focus on active donors from the last 3 years.`;

  const messages: PerplexityMessage[] = [
    {
      role: "system",
      content:
        "You are a philanthropy research assistant. List real, verifiable donors and foundations. Only include organizations you are confident exist. Provide specific, factual details.",
    },
    { role: "user", content: query },
  ];

  const response = await callPerplexity(messages);
  return parseResponse(response);
}

/**
 * Deep enrichment research for a specific donor.
 * This is the paid "Enrich" feature — more comprehensive than basic research.
 */
export async function enrichDonor(
  donorName: string,
  knownInfo: {
    website?: string;
    causes?: string[];
    description?: string;
  }
): Promise<DeepResearchResult> {
  const context = [
    knownInfo.website && `Website: ${knownInfo.website}`,
    knownInfo.causes?.length && `Known causes: ${knownInfo.causes.join(", ")}`,
    knownInfo.description && `Known info: ${knownInfo.description}`,
  ]
    .filter(Boolean)
    .join("\n");

  const messages: PerplexityMessage[] = [
    {
      role: "system",
      content:
        "You are a philanthropy research assistant performing deep due diligence on a donor. Provide comprehensive, verified information. Focus on actionable intelligence that would help a nonprofit decide whether and how to approach this donor.",
    },
    {
      role: "user",
      content: `Perform deep research on "${donorName}".

Known information:
${context || "None"}

Provide a comprehensive report including:
1. Full profile: mission, history, founding story
2. Giving patterns: how much they give annually, typical grant sizes, multi-year vs one-time
3. Application process: how to apply, deadlines, requirements, whether they accept unsolicited proposals
4. Decision makers: key people, their backgrounds, how to reach them
5. Recent grants (last 2-3 years): recipient, amount, purpose
6. Strategic priorities: any shifts in focus, new initiatives
7. Public presence: recent interviews, articles, social media, conferences
8. Connections: notable board members, partner organizations, affiliated foundations
9. Red flags or considerations: any controversies, restrictions, or important caveats
10. Best approach strategy: how similar organizations have successfully secured funding`,
    },
  ];

  const response = await callPerplexity(messages, "sonar-pro");
  return parseResponse(response);
}
