import React from "react";

export interface HeadingItem {
  id: string;
  text: string;
  level: number;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export function getHeadingText(children: React.ReactNode): string {
  if (!children) return "";
  if (typeof children === "string") return children;
  if (Array.isArray(children)) {
    return children.map(getHeadingText).join("");
  }
  if (typeof children === "object" && children !== null && "props" in children) {
    const props = (children as React.ReactElement).props;
    if (props && "children" in props) {
      return getHeadingText(props.children);
    }
  }
  return "";
}

export function extractHeadings(markdown: string): HeadingItem[] {
  if (!markdown) return [];

  // Remove triple backtick code blocks to avoid false headings inside comments
  const withoutCodeBlocks = markdown.replace(/```[\s\S]*?```/g, "");

  const headings: HeadingItem[] = [];
  const regex = /^(#{1,3})\s+(.+)$/gm;
  let match;

  while ((match = regex.exec(withoutCodeBlocks)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const id = slugify(text);
    headings.push({ id, text, level });
  }

  return headings;
}
