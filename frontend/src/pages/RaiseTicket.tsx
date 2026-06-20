import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createTicket, findSimilarTickets, suggestCategory } from "../api/client";
import { useToast } from "../components/ToastProvider";
import type { Ticket, TicketCategory, TicketUrgency } from "../types";

const employeeNameKey = "deskline.employeeName";
const categories: TicketCategory[] = ["IT", "HR", "Finance", "Admin"];
const urgencies: TicketUrgency[] = ["Low", "Medium", "High", "Critical"];

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3).trim()}...`;
}

export function RaiseTicket() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TicketCategory | "">("");
  const [urgency, setUrgency] = useState<TicketUrgency | "">("");
  const [raisedBy, setRaisedBy] = useState("");
  const [similarTicket, setSimilarTicket] = useState<Ticket | null>(null);
  const [isSimilarExpanded, setIsSimilarExpanded] = useState(false);
  const [autoSuggested, setAutoSuggested] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = useMemo(
    () =>
      title.trim().length >= 3 &&
      description.trim().length >= 3 &&
      category !== "" &&
      urgency !== "" &&
      raisedBy.trim().length > 0 &&
      !isSubmitting,
    [category, description, isSubmitting, raisedBy, title, urgency]
  );

  useEffect(() => {
    const trimmedDescription = description.trim();

    if (trimmedDescription.length < 15) {
      setAutoSuggested(false);
      setSimilarTicket(null);
      setIsChecking(false);
      return;
    }

    let isCurrent = true;
    const timeout = window.setTimeout(() => {
      setIsChecking(true);

      Promise.allSettled([
        suggestCategory(trimmedDescription),
        title.trim().length >= 3
          ? findSimilarTickets({ title: title.trim(), description: trimmedDescription })
          : Promise.resolve({ match: null })
      ])
        .then(([categoryResult, similarResult]) => {
          if (!isCurrent) {
            return;
          }

          if (categoryResult.status === "fulfilled" && categoryResult.value.suggested_category) {
            setCategory(categoryResult.value.suggested_category);
            setAutoSuggested(true);
          } else {
            setAutoSuggested(false);
          }

          if (similarResult.status === "fulfilled") {
            setSimilarTicket(similarResult.value.match);
            setIsSimilarExpanded(false);
          } else {
            setSimilarTicket(null);
          }
        })
        .catch(() => {
          if (isCurrent) {
            setAutoSuggested(false);
            setSimilarTicket(null);
          }
        })
        .finally(() => {
          if (isCurrent) {
            setIsChecking(false);
          }
        });
    }, 800);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeout);
    };
  }, [description, title]);

  const persistEmployeeName = (name: string) => {
    localStorage.setItem(employeeNameKey, name);
    window.dispatchEvent(new Event("deskline:name-updated"));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!canSubmit) {
      setError("Please complete the required fields before submitting.");
      return;
    }

    if (!category || !urgency) {
      setError("Please select a category and urgency.");
      return;
    }

    setIsSubmitting(true);

    try {
      persistEmployeeName(raisedBy.trim());
      await createTicket({
        title: title.trim(),
        description: description.trim(),
        category,
        urgency,
        raised_by: raisedBy.trim()
      });
      showToast("Ticket created successfully.", "success");
      setTitle("");
      setDescription("");
      setCategory("");
      setUrgency("");
      setSimilarTicket(null);
      setAutoSuggested(false);
      navigate("/my-tickets");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not create ticket.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="page">
      <section className="page-header">
        <h1>Raise a ticket</h1>
        <p>Share the issue with the right team and keep enough detail for a quick first pass.</p>
      </section>

      <form className="card ticket-form" onSubmit={(event) => void handleSubmit(event)}>
        {error ? <div className="inline-error">{error}</div> : null}

        <div className="form-grid">
          <div className="field full">
            <label htmlFor="ticket-title">Title</label>
            <input
              className="control"
              id="ticket-title"
              minLength={3}
              required
              type="text"
              value={title}
              autoComplete="off"
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Enter a short ticket title"
            />
          </div>

          <div className="field full">
            <label htmlFor="ticket-description">Description</label>
            <textarea
              className="control"
              id="ticket-description"
              minLength={3}
              required
              value={description}
              autoComplete="off"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe the issue"
            />
          </div>

          <div className="field">
            <div className="field-row">
              <label htmlFor="ticket-category">Category</label>
              {autoSuggested ? <span className="hint">Auto-suggested</span> : null}
            </div>
            <select
              className="control"
              id="ticket-category"
              required
              value={category}
              onChange={(event) => {
                setCategory(event.target.value as TicketCategory | "");
                setAutoSuggested(false);
              }}
            >
              <option value="">None</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="raised-by">Raised By</label>
            <input
              className="control"
              id="raised-by"
              required
              type="text"
              value={raisedBy}
              autoComplete="off"
              onBlur={() => {
                if (raisedBy.trim()) {
                  persistEmployeeName(raisedBy.trim());
                }
              }}
              onChange={(event) => setRaisedBy(event.target.value)}
              placeholder="Employee name"
            />
          </div>

          <div className="field full">
            <div className="field-label">Urgency</div>
            <div className="segmented" role="group" aria-label="Urgency">
              {urgencies.map((item) => (
                <button
                  className={`segment${urgency === item ? " active" : ""}`}
                  key={item}
                  type="button"
                  onClick={() => setUrgency(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="form-actions">
          {isChecking ? <span className="hint">Checking details...</span> : null}
          <button className="primary-button" disabled={!canSubmit} type="submit">
            {isSubmitting ? "Submitting..." : "Submit ticket"}
          </button>
        </div>
      </form>

      {similarTicket ? (
        <section className="similar-card card">
          <h2>A similar ticket was already resolved: "{similarTicket.title}"</h2>
          <p>{truncate(similarTicket.agent_response ?? "No resolution note was saved.", 150)}</p>
          {isSimilarExpanded ? (
            <div className="expanded-detail">
              <p>{similarTicket.description}</p>
              {similarTicket.agent_response ? <p>{similarTicket.agent_response}</p> : null}
            </div>
          ) : null}
          <button className="secondary-button" type="button" onClick={() => setIsSimilarExpanded((value) => !value)}>
            {isSimilarExpanded ? "Hide details" : "View details"}
          </button>
        </section>
      ) : null}
    </main>
  );
}
