const Database = require("../node_modules/better-sqlite3");
const path = require("node:path");

const db = new Database(path.resolve(__dirname, "../data/deskline.sqlite"));

db.exec(`
  CREATE TABLE IF NOT EXISTS ticket_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('created', 'status_changed', 'response_added')),
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_ticket_events_ticket_id ON ticket_events(ticket_id);
`);

const tickets = db
  .prepare(
    `
      SELECT *
      FROM tickets
      WHERE id NOT IN (
        SELECT DISTINCT ticket_id
        FROM ticket_events
      )
    `
  )
  .all();

const insertEvent = db.prepare(`
  INSERT INTO ticket_events (ticket_id, event_type, message, created_at)
  VALUES (?, ?, ?, ?)
`);

const transaction = db.transaction(() => {
  for (const ticket of tickets) {
    insertEvent.run(
      ticket.id,
      "created",
      `Ticket created with ${ticket.urgency} urgency in ${ticket.category}.`,
      ticket.created_at
    );

    if (ticket.status !== "Open") {
      insertEvent.run(ticket.id, "status_changed", `Status changed from Open to ${ticket.status}.`, ticket.updated_at);
    }

    if (ticket.agent_response) {
      insertEvent.run(ticket.id, "response_added", "Agent response added.", ticket.updated_at);
    }
  }
});

transaction();

console.log({
  backfilled: tickets.length,
  events: db.prepare("SELECT COUNT(*) AS count FROM ticket_events").get().count
});
