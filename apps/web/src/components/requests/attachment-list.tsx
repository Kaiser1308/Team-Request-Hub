"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useRequestFileUpload } from "@/hooks/use-request-attachments";
import { formatFileSize } from "@/lib/format";
import { addRequestAttachments, removeRequestAttachment } from "@/lib/api/requests";
import { getDownloadUrl, getPreviewUrl } from "@/lib/api/request-attachments";
import { queryKeys } from "@/lib/api/query-keys";
import type { RequestAttachment, RequestAttachmentsGrouped } from "@/types";

interface AttachmentListProps {
  attachments?: RequestAttachmentsGrouped;
  requestId: string;
  canManage: boolean;
}

export function AttachmentList({ attachments, requestId, canManage }: AttachmentListProps) {
  const t = useTranslations("requests.attachments");
  const requestFiles = attachments?.request ?? [];
  const replyFiles = attachments?.done_reply ?? [];

  if (requestFiles.length === 0 && replyFiles.length === 0 && !canManage) return null;

  return (
    <div className="space-y-3">
      {requestFiles.length > 0 && (
        <div>
          <p className="text-xs font-medium text-[#6b7280] mb-1">{t("requestFiles")}</p>
          <ul className="space-y-1">
            {requestFiles.map((att) => (
              <AttachmentItem
                key={att.id}
                attachment={att}
                requestId={requestId}
                canManage={canManage}
              />
            ))}
          </ul>
        </div>
      )}
      {replyFiles.length > 0 && (
        <div>
          <p className="text-xs font-medium text-[#6b7280] mb-1">{t("replyFiles")}</p>
          <ul className="space-y-1">
            {replyFiles.map((att) => (
              <AttachmentItem key={att.id} attachment={att} canManage={false} requestId={requestId} />
            ))}
          </ul>
        </div>
      )}
      {canManage ? <AddAttachmentsControl requestId={requestId} /> : null}
    </div>
  );
}

function AttachmentItem({
  attachment,
  requestId,
  canManage,
}: {
  attachment: RequestAttachment;
  requestId: string;
  canManage: boolean;
}) {
  const t = useTranslations("requests.attachments");
  const queryClient = useQueryClient();

  async function handleView() {
    const { url } = await getPreviewUrl(attachment.id);
    window.open(url, "_blank");
  }

  async function handleDownload() {
    const { url } = await getDownloadUrl(attachment.id);
    const link = document.createElement("a");
    link.href = url;
    link.download = attachment.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const removeMutation = useMutation({
    mutationFn: () => removeRequestAttachment(requestId, attachment.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.requests.detail(requestId) });
    },
  });

  function handleRemove() {
    if (window.confirm(t("confirmRemove"))) {
      removeMutation.mutate();
    }
  }

  return (
    <li className="grid gap-1.5 rounded-md border border-[#e5e7eb] bg-white px-3 py-2 text-sm sm:flex sm:items-center sm:gap-2">
      <span className="min-w-0 truncate">{attachment.name}</span>
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-xs text-[#6b7280]">
          {formatFileSize(attachment.size_bytes)}
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={handleView}>
          {t("view")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={handleDownload}>
          {t("download")}
        </Button>
        {canManage ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={removeMutation.isPending}
            className="text-red-600 hover:text-red-700"
          >
            {t("remove")}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function AddAttachmentsControl({ requestId }: { requestId: string }) {
  const t = useTranslations("requests.attachments");
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useRequestFileUpload("request");
  const [busy, setBusy] = useState(false);

  const addMutation = useMutation({
    mutationFn: (ids: string[]) => addRequestAttachments(requestId, ids),
    onSuccess: () => {
      upload.clearFiles();
      void queryClient.invalidateQueries({ queryKey: queryKeys.requests.detail(requestId) });
    },
  });

  async function handleAdd() {
    const ids = await upload.uploadAll();
    if (ids.length === 0) return;
    setBusy(true);
    try {
      await addMutation.mutateAsync(ids);
    } finally {
      setBusy(false);
    }
  }

  const hasPending = upload.files.some((f) => f.status === "pending" || f.status === "uploading");

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={upload.files.length >= 5}
        >
          {t("addFiles")}
        </Button>
        {upload.files.length > 0 ? (
          <Button
            type="button"
            size="sm"
            onClick={handleAdd}
            disabled={hasPending || busy || addMutation.isPending}
          >
            {t("save")}
          </Button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files) {
            upload.addFiles(event.target.files);
            event.target.value = "";
          }
        }}
        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
      />
      {upload.files.length > 0 ? (
        <ul className="space-y-1">
          {upload.files.map((pf) => (
            <li
              key={pf.id}
              className="flex items-center gap-2 rounded-md border border-[#e5e7eb] bg-gray-50 px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate">{pf.file.name}</span>
              <span className="shrink-0 text-xs text-[#6b7280]">
                {formatFileSize(pf.file.size)}
              </span>
              <span className="shrink-0 text-xs text-[#6b7280]">{pf.status}</span>
              {pf.status !== "uploading" ? (
                <button
                  type="button"
                  className="shrink-0 text-xs text-[#6b7280] hover:text-red-600"
                  onClick={() => upload.removeFile(pf.id)}
                >
                  x
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
