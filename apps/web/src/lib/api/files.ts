import { apiFetch } from "@/lib/api/client";
import type { FileActivityLog, TeamFile } from "@/types";

export interface CreateFolderPayload {
  parent_path: string;
  name: string;
}

export interface UploadUrlPayload {
  parent_path: string;
  name: string;
  size_bytes: number;
  content_type?: string | null;
}

export interface CompleteUploadPayload {
  size_bytes: number;
}

export interface RenameFilePayload {
  name: string;
}

export interface MoveFilePayload {
  parent_path: string;
}

export interface BatchCopyPayload {
  file_ids: string[];
  parent_path: string;
}

export interface BatchMovePayload {
  file_ids: string[];
  parent_path: string;
}

export interface PresignedUrlResponse {
  url: string;
  expires_in_seconds: number;
}

export interface UploadUrlResponse {
  file: TeamFile;
  upload_url: string;
  method: "PUT";
  expires_in_seconds: number;
}

export interface PurgeExpiredResponse {
  purged: number;
}

export function listFiles(path: string, includeDeleted = false) {
  const params = new URLSearchParams({
    path,
    include_deleted: String(includeDeleted),
  });
  return apiFetch<TeamFile[]>(`/files?${params.toString()}`);
}

export function searchFiles(query: string, includeDeleted = false) {
  const params = new URLSearchParams({
    q: query,
    include_deleted: String(includeDeleted),
  });
  return apiFetch<TeamFile[]>(`/files/search?${params.toString()}`);
}

export function createFolder(payload: CreateFolderPayload) {
  return apiFetch<TeamFile>("/files/folders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createUploadUrl(payload: UploadUrlPayload) {
  return apiFetch<UploadUrlResponse>("/files/upload-url", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function completeUpload(fileId: string, payload: CompleteUploadPayload) {
  return apiFetch<TeamFile>(`/files/${fileId}/complete-upload`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getDownloadUrl(fileId: string) {
  return apiFetch<PresignedUrlResponse>(`/files/${fileId}/download-url`, {
    method: "POST",
  });
}

export function getPreviewUrl(fileId: string) {
  return apiFetch<PresignedUrlResponse>(`/files/${fileId}/preview-url`, {
    method: "POST",
  });
}

export function renameFile(fileId: string, payload: RenameFilePayload) {
  return apiFetch<TeamFile>(`/files/${fileId}/rename`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function moveFile(fileId: string, payload: MoveFilePayload) {
  return apiFetch<TeamFile>(`/files/${fileId}/move`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function batchCopyFiles(payload: BatchCopyPayload) {
  return apiFetch<TeamFile[]>("/files/batch-copy", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function batchMoveFiles(payload: BatchMovePayload) {
  return apiFetch<TeamFile[]>("/files/batch-move", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteFile(fileId: string) {
  return apiFetch<TeamFile>(`/files/${fileId}/delete`, {
    method: "POST",
  });
}

export function restoreFile(fileId: string) {
  return apiFetch<TeamFile>(`/files/${fileId}/restore`, {
    method: "POST",
  });
}

export function purgeExpiredFiles() {
  return apiFetch<PurgeExpiredResponse>("/files/purge-expired", {
    method: "POST",
  });
}

export function listFileActivity(fileId?: string, limit = 50) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (fileId) params.set("file_id", fileId);
  return apiFetch<FileActivityLog[]>(
    `/files/activity?${params.toString()}`,
  );
}
