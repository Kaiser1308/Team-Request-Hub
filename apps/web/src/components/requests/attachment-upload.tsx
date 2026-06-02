"use client";

import { useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { PendingFile } from "@/hooks/use-request-attachments";
import type { useRequestFileUpload } from "@/hooks/use-request-attachments";
import { formatFileSize } from "@/lib/format";

interface AttachmentUploadProps {
  hook: ReturnType<typeof useRequestFileUpload>;
}

export function AttachmentUpload({ hook }: AttachmentUploadProps) {
  const t = useTranslations("requests.attachments");
  const inputRef = useRef<HTMLInputElement>(null);
  const hasUploadedFiles = hook.files.some((file) => file.status === "done");
  const hasPendingFiles = hook.files.some((file) => file.status === "pending");
  const showUploadSuccess =
    hasUploadedFiles && !hook.isUploading && !hasPendingFiles && !hook.hasErrors;

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.target.files) {
      hook.addFiles(event.target.files);
      event.target.value = "";
    }
  }

  const handlePaste = useCallback(
    (event: React.ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            const ext = item.type.split("/")[1] || "png";
            const namedFile = new File(
              [file],
              `screenshot-${Date.now()}.${ext}`,
              { type: item.type },
            );
            imageFiles.push(namedFile);
          }
        }
      }

      if (imageFiles.length > 0) {
        event.preventDefault();
        hook.addFiles(imageFiles);
      }
    },
    [hook],
  );

  return (
    <div
      className="grid gap-2"
      onPaste={handlePaste}
      tabIndex={0}
    >
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={hook.files.length >= 5}
        >
          {t("addFiles")}
        </Button>
        <span className="text-xs text-[#6b7280]">{t("pasteHint")}</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleChange}
        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
      />

      {hook.files.length > 0 && (
        <ul className="space-y-1">
          {hook.files.map((pf) => (
            <FileItem key={pf.id} pf={pf} onRemove={() => hook.removeFile(pf.id)} t={t} />
          ))}
        </ul>
      )}

      {showUploadSuccess ? (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-700">
          {t("allUploaded")}
        </p>
      ) : null}
    </div>
  );
}

function FileItem({
  pf,
  onRemove,
  t,
}: {
  pf: PendingFile;
  onRemove: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <li className="flex items-center gap-2 rounded-md border border-[#e5e7eb] bg-gray-50 px-3 py-2 text-sm">
      <span className="min-w-0 flex-1 truncate">{pf.file.name}</span>
      <span className="shrink-0 text-xs text-[#6b7280]">{formatFileSize(pf.file.size)}</span>
      {pf.status === "uploading" && (
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-blue-600">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
          {t("uploading")}
        </span>
      )}
      {pf.status === "done" && (
        <span className="shrink-0 text-xs font-medium text-green-600">
          {t("uploadSuccess")}
        </span>
      )}
      {pf.status === "error" && (
        <span className="shrink-0 text-xs text-red-600">{pf.error || "Error"}</span>
      )}
      {pf.status !== "uploading" && (
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 text-xs text-[#6b7280] hover:text-red-600"
        >
          x
        </button>
      )}
    </li>
  );
}
