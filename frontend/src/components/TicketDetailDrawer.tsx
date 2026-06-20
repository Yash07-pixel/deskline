import { Check, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { draftResponse, updateTicketStatus } from "../api/client";
import { TicketTimeline } from "./TicketTimeline";
import type { Ticket, TicketStatus } from "../types";
import { formatRelativeTime } from "../utils/date";

interface TicketDetailDrawerProps {
  ticket: Ticket | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (ticket: Ticket) => void;
}

const nextStatusOptions: Record<TicketStatus, Array<{ status: TicketStatus; label: string }>> = {
  Open: [
    { status: "In Progress", label: "Move to In Progress" },
    { status: "Resolved", label: "Resolve" }
  ],
  "In Progress": [{ status: "Resolved", label: "Resolve" }],
  Resolved: [{ status: "Closed", label: "Close" }],
  Closed: []
};

function statusClassName(status: TicketStatus): string {
  return `status-pill status-${status.toLowerCase().replaceAll(" ", "-")}`;
}

export function TicketDetailDrawer({ ticket, isOpen, onClose, onUpdated }: TicketDetailDrawerProps) {
  const [responseText, setResponseText] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<TicketStatus | "">("");
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const options = useMemo(() => (ticket ? nextStatusOptions[ticket.status] : []), [ticket]);

  useEffect(() => {
    if (!ticket || !isOpen) {
      setResponseText("");
      setInternalNotes("");
      setSelectedStatus("");
      setError("");
      return;
    }

    setSelectedStatus(options[0]?.status ?? "");
    setInternalNotes(ticket.internal_notes ?? "");
    setError("");

    if (ticket.agent_response) {
      setResponseText(ticket.agent_response);
      setIsDrafting(false);
    }
  }, [isOpen, options, ticket]);

  useEffect(() => {
    if (!ticket || !isOpen || !selectedStatus || ticket.agent_response) {
      return;
    }

    let isCurrent = true;
    setResponseText("");
    setIsDrafting(true);

    draftResponse(ticket.id, selectedStatus)
      .then((result) => {
        if (isCurrent) {
          setResponseText(result.draft);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setResponseText("");
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsDrafting(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [isOpen, selectedStatus, ticket]);

  const handleSave = async () => {
    if (!ticket || !selectedStatus) {
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const updated = await updateTicketStatus(ticket.id, {
        status: selectedStatus,
        agent_response: responseText.trim(),
        internal_notes: internalNotes.trim()
      });
      onUpdated(updated);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update ticket.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`drawer-layer${isOpen ? " open" : ""}`} aria-hidden={!isOpen}>
      <button className="drawer-backdrop" type="button" aria-label="Close ticket detail" onClick={onClose} />
      <aside className="ticket-drawer" aria-label="Ticket detail">
        {ticket ? (
          <>
            <div className="drawer-header">
              <div>
                <div className="ticket-meta">
                  <span>{ticket.category}</span>
                  <span>{ticket.urgency}</span>
                  <span>{formatRelativeTime(ticket.created_at)}</span>
                </div>
                <h2>{ticket.title}</h2>
              </div>
              <button className="drawer-close" type="button" aria-label="Close drawer" onClick={onClose}>
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <div className="drawer-body">
              <div className="drawer-pill-row">
                <span className={statusClassName(ticket.status)}>{ticket.status}</span>
                <span className={`urgency-pill urgency-${ticket.urgency.toLowerCase()}`}>{ticket.urgency}</span>
              </div>

              <section className="detail-section">
                <h3>Raised by</h3>
                <p>{ticket.raised_by}</p>
              </section>

              <section className="detail-section">
                <h3>Description</h3>
                <p>{ticket.description}</p>
              </section>

              <TicketTimeline ticketId={ticket.id} />

              <section className="detail-section">
                <label htmlFor="agent-response">Response</label>
                {isDrafting ? (
                  <div className="textarea-skeleton">
                    <span />
                    <span />
                    <span />
                  </div>
                ) : (
                  <textarea
                    className="control"
                    id="agent-response"
                    placeholder="Type your response..."
                    value={responseText}
                    onChange={(event) => setResponseText(event.target.value)}
                  />
                )}
              </section>

              <section className="detail-section">
                <label htmlFor="internal-notes">Internal notes</label>
                <textarea
                  className="control internal-notes"
                  id="internal-notes"
                  placeholder="Private notes for agents..."
                  value={internalNotes}
                  onChange={(event) => setInternalNotes(event.target.value)}
                />
              </section>

              <section className="detail-section">
                <h3>Status update</h3>
                {options.length > 0 ? (
                  <div className="status-actions">
                    {options.map((option) => (
                      <button
                        className={`segment${selectedStatus === option.status ? " active" : ""}`}
                        key={option.status}
                        type="button"
                        onClick={() => setSelectedStatus(option.status)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="hint">No further status changes are available.</p>
                )}
              </section>

              {error ? <div className="inline-error">{error}</div> : null}
            </div>

            <div className="drawer-footer">
              <button className="secondary-button" type="button" onClick={onClose}>
                Cancel
              </button>
              <button
                className="primary-button"
                disabled={!selectedStatus || isSaving || isDrafting}
                type="button"
                onClick={() => void handleSave()}
              >
                {isSaving ? "Updating..." : "Send & Update"}
              </button>
            </div>
          </>
        ) : (
          <div className="drawer-empty">
            <Check size={24} aria-hidden="true" />
          </div>
        )}
      </aside>
    </div>
  );
}
