import { useCallback, useState } from "react";
import type { AttachmentContext } from "@/lib/api/request-attachments";
import { getUploadUrl, completeUpload } from "@/lib/api/request-attachments";
import type { RequestAttachment } from "@/types";

export interface PendingFile {
  id: string;
  file: File;
  attachment?: RequestAttachment;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

const MAX_FILES = 5;

let fileIdCounter = 0;
function nextFileId() {
  return `local-${++fileIdCounter}`;
}

export function useRequestFileUpload(context: AttachmentContext) {
  const [files, setFiles] = useState<PendingFile[]>([]);

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const incoming = Array.from(fileList);
    setFiles((prev) => {
      const remaining = MAX_FILES - prev.length;
      if (remaining <= 0) return prev;
      const toAdd = incoming.slice(0, remaining).map((file) => ({
        id: nextFileId(),
        file,
        status: "pending" as const,
      }));
      return [...prev, ...toAdd];
    });
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
  }, []);

  const uploadAll = useCallback(async (): Promise<string[]> => {
    const pendingFiles = files.filter((f) => f.status === "pending");
    if (pendingFiles.length === 0) {
      return files.filter((f) => f.attachment).map((f) => f.attachment!.id);
    }

    const attachmentIds: string[] = [];

    for (const pf of pendingFiles) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === pf.id ? { ...f, status: "uploading" as const, error: undefined } : f,
        ),
      );

      try {
        const { attachment, upload_url } = await getUploadUrl({
          name: pf.file.name,
          content_type: pf.file.type || "application/octet-stream",
          size_bytes: pf.file.size,
          context,
        });

        const resp = await fetch(upload_url, {
          method: "PUT",
          body: pf.file,
          headers: { "Content-Type": pf.file.type || "application/octet-stream" },
        });

        if (!resp.ok) throw new Error(`Upload failed: ${resp.status}`);

        await completeUpload(attachment.id, pf.file.size);

        setFiles((prev) =>
          prev.map((f) =>
            f.id === pf.id ? { ...f, status: "done" as const, attachment } : f,
          ),
        );
        attachmentIds.push(attachment.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setFiles((prev) =>
          prev.map((f) =>
            f.id === pf.id ? { ...f, status: "error" as const, error: message } : f,
          ),
        );
      }
    }

    const doneIds = files.filter((f) => f.attachment).map((f) => f.attachment!.id);
    return [...doneIds, ...attachmentIds];
  }, [files, context]);

  const isUploading = files.some((f) => f.status === "uploading");
  const hasErrors = files.some((f) => f.status === "error");
  const pendingCount = files.filter((f) => f.status === "pending").length;

  return {
    files,
    addFiles,
    removeFile,
    clearFiles,
    uploadAll,
    isUploading,
    hasErrors,
    pendingCount,
  };
}
