import type {
  AnalyticsSummary,
  CreateTicketInput,
  EmployeeNotification,
  Ticket,
  TicketCategory,
  TicketEvent,
  TicketListFilters,
  TicketStatus,
  UpdateTicketStatusInput
} from "../types";

function normalizeApiBaseUrl(value: string): string {
  const baseUrl = value.replace(/\/$/, "");

  if (baseUrl === "/api" || baseUrl.endsWith("/api")) {
    return baseUrl;
  }

  return `${baseUrl}/api`;
}

const API_BASE_URL = normalizeApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.PROD ? "https://deskline.onrender.com/api" : "/api")
);

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    },
    ...options
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const body = (await response.json()) as { error?: string };
      message = body.error ?? message;
    } catch {
      // Keep the status-based message if the response is not JSON.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function createTicket(input: CreateTicketInput): Promise<Ticket> {
  return apiRequest<Ticket>("/tickets", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function getTicketsByEmployee(raisedBy: string): Promise<Ticket[]> {
  return getTickets({ raised_by: raisedBy });
}

export function getTicketsByCategory(category: TicketCategory): Promise<Ticket[]> {
  return getTickets({ category });
}

export function getTickets(filters: TicketListFilters): Promise<Ticket[]> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, value);
    }
  }

  return apiRequest<Ticket[]>(`/tickets?${params.toString()}`);
}

export function getTicketById(id: number): Promise<Ticket> {
  return apiRequest<Ticket>(`/tickets/${id}`);
}

export function getTicketActivity(id: number): Promise<TicketEvent[]> {
  return apiRequest<TicketEvent[]>(`/tickets/${id}/activity`);
}

export function updateTicketStatus(id: number, input: UpdateTicketStatusInput): Promise<Ticket> {
  return apiRequest<Ticket>(`/tickets/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function updateInternalNotes(id: number, internalNotes: string): Promise<Ticket> {
  return apiRequest<Ticket>(`/tickets/${id}/internal-notes`, {
    method: "PATCH",
    body: JSON.stringify({ internal_notes: internalNotes })
  });
}

export function updateSatisfactionRating(id: number, rating: number): Promise<Ticket> {
  return apiRequest<Ticket>(`/tickets/${id}/satisfaction`, {
    method: "PATCH",
    body: JSON.stringify({ rating })
  });
}

export function getNotifications(raisedBy: string): Promise<EmployeeNotification[]> {
  return apiRequest<EmployeeNotification[]>(`/notifications?raised_by=${encodeURIComponent(raisedBy)}`);
}

export function markNotificationRead(id: number): Promise<EmployeeNotification> {
  return apiRequest<EmployeeNotification>(`/notifications/${id}/read`, {
    method: "PATCH"
  });
}

export function suggestCategory(description: string): Promise<{ suggested_category: TicketCategory | null }> {
  return apiRequest<{ suggested_category: TicketCategory | null }>("/ai/suggest-category", {
    method: "POST",
    body: JSON.stringify({ description })
  });
}

export function findSimilarTickets(input: {
  title: string;
  description: string;
}): Promise<{ match: Ticket | null }> {
  return apiRequest<{ match: Ticket | null }>("/ai/similar-tickets", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function draftResponse(ticketId: number, targetStatus?: TicketStatus): Promise<{ draft: string }> {
  return apiRequest<{ draft: string }>("/ai/draft-response", {
    method: "POST",
    body: JSON.stringify({ ticket_id: ticketId, target_status: targetStatus })
  });
}

export function getAnalytics(): Promise<AnalyticsSummary> {
  return apiRequest<AnalyticsSummary>("/analytics");
}
