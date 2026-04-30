import type { ReactNode } from "react";

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function formatSearchDateTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString("vi-VN", {
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

export function getMessageDomId(messageId: string | number): string {
  return `chat-message-${String(messageId)}`;
}

export function highlightKeyword(
  content: string,
  keyword: string,
): ReactNode {
  const text = String(content || "");
  const key = String(keyword || "").trim();
  if (!key) return text || "[Khong co noi dung]";

  const regex = new RegExp(`(${escapeRegExp(key)})`, "gi");
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;
    const isMatch = part.toLowerCase() === key.toLowerCase();
    if (!isMatch) return <span key={`${part}-${index}`}>{part}</span>;
    return (
      <mark
        key={`${part}-${index}`}
        className="rounded bg-yellow-200 px-0.5 text-gray-900"
      >
        {part}
      </mark>
    );
  });
}
