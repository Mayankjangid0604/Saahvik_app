// ---- Enums ----
export type SubscriptionPlan = 'basic' | 'beginner';
export type UserRole = 'owner' | 'staff';
export type BedStatus = 'vacant' | 'occupied' | 'maintenance';
export type ResidentStatus = 'active' | 'vacated' | 'transferred';
export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'razorpay';
export type NotificationChannel = 'email' | 'sms' | 'whatsapp' | 'push';
export type NotificationStatus = 'queued' | 'sent' | 'failed' | 'pending_provider_config';

// ---- Auth ----
export interface AuthUser {
  userId: string;
  orgId: string;
  role: UserRole;
  name: string;
  email: string;
}

export interface LoginResponse {
  accessToken: string;
}

export interface SignupResponse {
  userId: string;
  organizationId: string;
}

// ---- Organization ----
export interface Organization {
  id: string;
  name: string;
  subscriptionPlan: SubscriptionPlan;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  createdAt: string;
}

// ---- Property ----
export interface Property {
  id: string;
  organizationId: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  timezone: string;
  createdAt: string;
}

export interface Wing {
  id: string;
  propertyId: string;
  name: string;
  createdAt: string;
}

export interface Room {
  id: string;
  propertyId: string;
  wingId: string | null;
  roomNumber: string;
  floor: number;
  createdAt: string;
  wing?: Wing;
  beds?: Bed[];
}

export interface Bed {
  id: string;
  roomId: string;
  bedLabel: string;
  status: BedStatus;
  createdAt: string;
  resident?: Resident | null;
  room?: Room;
}

// ---- Residents ----
export interface Guardian {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  relationship: string;
}

export interface GuardianLink {
  id: string;
  residentId: string;
  guardianId: string;
  relationship: string;
  guardian: Guardian;
}

export interface FeeStructure {
  id: string;
  residentId: string;
  monthlyRentPaisa: string; // BigInt comes as string from API
  effectiveFrom: string;
  createdAt: string;
}

export interface Resident {
  id: string;
  organizationId: string;
  bedId: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  photoKey: string | null;
  idDocumentKey: string | null;
  status: ResidentStatus;
  admissionDate: string;
  vacateDate: string | null;
  createdAt: string;
  updatedAt: string;
  bed?: Bed | null;
  guardianLinks?: GuardianLink[];
  feeStructures?: FeeStructure[];
  payments?: Payment[];
  dues?: Dues[];
}

// ---- Billing ----
export interface Payment {
  id: string;
  residentId: string;
  amountPaisa: string; // BigInt as string
  method: PaymentMethod;
  paidOn: string;
  receiptPdfKey: string | null;
  razorpayPaymentId: string | null;
  idempotencyKey: string | null;
  notes: string | null;
  createdAt: string;
  resident?: Resident;
}

export interface Dues {
  id: string;
  residentId: string;
  amountDuePaisa: string; // BigInt as string
  dueSince: string;
  settled: boolean;
  settledAt: string | null;
  createdAt: string;
  resident?: Resident;
}

// ---- Notifications ----
export interface Notification {
  id: string;
  organizationId: string;
  channel: NotificationChannel;
  recipientPhone: string | null;
  recipientEmail: string | null;
  subject: string | null;
  body: string;
  templateId: string | null;
  status: NotificationStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface NotificationTemplate {
  id: string;
  organizationId: string;
  name: string;
  channel: NotificationChannel;
  subject: string | null;
  body: string;
  variables: string[];
  createdAt: string;
  updatedAt: string;
}

// ---- Audit ----
export interface AuditLog {
  id: string;
  organizationId: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user?: { name: string; email: string };
}

// ---- Pagination ----
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ---- Occupancy ----
export interface OccupancyData {
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  maintenanceBeds: number;
  occupancyRate: number;
  rooms: OccupancyRoom[];
}

export interface OccupancyRoom {
  id: string;
  roomNumber: string;
  floor: number;
  wingName: string | null;
  beds: OccupancyBed[];
}

export interface OccupancyBed {
  id: string;
  bedLabel: string;
  status: BedStatus;
  residentName: string | null;
}
