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
  if (typeof children === "string" || typeof children === "number") return children.toString();
  if (Array.isArray(children)) {
    return children.map(getHeadingText).join("");
  }
  if (React.isValidElement(children)) {
    return getHeadingText((children as React.ReactElement<{ children?: React.ReactNode }>).props.children);
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
