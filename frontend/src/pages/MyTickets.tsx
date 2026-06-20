import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getTickets, updateSatisfactionRating } from "../api/client";
import { TicketTimeline } from "../components/TicketTimeline";
import type { Ticket, TicketStatus, TicketUrgency } from "../types";
import { formatRelativeTime } from "../utils/date";

const employeeNameKey = "deskline.employeeName";
const statuses: Array<TicketStatus | ""> = ["", "Open", "In Progress", "Resolved", "Closed"];
const urgencies: Array<TicketUrgency | ""> = ["", "Low", "Medium", "High", "Critical"];

function statusClassName(status: TicketStatus): string {
  return `status-pill status-${status.toLowerCase().replaceAll(" ", "-")}`;
}

export function MyTickets() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [employeeName, setEmployeeName] = useState(() => localStorage.getItem(employeeNameKey) ?? "");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [expandedTicketId, setExpandedTicketId] = useState<number | null>(() => {
    const ticketId = Number(searchParams.get("ticket"));
    return Number.isInteger(ticketId) && ticketId > 0 ? ticketId : null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "">("");
  const [urgencyFilter, setUrgencyFilter] = useState<TicketUrgency | "">("");

  const hasName = useMemo(() => employeeName.trim().length > 0, [employeeName]);

  useEffect(() => {
    const syncName = () => setEmployeeName(localStorage.getItem(employeeNameKey) ?? "");

    window.addEventListener("deskline:name-updated", syncName);
    window.addEventListener("storage", syncName);

    return () => {
      window.removeEventListener("deskline:name-updated", syncName);
      window.removeEventListener("storage", syncName);
    };
  }, []);

  useEffect(() => {
    const ticketId = Number(searchParams.get("ticket"));

    if (Number.isInteger(ticketId) && ticketId > 0) {
      setExpandedTicketId(ticketId);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!hasName) {
      setTickets([]);
      return;
    }

    let isCurrent = true;
    setIsLoading(true);
    setError("");

    getTickets({
      raised_by: employeeName.trim(),
      search: search.trim() || undefined,
      status: statusFilter || undefined,
      urgency: urgencyFilter || undefined
    })
      .then((items) => {
        if (isCurrent) {
          setTickets(items);
        }
      })
      .catch((loadError) => {
        if (isCurrent) {
          setError(loadError instanceof Error ? loadError.message : "Could not load tickets.");
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
  }, [employeeName, hasName, search, statusFilter, urgencyFilter]);

  const toggleTicket = (ticketId: number) => {
    setExpandedTicketId((current) => {
      const next = current === ticketId ? null : ticketId;

      if (next) {
        setSearchParams({ ticket: String(next) });
      } else {
        setSearchParams({});
      }

      return next;
    });
  };

  const rateTicket = async (ticketId: number, rating: number) => {
    const updated = await updateSatisfactionRating(ticketId, rating);
    setTickets((current) => current.map((ticket) => (ticket.id === ticketId ? updated : ticket)));
  };

  return (
    <main className="page">
      <section className="page-header">
        <h1>My tickets</h1>
        <p>Track requests you have raised and read the latest updates from support teams.</p>
      </section>

      {!hasName ? (
        <section className="card empty-state">
          <h2>No employee name saved yet</h2>
          <p className="hint">Raise a ticket first, or enter your name on the ticket form, and your requests will appear here.</p>
          <Link className="primary-button" to="/raise-ticket">
            Raise a ticket
          </Link>
        </section>
      ) : null}

      {hasName ? (
        <section className="filter-bar card">
          <input
            className="control"
            type="search"
            placeholder="Search your tickets"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select className="control" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as TicketStatus | "")}>
            {statuses.map((status) => (
              <option key={status || "all"} value={status}>
                {status || "All statuses"}
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
      ) : null}

      {hasName && isLoading ? (
        <div className="tickets-list">
          <div className="card ticket-card skeleton-ticket" />
          <div className="card ticket-card skeleton-ticket" />
          <div className="card ticket-card skeleton-ticket" />
        </div>
      ) : null}
      {hasName && error ? <div className="inline-error">{error}</div> : null}

      {hasName && !isLoading && tickets.length === 0 ? (
        <section className="card empty-state">
          <h2>No tickets yet</h2>
          <p className="hint">When you raise your first request, it will show up here with status updates.</p>
          <Link className="primary-button" to="/raise-ticket">
            Raise the first ticket
          </Link>
        </section>
      ) : null}

      {tickets.length > 0 ? (
        <section className="tickets-list">
          {tickets.map((ticket) => {
            const isExpanded = expandedTicketId === ticket.id;

            return (
              <article className="card ticket-card" key={ticket.id}>
                <button className="ticket-summary-button" type="button" onClick={() => toggleTicket(ticket.id)}>
                  <div className="ticket-topline">
                    <div>
                      <h2 className="ticket-title">{ticket.title}</h2>
                      <div className="ticket-meta">
                        <span>{ticket.category}</span>
                        <span>{ticket.urgency}</span>
                        <span>{formatRelativeTime(ticket.created_at)}</span>
                      </div>
                    </div>
                    <span className={statusClassName(ticket.status)}>{ticket.status}</span>
                  </div>
                </button>
                {isExpanded ? (
                  <div className="expanded-detail">
                    <p>{ticket.description}</p>
                    {ticket.agent_response ? <p>{ticket.agent_response}</p> : <p className="hint">No agent response yet.</p>}
                    {ticket.status === "Resolved" || ticket.status === "Closed" ? (
                      <section className="rating-section">
                        <h3>Rate this resolution</h3>
                        <div className="rating-buttons" aria-label="Satisfaction rating">
                          {[1, 2, 3, 4, 5].map((rating) => (
                            <button
                              className={ticket.satisfaction_rating && ticket.satisfaction_rating >= rating ? "active" : ""}
                              key={rating}
                              type="button"
                              onClick={() => void rateTicket(ticket.id, rating)}
                            >
                              ★
                            </button>
                          ))}
                        </div>
                      </section>
                    ) : null}
                    <TicketTimeline ticketId={ticket.id} />
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : null}
    </main>
  );
}
