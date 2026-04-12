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
  FileText,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { dmConversationId, useDirectMessage } from "../hooks/useChatHooks";
import { useSocket, type CallSignalPayload } from "../../../contexts/SocketContext";
import { useChatStore } from "../store/chatStore";
import { buildOneToOneCallRoomId } from "../api";
import apiClient from "../../../lib/axios";
import type { AuthUser } from "../../../types";
import VideoCallRoom from "../../../components/chat/VideoCallRoom";
import { useToast } from "../../../contexts/ToastContext";

interface ChatWindowProps {
  authUser: AuthUser;
}

interface ActiveCallData {
  roomId: string;
  token: string;
  appId: number;
  userId: string;
  userName: string;
  conversationId: string;
  callerId: string;
  callerName: string;
  receiverId: string;
}

interface IncomingCallData {
  conversationId: string;
  roomId: string;
  callerId: string;
  callerName: string;
  receiverId: string;
}

function sanitizeRoomId(roomId: string): string {
  return roomId.replace(/:/g, "_");
}

export default function ChatWindow({ authUser }: ChatWindowProps) {
  const { selectedFriend } = useChatStore();
  const friendId = selectedFriend?.friend_id ?? null;

  const {
    messages,
    isLoadingHistory,
    historyError,
    sendMessage,
    sendFileMessage,
    isSending,
    isUploadingFile,
    bottomSentinelRef,
    scrollContainerRef,
    typingUsers,
    onTypingChange,
  } = useDirectMessage(friendId);

  const {
    status,
    emitCallUser,
    emitCallAccepted,
    emitCallDeclined,
    emitEndCall,
    onCallAccepted,
    onCallDeclined,
    onEndCall,
  } = useSocket();
  const { addToast } = useToast();
  const [inputValue, setInputValue] = useState("");
  const [isInCall, setIsInCall] = useState(false);
  const [isStartingCall, setIsStartingCall] = useState(false);
  const [callData, setCallData] = useState<ActiveCallData | null>(null);
  const [incomingCallData, setIncomingCallData] =
    useState<IncomingCallData | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isConnected = status === "connected";

  const friendName = selectedFriend?.friend_display_name ?? "";

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 128)}px`;
  }, [inputValue]);

  useEffect(() => {
    const offAccepted = onCallAccepted((payload: CallSignalPayload) => {
      if (String(payload.callerId) !== String(authUser.id)) return;
      if (!payload.token || !payload.appId) return;

      setCallData({
        roomId: sanitizeRoomId(payload.roomId),
        token: payload.token,
        appId: payload.appId,
        userId: String(authUser.id),
        userName: authUser.displayName || authUser.username,
        conversationId: payload.conversationId,
        callerId: String(payload.callerId),
        callerName: payload.callerName,
        receiverId: String(payload.receiverId),
      });
      setIsInCall(true);
      setIsStartingCall(false);
    });

    const offDeclined = onCallDeclined((payload: CallSignalPayload) => {
      if (String(payload.callerId) !== String(authUser.id)) return;
      setIsInCall(false);
      setCallData(null);
      setIsStartingCall(false);
    });

    const offEndCall = onEndCall((payload: CallSignalPayload) => {
      const endedCurrentCall =
        !callData || payload.conversationId === callData.conversationId;

      if (!endedCurrentCall) return;

      addToast("Cuoc goi da ket thuc", "info", 2500);
      setIsInCall(false);
      setCallData(null);
      setIncomingCallData(null);
      setIsStartingCall(false);
    });

    return () => {
      offAccepted();
      offDeclined();
      offEndCall();
    };
  }, [
    onCallAccepted,
    onCallDeclined,
    onEndCall,
    status,
    authUser.id,
    authUser.displayName,
    authUser.username,
    addToast,
    callData,
  ]);

  async function handleStartVideoCall() {
    if (!selectedFriend || isStartingCall || isInCall) return;

    setIsStartingCall(true);
    try {
      const rawRoomId = buildOneToOneCallRoomId(
        authUser.id,
        selectedFriend.friend_id,
      );
      const safeRoomId = sanitizeRoomId(rawRoomId);

      const response = await apiClient.get<{ appID: number; token: string }>(
        "/api/calls/token",
        {
          params: {
            userID: String(authUser.id),
          },
        },
      );

      const payload: ActiveCallData = {
        roomId: safeRoomId,
        token: String(response.data.token),
        appId: Number(response.data.appID),
        userId: String(authUser.id),
        userName: authUser.displayName || authUser.username,
        conversationId: dmConversationId(authUser.id, selectedFriend.friend_id),
        callerId: String(authUser.id),
        callerName: authUser.displayName || authUser.username,
        receiverId: String(selectedFriend.friend_id),
      };

      emitCallUser({
        conversationId: payload.conversationId,
        roomId: rawRoomId,
        callerId: payload.callerId,
        callerName: payload.callerName,
        receiverId: payload.receiverId,
      });
      setCallData(payload);
      setIsInCall(true);
    } catch {
      setIsInCall(false);
      setCallData(null);
    } finally {
      setIsStartingCall(false);
    }
  }

  async function handleAcceptIncomingCall() {
    if (!incomingCallData) return;

    try {
      const response = await apiClient.get<{ appID: number; token: string }>(
        "/api/calls/token",
        {
          params: {
            userID: String(authUser.id),
          },
        },
      );

      const acceptedPayload: ActiveCallData = {
        roomId: sanitizeRoomId(incomingCallData.roomId),
        token: String(response.data.token),
        appId: Number(response.data.appID),
        userId: String(authUser.id),
        userName: authUser.displayName || authUser.username,
        conversationId: incomingCallData.conversationId,
        callerId: incomingCallData.callerId,
        callerName: incomingCallData.callerName,
        receiverId: String(authUser.id),
      };

      emitCallAccepted({
        conversationId: incomingCallData.conversationId,
        roomId: incomingCallData.roomId,
        callerId: incomingCallData.callerId,
        callerName: incomingCallData.callerName,
        receiverId: incomingCallData.receiverId,
        token: acceptedPayload.token,
        appId: acceptedPayload.appId,
      });

      setCallData(acceptedPayload);
      setIsInCall(true);
      setIncomingCallData(null);
    } catch (error) {
      console.error("Loi khi nguoi nghe lay token:", error);
    }
  }

  function handleDeclineIncomingCall() {
    if (!incomingCallData) return;
    emitCallDeclined(incomingCallData);
    setIncomingCallData(null);
  }

  function handleHangUp(shouldEmitSignal = true) {
    if (shouldEmitSignal && callData) {
      const remoteUserId =
        String(callData.callerId) === String(authUser.id)
          ? String(callData.receiverId)
          : String(callData.callerId);

      emitEndCall({
        conversationId: callData.conversationId,
        roomId: callData.roomId,
        callerId: String(authUser.id),
        callerName: authUser.displayName || authUser.username,
        receiverId: remoteUserId,
        to: remoteUserId,
        from: String(authUser.id),
      });
    }

    setIsInCall(false);
    setCallData(null);
  }

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

  async function handlePickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || isUploadingFile) return;
    await sendFileMessage(file);
    e.target.value = "";
  }

  if (!selectedFriend) {
    return (
      <div className="flex-1 bg-[#f3f5f6] flex flex-col items-center justify-center min-w-0 text-gray-400 px-6">
        <div className="w-16 h-16 rounded-full bg-gray-200/80 flex items-center justify-center mb-4">
          <Smile className="w-8 h-8 text-gray-500" />
        </div>
        <p className="text-sm font-medium text-gray-600">
          Chọn một cuộc trò chuyện
        </p>
        <p className="text-xs text-gray-500 mt-1 text-center max-w-sm">
          Danh sách bạn bè ở cột bên trái. Tin nhắn mới sẽ cập nhật trên danh
          sách khi có.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#f3f5f6] flex flex-col relative min-w-0">
      <div className="h-17 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-xl relative overflow-hidden">
            {selectedFriend.friend_avatar_url ? (
              <img
                src={selectedFriend.friend_avatar_url}
                alt={friendName}
                className="w-full h-full object-cover"
              />
            ) : (
              friendName.charAt(0).toUpperCase()
            )}
            {isConnected && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-white rounded-full shrink-0" />
            )}
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 text-base leading-tight">
              {friendName}
            </h2>
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
            onClick={handleStartVideoCall}
            disabled={!isConnected || isStartingCall || isInCall}
          >
            {isStartingCall ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Video className="w-5 h-5" />
            )}
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
        className="flex-1 overflow-y-auto p-4 flex flex-col gap-3"
      >
        {isLoadingHistory && (
          <div className="flex items-center justify-center py-8 text-gray-400 text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Đang tải tin nhắn...
          </div>
        )}

        {historyError && !isLoadingHistory && (
          <div className="flex items-center justify-center py-8 text-red-400 text-sm">
            {historyError}
          </div>
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
          const isOwn =
            msg.isOwn || Number(msg.senderId) === Number(authUser.id);

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[70%] px-3 py-2 rounded-2xl text-[14px] shadow-sm border ${
                  isOwn
                    ? "bg-blue-500 text-white border-blue-500 rounded-br-sm"
                    : "bg-white text-gray-800 border-gray-200 rounded-bl-sm"
                } ${msg.sendStatus === "failed" ? "opacity-70 border-red-400" : ""}`}
              >
                {!isOwn && (
                  <div
                    className={`text-xs font-medium mb-0.5 ${isOwn ? "text-blue-200" : "text-gray-400"}`}
                  >
                    {friendName}
                  </div>
                )}
                {Array.isArray(msg.attachments) &&
                  msg.attachments.length > 0 && (
                    <div className="mb-2 space-y-2">
                      {msg.attachments.map((attachment, idx) => {
                        if (attachment?.type === "image" && attachment.url) {
                          return (
                            <a
                              key={`${msg.id}-attachment-${idx}`}
                              href={attachment.url}
                              target="_blank"
                              rel="noreferrer"
                              className="block"
                            >
                              <img
                                src={attachment.url}
                                alt={msg.content || "Ảnh đính kèm"}
                                className="max-h-60 max-w-full rounded-lg border border-black/10 object-cover"
                              />
                            </a>
                          );
                        }

                        if (attachment?.url) {
                          return (
                            <a
                              key={`${msg.id}-attachment-${idx}`}
                              href={attachment.url}
                              target="_blank"
                              rel="noreferrer"
                              className={`inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs border ${
                                isOwn
                                  ? "border-blue-200 bg-blue-400/40 text-white"
                                  : "border-gray-200 bg-gray-50 text-gray-700"
                              }`}
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span className="truncate max-w-44">
                                {msg.content || "Tệp đính kèm"}
                              </span>
                            </a>
                          );
                        }

                        return null;
                      })}
                    </div>
                  )}
                <div className="whitespace-pre-wrap wrap-break-word">
                  {msg.content || "[Không có nội dung]"}
                </div>
                <div
                  className={`mt-1 text-[10px] flex items-center gap-1 ${
                    isOwn ? "text-blue-200 justify-end" : "text-gray-400"
                  }`}
                >
                  {new Date(msg.createdAt).toLocaleString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {isOwn && msg.sendStatus === "sending" && (
                    <Loader2 className="w-3 h-3 animate-spin inline-block" />
                  )}
                  {isOwn && msg.sendStatus === "sent" && <span>✓</span>}
                  {isOwn && msg.sendStatus === "failed" && (
                    <span className="text-red-300">✗</span>
                  )}
                </div>
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
        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif"
          className="hidden"
          onChange={handlePickFile}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          className="hidden"
          onChange={handlePickFile}
        />
        <div className="flex items-center gap-4 px-4 py-2.5 border-b border-gray-100">
          <Smile className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700" />
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={!isConnected || isUploadingFile}
            className="text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Gửi ảnh"
          >
            <Image className="w-5 h-5 cursor-pointer" />
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!isConnected || isUploadingFile}
            className="text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Gửi tệp"
          >
            <Paperclip className="w-5 h-5 cursor-pointer" />
          </button>
          <LinkIcon className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700" />
          <MapPin className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700" />
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
            disabled={!isConnected || isSending || isUploadingFile}
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
              disabled={
                !inputValue.trim() ||
                !isConnected ||
                isSending ||
                isUploadingFile
              }
              className="w-9 h-9 rounded-md text-blue-500 flex items-center justify-center cursor-pointer hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
              title="Gửi tin nhắn (Enter)"
            >
              {isSending || isUploadingFile ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ThumbsUp className="w-5 h-5" fill="currentColor" />
              )}
            </button>
          </div>
        </div>
      </div>

      {incomingCallData && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Cuộc gọi đến</h3>
            <p className="mt-1 text-sm text-gray-600">{friendName || "Bạn bè"} đang gọi video cho bạn.</p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleDeclineIncomingCall}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Từ chối
              </button>
              <button
                type="button"
                onClick={handleAcceptIncomingCall}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Chấp nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {isInCall &&
        callData &&
        (() => {
          const safeUserId = String(callData.userId || "").trim();

          if (!safeUserId) {
            return (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Dang tai thong tin nguoi dung...
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Chua the vao cuoc goi vi userId dang rong.
                  </p>
                </div>
              </div>
            );
          }

          return (
            <VideoCallRoom
              roomId={callData.roomId}
              token={callData.token}
              appId={callData.appId}
              userId={safeUserId}
              userName={callData.userName}
              remoteUserId={
                String(callData.callerId) === String(authUser.id)
                  ? String(callData.receiverId)
                  : String(callData.callerId)
              }
              conversationId={callData.conversationId}
              onLeave={() => handleHangUp(false)}
            />
          );
        })()}
    </div>
  );
}
