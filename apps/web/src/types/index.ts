export type Role = "fe" | "be" | "lead";

export type RequestStatus =
  | "pending"
  | "acknowledged"
  | "in_progress"
  | "done"
  | "cancelled";

export type RequestPriority = "low" | "medium" | "high" | "urgent";

export type NotificationType =
  | "assigned"
  | "reassigned"
  | "status_changed"
  | "pool_new"
  | "replied"
  | "done"
  | "cancelled";

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  role: Role;
  created_at: string;
}

export interface InternalRequest {
  id: string;
  title: string;
  description: string;
  tags: string[];
  priority: RequestPriority;
  status: RequestStatus;
  created_by: string;
  assigned_to?: string | null;
  reference_links: string[];
  reply?: string | null;
  acknowledged_at?: string | null;
  started_at?: string | null;
  done_at?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssignmentHistory {
  id: string;
  request_id: string;
  from_user_id?: string | null;
  to_user_id: string;
  assigned_by: string;
  reason?: string | null;
  created_at: string;
}

export interface RequestStatusLog {
  id: string;
  request_id: string;
  from_status?: RequestStatus | null;
  to_status: RequestStatus;
  changed_by: string;
  reason?: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  request_id?: string | null;
  type: NotificationType;
  message: string;
  is_read: boolean;
  created_at: string;
}
