import { Router, type Request, type Response } from "express";
import { getResolvedTicketsWithResponses, getTicketById } from "../db/ticketRepository.js";
import { draftFirstAgentResponse, findSimilarTicketMatch, suggestTicketCategory } from "../services/geminiService.js";
import type { TicketStatus } from "../db/schema.js";

export const aiRouter = Router();

function sendError(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
}

function isMinLengthString(value: unknown, minLength: number): value is string {
  return typeof value === "string" && value.trim().length >= minLength;
}

function parseId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

const statuses: TicketStatus[] = ["Open", "In Progress", "Resolved", "Closed"];

function isTicketStatus(value: unknown): value is TicketStatus {
  return typeof value === "string" && statuses.includes(value as TicketStatus);
}

aiRouter.get("/status", (_req, res) => {
  res.json({ configured: Boolean(process.env.GEMINI_API_KEY) });
});

// Prototype note: production should add request throttling/rate limiting for these AI endpoints.
aiRouter.post("/suggest-category", async (req: Request, res: Response) => {
  try {
    const { description } = req.body as Record<string, unknown>;

    if (!isMinLengthString(description, 3)) {
      sendError(res, 400, "description is required and must be at least 3 characters");
      return;
    }

    const suggestedCategory = await suggestTicketCategory(description.trim());
    res.json({ suggested_category: suggestedCategory });
  } catch (error) {
    console.error("AI suggest-category endpoint failed", error);
    res.json({ suggested_category: null });
  }
});

aiRouter.post("/similar-tickets", async (req: Request, res: Response) => {
  try {
    const { title, description } = req.body as Record<string, unknown>;

    if (!isMinLengthString(title, 3)) {
      sendError(res, 400, "title is required and must be at least 3 characters");
      return;
    }

    if (!isMinLengthString(description, 3)) {
      sendError(res, 400, "description is required and must be at least 3 characters");
      return;
    }

    const pastTickets = getResolvedTicketsWithResponses(30);
    const result = await findSimilarTicketMatch(
      {
        title: title.trim(),
        description: description.trim()
      },
      pastTickets
    );
    const match = result.matchId ? getTicketById(result.matchId) : null;

    res.json({ match });
  } catch (error) {
    console.error("AI similar-tickets endpoint failed", error);
    res.json({ match: null });
  }
});

aiRouter.post("/draft-response", async (req: Request, res: Response) => {
  try {
    const { ticket_id, target_status } = req.body as Record<string, unknown>;
    const ticketId = parseId(ticket_id);

    if (!ticketId) {
      sendError(res, 400, "ticket_id must be a positive integer");
      return;
    }

    if (target_status !== undefined && !isTicketStatus(target_status)) {
      sendError(res, 400, "target_status must be one of: Open, In Progress, Resolved, Closed");
      return;
    }

    const ticket = getTicketById(ticketId);

    if (!ticket) {
      sendError(res, 404, "Ticket not found");
      return;
    }

    const pastTickets = getResolvedTicketsWithResponses(30);
    const similarResult = await findSimilarTicketMatch(
      {
        title: ticket.title,
        description: ticket.description
      },
      pastTickets
    );
    const similarTicket = similarResult.matchId ? getTicketById(similarResult.matchId) : null;
    const draft = await draftFirstAgentResponse(ticket, similarTicket, target_status);

    res.json({
      draft:
        draft ??
        "Thanks for sharing this. We have received your ticket and will review the details shortly; in the meantime, please add any screenshots or recent changes that may help us troubleshoot."
    });
  } catch (error) {
    console.error("AI draft-response endpoint failed", error);
    res.json({
      draft:
        "Thanks for sharing this. We have received your ticket and will review the details shortly; in the meantime, please add any screenshots or recent changes that may help us troubleshoot."
    });
  }
});
