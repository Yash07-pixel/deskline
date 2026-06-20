import { db } from "./db.js";
import type { Notification, Ticket, TicketCategory, TicketEvent, TicketStatus, TicketUrgency } from "./schema.js";

export interface CreateTicketInput {
  title: string;
  description: string;
  category: TicketCategory;
  urgency: TicketUrgency;
  raised_by: string;
}

export interface TicketFilters {
  raised_by?: string;
  category?: TicketCategory;
  status?: TicketStatus;
  urgency?: TicketUrgency;
  search?: string;
}

export interface UpdateTicketStatusInput {
  status: TicketStatus;
  agent_response?: string;
  internal_notes?: string;
}

export interface EmployeeNotification extends Notification {
  ticket_title: string;
  ticket_status: TicketStatus;
  raised_by: string;
}

const ticketSelect = `
  id,
  title,
  description,
  category,
  urgency,
  status,
  raised_by,
  created_at,
  updated_at,
  agent_response,
  internal_notes,
  satisfaction_rating
`;

const validTransitions: Record<TicketStatus, TicketStatus[]> = {
  Open: ["In Progress", "Resolved"],
  "In Progress": ["Resolved"],
  Resolved: ["Closed"],
  Closed: []
};

export function createTicket(input: CreateTicketInput): Ticket {
  const now = new Date().toISOString();
  const createTransaction = db.transaction(() => {
    const result = db
      .prepare(
        `
        INSERT INTO tickets (
          title,
          description,
          category,
          urgency,
          status,
          raised_by,
          created_at,
          updated_at,
          agent_response,
          internal_notes,
          satisfaction_rating
        ) VALUES (
          @title,
          @description,
          @category,
          @urgency,
          'Open',
          @raised_by,
          @now,
          @now,
          NULL,
          NULL,
          NULL
        )
      `
      )
      .run({ ...input, now });

    const ticketId = Number(result.lastInsertRowid);
    db.prepare(
      `
        INSERT INTO ticket_events (ticket_id, event_type, message, created_at)
        VALUES (?, 'created', ?, ?)
      `
    ).run(ticketId, `Ticket created with ${input.urgency} urgency in ${input.category}.`, now);

    return ticketId;
  });

  const ticketId = createTransaction();

  const created = getTicketById(ticketId);

  if (!created) {
    throw new Error("Ticket was created but could not be loaded");
  }

  return created;
}

