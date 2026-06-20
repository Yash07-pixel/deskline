import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";
import type { Ticket, TicketCategory, TicketStatus } from "../db/schema.js";

const modelName = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
const requestTimeoutMs = 10_000;
const categories = ["IT", "HR", "Finance", "Admin"] as const;

let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;

interface SimilarTicketResult {
  matchId: number | null;
  confidence?: string;
}

function isTicketCategory(value: string): value is TicketCategory {
  return categories.includes(value as TicketCategory);
}

function getGeminiModel(): GenerativeModel {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  genAI ??= new GoogleGenerativeAI(apiKey);
  model ??= genAI.getGenerativeModel({ model: modelName });

  return model;
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs = requestTimeoutMs): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error("Gemini request timed out")), timeoutMs);
  });

  try {
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

async function generateText(prompt: string): Promise<string> {
  const result = await withTimeout(getGeminiModel().generateContent(prompt));
  return result.response.text().trim();
}

function stripJsonMarkdown(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseSimilarTicketResponse(text: string): SimilarTicketResult {
  try {
    const parsed = JSON.parse(stripJsonMarkdown(text)) as { match_id?: unknown; confidence?: unknown };
    const matchId = typeof parsed.match_id === "number" && Number.isInteger(parsed.match_id) ? parsed.match_id : null;
    const confidence = typeof parsed.confidence === "string" ? parsed.confidence : undefined;

    return { matchId, confidence };
  } catch (error) {
    console.warn("Failed to parse Gemini similar-ticket JSON response", { text, error });
    return { matchId: null };
  }
}

function formatPastTickets(tickets: Ticket[]): string {
  return tickets
    .map(
      (ticket) => `
ID: ${ticket.id}
Title: ${ticket.title}
Description: ${ticket.description}
Resolution: ${ticket.agent_response ?? ""}
`
    )
    .join("\n---\n");
}

function suggestCategoryLocally(description: string): TicketCategory {
  const text = description.toLowerCase();
  const scores: Record<TicketCategory, number> = {
    IT: 0,
    HR: 0,
    Finance: 0,
    Admin: 0
  };

  const keywords: Record<TicketCategory, string[]> = {
    IT: ["vpn", "laptop", "email", "login", "password", "printer", "software", "network", "mfa", "access", "folder"],
    HR: ["leave", "policy", "onboarding", "insurance", "benefit", "payroll profile", "manager", "attendance"],
    Finance: ["payslip", "salary", "reimbursement", "tax", "form 16", "expense", "invoice", "account", "payment"],
    Admin: ["monitor", "chair", "desk", "id card", "badge", "room", "facility", "access card", "parking", "asset"]
  };

  for (const [category, words] of Object.entries(keywords) as Array<[TicketCategory, string[]]>) {
    for (const word of words) {
      if (text.includes(word)) {
        scores[category] += 1;
      }
    }
  }

  return categories.reduce((best, category) => (scores[category] > scores[best] ? category : best), "IT");
}

function tokenize(value: string): Set<string> {
  const stopWords = new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "after",
    "every",
    "while",
    "during",
    "issue",
    "ticket",
    "need",
    "cannot",
    "keeps"
  ]);

  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word))
  );
}

function findSimilarTicketLocally(newTicket: Pick<Ticket, "title" | "description">, pastTickets: Ticket[]): SimilarTicketResult {
  const newTokens = tokenize(`${newTicket.title} ${newTicket.description}`);
  let bestMatch: { id: number; score: number } | null = null;

  for (const ticket of pastTickets) {
    const pastTokens = tokenize(`${ticket.title} ${ticket.description} ${ticket.agent_response ?? ""}`);
    let overlap = 0;

    for (const token of newTokens) {
      if (pastTokens.has(token)) {
        overlap += token.length > 4 ? 2 : 1;
      }
    }

    if (!bestMatch || overlap > bestMatch.score) {
      bestMatch = { id: ticket.id, score: overlap };
    }
  }

  return bestMatch && bestMatch.score >= 3 ? { matchId: bestMatch.id, confidence: "local" } : { matchId: null };
}

