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

export interface UserSummary {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url?: string | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string | null;
  role: Role;
  is_active: boolean;
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
  creator?: UserSummary | null;
  assignee?: UserSummary | null;
  assignees?: UserSummary[];
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

export type TeamFileStatus = "pending_upload" | "active" | "deleted" | "purged";

export type TeamFileAction =
  | "create_folder"
  | "upload"
  | "complete_upload"
  | "rename"
  | "move"
  | "delete"
  | "restore"
  | "purge"
  | "download"
  | "preview";

export interface TeamFile {
  id: string;
  name: string;
  path: string;
  parent_path: string;
  is_directory: boolean;
  size_bytes: number;
  content_type?: string | null;
  extension?: string | null;
  status: TeamFileStatus;
  uploaded_by?: string | null;
  created_by: string;
  updated_by?: string | null;
  deleted_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  purge_after?: string | null;
}

export interface FileActivityLog {
  id: string;
  actor_id: string;
  file_id?: string | null;
  action: TeamFileAction;
  target_type: "file" | "folder";
  old_path?: string | null;
  new_path?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type NotificationChannel = "telegram" | "email" | "web_push";

export interface NotificationPreference {
  channel: NotificationChannel;
  enabled: boolean;
}
