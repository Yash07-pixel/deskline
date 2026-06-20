export type TicketCategory = "IT" | "HR" | "Finance" | "Admin";
export type TicketUrgency = "Low" | "Medium" | "High" | "Critical";
export type TicketStatus = "Open" | "In Progress" | "Resolved" | "Closed";

export interface Ticket {
  id: number;
  title: string;
  description: string;
  category: TicketCategory;
  urgency: TicketUrgency;
  status: TicketStatus;
  raised_by: string;
  created_at: string;
  updated_at: string;
  agent_response: string | null;
  internal_notes: string | null;
  satisfaction_rating: number | null;
}

export interface Notification {
  id: number;
  ticket_id: number;
  message: string;
  is_read: 0 | 1;
  created_at: string;
}

export interface TicketEvent {
  id: number;
  ticket_id: number;
  event_type: "created" | "status_changed" | "response_added";
  message: string;
  created_at: string;
}

export interface EmployeeNotification extends Notification {
  ticket_title: string;
  ticket_status: TicketStatus;
  raised_by: string;
}

export interface CreateTicketInput {
  title: string;
  description: string;
  category: TicketCategory;
  urgency: TicketUrgency;
  raised_by: string;
}

export interface UpdateTicketStatusInput {
  status: TicketStatus;
  agent_response?: string;
  internal_notes?: string;
}

export interface TicketListFilters {
  raised_by?: string;
  category?: TicketCategory;
  status?: TicketStatus;
  urgency?: TicketUrgency;
  search?: string;
}

export interface AnalyticsSummary {
  total_tickets: number;
  by_status: Record<TicketStatus, number>;
  by_category: Record<TicketCategory, number>;
  avg_resolution_hours: number;
  busiest_category: {
    name: TicketCategory;
    percentage: number;
  };
  tickets_by_day: Array<{
    date: string;
    count: number;
  }>;
  recent_activity: Array<TicketEvent & {
    ticket_title: string;
    category: TicketCategory;
    status: TicketStatus;
  }>;
  avg_satisfaction: number | null;
}
