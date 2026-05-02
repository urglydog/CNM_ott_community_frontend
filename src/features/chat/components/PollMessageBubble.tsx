"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { BarChart3, Loader2, CheckCircle2, ChevronRight } from "lucide-react";
import { useSocket } from "../../../contexts/SocketContext";
import type { GroupChatMessage } from "../hooks/useGroupChat";
import type { PollData, PollOption } from "../../../types";

interface PollMessageBubbleProps {
  msg: GroupChatMessage;
  currentUserId: string | number;
}

export function PollMessageBubble({ msg, currentUserId }: PollMessageBubbleProps) {
  const { emitPollVote } = useSocket();
  const pollData: PollData | null = msg.pollData ?? null;

  // Get user ID as string for comparison
  const userIdStr = String(currentUserId);

  // Memoize the pollData string for dependency tracking
  const pollDataKey = useMemo(() => {
    if (!pollData) return "";
    return JSON.stringify(pollData);
  }, [pollData]);

  // Check if current user has already voted (from latest poll data)
  const userVotedOptionIds = useMemo(() => {
    if (!pollData) return [];
    return pollData.pollOptions
      .filter((opt) => opt.voterIds?.map(String).includes(userIdStr))
      .map((opt) => opt.id);
  }, [pollData, userIdStr]);

  // Calculate total unique voters across all options
  const totalVoters = useMemo(() => {
    if (!pollData) return 0;
    const uniqueVoterIds = new Set<string>();
    pollData.pollOptions.forEach((opt) => {
      (opt.voterIds || []).forEach((id) => uniqueVoterIds.add(String(id)));
    });
    return uniqueVoterIds.size;
  }, [pollData]);

  // User has already voted if their ID exists in any voterIds
  const hasVoted = userVotedOptionIds.length > 0;

  // Editing state - allows user to change their vote
  const [isEditing, setIsEditing] = useState(false);
  // Local selected options state (for UI selection before submitting)
  const [selectedOptions, setSelectedOptions] = useState<string[]>(userVotedOptionIds);
  const [isVoting, setIsVoting] = useState(false);

  // Sync selectedOptions when pollData updates (real-time vote changes from other users)
  useEffect(() => {
    // Only sync from pollData if not currently editing
    if (!isEditing) {
      setSelectedOptions(userVotedOptionIds);
    }
  }, [pollDataKey, userVotedOptionIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // Calculate total votes
  const totalVotes = pollData?.pollOptions.reduce(
    (sum, opt) => sum + (opt.voterIds?.length || 0),
    0
  ) || 0;

  // Calculate percentage for an option
  const getPercentage = (option: PollOption) => {
    if (totalVotes === 0) return 0;
    return Math.round(((option.voterIds?.length || 0) / totalVotes) * 100);
  };

  const isMultipleChoice = pollData?.pollSettings?.multipleChoice ?? false;

  // Handle option click (toggle selection)
  const handleOptionClick = useCallback(
    (optionId: string) => {
      if (isVoting) return;
      // Only allow clicking when not voted yet OR when editing
      if (hasVoted && !isEditing) return;

      setSelectedOptions((prev) => {
        if (isMultipleChoice) {
          return prev.includes(optionId)
            ? prev.filter((id) => id !== optionId)
            : [...prev, optionId];
        } else {
          return prev.includes(optionId) ? [] : [optionId];
        }
      });
    },
    [isVoting, hasVoted, isEditing, isMultipleChoice]
  );

  // Start editing vote
  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
    // Pre-fill with previously voted options
    setSelectedOptions(userVotedOptionIds);
  }, [userVotedOptionIds]);

  // Cancel editing
  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setSelectedOptions(userVotedOptionIds);
  }, [userVotedOptionIds]);

  // Handle vote submission (new vote or update)
  const handleVote = useCallback(async () => {
    if (!msg.conversationId || !msg.id || selectedOptions.length === 0) return;

    setIsVoting(true);
    try {
      for (const optionId of selectedOptions) {
        await emitPollVote(String(msg.conversationId), msg.id, optionId);
      }
      setIsEditing(false);
    } catch (error) {
      console.error("[PollMessageBubble] Vote error:", error);
    } finally {
      setIsVoting(false);
    }
  }, [msg.conversationId, msg.id, selectedOptions, emitPollVote]);

  if (!pollData) {
    return (
      <div className="flex justify-center my-3">
        <div className="bg-gray-100 rounded-xl p-4 max-w-md w-full text-sm text-gray-500">
          Dữ liệu bình chọn không khả dụng.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full my-3">
      {/* Notification Pill */}
      <div className="mb-3">
        <div className="inline-flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 transition-colors rounded-full px-4 py-1.5 text-sm">
          <BarChart3 className="w-3.5 h-3.5 text-green-600 shrink-0" />
          <span className="text-gray-600">
            <span className="font-medium">
              {msg.senderDisplayName || "Ai đó"}
            </span>{" "}
            tạo cuộc bình chọn mới: <strong>{msg.content}</strong>
          </span>
        </div>
      </div>

      {/* Poll Card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm max-w-md w-full p-4">
        {/* Header */}
        <div className="mb-2">
          <h3 className="text-lg font-semibold text-gray-900">{msg.content}</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {isMultipleChoice
              ? "Chọn nhiều phương án"
              : "Chọn một phương án"}
          </p>

          {/* Vote Summary Link */}
          {totalVoters > 0 && (
            <div className="mt-2">
              <button
                className="text-blue-500 hover:underline text-sm font-medium flex items-center gap-1"
                onClick={() => {}}
              >
                {totalVoters} người bình chọn
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Options List - Voted State or Editing State */}
        <div className="space-y-2">
          {pollData.pollOptions.map((option) => {
            const isSelected = selectedOptions.includes(option.id);
            const isUserVoted = userVotedOptionIds.includes(option.id);
            const percentage = getPercentage(option);
            const voteCount = option.voterIds?.length || 0;

            return (
              <div key={option.id} className="flex items-center gap-3">
                {/* Option Box - Colored Bar */}
                <div
                  onClick={() => handleOptionClick(option.id)}
                  className={`
                    flex-1 flex justify-between items-center p-3 rounded-lg transition-all duration-200
                    ${!hasVoted || isEditing
                      ? isSelected
                        ? "bg-blue-100 cursor-pointer"
                        : "bg-gray-100 hover:bg-gray-200 cursor-pointer"
                      : isUserVoted
                        ? "bg-blue-100 cursor-default"
                        : "bg-gray-100 cursor-default"
                    }
                  `}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-medium ${
                        isSelected ? "text-blue-700" : "text-gray-700"
                      }`}
                    >
                      {option.text}
                    </span>
                  </div>

                  {/* Checkmark for user's selected option */}
                  {isSelected && (
                    <CheckCircle2 className="w-5 h-5 text-blue-600" />
                  )}
                </div>

                {/* Vote Count - Outside the colored bar */}
                <div className="text-sm text-gray-700 w-12 text-right">
                  {voteCount} phiếu
                </div>
              </div>
            );
          })}
        </div>

        {/* Percentage bar */}
        {totalVotes > 0 && (
          <div className="mt-3 space-y-1">
            {pollData.pollOptions.map((option) => {
              const percentage = getPercentage(option);
              const isUserVoted = userVotedOptionIds.includes(option.id);

              return (
                <div key={option.id} className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isUserVoted ? "bg-blue-500" : "bg-gray-300"
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-10 text-right">
                    {percentage}%
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Action Button */}
        <div className="mt-4">
          {!hasVoted && !isEditing && (
            <button
              onClick={handleVote}
              disabled={selectedOptions.length === 0 || isVoting}
              className={`
                w-full py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2
                ${
                  selectedOptions.length === 0 || isVoting
                    ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
                    : "bg-blue-500 text-white hover:bg-blue-600"
                }
              `}
            >
              {isVoting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang bình chọn...
                </>
              ) : (
                <>
                  <BarChart3 className="w-4 h-4" />
                  Bình chọn
                </>
              )}
            </button>
          )}

          {hasVoted && !isEditing && (
            <button
              onClick={handleStartEdit}
              className="w-full py-2 border border-blue-500 text-blue-600 rounded-lg font-medium hover:bg-blue-50 bg-white transition-colors"
            >
              Đổi lựa chọn
            </button>
          )}

          {isEditing && (
            <div className="flex gap-2">
              <button
                onClick={handleCancelEdit}
                disabled={isVoting}
                className="flex-1 py-2 border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50 bg-white transition-colors disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={handleVote}
                disabled={selectedOptions.length === 0 || isVoting}
                className={`
                  flex-1 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2
                  ${
                    selectedOptions.length === 0 || isVoting
                      ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
                      : "bg-blue-500 text-white hover:bg-blue-600"
                  }
                `}
              >
                {isVoting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang cập nhật...
                  </>
                ) : (
                  <>
                    <BarChart3 className="w-4 h-4" />
                    Cập nhật
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
