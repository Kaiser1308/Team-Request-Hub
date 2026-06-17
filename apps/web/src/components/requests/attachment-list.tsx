"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { getDownloadUrl, getPreviewUrl } from "@/lib/api/request-attachments";
import { formatFileSize } from "@/lib/format";
import type { RequestAttachment, RequestAttachmentsGrouped } from "@/types";

interface AttachmentListProps {
  attachments?: RequestAttachmentsGrouped;
}

export function AttachmentList({ attachments }: AttachmentListProps) {
  const t = useTranslations("requests.attachments");
  const requestFiles = attachments?.request ?? [];
  const replyFiles = attachments?.done_reply ?? [];

  if (requestFiles.length === 0 && replyFiles.length === 0) return null;

  return (
    <div className="space-y-3">
      {requestFiles.length > 0 && (
        <div>
          <p className="text-xs font-medium text-[#6b7280] mb-1">{t("requestFiles")}</p>
          <ul className="space-y-1">
            {requestFiles.map((att) => (
              <AttachmentItem key={att.id} attachment={att} />
            ))}
          </ul>
        </div>
      )}
      {replyFiles.length > 0 && (
        <div>
          <p className="text-xs font-medium text-[#6b7280] mb-1">{t("replyFiles")}</p>
          <ul className="space-y-1">
            {replyFiles.map((att) => (
              <AttachmentItem key={att.id} attachment={att} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AttachmentItem({ attachment }: { attachment: RequestAttachment }) {
  const t = useTranslations("requests.attachments");

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
      </div>
    </li>
  );
}
