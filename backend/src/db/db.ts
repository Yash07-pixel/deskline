import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeSchema, type Ticket } from "./schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "../../data");
const dbPath = path.join(dataDir, "deskline.sqlite");

mkdirSync(dataDir, { recursive: true });

export const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

initializeSchema(db);
if (process.env.SEED_SAMPLE_DATA === "true") {
  seedTickets();
}

type SeedTicket = Omit<Ticket, "id" | "internal_notes" | "satisfaction_rating">;

function seedTickets(): void {
  const existingCount = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE raised_by = 'Sample Data'").get() as {
    count: number;
  };

  if (existingCount.count > 0) {
    return;
  }

  const tickets: SeedTicket[] = [
    {
      title: "VPN won't connect from home network",
      description: "The VPN client times out after authentication and I cannot access internal tools.",
      category: "IT",
      urgency: "High",
      status: "Resolved",
      raised_by: "Sample Data",
      created_at: "2026-04-03T09:15:00.000Z",
      updated_at: "2026-04-03T13:40:00.000Z",
      agent_response: "Reset the VPN profile and refreshed device certificates. User confirmed access is restored."
    },
    {
      title: "Payslip not generated for May",
      description: "My May payslip is missing from the employee portal although salary was credited.",
      category: "Finance",
      urgency: "Medium",
      status: "Closed",
      raised_by: "Sample Data",
      created_at: "2026-05-31T06:20:00.000Z",
      updated_at: "2026-06-01T10:05:00.000Z",
      agent_response: "Regenerated the payslip and confirmed it is visible in the portal."
    },
    {
      title: "Need new monitor for design workstation",
      description: "Current monitor flickers frequently and affects UI review work.",
      category: "Admin",
      urgency: "Medium",
      status: "In Progress",
      raised_by: "Sample Data",
      created_at: "2026-06-12T11:10:00.000Z",
      updated_at: "2026-06-15T08:30:00.000Z",
      agent_response: "Procurement request approved. Awaiting vendor delivery."
    },
    {
      title: "Leave balance incorrect after transfer",
      description: "My earned leave balance dropped after moving teams last month.",
      category: "HR",
      urgency: "Medium",
      status: "Resolved",
      raised_by: "Sample Data",
      created_at: "2026-05-10T08:45:00.000Z",
      updated_at: "2026-05-11T12:10:00.000Z",
      agent_response: "Synced leave records from the previous reporting unit and corrected the balance."
    },
    {
      title: "Laptop battery drains within one hour",
      description: "The laptop shuts down quickly even after a full charge.",
      category: "IT",
      urgency: "High",
      status: "Closed",
      raised_by: "Sample Data",
      created_at: "2026-03-18T10:25:00.000Z",
      updated_at: "2026-03-19T15:55:00.000Z",
      agent_response: "Battery health failed diagnostics. Replaced battery and verified normal runtime."
    },
    {
      title: "Reimbursement pending for client travel",
      description: "Travel reimbursement submitted two weeks ago is still showing as pending.",
      category: "Finance",
      urgency: "Low",
      status: "Resolved",
      raised_by: "Sample Data",
      created_at: "2026-04-22T07:35:00.000Z",
      updated_at: "2026-04-24T09:00:00.000Z",
      agent_response: "Expense was missing manager approval. Approval obtained and payment queued."
    },
    {
      title: "ID card access blocked at main entrance",
      description: "My ID card stopped working at the main entrance turnstile today.",
      category: "Admin",
      urgency: "High",
      status: "Resolved",
      raised_by: "Sample Data",
      created_at: "2026-05-06T04:50:00.000Z",
      updated_at: "2026-05-06T07:15:00.000Z",
      agent_response: "Reactivated access profile and replaced worn card sleeve."
    },
    {
      title: "Incorrect tax declaration status",
      description: "The finance portal shows my tax declaration as not submitted even though I completed it.",
      category: "Finance",
      urgency: "Medium",
      status: "Closed",
      raised_by: "Sample Data",
      created_at: "2026-02-15T12:05:00.000Z",
      updated_at: "2026-02-16T11:30:00.000Z",
      agent_response: "Fixed a sync issue between payroll and finance portal records."
    },
    {
      title: "Onboarding checklist missing new hire tasks",
      description: "My onboarding dashboard does not show laptop pickup or policy acknowledgement tasks.",
      category: "HR",
      urgency: "Low",
      status: "Resolved",
      raised_by: "Sample Data",
      created_at: "2026-01-09T09:00:00.000Z",
      updated_at: "2026-01-09T14:45:00.000Z",
      agent_response: "Assigned the correct onboarding template for the role."
    },
    {
      title: "Printer on floor 5 is offline",
      description: "The shared printer near conference room 5B is offline for everyone.",
      category: "IT",
      urgency: "Medium",
      status: "Closed",
      raised_by: "Sample Data",
      created_at: "2026-04-08T05:30:00.000Z",
      updated_at: "2026-04-08T08:20:00.000Z",
      agent_response: "Cleared print queue, updated network mapping, and restarted the printer."
    },
    {
      title: "Conference room booking conflict",
      description: "The same meeting room appears booked by two teams at the same time.",
      category: "Admin",
      urgency: "Low",
      status: "Resolved",
      raised_by: "Sample Data",
      created_at: "2026-05-18T09:40:00.000Z",
      updated_at: "2026-05-18T10:25:00.000Z",
      agent_response: "Removed duplicate calendar resource entry and notified both teams."
    },
    {
      title: "Health insurance dependent not visible",
      description: "My newly added dependent is not visible in the benefits portal.",
      category: "HR",
      urgency: "Medium",
      status: "Closed",
      raised_by: "Sample Data",
      created_at: "2026-03-02T06:50:00.000Z",
      updated_at: "2026-03-04T09:35:00.000Z",
      agent_response: "Benefits vendor confirmed enrollment and portal visibility was restored."
    },
    {
      title: "Cannot access shared finance folder",
      description: "Access to the quarterly budget shared folder is denied after role change.",
      category: "IT",
      urgency: "High",
      status: "Resolved",
      raised_by: "Sample Data",
      created_at: "2026-06-05T10:00:00.000Z",
      updated_at: "2026-06-05T16:10:00.000Z",
      agent_response: "Updated group membership based on the new role."
    },
    {
      title: "Desk chair adjustment lever broken",
      description: "The chair at workstation B-214 does not hold height adjustment.",
      category: "Admin",
      urgency: "Low",
      status: "Closed",
      raised_by: "Sample Data",
      created_at: "2026-02-28T11:25:00.000Z",
      updated_at: "2026-03-01T08:15:00.000Z",
      agent_response: "Facilities replaced the chair with a serviced unit."
    },
    {
      title: "Salary account update request",
      description: "I need to update my salary account before the next payroll cycle.",
      category: "Finance",
      urgency: "Medium",
      status: "Open",
      raised_by: "Sample Data",
      created_at: "2026-06-18T07:05:00.000Z",
      updated_at: "2026-06-18T07:05:00.000Z",
      agent_response: null
    },
    {
      title: "HR policy document link is broken",
      description: "The remote work policy link in the HR portal returns a 404 page.",
      category: "HR",
      urgency: "Low",
      status: "Resolved",
      raised_by: "Sample Data",
      created_at: "2026-04-14T12:35:00.000Z",
      updated_at: "2026-04-15T05:45:00.000Z",
      agent_response: "Updated the policy link to the current document repository."
    },
    {
      title: "MFA prompt looping on email login",
      description: "After approving MFA, the email app asks me to authenticate again repeatedly.",
      category: "IT",
      urgency: "Critical",
      status: "In Progress",
      raised_by: "Sample Data",
      created_at: "2026-06-17T03:25:00.000Z",
      updated_at: "2026-06-18T13:20:00.000Z",
      agent_response: "Session tokens were cleared. Identity provider logs are under review."
    },
    {
      title: "Form 16 download unavailable",
      description: "The Form 16 download button is disabled in the payroll portal.",
      category: "Finance",
      urgency: "High",
      status: "Closed",
      raised_by: "Sample Data",
      created_at: "2026-06-02T08:10:00.000Z",
      updated_at: "2026-06-03T06:55:00.000Z",
      agent_response: "Published corrected Form 16 files after payroll vendor reprocessing."
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
      @raised_by,
      @created_at,
      @updated_at,
      @agent_response
    )
  `);

  const insertNotification = db.prepare(`
    INSERT INTO notifications (ticket_id, message, is_read, created_at)
    VALUES (?, ?, ?, ?)
  `);

  const transaction = db.transaction((seedData: SeedTicket[]) => {
    for (const ticket of seedData) {
      const result = insertTicket.run(ticket);
      const ticketId = Number(result.lastInsertRowid);
      db.prepare(
        `
          INSERT INTO ticket_events (ticket_id, event_type, message, created_at)
          VALUES (?, 'created', ?, ?)
        `
      ).run(ticketId, `Ticket created with ${ticket.urgency} urgency in ${ticket.category}.`, ticket.created_at);

      if (ticket.status !== "Open") {
        db.prepare(
          `
            INSERT INTO ticket_events (ticket_id, event_type, message, created_at)
            VALUES (?, 'status_changed', ?, ?)
          `
        ).run(ticketId, `Status changed from Open to ${ticket.status}.`, ticket.updated_at);
      }

      if (ticket.agent_response) {
        db.prepare(
          `
            INSERT INTO ticket_events (ticket_id, event_type, message, created_at)
            VALUES (?, 'response_added', 'Agent response added.', ?)
          `
        ).run(ticketId, ticket.updated_at);
      }

      const message =
        ticket.status === "Open" || ticket.status === "In Progress"
          ? `Ticket "${ticket.title}" is awaiting agent action.`
          : `Ticket "${ticket.title}" was ${ticket.status.toLowerCase()}.`;

      insertNotification.run(ticketId, message, ticket.status === "Closed" ? 1 : 0, ticket.updated_at);
    }
  });

  transaction(tickets);
}
