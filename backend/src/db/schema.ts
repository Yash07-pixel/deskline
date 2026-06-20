import type { Database } from "better-sqlite3";

export type TicketCategory = "IT" | "HR" | "Finance" | "Admin";
export type TicketUrgency = "Low" | "Medium" | "High" | "Critical";
export type TicketStatus = "Open" | "In Progress" | "Resolved" | "Closed";

export interface Ticket {
  id: number;
  title: string;
  description: string;
  category: TicketCategory;
  urgency: TicketUrgency;
  status: TicketStatus;
  raised_by: string;
  created_at: string;
  updated_at: string;
  agent_response: string | null;
  internal_notes: string | null;
  satisfaction_rating: number | null;
}

export interface Notification {
  id: number;
  ticket_id: number;
  message: string;
  is_read: 0 | 1;
  created_at: string;
}

export interface TicketEvent {
  id: number;
  ticket_id: number;
  event_type: "created" | "status_changed" | "response_added";
  message: string;
  created_at: string;
}

export function initializeSchema(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('IT', 'HR', 'Finance', 'Admin')),
      urgency TEXT NOT NULL CHECK (urgency IN ('Low', 'Medium', 'High', 'Critical')),
      status TEXT NOT NULL CHECK (status IN ('Open', 'In Progress', 'Resolved', 'Closed')),
      raised_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      agent_response TEXT,
      internal_notes TEXT,
      satisfaction_rating INTEGER CHECK (satisfaction_rating IS NULL OR satisfaction_rating BETWEEN 1 AND 5)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ticket_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      event_type TEXT NOT NULL CHECK (event_type IN ('created', 'status_changed', 'response_added')),
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
    CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category);
    CREATE INDEX IF NOT EXISTS idx_notifications_ticket_id ON notifications(ticket_id);
    CREATE INDEX IF NOT EXISTS idx_ticket_events_ticket_id ON ticket_events(ticket_id);
  `);

  const columns = db.prepare("PRAGMA table_info(tickets)").all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has("internal_notes")) {
    db.exec("ALTER TABLE tickets ADD COLUMN internal_notes TEXT");
  }

  if (!columnNames.has("satisfaction_rating")) {
    db.exec("ALTER TABLE tickets ADD COLUMN satisfaction_rating INTEGER CHECK (satisfaction_rating IS NULL OR satisfaction_rating BETWEEN 1 AND 5)");
  }
}
