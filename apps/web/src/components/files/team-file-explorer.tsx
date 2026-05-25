"use client";

import { useState, useRef, useCallback } from "react";
import { FileManager } from "@cubone/react-file-manager";
import "@cubone/react-file-manager/dist/style.css";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useFileMutations, useFileSearch, useFiles } from "@/hooks/use-files";
import type { TeamFile } from "@/types";

type CuboneFile = {
  id: string;
  name: string;
  isDirectory: boolean;
  path: string;
  updatedAt?: string;
  size?: number;
  content_type?: string | null;
  extension?: string | null;
};

function toCuboneFile(file: TeamFile): CuboneFile {
  return {
    id: file.id,
    name: file.name,
    isDirectory: file.is_directory,
    path: file.path,
    updatedAt: file.updated_at,
    size: file.size_bytes,
    content_type: file.content_type,
    extension: file.extension,
  };
}

function isPreviewable(file: CuboneFile) {
  return (
    (file.content_type?.startsWith("image/") && file.extension !== "svg") ||
    file.content_type === "application/pdf"
  );
}

export function TeamFileExplorer() {
  const [currentPath, setCurrentPath] = useState("/");
  const [search, setSearch] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const currentUser = useCurrentUser();
  const isLead = currentUser.data?.role === "lead";
  const filesQuery = useFiles(currentPath, includeDeleted && isLead);
  const searchQuery = useFileSearch(search, includeDeleted && isLead);
  const mutations = useFileMutations();
  const files = (search.trim() ? searchQuery.data : filesQuery.data) ?? [];
  const managerFiles = files.map(toCuboneFile);
  const isLoading = filesQuery.isLoading || searchQuery.isLoading;
  const error = filesQuery.error || searchQuery.error;

  const clipboardRef = useRef<{ files: CuboneFile[]; type: "copy" | "move" } | null>(null);

  const handlePaste = useCallback(
    async (pastedFiles: CuboneFile[], destination: CuboneFile, operationType: "copy" | "move") => {
      const destPath = destination.isDirectory ? destination.path : "/";
      const ids = pastedFiles.map((f) => f.id);
      if (operationType === "copy") {
        await mutations.batchCopyFiles.mutateAsync({ file_ids: ids, parent_path: destPath });
      } else {
        await mutations.batchMoveFiles.mutateAsync({ file_ids: ids, parent_path: destPath });
      }
      clipboardRef.current = null;
    },
    [mutations],
  );

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList) return;
    for (const file of Array.from(fileList)) {
      const upload = await mutations.createUploadUrl.mutateAsync({
        parent_path: currentPath,
        name: file.name,
        size_bytes: file.size,
        content_type: file.type || null,
      });
      const response = await fetch(upload.upload_url, {
        method: upload.method,
        body: file,
      });
      if (!response.ok)
        throw new Error(`Upload failed: ${response.status}`);
      await mutations.completeUpload.mutateAsync({
        fileId: upload.file.id,
        payload: { size_bytes: file.size },
      });
    }
  }

  async function openFile(file: CuboneFile) {
    if (file.isDirectory) {
      setCurrentPath(file.path);
      return;
    }
    const response = isPreviewable(file)
      ? await mutations.previewUrl.mutateAsync(file.id)
      : await mutations.downloadUrl.mutateAsync(file.id);
    window.open(response.url, "_blank", "noopener,noreferrer");
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error instanceof Error ? error.message : "Unable to load files"}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-[#e5e7eb] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-page-title text-[#111827]">Files</h1>
          <p className="text-caption text-[#6b7280]">
            Shared team repository. Uploads are limited to 200MB.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search files"
            className="h-10 rounded-md border border-[#d1d5db] px-3 text-sm"
          />
          {isLead ? (
            <label className="flex items-center gap-2 text-sm text-[#4b5563]">
              <input
                type="checkbox"
                checked={includeDeleted}
                onChange={(event) => setIncludeDeleted(event.target.checked)}
              />
              Trash
            </label>
          ) : null}
          <Button asChild>
            <label className="cursor-pointer">
              <Upload className="mr-2 h-4 w-4" /> Upload
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(event) => void uploadFiles(event.target.files)}
              />
            </label>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-[#e5e7eb] bg-white p-2">
        <FileManager
          files={managerFiles}
          isLoading={isLoading}
          initialPath={currentPath}
          layout="list"
          language="vi-VN"
          maxFileSize={209_715_200}
          enableFilePreview={false}
          permissions={{
            create: true,
            upload: false,
            download: true,
            copy: isLead,
            move: true,
            rename: true,
            delete: isLead,
          }}
          onFolderChange={setCurrentPath}
          onFileOpen={(file) => void openFile(file as CuboneFile)}
          onCreateFolder={(name) =>
            void mutations.createFolder.mutateAsync({
              parent_path: currentPath,
              name,
            })
          }
          onCopy={(files) => {
            clipboardRef.current = { files: files as CuboneFile[], type: "copy" };
          }}
          onCut={(files) => {
            clipboardRef.current = { files: files as CuboneFile[], type: "move" };
          }}
          onPaste={(files, destination, operationType) =>
            void handlePaste(files as CuboneFile[], destination as CuboneFile, operationType)
          }
          onDrop={(files, destination, operationType) =>
            void handlePaste(files as CuboneFile[], destination as CuboneFile, operationType || "move")
          }
          onRename={(file, name) =>
            void mutations.renameFile.mutateAsync({
              fileId: (file as CuboneFile).id,
              payload: { name },
            })
          }
          onDelete={(selected) =>
            selected.forEach(
              (file) => void mutations.deleteFile.mutateAsync((file as CuboneFile).id),
            )
          }
          onDownload={(selected) =>
            selected.forEach((file) => void openFile(file as CuboneFile))
          }
          onRefresh={() => void filesQuery.refetch()}
        />
      </div>
    </div>
  );
}
