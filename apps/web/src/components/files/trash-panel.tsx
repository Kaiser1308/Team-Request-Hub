"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useFileMutations, useFileTree } from "@/hooks/use-files";
import type { TeamFile } from "@/types";

function formatSize(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TrashPanel() {
  const t = useTranslations("files");
  const treeQuery = useFileTree(true);
  const mutations = useFileMutations();

  const deletedFiles = (treeQuery.data ?? []).filter(
    (f: TeamFile) => f.status === "deleted",
  );

  if (deletedFiles.length === 0) {
    return (
      <div className="rounded-lg border border-[#e5e7eb] bg-white p-6 text-center text-sm text-[#6b7280]">
        Thùng rác trống
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#e5e7eb] bg-white">
      <div className="border-b border-[#e5e7eb] px-4 py-3">
        <h2 className="text-sm font-medium text-[#111827]">
          Thùng rác ({deletedFiles.length})
        </h2>
      </div>
      <div className="divide-y divide-[#e5e7eb]">
        {deletedFiles.map((file: TeamFile) => (
          <div
            key={file.id}
            className="flex items-center justify-between gap-3 px-4 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[#111827]">
                {file.is_directory ? "📁 " : ""}
                {file.name}
              </p>
              <p className="text-xs text-[#6b7280]">
                {file.deleted_at ? formatDate(file.deleted_at) : ""}
                {!file.is_directory && file.size_bytes > 0 && (
                  <> &middot; {formatSize(file.size_bytes)}</>
                )}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void mutations.restoreFile.mutateAsync(file.id)}
                disabled={mutations.restoreFile.isPending}
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                Khôi phục
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                disabled={mutations.hardDeleteFile.isPending}
                onClick={() => {
                  const message = file.is_directory
                    ? t("hardDeleteFolderConfirm", { name: file.name })
                    : t("hardDeleteFileConfirm", { name: file.name });
                  if (window.confirm(message)) {
                    void mutations.hardDeleteFile.mutateAsync(file.id);
                  }
                }}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                {t("hardDelete")}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
