"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Download, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PresignedUrlResponse } from "@/lib/api/files";
import type { TeamFile } from "@/types";

const MAX_TEXT_PREVIEW_BYTES = 1_000_000;

type PreviewKind = "image" | "pdf" | "markdown" | "html" | "unsupported";

interface FilePreviewPanelProps {
  file: TeamFile | null;
  getPreviewUrl: (fileId: string) => Promise<PresignedUrlResponse>;
  getDownloadUrl: (fileId: string) => Promise<PresignedUrlResponse>;
  getPreviewContent?: (fileId: string) => Promise<string>;
}

function extensionOf(file: TeamFile): string {
  return file.extension?.toLowerCase() ?? "";
}

function getPreviewKind(file: TeamFile): PreviewKind {
  const extension = extensionOf(file);
  if (file.content_type?.startsWith("image/") && extension !== "svg") return "image";
  if (file.content_type === "application/pdf" || extension === "pdf") return "pdf";
  if (extension === "md" || extension === "markdown") return "markdown";
  if (extension === "html" || extension === "htm") return "html";
  return "unsupported";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FilePreviewPanel({
  file,
  getPreviewUrl,
  getDownloadUrl,
  getPreviewContent,
}: FilePreviewPanelProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const retryKey = useMemo(
    () => `${file?.id ?? "empty"}:${file?.updated_at ?? ""}:${reloadToken}`,
    [file, reloadToken],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      setPreviewUrl(null);
      setDownloadUrl(null);
      setTextContent(null);
      setError(null);

      if (!file || file.is_directory) return;

      const kind = getPreviewKind(file);
      setIsLoading(true);

      try {
        void getDownloadUrl(file.id)
          .then((download) => {
            if (!cancelled) setDownloadUrl(download.url);
          })
          .catch(() => {
            if (!cancelled) setDownloadUrl(null);
          });

        if (kind === "unsupported") return;

        if (kind === "markdown" || kind === "html") {
          if (file.size_bytes > MAX_TEXT_PREVIEW_BYTES) {
            throw new Error("File is too large to preview in the browser.");
          }
          if (!getPreviewContent) {
            throw new Error("Preview service is temporarily unavailable. Please refresh the page.");
          }
          const content = await getPreviewContent(file.id);
          if (!cancelled) {
            setTextContent(content);
            setIsLoading(false);
          }
          return;
        }

        const preview = await getPreviewUrl(file.id);
        if (cancelled) return;
        setPreviewUrl(preview.url);
        if (!cancelled) {
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load preview.");
          setIsLoading(false);
        }
      }
    }

    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [file, getDownloadUrl, getPreviewContent, getPreviewUrl, retryKey]);

  if (!file) {
    return (
      <aside className="flex min-h-[420px] items-center justify-center rounded-lg border border-[#e5e7eb] bg-white p-6 text-center">
        <div>
          <FileText className="mx-auto mb-3 h-8 w-8 text-[#9ca3af]" />
          <h2 className="text-section-title text-[#111827]">Select a file</h2>
          <p className="mt-1 text-caption text-[#6b7280]">Markdown, HTML, images, and PDFs preview here.</p>
        </div>
      </aside>
    );
  }

  const kind = getPreviewKind(file);

  return (
    <aside className="flex min-h-[520px] flex-col rounded-lg border border-[#e5e7eb] bg-white">
      <header className="flex items-start justify-between gap-3 border-b border-[#e5e7eb] px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-section-title text-[#111827]">{file.name}</h2>
          <p className="text-caption text-[#6b7280]">
            {formatBytes(file.size_bytes)} | {file.extension || "file"}
          </p>
        </div>
        {downloadUrl ? (
          <Button asChild variant="outline" size="sm">
            <a href={downloadUrl} target="_blank" rel="noreferrer">
              <Download className="mr-2 h-4 w-4" />
              Download
            </a>
          </Button>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {isLoading ? <p className="text-caption text-[#6b7280]">Loading preview...</p> : null}

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p>{error}</p>
            <Button className="mt-3" size="sm" variant="outline" onClick={() => setReloadToken((v) => v + 1)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : null}

        {!isLoading && !error && kind === "unsupported" ? (
          <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-4">
            <h3 className="text-card-title text-[#111827]">Preview unavailable</h3>
            <p className="mt-1 text-caption text-[#6b7280]">This file type can be downloaded but not previewed.</p>
          </div>
        ) : null}

        {!isLoading && !error && kind === "image" && previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={file.name} className="max-h-[70vh] w-full object-contain" />
        ) : null}

        {!isLoading && !error && kind === "pdf" && previewUrl ? (
          <iframe title={file.name} src={previewUrl} className="h-[70vh] w-full rounded-md border border-[#e5e7eb]" />
        ) : null}

        {!isLoading && !error && kind === "html" && textContent ? (
          <iframe
            title={file.name}
            sandbox=""
            srcDoc={textContent}
            className="h-[70vh] w-full rounded-md border border-[#e5e7eb] bg-white"
          />
        ) : null}

        {!isLoading && !error && kind === "markdown" && textContent ? (
          <div className="space-y-3 text-sm text-[#111827]">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: (props) => <h1 className="text-xl font-semibold" {...props} />,
                h2: (props) => <h2 className="text-lg font-semibold" {...props} />,
                h3: (props) => <h3 className="text-base font-semibold" {...props} />,
                p: (props) => <p className="leading-6" {...props} />,
                ul: (props) => <ul className="list-disc space-y-1 pl-5" {...props} />,
                ol: (props) => <ol className="list-decimal space-y-1 pl-5" {...props} />,
                code: (props) => <code className="rounded bg-[#f3f4f6] px-1 py-0.5 text-xs" {...props} />,
                pre: (props) => <pre className="overflow-x-auto rounded-md bg-[#111827] p-3 text-xs text-white" {...props} />,
                a: (props) => <a className="text-[#2563eb] underline" target="_blank" rel="noreferrer" {...props} />,
              }}
            >
              {textContent}
            </ReactMarkdown>
          </div>
        ) : null}

      </div>
    </aside>
  );
}
