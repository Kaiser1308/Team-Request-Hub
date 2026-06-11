"use client";

import { useMemo, useState, use, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  Compass,
  Calendar,
  ExternalLink,
  ChevronLeft,
} from "lucide-react";
import { useFileContent, useFileTree } from "@/hooks/use-files";
import type { TeamFile } from "@/types";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ path?: string[] }>;
}

interface DocNode {
  file: TeamFile;
  children: DocNode[];
}

function buildTree(files: TeamFile[]): DocNode[] {
  const rootNodes: DocNode[] = [];
  const nodeMap = new Map<string, DocNode>();

  // Filter only items under /docs (inclusive)
  const docsItems = files.filter(
    (f) => f.path === "/docs" || f.path.startsWith("/docs/"),
  );

  // Sort by path length and directories first
  docsItems.sort((a, b) => {
    const depthA = a.path.split("/").length;
    const depthB = b.path.split("/").length;
    if (depthA !== depthB) return depthA - depthB;
    if (a.is_directory !== b.is_directory) return a.is_directory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  for (const file of docsItems) {
    const node: DocNode = { file, children: [] };
    nodeMap.set(file.path, node);

    if (file.path === "/docs") {
      continue;
    }

    const parentNode = nodeMap.get(file.parent_path);
    if (parentNode) {
      parentNode.children.push(node);
    } else if (file.parent_path === "/docs") {
      // Direct child of docs root
      const docsRoot = nodeMap.get("/docs");
      if (docsRoot) {
        docsRoot.children.push(node);
      } else {
        rootNodes.push(node);
      }
    } else {
      rootNodes.push(node);
    }
  }

  const docsRoot = nodeMap.get("/docs");
  return docsRoot ? docsRoot.children : rootNodes;
}

// Sidebar component
function SidebarTree({
  nodes,
  currentPath,
  searchQuery,
  expandedPaths,
  toggleFolder,
}: {
  nodes: DocNode[];
  currentPath: string;
  searchQuery: string;
  expandedPaths: Set<string>;
  toggleFolder: (path: string) => void;
}) {
  const filteredNodes = useMemo(() => {
    if (!searchQuery) return nodes;

    const filter = (list: DocNode[]): DocNode[] => {
      return list
        .map((node) => {
          const match = node.file.name
            .toLowerCase()
            .includes(searchQuery.toLowerCase());
          const childrenMatch = filter(node.children);

          if (match || childrenMatch.length > 0) {
            return {
              ...node,
              children: childrenMatch,
            };
          }
          return null;
        })
        .filter(Boolean) as DocNode[];
    };

    return filter(nodes);
  }, [nodes, searchQuery]);

  const renderNode = (node: DocNode, depth = 0) => {
    const file = node.file;
    const isDir = file.is_directory;
    const isExpanded = expandedPaths.has(file.path) || searchQuery.length > 0;
    const isActive = currentPath === file.path;

    const itemClass = `flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors w-full text-left outline-none ${
      isActive
        ? "bg-[#1e293b] text-white font-medium"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    }`;

    // Skip non-markdown files in sidebar tree
    if (!isDir && file.extension !== "md" && file.extension !== "markdown") {
      return null;
    }

    const linkHref = `/docs${file.path.substring(5)}`;

    if (isDir) {
      return (
        <div key={file.id} className="space-y-0.5">
          <button
            type="button"
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            className={itemClass}
            onClick={() => toggleFolder(file.path)}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
            )}
            {isExpanded ? (
              <FolderOpen className="h-4 w-4 shrink-0 text-slate-400" />
            ) : (
              <Folder className="h-4 w-4 shrink-0 text-slate-400" />
            )}
            <span className="truncate">{file.name}</span>
          </button>
          {isExpanded && node.children.length > 0 && (
            <div className="space-y-0.5">
              {node.children.map((child) => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={file.id}
        href={linkHref}
        style={{ paddingLeft: `${depth * 12 + 28}px` }}
        className={itemClass}
      >
        <FileText className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
        <span className="truncate">{file.name}</span>
      </Link>
    );
  };

  if (filteredNodes.length === 0) {
    return <p className="p-4 text-xs text-slate-400 text-center">No documents found</p>;
  }

  return <div className="space-y-0.5">{filteredNodes.map((n) => renderNode(n))}</div>;
}

export default function DocsPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const pathSegments = useMemo(() => resolvedParams?.path ?? [], [resolvedParams]);
  const router = useRouter();

  // Re-construct the target file path, e.g. "/docs/project/formSystem"
  const currentPath = useMemo(() => {
    if (pathSegments.length === 0) return "/docs";
    return "/docs/" + pathSegments.map(decodeURIComponent).join("/");
  }, [pathSegments]);

  const treeQuery = useFileTree(false);
  const [search, setSearch] = useState("");
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(["/docs"]));

  // Auto-expand parents of active document path
  useEffect(() => {
    if (currentPath === "/docs") return;
    const parts = currentPath.split("/");
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      let cumulative = "";
      for (let i = 1; i < parts.length; i++) {
        cumulative += "/" + parts[i];
        next.add(cumulative);
      }
      return next;
    });
  }, [currentPath]);

  const toggleFolder = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const { fileMap, treeNodes, activeNode, parentPath } = useMemo(() => {
    const list = treeQuery.data ?? [];
    const map = new Map<string, TeamFile>();
    for (const f of list) {
      map.set(f.path, f);
    }

    const nodes = buildTree(list);
    const active = map.get(currentPath);

    let parent = "/docs";
    if (active) {
      parent = active.parent_path;
    }

    return { fileMap: map, treeNodes: nodes, activeNode: active, parentPath: parent };
  }, [treeQuery.data, currentPath]);

  const contentQuery = useFileContent(
    activeNode && !activeNode.is_directory ? activeNode.id : undefined,
  );

  // Build breadcrumbs path
  const breadcrumbs = useMemo(() => {
    const items = [{ name: "Docs", href: "/docs" }];
    if (pathSegments.length === 0) return items;

    let accum = "/docs";
    for (const segment of pathSegments) {
      const decoded = decodeURIComponent(segment);
      accum += "/" + decoded;
      items.push({ name: decoded, href: `/docs${accum.substring(5)}` });
    }
    return items;
  }, [pathSegments]);

  if (treeQuery.isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-sm text-slate-500">Loading documentation index...</p>
      </div>
    );
  }

  // 1. Root /docs doesn't exist in system database
  const hasDocsFolder = fileMap.has("/docs");
  if (!hasDocsFolder && treeNodes.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <Compass className="mx-auto h-12 w-12 text-slate-300" />
        <h1 className="mt-4 text-xl font-bold text-slate-800">Documentation Not Configured</h1>
        <p className="mt-2 text-sm text-slate-500">
          The documentation portal parses markdown files located under the `/docs` folder in MinIO.
        </p>
        <div className="mt-6">
          <Button asChild>
            <Link href="/files?path=%2F">
              <ArrowRight className="mr-2 h-4 w-4" /> Go to File Explorer to Create &quot;/docs&quot;
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // 2. Active path not found fallback (404)
  if (pathSegments.length > 0 && !activeNode) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-3xl font-bold text-slate-800">404</h1>
        <p className="mt-2 text-sm text-slate-500">The requested documentation page does not exist.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="outline" onClick={() => router.back()}>
            <ChevronLeft className="mr-2 h-4 w-4" /> Go Back
          </Button>
          <Button asChild>
            <Link href="/docs">Docs Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      {/* Sidebar navigation */}
      <aside className="h-[calc(100vh-120px)] overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 shadow-sm sticky top-20">
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search documentation"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 rounded-md border border-slate-200 px-3 text-xs outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>
        <SidebarTree
          nodes={treeNodes}
          currentPath={currentPath}
          searchQuery={search}
          expandedPaths={expandedPaths}
          toggleFolder={toggleFolder}
        />
      </aside>

      {/* Main content pane */}
      <div className="flex flex-col min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Header toolbar */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-150 px-6 py-4 bg-slate-50/50">
          <nav className="flex items-center gap-1.5 text-xs text-slate-500" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, idx) => (
              <span key={crumb.href} className="flex items-center gap-1.5">
                {idx > 0 && <span className="text-slate-300">/</span>}
                {idx === breadcrumbs.length - 1 ? (
                  <span className="font-medium text-slate-800 max-w-[150px] truncate">{crumb.name}</span>
                ) : (
                  <Link href={crumb.href} className="hover:text-slate-900 hover:underline">
                    {crumb.name}
                  </Link>
                )}
              </span>
            ))}
          </nav>

          <Button asChild variant="outline" size="sm">
            <Link href={`/files?path=${encodeURIComponent(parentPath)}`}>
              <ExternalLink className="mr-2 h-3.5 w-3.5" />
              Manage in File Explorer
            </Link>
          </Button>
        </header>

        {/* Content body */}
        <main className="flex-1 px-8 py-6 min-h-[500px]">
          {/* Active node is folder: show directory index */}
          {(!activeNode || activeNode.is_directory) ? (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-800">
                  {activeNode ? activeNode.name : "Documentation"}
                </h1>
                <p className="text-xs text-slate-400 mt-1">Directory Index</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {/* List subfolders first */}
                {(treeQuery.data ?? [])
                  .filter((f) => f.parent_path === currentPath)
                  .map((child) => {
                     const isDir = child.is_directory;
                     // Skip files that aren't markdown
                     if (!isDir && child.extension !== "md" && child.extension !== "markdown") {
                       return null;
                     }
                     const childLink = `/docs${child.path.substring(5)}`;

                     return (
                       <Link
                         key={child.id}
                         href={childLink}
                         className="flex items-start gap-3 rounded-lg border border-slate-200 p-4 transition-colors hover:bg-slate-50"
                       >
                         {isDir ? (
                           <Folder className="h-5 w-5 text-slate-400 shrink-0" />
                         ) : (
                           <FileText className="h-5 w-5 text-slate-400 shrink-0" />
                         )}
                         <div className="min-w-0">
                           <h3 className="text-sm font-semibold text-slate-700 truncate">
                             {child.name}
                           </h3>
                           <p className="text-xs text-slate-400 mt-0.5">
                             {isDir ? "Folder" : `${(child.size_bytes / 1024).toFixed(1)} KB | Markdown`}
                           </p>
                         </div>
                       </Link>
                     );
                  })}
                {(treeQuery.data ?? []).filter((f) => f.parent_path === currentPath).length === 0 && (
                  <p className="col-span-2 text-sm text-slate-400 text-center py-8">
                    This directory is empty.
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* Active node is markdown file: show content */
            <article className="max-w-3xl">
              <div className="border-b border-slate-100 pb-4 mb-6">
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  {activeNode.name.replace(/\.[^/.]+$/, "")}
                </h1>
                <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Updated: {new Date(activeNode.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {contentQuery.isLoading ? (
                <div className="space-y-4">
                  <div className="h-4 bg-slate-100 rounded-md w-3/4 animate-pulse" />
                  <div className="h-4 bg-slate-100 rounded-md w-5/6 animate-pulse" />
                  <div className="h-4 bg-slate-100 rounded-md w-2/3 animate-pulse" />
                </div>
              ) : contentQuery.isError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <p>Unable to retrieve markdown content.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => void contentQuery.refetch()}>
                    Retry
                  </Button>
                </div>
              ) : (
                <div className="prose prose-slate max-w-none prose-sm sm:prose-base dark:prose-invert">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: (props) => <h1 className="text-2xl font-bold border-b border-slate-100 pb-2 mt-6 mb-4" {...props} />,
                      h2: (props) => <h2 className="text-xl font-bold mt-5 mb-3" {...props} />,
                      h3: (props) => <h3 className="text-lg font-semibold mt-4 mb-2" {...props} />,
                      p: (props) => <p className="leading-7 text-slate-700 mb-4" {...props} />,
                      ul: (props) => <ul className="list-disc space-y-1.5 pl-6 mb-4 text-slate-700" {...props} />,
                      ol: (props) => <ol className="list-decimal space-y-1.5 pl-6 mb-4 text-slate-700" {...props} />,
                      code: (props) => <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-[#d11149] font-mono" {...props} />,
                      pre: (props) => <pre className="overflow-x-auto rounded-md bg-slate-900 p-4 text-xs text-white font-mono mb-4" {...props} />,
                      a: (props) => <a className="text-[#2563eb] hover:underline" target="_blank" rel="noreferrer" {...props} />,
                      table: (props) => (
                        <div className="overflow-x-auto my-4">
                          <table className="min-w-full divide-y divide-slate-200 border border-slate-200" {...props} />
                        </div>
                      ),
                      thead: (props) => <thead className="bg-slate-50" {...props} />,
                      tbody: (props) => <tbody className="divide-y divide-slate-250" {...props} />,
                      tr: (props) => <tr className="hover:bg-slate-50" {...props} />,
                      th: (props) => <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700 border-r border-slate-200 last:border-0" {...props} />,
                      td: (props) => <td className="px-4 py-2 text-sm text-slate-600 border-r border-slate-200 last:border-0" {...props} />,
                    }}
                  >
                    {contentQuery.data || ""}
                  </ReactMarkdown>
                </div>
              )}
            </article>
          )}
        </main>
      </div>
    </div>
  );
}
