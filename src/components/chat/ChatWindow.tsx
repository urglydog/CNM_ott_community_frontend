"use client";

import {
  MoreHorizontal,
  Phone,
  Search,
  ThumbsUp,
  Video,
  Smile,
  Image,
  Paperclip,
  Link as LinkIcon,
  MapPin,
  Contact,
  CheckSquare,
  Type,
  SmilePlus,
  AtSign,
  Gift,
  Loader2,
  WifiOff,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDirectMessage, type DmActivityPayload } from "../../hooks/useDirectMessage";
import { useSocket } from "../../contexts/SocketContext";
import type { AuthUser, FriendItem } from "../../types";
import { useLiveLocation } from "../../hooks/useLiveLocation";
import LocationMessage from "./LocationMessage";
import LiveLocationMap from "./LiveLocationMap";
import LocationShareButton from "./LocationShareButton";

interface ChatWindowProps {
  selectedFriend: FriendItem | null;
  authUser: AuthUser;
  onDmActivity?: (payload: DmActivityPayload) => void;
}

function formatTime(isoString: string) {
  try {
    return new Date(isoString).toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
    });
  } catch {
    return "";
  }
}

function getAvatarInitial(name: string): string {
  return name?.charAt(0)?.toUpperCase() ?? "?";
}

export default function ChatWindow({
  selectedFriend,
  authUser,
  onDmActivity,
}: ChatWindowProps) {
  const friendId = selectedFriend?.friend_id ?? null;

  const {
    messages,
    isLoadingHistory,
    historyError,
    sendMessage,
    isSending,
    bottomSentinelRef,
    scrollContainerRef,
    typingUsers,
    onTypingChange,
    setMessages,
  } = useDirectMessage(friendId, { onDmActivity });

  const { status } = useSocket();
  const [inputValue, setInputValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isConnected = status === "connected";

  // Logic Live Location
  const {
    isSharing,
    liveLocations,
    myLocation,
    startSharing,
    stopSharing,
  } = useLiveLocation(
    friendId ? `dm:${[Number(authUser.id), Number(friendId)].sort((a, b) => a - b).join(":")}` : null,
    setMessages
  );

  const friendName = selectedFriend?.friend_display_name ?? "";

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 128)}px`;
  }, [inputValue]);

  async function handleSend() {
    if (!inputValue.trim() || isSending) return;
    await sendMessage(inputValue);
    setInputValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!selectedFriend) {
    return (
      <div className="flex-1 bg-[#f3f5f6] flex flex-col items-center justify-center min-w-0 text-gray-400 px-6">
        <div className="w-16 h-16 rounded-full bg-gray-200/80 flex items-center justify-center mb-4">
          <Smile className="w-8 h-8 text-gray-500" />
        </div>
        <p className="text-sm font-medium text-gray-600">Chọn một cuộc trò chuyện</p>
        <p className="text-xs text-gray-500 mt-1 text-center max-w-sm">
          Danh sách bạn bè ở cột bên trái. Tin nhắn mới sẽ cập nhật trên danh sách khi có.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#f3f5f6] flex flex-col relative min-w-0">
      <div className="h-[68px] bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-xl relative overflow-hidden">
            {selectedFriend.friend_avatar_url ? (
              <img
                src={selectedFriend.friend_avatar_url}
                alt={friendName}
                className="w-full h-full object-cover"
              />
            ) : (
              getAvatarInitial(friendName)
            )}
            {isConnected && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-white rounded-full shrink-0" />
            )}
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 text-base leading-tight">{friendName}</h2>
            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
              {isConnected ? (
                <>
                  <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full" />
                  Đang hoạt động
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3" />
                  Đang kết nối lại...
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="p-2 hover:bg-gray-100 rounded-md cursor-pointer text-gray-600 transition-colors"
            title="Gọi thoại"
          >
            <Phone className="w-5 h-5" />
          </button>
          <button
            type="button"
            className="p-2 hover:bg-gray-100 rounded-md cursor-pointer text-gray-600 transition-colors"
            title="Gọi video"
          >
            <Video className="w-5 h-5" />
          </button>
          <div className="w-px h-5 bg-gray-300 mx-1" />
          <button
            type="button"
            className="p-2 hover:bg-gray-100 rounded-md cursor-pointer text-gray-600 transition-colors"
            title="Tìm kiếm"
          >
            <Search className="w-5 h-5" />
          </button>
          <button
            type="button"
            className="p-2 hover:bg-gray-100 rounded-md cursor-pointer text-gray-600 transition-colors"
            title="Khác"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 relative"
      >
        {/* Bản đồ Live Location hiển thị khi có người đang chia sẻ */}
        {(isSharing || liveLocations.size > 0) && (
          <div className="sticky top-0 z-20 mb-4 shadow-md rounded-xl overflow-hidden">
            <LiveLocationMap
              liveLocations={liveLocations}
              myLocation={myLocation}
              currentUserId={authUser.id}
              height={280}
            />
          </div>
        )}

        {isLoadingHistory && (
          <div className="flex items-center justify-center py-8 text-gray-400 text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Đang tải tin nhắn...
          </div>
        )}

        {historyError && !isLoadingHistory && (
          <div className="flex items-center justify-center py-8 text-red-400 text-sm">{historyError}</div>
        )}

        {!isLoadingHistory && !historyError && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <Smile className="w-6 h-6" />
            </div>
            <p className="text-sm">Bắt đầu cuộc trò chuyện với {friendName}</p>
            <p className="text-xs">Hãy gửi tin nhắn đầu tiên!</p>
          </div>
        )}

        {messages.map((msg) => {
          const isOwn = msg.isOwn || Number(msg.senderId) === Number(authUser.id);

          return (
            <div key={msg.id} className={`flex flex-col gap-0.5 ${isOwn ? "items-end" : "items-start"}`}>

              {/* Tên người gửi — NGOÀI bubble, phía trên */}
              {!isOwn && (
                <span className="text-xs text-gray-400 font-medium ml-2 leading-none">
                  {friendName}
                </span>
              )}

              {/* Bubble — chỉ chứa nội dung, không có tên */}
              <div
                className={`max-w-[70%] rounded-2xl text-[14px] shadow-sm border overflow-hidden ${
                  msg.contentType === "location" ? "min-w-[240px]" : ""
                } ${
                  isOwn
                    ? "bg-blue-500 text-white border-blue-500 rounded-br-sm"
                    : "bg-white text-gray-800 border-gray-200 rounded-bl-sm"
                } ${msg.sendStatus === "failed" ? "opacity-70 border-red-400" : ""}`}
              >
                {msg.contentType === "location" && msg.locationData ? (
                  /* Location: map flush to bubble edges */
                  <LocationMessage
                    locationData={msg.locationData}
                    isOwn={isOwn}
                    isLive={msg.locationData.isLive === true}
                    liveUntil={msg.locationData.liveUntil}
                    senderAvatarUrl={msg.senderAvatarUrl}
                    senderDisplayName={msg.senderDisplayName}
                  />
                ) : (
                  /* Text / other: padded */
                  <div className="px-3 py-2">
                    <div className="whitespace-pre-wrap wrap-break-word">{msg.content || "[Không có nội dung]"}</div>
                  </div>
                )}
              </div>

              {/* Timestamp — NGOÀI bubble, phía dưới */}
              <div
                className={`text-[10px] flex items-center gap-1 ${
                  isOwn ? "text-gray-400 mr-1" : "text-gray-400 ml-2"
                }`}
              >
                {formatTime(msg.createdAt)}
                {isOwn && msg.sendStatus === "sending" && <Loader2 className="w-3 h-3 animate-spin inline-block" />}
                {isOwn && msg.sendStatus === "sent" && <span>✓</span>}
                {isOwn && msg.sendStatus === "failed" && <span className="text-red-300">✗</span>}
              </div>

            </div>
          );
        })}

        <div ref={bottomSentinelRef} />
      </div>

      {typingUsers.length > 0 && (
        <div className="px-4 py-1.5 bg-[#f3f5f6]">
          <p className="text-xs italic text-gray-500">
            {typingUsers.length === 1
              ? `${typingUsers[0]} đang soạn tin...`
              : `${typingUsers.slice(0, -1).join(", ")} và ${typingUsers[typingUsers.length - 1]} đang soạn tin...`}
          </p>
        </div>
      )}

      <div className="bg-white border-t border-gray-200 flex flex-col shrink-0">
        <div className="flex items-center gap-4 px-4 py-2.5 border-b border-gray-100">
          <Smile className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700" />
          <Image className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700" />
          <Paperclip className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700" />
          <LinkIcon className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700" />
          
          {/* Nút Chia sẻ vị trí mới */}
          <LocationShareButton
            conversationId={friendId ? `dm:${[Number(authUser.id), Number(friendId)].sort((a, b) => a - b).join(":")}` : ""}
            token={authUser.token}
            isLiveSharing={isSharing}
            onStartLiveLocation={startSharing}
            onStopLiveLocation={stopSharing}
            style={{ display: "inline-flex" }}
          />

          <Contact className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700" />
          <CheckSquare className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700" />
          <Type className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700" />
          <MoreHorizontal className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700" />
        </div>

        <div className="flex items-end px-4 py-3 gap-2">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => onTypingChange(true)}
            onBlur={() => onTypingChange(false)}
            placeholder={`Nhắn tin cho ${friendName}`}
            disabled={!isConnected || isSending}
            className="flex-1 resize-none h-11 max-h-32 focus:outline-none text-[15px] pt-2.5 bg-gray-50 rounded-lg px-3 border border-gray-200 focus:ring-1 focus:ring-blue-400 focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            rows={1}
          />
          <div className="flex items-center gap-3 pb-1">
            <SmilePlus className="w-6 h-6 text-gray-400 cursor-pointer hover:text-gray-600" />
            <AtSign className="w-5 h-5 text-gray-400 cursor-pointer hover:text-gray-600" />
            <Gift className="w-5 h-5 text-gray-400 cursor-pointer hover:text-gray-600" />
            <button
              type="button"
              onClick={handleSend}
              disabled={!inputValue.trim() || !isConnected || isSending}
              className="w-9 h-9 rounded-md text-blue-500 flex items-center justify-center cursor-pointer hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
              title="Gửi tin nhắn (Enter)"
            >
              {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <ThumbsUp className="w-5 h-5" fill="currentColor" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
