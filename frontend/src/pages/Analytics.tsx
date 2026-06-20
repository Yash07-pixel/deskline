import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { getAnalytics } from "../api/client";
import type { AnalyticsSummary, TicketCategory, TicketStatus } from "../types";

const categoryOrder: TicketCategory[] = ["IT", "HR", "Finance", "Admin"];
const statusOrder: TicketStatus[] = ["Open", "In Progress", "Resolved", "Closed"];
const statusColors: Record<TicketStatus, string> = {
  Open: "#3B82F6",
  "In Progress": "#F59E0B",
  Resolved: "#10B981",
  Closed: "#6B7280"
};

function formatResolution(hours: number): string {
  if (hours <= 0) {
    return "0 hours";
  }

  if (hours >= 24) {
    return `${(hours / 24).toFixed(1)} days`;
  }

  return `${hours.toFixed(1)} hours`;
}

function formatChartDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function buildAnalyticsCsv(analytics: AnalyticsSummary): string {
  const rows = [
    ["Metric", "Value"],
    ["Total Tickets", String(analytics.total_tickets)],
    ["Open", String(analytics.by_status.Open)],
    ["In Progress", String(analytics.by_status["In Progress"])],
    ["Resolved", String(analytics.by_status.Resolved)],
    ["Closed", String(analytics.by_status.Closed)],
    ["Avg Resolution Hours", String(analytics.avg_resolution_hours)],
    ["Avg Satisfaction", analytics.avg_satisfaction === null ? "" : analytics.avg_satisfaction.toFixed(2)],
    [],
    ["Category", "Count"],
    ...categoryOrder.map((category) => [category, String(analytics.by_category[category])]),
    [],
    ["Date", "Created Tickets"],
    ...analytics.tickets_by_day.map((day) => [day.date, String(day.count)])
  ];

  return rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
}

export function Analytics() {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setError("");

    getAnalytics()
      .then((result) => {
        if (isCurrent) {
          setAnalytics(result);
        }
      })
      .catch((loadError) => {
        if (isCurrent) {
          setError(loadError instanceof Error ? loadError.message : "Could not load analytics.");
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const categoryData = useMemo(
    () => categoryOrder.map((category) => ({ name: category, count: analytics?.by_category[category] ?? 0 })),
    [analytics]
  );
  const statusData = useMemo(
    () => statusOrder.map((status) => ({ name: status, value: analytics?.by_status[status] ?? 0 })),
    [analytics]
  );
  const trendData = useMemo(
    () => analytics?.tickets_by_day.map((item) => ({ ...item, label: formatChartDate(item.date) })) ?? [],
    [analytics]
  );

  const exportCsv = () => {
    if (!analytics) {
      return;
    }

    const blob = new Blob([buildAnalyticsCsv(analytics)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "deskline-analytics.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="page">
      <section className="page-header">
        <h1>Analytics</h1>
        <p>Track workload, resolution pace, and daily intake across Deskline.</p>
        {analytics ? (
          <button className="secondary-button analytics-export" type="button" onClick={exportCsv}>
            Export CSV
          </button>
        ) : null}
      </section>

      {isLoading ? (
        <section className="analytics-grid stats-grid">
          <div className="card stat-card skeleton-block" />
          <div className="card stat-card skeleton-block" />
          <div className="card stat-card skeleton-block" />
          <div className="card stat-card skeleton-block" />
        </section>
      ) : null}

      {error ? <div className="inline-error">{error}</div> : null}

      {analytics && !isLoading ? (
        <>
          <section className="analytics-grid stats-grid">
            <article className="card stat-card">
              <span>Total Tickets</span>
              <strong>{analytics.total_tickets}</strong>
            </article>
            <article className="card stat-card">
              <span>Open</span>
              <strong>{analytics.by_status.Open}</strong>
            </article>
            <article className="card stat-card">
              <span>Avg Resolution Time</span>
              <strong>{formatResolution(analytics.avg_resolution_hours)}</strong>
            </article>
            <article className="card stat-card">
              <span>Busiest Department</span>
              <strong>{analytics.busiest_category.name}</strong>
              <small>{analytics.busiest_category.percentage}% of tickets</small>
            </article>
            <article className="card stat-card">
              <span>Avg Satisfaction</span>
              <strong>{analytics.avg_satisfaction === null ? "—" : analytics.avg_satisfaction.toFixed(1)}</strong>
              <small>out of 5</small>
            </article>
          </section>

          <section className="analytics-grid chart-grid">
            <article className="card chart-card chart-card-wide">
              <h2>Tickets by category</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={categoryData}>
                  <CartesianGrid stroke="#dfd4c8" vertical={false} />
                  <XAxis dataKey="name" stroke="#75665d" />
                  <YAxis allowDecimals={false} stroke="#75665d" />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8B5A3C" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </article>

            <article className="card chart-card">
              <h2>Tickets by status</h2>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={98} paddingAngle={2}>
                    {statusData.map((entry) => (
                      <Cell fill={statusColors[entry.name]} key={entry.name} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="chart-legend">
                {statusData.map((item) => (
                  <span key={item.name}>
                    <i style={{ background: statusColors[item.name] }} />
                    {item.name}
                  </span>
                ))}
              </div>
            </article>

            <article className="card chart-card chart-card-full">
              <h2>Tickets created per day</h2>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trendData}>
                  <CartesianGrid stroke="#dfd4c8" vertical={false} />
                  <XAxis dataKey="label" stroke="#75665d" />
                  <YAxis allowDecimals={false} stroke="#75665d" />
                  <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ""} />
                  <Line type="monotone" dataKey="count" stroke="#8B5A3C" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </article>

            <article className="card chart-card chart-card-full recent-activity-card">
              <h2>Recent activity</h2>
              <ol className="recent-activity-list">
                {analytics.recent_activity.map((event) => (
                  <li key={event.id}>
                    <span className={`timeline-dot event-${event.event_type}`} />
                    <div>
                      <strong>{event.ticket_title}</strong>
                      <p>{event.message}</p>
                      <small>
                        {event.category} · {event.status} · {formatChartDate(event.created_at.slice(0, 10))}
                      </small>
                    </div>
                  </li>
                ))}
              </ol>
            </article>
          </section>
        </>
      ) : null}
    </main>
  );
}
