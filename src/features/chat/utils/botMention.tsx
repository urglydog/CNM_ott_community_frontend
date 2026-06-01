import type { ReactNode } from "react";

export const BOT_AGENT_ID = "bot_agent";
export const BOT_AGENT_NAME = "Trợ lý AI";
export const BOT_DISPLAY_NAME = "BotAI";
export const BOT_AVATAR_URL = "/botai-avatar.svg";

const BOT_MENTION_ALIASES = [BOT_AGENT_NAME, BOT_DISPLAY_NAME, "Bot"];

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isBotSender(senderId?: string | number | null) {
  return String(senderId || "").trim().toLowerCase() === "ai-bot";
}

export function getBotMentionRegex() {
  const aliasesPattern = BOT_MENTION_ALIASES.map(escapeRegex).join("|");
  return new RegExp(`@(?:${aliasesPattern})(?=\\s|$|[,.!?:;])`, "giu");
}

export function renderBotMentionHighlight(
  content: string,
  keyPrefix = "bot-mention",
): ReactNode {
  if (!content) {
    return content;
  }

  const regex = getBotMentionRegex();
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    parts.push(
      <span
        key={`${keyPrefix}-${match.index}`}
        className="font-bold text-blue-500"
      >
        {match[0]}
      </span>,
    );

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts.length > 0 ? parts : content;
}
