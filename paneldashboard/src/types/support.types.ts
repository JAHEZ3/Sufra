export type SupportTicketSubject =
  | "general"
  | "technical"
  | "billing"
  | "partnership"
  | "order_issue"
  | "restaurant_join"
  | "driver_join"
  | "complaint"
  | "other";

export type SupportTicketPriority = "low" | "normal" | "high" | "critical";

export type SupportTicketStatus =
  | "open"
  | "in_progress"
  | "resolved"
  | "closed";

export type SupportTicketSource = "manager" | "contact_form";

export interface SupportTicket {
  id: string;
  submittedByUserId: string | null;
  submittedByEmail: string | null;
  submittedByName: string | null;
  submittedByPhone: string | null;
  source: SupportTicketSource;
  subject: SupportTicketSubject;
  priority: SupportTicketPriority;
  title: string;
  message: string;
  status: SupportTicketStatus;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupportTicketPayload {
  subject?: SupportTicketSubject;
  priority?: SupportTicketPriority;
  title: string;
  message: string;
}

export interface UpdateSupportTicketStatusPayload {
  status: SupportTicketStatus;
  resolutionNote?: string;
}

export interface ListSupportTicketsParams {
  status?: SupportTicketStatus;
  source?: SupportTicketSource;
  page?: number;
  limit?: number;
}
