"use client";

import { useState, useRef, useCallback, useEffect, type DragEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileManager } from "@cubone/react-file-manager";
import "@cubone/react-file-manager/dist/style.css";
import { Loader2, XCircle, Upload } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { FilePreviewPanel } from "@/components/files/file-preview-panel";
import { TrashPanel } from "@/components/files/trash-panel";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useFileMutations, useFileSearch, useFiles, useFileTree } from "@/hooks/use-files";
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

export function TeamFileExplorer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPath = searchParams.get("path") || "/";
  const [search, setSearch] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const currentUser = useCurrentUser();
  const isLead = currentUser.data?.role === "lead";
  const filesQuery = useFiles(currentPath, includeDeleted && isLead);
  const searchQuery = useFileSearch(search, includeDeleted && isLead);
  const treeQuery = useFileTree(includeDeleted && isLead);
  const mutations = useFileMutations();
  const treeFiles = (treeQuery.data ?? []).map(toCuboneFile);
  const isLoading = treeQuery.isLoading;
  const error = filesQuery.error || searchQuery.error || treeQuery.error;

  const clipboardRef = useRef<{ files: CuboneFile[]; type: "copy" | "move" } | null>(null);
  const currentPathRef = useRef(currentPath);
  currentPathRef.current = currentPath;
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
    name: string;
  } | null>(null);
  const dragCounterRef = useRef(0);
  const fileManagerRef = useRef<HTMLDivElement>(null);
  const [selectedFile, setSelectedFile] = useState<TeamFile | null>(null);

  useEffect(() => {
    fileManagerRef.current?.focus();
  }, [currentPath]);

  useEffect(() => {
    if (!selectedFile) return;
    const stillExists = (treeQuery.data ?? []).some((file) => file.id === selectedFile.id);
    if (!stillExists) {
      setSelectedFile(null);
    }
  }, [selectedFile, treeQuery.data]);

  function handleNativeDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    dragCounterRef.current = 0;
    void uploadFiles(e.dataTransfer.files);
  }

  function handleNativeDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }

  const handlePaste = useCallback(
    async (pastedFiles: CuboneFile[], destination: CuboneFile | null, operationType: "copy" | "move") => {
      const destPath = destination?.isDirectory ? destination.path : currentPathRef.current;
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
    const selectedFiles = Array.from(fileList);
    if (selectedFiles.length === 0 || uploadProgress) return;

    setUploadError(null);
    setUploadProgress({ current: 0, total: selectedFiles.length, name: selectedFiles[0]?.name ?? "" });
    try {
      for (const [index, file] of selectedFiles.entries()) {
        setUploadProgress({ current: index + 1, total: selectedFiles.length, name: file.name });
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
        if (!response.ok) {
          throw new Error(`Upload failed: ${response.status}`);
        }
        await mutations.completeUpload.mutateAsync({
          fileId: upload.file.id,
          payload: { size_bytes: file.size },
        });
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setUploadError(`${error.detail}. Rename the file or remove the existing one first.`);
        return;
      }
      setUploadError(error instanceof Error ? error.message : "Unable to upload files");
    } finally {
      setUploadProgress(null);
    }
  }

  async function openFile(file: CuboneFile) {
    if (file.isDirectory) {
      return;
    }
    const sourceFile = (treeQuery.data ?? []).find((item) => item.id === file.id);
    if (sourceFile) {
      setSelectedFile(sourceFile);
      return;
    }
    const response = await mutations.downloadUrl.mutateAsync(file.id);
    window.open(response.url, "_blank", "noopener,noreferrer");
  }

  async function downloadFile(file: CuboneFile) {
    if (file.isDirectory) {
      return;
    }
    const response = await mutations.downloadUrl.mutateAsync(file.id);
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
          <Button asChild disabled={Boolean(uploadProgress)}>
            <label className="cursor-pointer">
              {uploadProgress ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {uploadProgress ? "Uploading" : "Upload"}
              <input
                type="file"
                multiple
                className="hidden"
                disabled={Boolean(uploadProgress)}
                onChange={(event) => {
                  void uploadFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
          </Button>
        </div>
      </div>

      {uploadError ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">{uploadError}</div>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="text-red-700 underline-offset-2 hover:underline"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {uploadProgress ? (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          <div className="flex-1">
            Uploading {uploadProgress.current}/{uploadProgress.total}: {uploadProgress.name}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,42%)]">
        <div
          ref={fileManagerRef}
          tabIndex={-1}
          className="relative min-w-0 rounded-lg border border-[#e5e7eb] bg-white p-2 outline-none"
          onDrop={handleNativeDrop}
          onDragOver={handleNativeDragOver}
          onDragEnter={() => {
            dragCounterRef.current += 1;
            setIsDragOver(true);
          }}
          onDragLeave={() => {
            dragCounterRef.current -= 1;
            if (dragCounterRef.current === 0) setIsDragOver(false);
          }}
        >
          {isDragOver ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-[#2563eb] bg-[#eff6ff]/90 text-sm font-medium text-[#2563eb]">
              Drop files to upload
            </div>
          ) : null}
          <FileManager
            files={treeFiles}
            isLoading={isLoading}
            initialPath={currentPath}
            layout="list"
            language="vi-VN"
            maxFileSize={209_715_200}
            enableFilePreview={false}
            collapsibleNav
            defaultNavExpanded
            permissions={{
              create: true,
              upload: false,
              download: true,
              copy: isLead,
              move: true,
              rename: true,
              delete: true,
            }}
            onFolderChange={(path) => {
              const encoded = encodeURIComponent(path);
              if (`/files?path=${encoded}` !== `/files?path=${encodeURIComponent(currentPath)}`) {
                router.push(`/files?path=${encoded}`);
              }
            }}
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
              selected.forEach((file) => void downloadFile(file as CuboneFile))
            }
            onRefresh={() => { void filesQuery.refetch(); void treeQuery.refetch(); }}
          />
        </div>
        <FilePreviewPanel
          file={selectedFile}
          getPreviewUrl={mutations.previewUrl.mutateAsync}
          getDownloadUrl={mutations.downloadUrl.mutateAsync}
          getPreviewContent={mutations.previewContent.mutateAsync}
        />
      </div>

      {isLead && includeDeleted ? <TrashPanel /> : null}
    </div>
  );
}
