"use client";

import { Loader2 } from "lucide-react";
import type { GroupChatMessage } from "../hooks/useGroupChat";
import type { Friend } from "../../../types";
import type { GroupInfo } from "../../groups/types";

interface AiConversationTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface AiChatMessagesProps {
  aiConversation: AiConversationTurn[];
  isAskingAI: boolean;
  aiError: string;
}

export function AiChatMessages({
  aiConversation,
  isAskingAI,
  aiError,
}: AiChatMessagesProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
      {aiConversation.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            <span className="text-2xl">🤖</span>
          </div>
          <p className="text-sm text-gray-600">
            Bắt đầu cuộc trò chuyện với AI
          </p>
          <p className="text-xs">
            Bạn có thể hỏi nhanh ngay trong khung chat này.
          </p>
        </div>
      )}

      {aiConversation.map((turn) => {
        const isUser = turn.role === "user";
        return (
          <div
            key={turn.id}
            className={`flex ${isUser ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm border shadow-sm whitespace-pre-wrap ${isUser
                  ? "bg-blue-500 border-blue-500 text-white rounded-br-sm"
                  : "bg-white border-gray-200 text-gray-800 rounded-bl-sm"
                }`}
            >
              {turn.content}
            </div>
          </div>
        );
      })}

      {isAskingAI && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          AI đang trả lời...
        </div>
      )}

      {aiError && (
        <div className="text-xs text-red-500 px-3">
          {aiError}
        </div>
      )}
    </div>
  );
}

// Export types for use in parent
export type { AiConversationTurn };
