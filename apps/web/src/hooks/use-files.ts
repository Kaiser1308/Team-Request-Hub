"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  completeUpload,
  createFolder,
  createUploadUrl,
  deleteFile,
  getDownloadUrl,
  getPreviewUrl,
  listFileActivity,
  listFiles,
  moveFile,
  purgeExpiredFiles,
  renameFile,
  restoreFile,
  searchFiles,
  type CompleteUploadPayload,
  type CreateFolderPayload,
  type MoveFilePayload,
  type RenameFilePayload,
  type UploadUrlPayload,
} from "@/lib/api/files";
import { queryKeys } from "@/lib/api/query-keys";

export function useFiles(path: string, includeDeleted = false) {
  return useQuery({
    queryKey: queryKeys.files.list(path, includeDeleted),
    queryFn: () => listFiles(path, includeDeleted),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useFileSearch(query: string, includeDeleted = false) {
  return useQuery({
    queryKey: queryKeys.files.search(query, includeDeleted),
    queryFn: () => searchFiles(query, includeDeleted),
    enabled: query.trim().length > 0,
    staleTime: 15 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useFileActivity(fileId?: string) {
  return useQuery({
    queryKey: queryKeys.files.activity(fileId),
    queryFn: () => listFileActivity(fileId),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useFileMutations() {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.files.all });

  return {
    createFolder: useMutation({
      mutationFn: (payload: CreateFolderPayload) => createFolder(payload),
      onSuccess: invalidate,
    }),
    createUploadUrl: useMutation({
      mutationFn: (payload: UploadUrlPayload) => createUploadUrl(payload),
    }),
    completeUpload: useMutation({
      mutationFn: ({
        fileId,
        payload,
      }: {
        fileId: string;
        payload: CompleteUploadPayload;
      }) => completeUpload(fileId, payload),
      onSuccess: invalidate,
    }),
    downloadUrl: useMutation({
      mutationFn: (fileId: string) => getDownloadUrl(fileId),
    }),
    previewUrl: useMutation({
      mutationFn: (fileId: string) => getPreviewUrl(fileId),
    }),
    renameFile: useMutation({
      mutationFn: ({
        fileId,
        payload,
      }: {
        fileId: string;
        payload: RenameFilePayload;
      }) => renameFile(fileId, payload),
      onSuccess: invalidate,
    }),
    moveFile: useMutation({
      mutationFn: ({
        fileId,
        payload,
      }: {
        fileId: string;
        payload: MoveFilePayload;
      }) => moveFile(fileId, payload),
      onSuccess: invalidate,
    }),
    deleteFile: useMutation({
      mutationFn: (fileId: string) => deleteFile(fileId),
      onSuccess: invalidate,
    }),
    restoreFile: useMutation({
      mutationFn: (fileId: string) => restoreFile(fileId),
      onSuccess: invalidate,
    }),
    purgeExpiredFiles: useMutation({
      mutationFn: purgeExpiredFiles,
      onSuccess: invalidate,
    }),
  };
}
