const Database = require("../node_modules/better-sqlite3");
const path = require("node:path");

const db = new Database(path.resolve(__dirname, "../data/deskline.sqlite"));
db.pragma("foreign_keys = ON");

const existing = db.prepare("SELECT COUNT(*) AS count FROM tickets WHERE raised_by = ?").get("Sample Data");

if (existing.count > 0) {
  console.log({ inserted: 0, reason: "sample data already exists" });
  process.exit(0);
}

const rows = [
  {
    title: "VPN will not connect",
    description: "VPN client times out after authentication from home network.",
    category: "IT",
    urgency: "High",
    status: "Resolved",
    created_at: "2026-06-04T09:15:00.000Z",
    updated_at: "2026-06-04T13:40:00.000Z",
    agent_response: "Reset the VPN profile and refreshed the device certificate. User confirmed access was restored."
  },
  {
    title: "Laptop battery drains fast",
    description: "Laptop shuts down within one hour after a full charge.",
    category: "IT",
    urgency: "High",
    status: "Closed",
    created_at: "2026-06-05T10:25:00.000Z",
    updated_at: "2026-06-06T15:55:00.000Z",
    agent_response: "Battery health failed diagnostics. Replaced the battery and verified normal runtime."
  },
  {
    title: "Email MFA keeps looping",
    description: "After approving MFA, the email app asks for authentication again.",
    category: "IT",
    urgency: "Critical",
    status: "In Progress",
    created_at: "2026-06-17T03:25:00.000Z",
    updated_at: "2026-06-18T13:20:00.000Z",
    agent_response: "Session tokens were cleared. Identity provider logs are under review."
  },
  {
    title: "Payslip not generated",
    description: "Salary was credited but payslip is missing from payroll portal.",
    category: "Finance",
    urgency: "Medium",
    status: "Resolved",
    created_at: "2026-06-07T06:20:00.000Z",
    updated_at: "2026-06-07T10:05:00.000Z",
    agent_response: "Regenerated the payslip and confirmed it is visible in the portal."
  },
  {
    title: "Travel reimbursement pending",
    description: "Travel reimbursement submitted two weeks ago is still pending.",
    category: "Finance",
    urgency: "Low",
    status: "Closed",
    created_at: "2026-06-08T07:35:00.000Z",
    updated_at: "2026-06-09T09:00:00.000Z",
    agent_response: "Expense was missing manager approval. Approval obtained and payment queued."
  },
  {
    title: "Salary account update",
    description: "Need to update salary account before next payroll cycle.",
    category: "Finance",
    urgency: "Medium",
    status: "Open",
    created_at: "2026-06-18T07:05:00.000Z",
    updated_at: "2026-06-18T07:05:00.000Z",
    agent_response: null
  },
  {
    title: "Leave balance incorrect",
    description: "Earned leave balance dropped after team transfer.",
    category: "HR",
    urgency: "Medium",
    status: "Resolved",
    created_at: "2026-06-09T08:45:00.000Z",
    updated_at: "2026-06-10T12:10:00.000Z",
    agent_response: "Synced leave records from the previous reporting unit and corrected the balance."
  },
  {
    title: "Insurance dependent missing",
    description: "Newly added dependent is not visible in benefits portal.",
    category: "HR",
    urgency: "Medium",
    status: "Closed",
    created_at: "2026-06-10T06:50:00.000Z",
    updated_at: "2026-06-12T09:35:00.000Z",
    agent_response: "Benefits vendor confirmed enrollment and portal visibility was restored."
  },
  {
    title: "Remote work policy link broken",
    description: "Remote work policy link in HR portal returns a 404 page.",
    category: "HR",
    urgency: "Low",
    status: "Open",
    created_at: "2026-06-19T08:30:00.000Z",
    updated_at: "2026-06-19T08:30:00.000Z",
    agent_response: null
  },
  {
    title: "Need new monitor",
    description: "Current monitor flickers frequently and affects design review work.",
    category: "Admin",
    urgency: "Medium",
    status: "In Progress",
    created_at: "2026-06-12T11:10:00.000Z",
    updated_at: "2026-06-15T08:30:00.000Z",
    agent_response: "Procurement request approved. Awaiting vendor delivery."
  },
  {
    title: "ID card access blocked",
    description: "ID card stopped working at the main entrance turnstile.",
    category: "Admin",
    urgency: "High",
    status: "Resolved",
    created_at: "2026-06-11T04:50:00.000Z",
    updated_at: "2026-06-11T07:15:00.000Z",
    agent_response: "Reactivated access profile and replaced the worn card sleeve."
  },
  {
    title: "Conference room conflict",
    description: "Same meeting room appears booked by two teams at the same time.",
    category: "Admin",
    urgency: "Low",
    status: "Closed",
    created_at: "2026-06-13T09:40:00.000Z",
    updated_at: "2026-06-13T10:25:00.000Z",
    agent_response: "Removed duplicate calendar resource entry and notified both teams."
  }
];

const insertTicket = db.prepare(`
  INSERT INTO tickets (
    title,
    description,
    category,
    urgency,
    status,
    raised_by,
    created_at,
    updated_at,
    agent_response
  ) VALUES (
    @title,
    @description,
    @category,
    @urgency,
    @status,
    'Sample Data',
    @created_at,
    @updated_at,
    @agent_response
  )
`);

const insertNotification = db.prepare(`
  INSERT INTO notifications (ticket_id, message, is_read, created_at)
  VALUES (?, ?, ?, ?)
`);
const insertEvent = db.prepare(`
  INSERT INTO ticket_events (ticket_id, event_type, message, created_at)
  VALUES (?, ?, ?, ?)
`);

const transaction = db.transaction(() => {
  for (const ticket of rows) {
    const result = insertTicket.run(ticket);
    const ticketId = Number(result.lastInsertRowid);
    insertEvent(ticketId, "created", `Ticket created with ${ticket.urgency} urgency in ${ticket.category}.`, ticket.created_at);

    if (ticket.status !== "Open") {
      insertEvent(ticketId, "status_changed", `Status changed from Open to ${ticket.status}.`, ticket.updated_at);
    }

    if (ticket.agent_response) {
      insertEvent(ticketId, "response_added", "Agent response added.", ticket.updated_at);
    }

    insertNotification.run(
      ticketId,
      `Sample ticket "${ticket.title}" is ${ticket.status.toLowerCase()}.`,
      ticket.status === "Closed" ? 1 : 0,
      ticket.updated_at
    );
  }
});

transaction();

console.log({
  inserted: rows.length,
  total: db.prepare("SELECT COUNT(*) AS count FROM tickets").get().count
});
