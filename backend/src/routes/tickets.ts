import { Router, type Request, type Response } from "express";
import {
  createTicket,
  getNotificationsForEmployee,
  getTicketActivity,
  getTicketById,
  getTickets,
  markAllNotificationsRead,
  markNotificationRead,
  updateInternalNotes,
  updateSatisfactionRating,
  updateTicketStatus
} from "../db/ticketRepository.js";
import type { TicketCategory, TicketStatus, TicketUrgency } from "../db/schema.js";

export const ticketsRouter = Router();
export const notificationsRouter = Router();

const categories = ["IT", "HR", "Finance", "Admin"] as const;
const urgencies = ["Low", "Medium", "High", "Critical"] as const;
const statuses = ["Open", "In Progress", "Resolved", "Closed"] as const;

function isTicketCategory(value: unknown): value is TicketCategory {
  return typeof value === "string" && categories.includes(value as TicketCategory);
}

function isTicketUrgency(value: unknown): value is TicketUrgency {
  return typeof value === "string" && urgencies.includes(value as TicketUrgency);
}

function isTicketStatus(value: unknown): value is TicketStatus {
  return typeof value === "string" && statuses.includes(value as TicketStatus);
}

function isMinLengthString(value: unknown, minLength: number): value is string {
  return typeof value === "string" && value.trim().length >= minLength;
}

function parseId(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }

  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function sendError(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
}

ticketsRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { title, description, category, urgency, raised_by } = req.body as Record<string, unknown>;

    if (!isMinLengthString(title, 3)) {
      sendError(res, 400, "title is required and must be at least 3 characters");
      return;
    }

    if (!isMinLengthString(description, 3)) {
      sendError(res, 400, "description is required and must be at least 3 characters");
      return;
    }

    if (!isTicketCategory(category)) {
      sendError(res, 400, "category must be one of: IT, HR, Finance, Admin");
      return;
    }

    if (!isTicketUrgency(urgency)) {
      sendError(res, 400, "urgency must be one of: Low, Medium, High, Critical");
      return;
    }

    if (!isMinLengthString(raised_by, 1)) {
      sendError(res, 400, "raised_by is required");
      return;
    }

    const ticket = createTicket({
      title: title.trim(),
      description: description.trim(),
      category,
      urgency,
      raised_by: raised_by.trim()
    });

    res.status(201).json(ticket);
  } catch (error) {
    sendError(res, 500, error instanceof Error ? error.message : "Failed to create ticket");
  }
});

ticketsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const raisedBy = typeof req.query.raised_by === "string" ? req.query.raised_by.trim() : undefined;
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const urgency = typeof req.query.urgency === "string" ? req.query.urgency : undefined;
    const search = typeof req.query.search === "string" ? req.query.search.trim() : undefined;

    if (category && !isTicketCategory(category)) {
      sendError(res, 400, "category must be one of: IT, HR, Finance, Admin");
      return;
    }

    if (status && !isTicketStatus(status)) {
      sendError(res, 400, "status must be one of: Open, In Progress, Resolved, Closed");
      return;
    }

    if (urgency && !isTicketUrgency(urgency)) {
      sendError(res, 400, "urgency must be one of: Low, Medium, High, Critical");
      return;
    }

    const categoryFilter = category && isTicketCategory(category) ? category : undefined;
    const tickets = getTickets({
      raised_by: raisedBy || undefined,
      category: categoryFilter,
      status: status && isTicketStatus(status) ? status : undefined,
      urgency: urgency && isTicketUrgency(urgency) ? urgency : undefined,
      search: search || undefined
    });

    res.json(tickets);
  } catch (error) {
    sendError(res, 500, error instanceof Error ? error.message : "Failed to list tickets");
  }
});

ticketsRouter.get("/:id/activity", async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);

    if (!id) {
      sendError(res, 400, "Ticket id must be a positive integer");
      return;
    }

    if (!getTicketById(id)) {
      sendError(res, 404, "Ticket not found");
      return;
    }

    res.json(getTicketActivity(id));
  } catch (error) {
    sendError(res, 500, error instanceof Error ? error.message : "Failed to get ticket activity");
  }
});

ticketsRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);

    if (!id) {
      sendError(res, 400, "Ticket id must be a positive integer");
      return;
    }

    const ticket = getTicketById(id);

    if (!ticket) {
      sendError(res, 404, "Ticket not found");
      return;
    }

    res.json(ticket);
  } catch (error) {
    sendError(res, 500, error instanceof Error ? error.message : "Failed to get ticket");
  }
});

ticketsRouter.patch("/:id/status", async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);

    if (!id) {
      sendError(res, 400, "Ticket id must be a positive integer");
      return;
    }

    const { status, agent_response, internal_notes } = req.body as Record<string, unknown>;

    if (!isTicketStatus(status)) {
      sendError(res, 400, "status must be one of: Open, In Progress, Resolved, Closed");
      return;
    }

    if (agent_response !== undefined && typeof agent_response !== "string") {
      sendError(res, 400, "agent_response must be a string when provided");
      return;
    }

    if (internal_notes !== undefined && typeof internal_notes !== "string") {
      sendError(res, 400, "internal_notes must be a string when provided");
      return;
    }

    const ticket = updateTicketStatus(id, {
      status,
      agent_response: typeof agent_response === "string" ? agent_response.trim() : undefined,
      internal_notes: typeof internal_notes === "string" ? internal_notes.trim() : undefined
    });

    if (!ticket) {
      sendError(res, 404, "Ticket not found");
      return;
    }

    res.json(ticket);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update ticket status";
    const statusCode = message.startsWith("Invalid status transition") ? 400 : 500;
    sendError(res, statusCode, message);
  }
});

ticketsRouter.patch("/:id/internal-notes", async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);

    if (!id) {
      sendError(res, 400, "Ticket id must be a positive integer");
      return;
    }

    const { internal_notes } = req.body as Record<string, unknown>;

    if (typeof internal_notes !== "string") {
      sendError(res, 400, "internal_notes is required");
      return;
    }

    const ticket = updateInternalNotes(id, internal_notes.trim());

    if (!ticket) {
      sendError(res, 404, "Ticket not found");
      return;
    }

    res.json(ticket);
  } catch (error) {
    sendError(res, 500, error instanceof Error ? error.message : "Failed to update internal notes");
  }
});

ticketsRouter.patch("/:id/satisfaction", async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);

    if (!id) {
      sendError(res, 400, "Ticket id must be a positive integer");
      return;
    }

    const { rating } = req.body as Record<string, unknown>;
    const numericRating = Number(rating);

    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      sendError(res, 400, "rating must be an integer from 1 to 5");
      return;
    }

    const ticket = updateSatisfactionRating(id, numericRating);

    if (!ticket) {
      sendError(res, 404, "Ticket not found");
      return;
    }

    res.json(ticket);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update satisfaction";
    sendError(res, message.startsWith("Satisfaction can only") ? 400 : 500, message);
  }
});

notificationsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const raisedBy = typeof req.query.raised_by === "string" ? req.query.raised_by.trim() : "";

    if (!raisedBy) {
      sendError(res, 400, "raised_by query parameter is required");
      return;
    }

    res.json(getNotificationsForEmployee(raisedBy));
  } catch (error) {
    sendError(res, 500, error instanceof Error ? error.message : "Failed to list notifications");
  }
});

notificationsRouter.patch("/:id/read", async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);

    if (!id) {
      sendError(res, 400, "Notification id must be a positive integer");
      return;
    }

    const notification = markNotificationRead(id);

    if (!notification) {
      sendError(res, 404, "Notification not found");
      return;
    }

    res.json(notification);
  } catch (error) {
    sendError(res, 500, error instanceof Error ? error.message : "Failed to mark notification as read");
  }
});

notificationsRouter.patch("/read-all", async (req: Request, res: Response) => {
  try {
    const raisedBy = typeof req.query.raised_by === "string" ? req.query.raised_by.trim() : "";

    if (!raisedBy) {
      sendError(res, 400, "raised_by query parameter is required");
      return;
    }

    res.json({ updated: markAllNotificationsRead(raisedBy) });
  } catch (error) {
    sendError(res, 500, error instanceof Error ? error.message : "Failed to mark notifications as read");
  }
});
