import { Router } from "express";
import { db } from "../db/db.js";
import { getRecentActivity } from "../db/ticketRepository.js";
import type { TicketCategory, TicketStatus } from "../db/schema.js";

export const analyticsRouter = Router();

interface CountRow<T extends string> {
  name: T;
  count: number;
}

interface DayRow {
  date: string;
  count: number;
}

const statuses: TicketStatus[] = ["Open", "In Progress", "Resolved", "Closed"];
const categories: TicketCategory[] = ["IT", "HR", "Finance", "Admin"];

analyticsRouter.get("/", (_req, res) => {
  try {
    const totalTickets = db.prepare("SELECT COUNT(*) AS count FROM tickets").get() as { count: number };
    const statusRows = db
      .prepare("SELECT status AS name, COUNT(*) AS count FROM tickets GROUP BY status")
      .all() as Array<CountRow<TicketStatus>>;
    const categoryRows = db
      .prepare("SELECT category AS name, COUNT(*) AS count FROM tickets GROUP BY category")
      .all() as Array<CountRow<TicketCategory>>;
    const avgResolution = db
      .prepare(
        `
          SELECT AVG((julianday(updated_at) - julianday(created_at)) * 24.0) AS hours
          FROM tickets
          WHERE status IN ('Resolved', 'Closed')
        `
      )
      .get() as { hours: number | null };
    const dayRows = db
      .prepare(
        `
          WITH RECURSIVE days(day, step) AS (
            SELECT date('now', '-13 days'), 0
            UNION ALL
            SELECT date(day, '+1 day'), step + 1
            FROM days
            WHERE step < 13
          )
          SELECT days.day AS date, COUNT(tickets.id) AS count
          FROM days
          LEFT JOIN tickets ON date(tickets.created_at) = days.day
          GROUP BY days.day
          ORDER BY days.day ASC
        `
      )
      .all() as DayRow[];

    const byStatus = statuses.reduce<Record<TicketStatus, number>>(
      (accumulator, status) => ({
        ...accumulator,
        [status]: statusRows.find((row) => row.name === status)?.count ?? 0
      }),
      { Open: 0, "In Progress": 0, Resolved: 0, Closed: 0 }
    );
    const byCategory = categories.reduce<Record<TicketCategory, number>>(
      (accumulator, category) => ({
        ...accumulator,
        [category]: categoryRows.find((row) => row.name === category)?.count ?? 0
      }),
      { IT: 0, HR: 0, Finance: 0, Admin: 0 }
    );
    const busiestCategory = categories.reduce(
      (busiest, category) => (byCategory[category] > busiest.count ? { name: category, count: byCategory[category] } : busiest),
      { name: "IT", count: byCategory.IT }
    );

    res.json({
      total_tickets: totalTickets.count,
      by_status: byStatus,
      by_category: byCategory,
      avg_resolution_hours: Number((avgResolution.hours ?? 0).toFixed(2)),
      busiest_category: {
        name: busiestCategory.name,
        percentage: totalTickets.count > 0 ? Number(((busiestCategory.count / totalTickets.count) * 100).toFixed(1)) : 0
      },
      tickets_by_day: dayRows,
      recent_activity: getRecentActivity(8),
      avg_satisfaction:
        (db
          .prepare("SELECT AVG(satisfaction_rating) AS rating FROM tickets WHERE satisfaction_rating IS NOT NULL")
          .get() as { rating: number | null }).rating ?? null
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load analytics" });
  }
});
