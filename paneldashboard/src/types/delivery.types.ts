import type { PaginationParams } from "./common.types";

export enum AgentStatus {
  PENDING_APPROVAL = "pending_approval",
  ACTIVE = "active",
  SUSPENDED = "suspended",
  OFFLINE = "offline",
}

export enum VehicleType {
  MOTORCYCLE = "motorcycle",
  BICYCLE = "bicycle",
  CAR = "car",
  ON_FOOT = "on_foot",
}

export enum DeliveryRequestStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
}

export interface PaymentInfo {
  iban?: string | null;
  bankName?: string | null;
  accountHolder?: string | null;
}

export interface ApplicationAnswer {
  question: string;
  answer: string;
}

export interface DeliveryAgent {
  id: string;
  userId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  phone: string | null;
  idNumber: string | null;
  isDelivery: boolean;
  vehicleType: VehicleType | null;
  vehiclePlate: string | null;
  vehicleLicenseNumber: string | null;
  city: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  paymentInfo: PaymentInfo | null;
  termsAccepted: boolean;
  status: AgentStatus;
  rating: number;
  totalDeliveries: number;
  walletBalance: number;
  createdAt: string;
}

/** Pending agent application. Image URLs are presigned. */
export interface DeliveryApplication {
  requestId: string;
  agentId: string;
  fullName: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  profilePictureUrl: string | null;
  idPictureUrl: string | null;
  answers: ApplicationAnswer[] | null;
  submittedAt: string;
}

export interface ListAgentsParams extends PaginationParams {
  status?: AgentStatus;
  vehicleType?: VehicleType;
  city?: string;
  search?: string;
}

export interface UpdateAgentPayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
  city?: string;
  vehicleType?: VehicleType;
  vehiclePlate?: string;
  vehicleLicenseNumber?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

export interface ChangeAgentStatusPayload {
  status: AgentStatus;
}

export interface ChangeAgentStatusResponse {
  id: string;
  status: AgentStatus;
}

export interface RejectAgentApplicationPayload {
  reason: string;
}
