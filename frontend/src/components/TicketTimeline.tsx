import { useEffect, useState } from "react";
import { getTicketActivity } from "../api/client";
import type { TicketEvent } from "../types";
import { formatRelativeTime } from "../utils/date";

export function TicketTimeline({ ticketId }: { ticketId: number }) {
  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);

    getTicketActivity(ticketId)
      .then((items) => {
        if (isCurrent) {
          setEvents(items);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setEvents([]);
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
  }, [ticketId]);

  return (
    <section className="timeline-section">
      <h3>Activity</h3>
      {isLoading ? <div className="timeline-loading">Loading activity...</div> : null}
      {!isLoading && events.length === 0 ? <p className="hint">No activity recorded yet.</p> : null}
      {events.length > 0 ? (
        <ol className="ticket-timeline">
          {events.map((event) => (
            <li key={event.id}>
              <span className={`timeline-dot event-${event.event_type}`} />
              <div>
                <strong>{event.message}</strong>
                <small>{formatRelativeTime(event.created_at)}</small>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