function draftFirstAgentResponseLocally(ticket: Ticket, similarTicket: Ticket | null, targetStatus?: TicketStatus): string {
  if (targetStatus === "In Progress") {
    const firstSteps: Record<TicketCategory, string> = {
      IT: "I will check the VPN/session logs and confirm whether this is related to your device profile or network route.",
      HR: "I will review your employee record and compare it with the current HR portal data.",
      Finance: "I will check the payroll/finance record and confirm whether anything is pending from the vendor or approval flow.",
      Admin: "I will route this to the facilities/admin queue and verify the asset or location details."
    };

    return `Thanks for raising this. I am moving the ticket to In Progress and will investigate it now. ${firstSteps[ticket.category]}`;
  }

  if (targetStatus === "Resolved") {
    if (similarTicket?.agent_response) {
      return `Thanks for your patience. This appears to match a previously resolved ${ticket.category} issue, where the fix was: ${similarTicket.agent_response} I am marking this resolved based on that fix; please reopen or reply if the issue continues.`;
    }

    const resolutionSteps: Record<TicketCategory, string> = {
      IT: "I have applied the standard troubleshooting path for this issue. Please try again and reply if the problem continues.",
      HR: "I have reviewed the HR record and applied the needed correction. Please check the portal again.",
      Finance: "I have reviewed the finance record and applied the needed update. Please check the payroll or finance portal again.",
      Admin: "I have passed the update through the admin workflow and marked the request resolved. Please confirm if anything still looks off."
    };

    return `${resolutionSteps[ticket.category]} I am marking this ticket as resolved for now.`;
  }

  if (targetStatus === "Closed") {
    return "This ticket has already been resolved, so I am closing it now. Please raise a new ticket if the issue comes back or if you need anything else.";
  }

  if (similarTicket?.agent_response) {
    return `Thanks for sharing this. This looks similar to a previous ${ticket.category} issue, where the fix was: ${similarTicket.agent_response} Please try that first and let us know if the problem continues.`;
  }

  const firstSteps: Record<TicketCategory, string> = {
    IT: "Please share any error message or screenshot, and try signing out and back in once so we can rule out a stale session.",
    HR: "Please share the relevant employee portal screenshot or policy page so HR can compare it with your record.",
    Finance: "Please share the transaction, payslip, or claim reference number so Finance can trace it quickly.",
    Admin: "Please share your workstation or location details so the Admin team can route this to the right facility owner."
  };

  return `Thanks for raising this. We have noted the ${ticket.category} issue and will review it shortly. ${firstSteps[ticket.category]}`;
}

export async function suggestTicketCategory(description: string): Promise<TicketCategory | null> {
  try {
    const prompt = `
You are Deskline's internal support ticket classifier.
Classify the employee's ticket description into exactly one category: IT, HR, Finance, Admin.

Description:
${description}

Respond with ONLY one word: IT, HR, Finance, or Admin. No explanation.
`;

    const rawCategory = (await generateText(prompt)).replace(/[^A-Za-z]/g, "");

    if (isTicketCategory(rawCategory)) {
      return rawCategory;
    }

    console.warn(`Gemini returned invalid category "${rawCategory}", defaulting to IT`);
    return "IT";
  } catch (error) {
    console.error("Gemini category suggestion failed", error);
    return suggestCategoryLocally(description);
  }
}

export async function findSimilarTicketMatch(
  newTicket: Pick<Ticket, "title" | "description">,
  pastTickets: Ticket[]
): Promise<SimilarTicketResult> {
  if (pastTickets.length === 0) {
    return { matchId: null };
  }

  try {
    const prompt = `
You are helping Deskline identify whether a new internal support ticket has already been solved before.
Only match tickets that address the SAME underlying issue and whose resolution would likely help this employee.
Do not match merely because of shared keywords, category, or vague similarity.

New ticket:
Title: ${newTicket.title}
Description: ${newTicket.description}

Past resolved or closed tickets:
${formatPastTickets(pastTickets)}

Return ONLY valid JSON.
Use this shape when there is a strong semantic match:
{ "match_id": 42, "confidence": "high" }

Use this shape when there is no good match:
{ "match_id": null }
`;

    const result = parseSimilarTicketResponse(await generateText(prompt));
    const matchExists = result.matchId === null || pastTickets.some((ticket) => ticket.id === result.matchId);

    if (!matchExists) {
      console.warn(`Gemini returned unknown match_id "${result.matchId}"`);
      return { matchId: null };
    }

    return result;
  } catch (error) {
    console.error("Gemini similar-ticket lookup failed", error);
    return findSimilarTicketLocally(newTicket, pastTickets);
  }
}

export async function draftFirstAgentResponse(
  ticket: Ticket,
  similarTicket: Ticket | null,
  targetStatus?: TicketStatus
): Promise<string | null> {
  try {
    const similarContext = similarTicket
      ? `
A similar past ticket was resolved this way:
Title: ${similarTicket.title}
Description: ${similarTicket.description}
Resolution: ${similarTicket.agent_response ?? ""}
`
      : "No closely matching resolved ticket was found.";

    const prompt = `
You are a helpful support agent writing the first response to an employee in Deskline.
Write 2-4 concise, professional sentences. Acknowledge the issue directly.
The agent is about to update the ticket status to: ${targetStatus ?? "No status selected yet"}.
If the target status is "In Progress", write an investigation/update response and do not imply the issue is fixed.
If the target status is "Resolved", write a resolution response and mention the likely fix or next verification step.
If the target status is "Closed", write a short closure response.
If similar resolution context is available, use it only when it fits the target status.
If no similar context is available, ask one clarifying question or suggest one first troubleshooting step appropriate to the category.
Avoid corporate filler and do not mention AI.

Ticket:
Category: ${ticket.category}
Title: ${ticket.title}
Description: ${ticket.description}

Context:
${similarContext}
`;

    return await generateText(prompt);
  } catch (error) {
    console.error("Gemini draft response failed", error);
    return draftFirstAgentResponseLocally(ticket, similarTicket, targetStatus);
  }
}
