import { Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getTicketById, getTickets } from "../api/client";
import { TicketDetailDrawer } from "../components/TicketDetailDrawer";
import { useToast } from "../components/ToastProvider";
import type { Ticket, TicketCategory, TicketStatus, TicketUrgency } from "../types";
import { formatRelativeTime } from "../utils/date";

const departments: TicketCategory[] = ["IT", "HR", "Finance", "Admin"];
const activeStatuses: TicketStatus[] = ["Open", "In Progress"];
const statuses: Array<TicketStatus | ""> = ["", "Open", "In Progress", "Resolved", "Closed"];
const urgencies: Array<TicketUrgency | ""> = ["", "Low", "Medium", "High", "Critical"];

function statusClassName(status: TicketStatus): string {
  return `status-pill status-${status.toLowerCase().replaceAll(" ", "-")}`;
}

function urgencyDotClassName(urgency: TicketUrgency): string {
  return `urgency-dot urgency-${urgency.toLowerCase()}`;
}

function rowUrgencyClassName(urgency: TicketUrgency): string {
  return `agent-row urgency-border-${urgency.toLowerCase()}`;
}

function getSlaInfo(ticket: Ticket): { label: string; tone: "ok" | "soon" | "overdue" } {
  const hoursByUrgency: Record<TicketUrgency, number> = {
    Critical: 4,
    High: 24,
    Medium: 72,
    Low: 120
  };
  const dueAt = new Date(ticket.created_at).getTime() + hoursByUrgency[ticket.urgency] * 60 * 60 * 1000;
  const hoursLeft = Math.round((dueAt - Date.now()) / (60 * 60 * 1000));

  if (ticket.status === "Resolved" || ticket.status === "Closed") {
    return { label: "Completed", tone: "ok" };
  }

  if (hoursLeft < 0) {
    return { label: "Overdue", tone: "overdue" };
  }

  if (hoursLeft <= 6) {
    return { label: `Due in ${Math.max(hoursLeft, 1)}h`, tone: "soon" };
  }

  return { label: "On track", tone: "ok" };
}

export function AgentQueue() {
  const { showToast } = useToast();
  const [department, setDepartment] = useState<TicketCategory>("IT");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [recentlyUpdatedId, setRecentlyUpdatedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "">("");
  const [urgencyFilter, setUrgencyFilter] = useState<TicketUrgency | "">("");

  const counts = useMemo(
    () =>
      tickets.reduce<Record<TicketStatus, number>>(
        (accumulator, ticket) => {
          accumulator[ticket.status] += 1;
          return accumulator;
        },
        { Open: 0, "In Progress": 0, Resolved: 0, Closed: 0 }
      ),
    [tickets]
  );

  const visibleTickets = useMemo(
    () => (statusFilter ? tickets : tickets.filter((ticket) => activeStatuses.includes(ticket.status))),
    [statusFilter, tickets]
  );

  const loadTickets = () => {
    setIsLoading(true);
    setError("");

    getTickets({
      category: department,
      search: search.trim() || undefined,
      status: statusFilter || undefined,
      urgency: urgencyFilter || undefined
    })
      .then((items) => setTickets(items))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Could not load the queue."))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadTickets();
  }, [department, search, statusFilter, urgencyFilter]);

  const openTicket = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setIsDrawerOpen(true);
    setError("");

    try {
      setSelectedTicket(await getTicketById(ticket.id));
    } catch {
      setSelectedTicket(ticket);
    }
  };

  const handleUpdated = (ticket: Ticket) => {
    setRecentlyUpdatedId(ticket.id);
    showToast(`Ticket "${ticket.title}" updated to ${ticket.status}.`, "success");
    setIsDrawerOpen(false);
    setSelectedTicket(null);

    setTimeout(() => {
      loadTickets();
      setRecentlyUpdatedId(null);
    }, 650);
  };

  return (
    <main className="page">
      <section className="page-header">
        <h1>Agent queue</h1>
        <p>Work through active requests without leaving the department queue.</p>
      </section>

      <section className="filter-bar card">
        <input
          className="control"
          type="search"
          placeholder="Search queue"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select className="control" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as TicketStatus | "")}>
          {statuses.map((status) => (
            <option key={status || "all"} value={status}>
              {status || "Active statuses"}
            </option>
          ))}
        </select>
        <select className="control" value={urgencyFilter} onChange={(event) => setUrgencyFilter(event.target.value as TicketUrgency | "")}>
          {urgencies.map((urgency) => (
            <option key={urgency || "all"} value={urgency}>
              {urgency || "All urgency"}
            </option>
          ))}
        </select>
      </section>

      <section className="agent-toolbar">
        <div className="department-tabs" role="tablist" aria-label="Department">
          {departments.map((item) => (
            <button
              className={`department-tab${department === item ? " active" : ""}`}
              key={item}
              type="button"
              onClick={() => setDepartment(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="status-summary" aria-label="Queue summary">
          <span>{counts.Open} Open</span>
          <span>{counts["In Progress"]} In Progress</span>
          <span>{counts.Resolved} Resolved</span>
          <span>{counts.Closed} Closed</span>
        </div>
      </section>

      <section className="card agent-queue-card">
        <div className="agent-table-header">
          <span>Urgency</span>
          <span>Ticket</span>
          <span>Status</span>
          <span>Raised by</span>
          <span>Created</span>
          <span>SLA</span>
        </div>

        {isLoading ? (
          <div className="agent-skeleton-list">
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
          </div>
        ) : null}
        {error ? <div className="agent-empty-row inline-error">{error}</div> : null}

        {!isLoading && !error && visibleTickets.length === 0 ? (
          <div className="agent-empty-row">No active {department} tickets right now.</div>
        ) : null}

        {!isLoading && !error
          ? visibleTickets.map((ticket) => {
              const sla = getSlaInfo(ticket);
              return (
              <button
                className={`${rowUrgencyClassName(ticket.urgency)}${recentlyUpdatedId === ticket.id ? " just-updated" : ""}`}
                key={ticket.id}
                type="button"
                onClick={() => void openTicket(ticket)}
              >
                <span className="urgency-cell">
                  <span className={urgencyDotClassName(ticket.urgency)} />
                  {ticket.urgency}
                </span>
                <span className="agent-row-title">{ticket.title}</span>
                <span className={statusClassName(ticket.status)}>{ticket.status}</span>
                <span>{ticket.raised_by}</span>
                <span className="agent-created-cell">
                  {recentlyUpdatedId === ticket.id ? <Check size={18} aria-hidden="true" /> : null}
                  {formatRelativeTime(ticket.created_at)}
                </span>
                <span className={`sla-pill sla-${sla.tone}`}>{sla.label}</span>
              </button>
              );
            })
          : null}
      </section>

      <TicketDetailDrawer
        isOpen={isDrawerOpen}
        ticket={selectedTicket}
        onClose={() => setIsDrawerOpen(false)}
        onUpdated={handleUpdated}
      />
    </main>
  );
}
