declare module "@cubone/react-file-manager" {
  import type { ComponentType } from "react";

  interface FileItem {
    id?: string;
    name: string;
    isDirectory: boolean;
    path: string;
    updatedAt?: string;
    size?: number;
    content_type?: string | null;
    extension?: string | null;
  }

  interface Permissions {
    create?: boolean;
    upload?: boolean;
    download?: boolean;
    copy?: boolean;
    move?: boolean;
    rename?: boolean;
    delete?: boolean;
  }

  interface FileManagerProps {
    files: FileItem[];
    isLoading?: boolean;
    initialPath?: string;
    layout?: "list" | "grid";
    language?: string;
    maxFileSize?: number;
    enableFilePreview?: boolean;
    permissions?: Permissions;
    onFolderChange?: (path: string) => void;
    onFileOpen?: (file: FileItem) => void;
    onCreateFolder?: (name: string) => void;
    onRename?: (file: FileItem, newName: string) => void;
    onDelete?: (files: FileItem[]) => void;
    onDownload?: (files: FileItem[]) => void;
    onRefresh?: () => void;
    onCopy?: (files: FileItem[]) => void;
    onCut?: (files: FileItem[]) => void;
    onPaste?: (files: FileItem[], destination: FileItem | null, type: "copy" | "move") => void;
    onDrop?: (files: FileItem[], destination: FileItem | null, type: "copy" | "move") => void;
    onSelectionChange?: (files: FileItem[]) => void;
    onLayoutChange?: (layout: "list" | "grid") => void;
    onError?: (error: { type: string; message: string }, file?: FileItem) => void;
  }

  export const FileManager: ComponentType<FileManagerProps>;
}
