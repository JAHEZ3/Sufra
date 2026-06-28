export type SupportTicketSubject =
  | "general"
  | "technical"
  | "billing"
  | "partnership"
  | "order_issue"
  | "complaint"
  | "other";

export type SupportTicketPriority = "low" | "normal" | "high" | "critical";

export type SupportTicketStatus =
  | "open"
  | "in_progress"
  | "resolved"
  | "closed";

export interface SupportTicket {
  id: string;
  submittedByUserId: string | null;
  submittedByEmail: string | null;
  submittedByName: string | null;
  submittedByPhone: string | null;
  source: string;
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