export function getTickets(filters: TicketFilters = {}): Ticket[] {
  const where: string[] = [];
  const params: Array<string> = [];

  if (filters.raised_by) {
    where.push("raised_by = ?");
    params.push(filters.raised_by);
  }

  if (filters.category) {
    where.push("category = ?");
    params.push(filters.category);
  }

  if (filters.status) {
    where.push("status = ?");
    params.push(filters.status);
  }

  if (filters.urgency) {
    where.push("urgency = ?");
    params.push(filters.urgency);
  }

  if (filters.search) {
    where.push("(title LIKE ? OR description LIKE ?)");
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const orderClause = filters.category
    ? `
        ORDER BY
            CASE urgency
              WHEN 'Critical' THEN 1
              WHEN 'High' THEN 2
              WHEN 'Medium' THEN 3
              WHEN 'Low' THEN 4
            END,
            datetime(created_at) ASC
      `
    : "ORDER BY datetime(created_at) DESC";

  return db
    .prepare(
      `
        SELECT ${ticketSelect}
        FROM tickets
        ${whereClause}
        ${orderClause}
      `
    )
    .all(...params) as Ticket[];
}

export function getTicketById(id: number): Ticket | null {
  const ticket = db
    .prepare(
      `
        SELECT ${ticketSelect}
        FROM tickets
        WHERE id = ?
      `
    )
    .get(id) as Ticket | undefined;

  return ticket ?? null;
}

export function getResolvedTicketsWithResponses(limit = 30): Ticket[] {
  return db
    .prepare(
      `
        SELECT ${ticketSelect}
        FROM tickets
        WHERE status IN ('Resolved', 'Closed')
          AND agent_response IS NOT NULL
          AND length(trim(agent_response)) > 0
        ORDER BY datetime(updated_at) DESC
        LIMIT ?
      `
    )
    .all(limit) as Ticket[];
}

export function getTicketActivity(ticketId: number): TicketEvent[] {
  return db
    .prepare(
      `
        SELECT id, ticket_id, event_type, message, created_at
        FROM ticket_events
        WHERE ticket_id = ?
        ORDER BY datetime(created_at) ASC, id ASC
      `
    )
    .all(ticketId) as TicketEvent[];
}

export interface RecentActivity {
  id: number;
  ticket_id: number;
  event_type: "created" | "status_changed" | "response_added";
  message: string;
  created_at: string;
  ticket_title: string;
  category: TicketCategory;
  status: TicketStatus;
}

export function getRecentActivity(limit = 8): RecentActivity[] {
  return db
    .prepare(
      `
        SELECT
          ticket_events.id,
          ticket_events.ticket_id,
          ticket_events.event_type,
          ticket_events.message,
          ticket_events.created_at,
          tickets.title AS ticket_title,
          tickets.category,
          tickets.status
        FROM ticket_events
        INNER JOIN tickets ON tickets.id = ticket_events.ticket_id
        ORDER BY datetime(ticket_events.created_at) DESC, ticket_events.id DESC
        LIMIT ?
      `
    )
    .all(limit) as RecentActivity[];
}

export function updateTicketStatus(id: number, input: UpdateTicketStatusInput): Ticket | null {
  const existing = getTicketById(id);

  if (!existing) {
    return null;
  }

  if (!validTransitions[existing.status].includes(input.status)) {
    throw new Error(`Invalid status transition from ${existing.status} to ${input.status}`);
  }

  const now = new Date().toISOString();
  const message = `Your ticket '${existing.title}' is now ${input.status}`;

  const updateTransaction = db.transaction(() => {
    db.prepare(
      `
        UPDATE tickets
        SET status = ?,
            agent_response = COALESCE(?, agent_response),
            internal_notes = COALESCE(?, internal_notes),
            updated_at = ?
        WHERE id = ?
      `
    ).run(input.status, input.agent_response ?? null, input.internal_notes ?? null, now, id);

    db.prepare(
      `
        INSERT INTO notifications (ticket_id, message, is_read, created_at)
        VALUES (?, ?, 0, ?)
      `
    ).run(id, message, now);

    db.prepare(
      `
        INSERT INTO ticket_events (ticket_id, event_type, message, created_at)
        VALUES (?, 'status_changed', ?, ?)
      `
    ).run(id, `Status changed from ${existing.status} to ${input.status}.`, now);

    if (input.agent_response?.trim()) {
      db.prepare(
        `
          INSERT INTO ticket_events (ticket_id, event_type, message, created_at)
          VALUES (?, 'response_added', ?, ?)
        `
      ).run(id, "Agent response added.", now);
    }
  });

  updateTransaction();

  return getTicketById(id);
}

export function updateInternalNotes(id: number, internalNotes: string): Ticket | null {
  if (!getTicketById(id)) {
    return null;
  }

  db.prepare("UPDATE tickets SET internal_notes = ?, updated_at = ? WHERE id = ?").run(
    internalNotes,
    new Date().toISOString(),
    id
  );

  return getTicketById(id);
}

export function updateSatisfactionRating(id: number, rating: number): Ticket | null {
  const ticket = getTicketById(id);

  if (!ticket) {
    return null;
  }

  if (ticket.status !== "Resolved" && ticket.status !== "Closed") {
    throw new Error("Satisfaction can only be added after a ticket is resolved or closed");
  }

  db.prepare("UPDATE tickets SET satisfaction_rating = ?, updated_at = ? WHERE id = ?").run(
    rating,
    new Date().toISOString(),
    id
  );

  return getTicketById(id);
}

export function getNotificationsForEmployee(raisedBy: string): EmployeeNotification[] {
  return db
    .prepare(
      `
        SELECT
          notifications.id,
          notifications.ticket_id,
          notifications.message,
          notifications.is_read,
          notifications.created_at,
          tickets.title AS ticket_title,
          tickets.status AS ticket_status,
          tickets.raised_by
        FROM notifications
        INNER JOIN tickets ON tickets.id = notifications.ticket_id
        WHERE tickets.raised_by = ?
        ORDER BY datetime(notifications.created_at) DESC, notifications.id DESC
      `
    )
    .all(raisedBy) as EmployeeNotification[];
}

export function markNotificationRead(id: number): Notification | null {
  const notification = db.prepare("SELECT * FROM notifications WHERE id = ?").get(id) as Notification | undefined;

  if (!notification) {
    return null;
  }

  db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").run(id);

  return db.prepare("SELECT * FROM notifications WHERE id = ?").get(id) as Notification;
}

export function markAllNotificationsRead(raisedBy: string): number {
  const result = db
    .prepare(
      `
        UPDATE notifications
        SET is_read = 1
        WHERE ticket_id IN (
          SELECT id
          FROM tickets
          WHERE raised_by = ?
        )
      `
    )
    .run(raisedBy);

  return result.changes;
}
