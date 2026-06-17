import { apiFetch } from "@/lib/api/client";
import type { RequestAttachment } from "@/types";

export type AttachmentContext = "request" | "done_reply";

export interface UploadUrlResponse {
  attachment: RequestAttachment;
  upload_url: string;
  method: string;
  expires_in_seconds: number;
}

export interface PreviewUrlResponse {
  url: string;
  expires_in_seconds: number;
}

export function getUploadUrl(payload: {
  name: string;
  content_type: string;
  size_bytes: number;
  context: AttachmentContext;
}) {
  return apiFetch<UploadUrlResponse>("/request-attachments/upload-url", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function completeUpload(attachmentId: string, sizeBytes: number) {
  return apiFetch<RequestAttachment>(
    `/request-attachments/${attachmentId}/complete-upload`,
    {
      method: "POST",
      body: JSON.stringify({ size_bytes: sizeBytes }),
    },
  );
}

export function getPreviewUrl(attachmentId: string) {
  return apiFetch<PreviewUrlResponse>(
    `/request-attachments/${attachmentId}/preview-url`,
    { method: "POST" },
  );
}

export function getDownloadUrl(attachmentId: string) {
  return apiFetch<PreviewUrlResponse>(
    `/request-attachments/${attachmentId}/download-url`,
    { method: "POST" },
  );
}
