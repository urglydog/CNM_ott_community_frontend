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
  Users,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { dmConversationId, useDirectMessage } from "../hooks/useChatHooks";
import {
  groupConversationId,
  useGroupChat,
  isSystemMessage,
  type GroupChatMessage,
} from "../hooks/useGroupChat";
import { getGroupMembers } from "../api";
import { useSocket, type CallSignalPayload } from "../../../contexts/SocketContext";
import { useChatStore } from "../store/chatStore";
import apiClient from "../../../lib/axios";
import type { AuthUser } from "../../../types";
import { askBot } from "../api";

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
  isGroupCall: boolean;
}

interface IncomingCallData {
  conversationId: string;
  roomId: string;
  callerId: string;
  callerName: string;
  receiverId: string;
  isGroupCall: boolean;
}

function sanitizeRoomId(roomId: string): string {
  return roomId.replace(/:/g, "_");
}

function getAvatarInitial(name: string): string {
  return name?.charAt(0)?.toUpperCase() ?? "?";
}

function formatTime(isoString: string) {
  try {
    return new Date(isoString).toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/** Tạo avatar ghép (Zalo style) từ danh sách avatar thành viên */
function buildGroupAvatarUrls(members: GroupMember[], maxCount = 4): (string | null)[] {
  return members.slice(0, maxCount).map((m) => m.avatarUrl);
}

/** Avatar group: hiển thị lưới 2x2 avatar thành viên hoặc icon mặc định */
function GroupAvatar({ members, size = 48 }: { members: GroupMember[]; size?: number }) {
  const urls = buildGroupAvatarUrls(members, 4);
  const initials = urls.map((_, i) => members[i]?.displayName?.charAt(0)?.toUpperCase() ?? "?");
  const colors = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500"];
  const half = size / 2;

  if (urls.length === 0) {
    return (
      <div
        className="rounded-full bg-gray-300 flex items-center justify-center text-white font-semibold shrink-0"
        style={{ width: size, height: size }}
      >
        <Users className="w-5 h-5" />
      </div>
    );
  }

  if (urls.length === 1) {
    return (
      <div
        className="rounded-full overflow-hidden flex items-center justify-center text-white font-semibold shrink-0"
        style={{ width: size, height: size }}
      >
        {urls[0] ? (
          <img src={urls[0]} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className={`${colors[0]} w-full h-full flex items-center justify-center`}>
            {initials[0]}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="rounded-full overflow-hidden flex flex-wrap shrink-0"
      style={{ width: size, height: size }}
    >
      {urls.slice(0, 2).map((url, i) => (
        <div key={i} className="relative" style={{ width: half, height: half }}>
          {url ? (
            <img src={url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full flex items-center justify-center text-white text-[10px] font-semibold ${colors[i]}`}>
              {initials[i]}
            </div>
          )}
        </div>
      ))}
      {urls.slice(2, 4).map((url, i) => (
        <div key={i + 2} className="relative" style={{ width: half, height: half }}>
          {url ? (
            <img src={url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full flex items-center justify-center text-white text-[10px] font-semibold ${colors[i + 2]}`}>
              {initials[i + 2]}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** Avatar người gửi (Zalo style) */
function SenderAvatar({
  avatarUrl,
  name,
  size = 36,
}: {
  avatarUrl: string | null | undefined;
  name: string;
  size?: number;
}) {
  return (
    <div
      className="rounded-full overflow-hidden bg-gray-200 flex items-center justify-center text-gray-500 font-medium shrink-0"
      style={{ width: size, height: size, minWidth: size }}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        getAvatarInitial(name)
      )}
    </div>
  );
}

/** Tin nhắn hệ thống (hiển thị giữa màn hình) */
function SystemMessageBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-center my-2">
      <div className="bg-gray-200/70 text-gray-500 text-xs px-3 py-1 rounded-full">
        {content}
      </div>
    </div>
  );
}

/** Bubble tin nhắn nhóm — hiển thị avatar + tên người gửi bên trái (Zalo style) */
function GroupMessageBubble({
  msg,
  authUserId,
}: {
  msg: GroupChatMessage;
  authUserId: string | number;
}) {
  const isOwn = msg.isOwn || Number(msg.senderId) === Number(authUserId);

  const senderName =
    msg.senderDisplayName ||
    (isOwn ? "Bạn" : "Người dùng");

  return (
    <div className={`flex items-start gap-2 mb-3 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar người gửi — chỉ hiện nếu không phải mình */}
      {!isOwn && (
        <SenderAvatar
          avatarUrl={msg.senderAvatarUrl}
          name={senderName}
        />
      )}

      <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"} max-w-[68%]`}>
        {/* Tên người gửi — chỉ hiện nếu không phải mình */}
        {!isOwn && (
          <span className="text-xs text-gray-500 mb-0.5 ml-1">{senderName}</span>
        )}

        <div
          className={`px-3 py-2 rounded-2xl text-[14px] shadow-sm border ${
            isOwn
              ? "bg-blue-500 text-white border-blue-500 rounded-br-sm"
              : "bg-white text-gray-800 border-gray-200 rounded-bl-sm"
          } ${msg.sendStatus === "failed" ? "opacity-70 border-red-400" : ""}`}
        >
          {/* File/Image attachments */}
          {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
            <div className="mb-2 space-y-2">
              {msg.attachments.map((att, idx) => {
                if (att?.type === "image" && att.url) {
                  return (
                    <a
                      key={`${msg.id}-att-${idx}`}
                      href={att.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block"
                    >
                      <img
                        src={att.url}
                        alt={msg.content || "Ảnh"}
                        className="max-h-56 max-w-full rounded-lg border border-black/10 object-cover"
                      />
                    </a>
                  );
                }
                if (att?.url) {
                  return (
                    <a
                      key={`${msg.id}-att-${idx}`}
                      href={att.url}
                      target="_blank"
                      rel="noreferrer"
                      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs border ${
                        isOwn
                          ? "border-blue-200/50 bg-blue-400/30 text-blue-100"
                          : "border-gray-200 bg-gray-50 text-gray-700"
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate max-w-36">{msg.content || "Tệp"}</span>
                    </a>
                  );
                }
                return null;
              })}
            </div>
          )}

          {/* Nội dung tin nhắn */}
          <div className="whitespace-pre-wrap wrap-break-word">
            {msg.content || "[Không có nội dung]"}
          </div>

          {/* Thời gian + trạng thái gửi */}
          <div
            className={`mt-1 text-[10px] flex items-center gap-1 ${
              isOwn ? "text-blue-200 justify-end" : "text-gray-400"
            }`}
          >
            {formatTime(msg.createdAt)}
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
    </div>
  );
}

/** Bubble tin nhắn 1:1 (Private DM) */
function PrivateMessageBubble({
  msg,
  friendName,
  friendAvatarUrl,
  authUserId,
}: {
  msg: GroupChatMessage;
  friendName: string;
  friendAvatarUrl: string | null;
  authUserId: string | number;
}) {
  const isOwn = msg.isOwn || Number(msg.senderId) === Number(authUserId);

  return (
    <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"} mb-3`}>
      <div
        className={`max-w-[70%] px-3 py-2 rounded-2xl text-[14px] shadow-sm border ${
          isOwn
            ? "bg-blue-500 text-white border-blue-500 rounded-br-sm"
            : "bg-white text-gray-800 border-gray-200 rounded-bl-sm"
        } ${msg.sendStatus === "failed" ? "opacity-70 border-red-400" : ""}`}
      >
        {!isOwn && (
          <div className={`text-xs font-medium mb-0.5 ${isOwn ? "text-blue-200" : "text-gray-400"}`}>
            {friendName}
          </div>
        )}

        {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
          <div className="mb-2 space-y-2">
            {msg.attachments.map((att, idx) => {
              if (att?.type === "image" && att.url) {
                return (
                  <a
                    key={`${msg.id}-att-${idx}`}
                    href={att.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block"
                  >
                    <img
                      src={att.url}
                      alt={msg.content || "Ảnh"}
                      className="max-h-60 max-w-full rounded-lg border border-black/10 object-cover"
                    />
                  </a>
                );
              }
              if (att?.url) {
                return (
                  <a
                    key={`${msg.id}-att-${idx}`}
                    href={att.url}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs border ${
                      isOwn
                        ? "border-blue-200 bg-blue-400/40 text-white"
                        : "border-gray-200 bg-gray-50 text-gray-700"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span className="truncate max-w-44">{msg.content || "Tệp"}</span>
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
          {formatTime(msg.createdAt)}
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
}

export default function ChatWindow({ authUser }: ChatWindowProps) {
  const { selectedFriend, selectedGroup, chatMode } = useChatStore();

  const currentUserId = String((authUser as any)._id || authUser.id || "");
  const currentUserName = authUser.displayName || authUser.username || "User";

  // ── Private mode ───────────────────────────────────────────────────────
  const friendId = selectedFriend?.friend_id ?? null;
  const {
    messages: dmMessages,
    isLoadingHistory: dmLoading,
    historyError: dmError,
    sendMessage: sendDmMessage,
    isSending: dmSending,
    bottomSentinelRef: dmSentinelRef,
    scrollContainerRef: dmScrollRef,
    typingUsers: dmTypingUsers,
    onTypingChange: dmTypingChange,
  } = useDirectMessage(friendId);

  // ── Group mode ────────────────────────────────────────────────────────
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);

  const {
    messages: groupMessages,
    isLoadingHistory: groupLoading,
    historyError: groupError,
    sendMessage: sendGroupMessage,
    isSending: groupSending,
    bottomSentinelRef: groupSentinelRef,
    scrollContainerRef: groupScrollRef,
    typingUsers: groupTypingUsers,
    onTypingChange: groupTypingChange,
  } = useGroupChat(selectedGroup ?? null, groupMembers);

  // Load group members when selectedGroup changes
  useEffect(() => {
    if (!selectedGroup) {
      setGroupMembers([]);
      return;
    }
    const groupIdForMembers = selectedGroup.groupId;

    getGroupMembers(groupIdForMembers)
      .then((members) => {
        const normalized: GroupMember[] = members.map((m) => ({
          userId: String(m.userId),
          displayName: m.displayName || m.username || String(m.userId),
          username: m.username || "",
          avatarUrl: m.avatarUrl || null,
          role: (m.role as "owner" | "admin" | "member") || "member",
        }));
        setGroupMembers(normalized);
      })
      .catch(() => setGroupMembers([]));
  }, [selectedGroup]);

  const {
    socket,
    status,
    onIncomingCall,
    emitCallDeclined,
    emitEndCall,
    onCallAccepted,
    onCallDeclined,
    onEndCall,
  } = useSocket();
  const { addToast } = useToast();
  const [inputValue, setInputValue] = useState("");
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [isAskingAI, setIsAskingAI] = useState(false);
  const [aiError, setAiError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isConnected = status === "connected";

  // Lấy ref đúng dựa trên mode
  const activeSentinelRef = chatMode === "GROUP" ? groupSentinelRef : dmSentinelRef;
  const activeScrollRef = chatMode === "GROUP" ? groupScrollRef : dmScrollRef;
  const activeTypingUsers = chatMode === "GROUP" ? groupTypingUsers : dmTypingUsers;
  const activeTypingChange = chatMode === "GROUP" ? groupTypingChange : dmTypingChange;

  const friendName = selectedFriend?.friend_display_name ?? "";
  const groupName = selectedGroup?.name ?? "";
  const memberCount = groupMembers.length || selectedGroup?.memberCount || 0;

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 128)}px`;
  }, [inputValue]);

  useEffect(() => {
    const offIncoming = onIncomingCall((payload: CallSignalPayload) => {
      console.debug("[ChatWindow][onIncomingCall] payload:", payload);
      if (String(payload.callerId) === currentUserId) return;

      const isGroupCall = Boolean(payload.isGroupCall);

      if (!isGroupCall && String(payload.receiverId ?? "") !== currentUserId) {
        return;
      }

      setIncomingCallData({
        conversationId: String(payload.conversationId || payload.roomId),
        roomId: String(payload.roomId),
        callerId: String(payload.callerId),
        callerName: payload.callerName,
        receiverId: String(payload.receiverId ?? currentUserId),
        isGroupCall,
      });
    });

    const offAccepted = onCallAccepted((_payload: CallSignalPayload) => {
      console.debug("[ChatWindow][onCallAccepted] payload:", _payload);
      setIsStartingCall(false);
    });

    const offDeclined = onCallDeclined((payload: CallSignalPayload) => {
      console.debug("[ChatWindow][onCallDeclined] payload:", payload);
      if (String(payload.callerId) !== currentUserId) return;
      addToast("Người dùng đã từ chối cuộc gọi", "info");
      setIsInCall(false);
      setCallData(null);
      setIsStartingCall(false);
    });

    const offEndCall = onEndCall((payload: CallSignalPayload) => {
      console.debug("[ChatWindow][onEndCall] payload:", payload);
      const endedCurrentCall = !callData || payload.roomId === callData.roomId;

      if (!endedCurrentCall) return;

      addToast("Cuộc gọi đã kết thúc", "info", 2500);
      setIsInCall(false);
      setCallData(null);
      setIncomingCallData(null);
      setIsStartingCall(false);
    });

    return () => {
      offIncoming();
      offAccepted();
      offDeclined();
      offEndCall();
    };
  }, [
    onIncomingCall,
    onCallAccepted,
    onCallDeclined,
    onEndCall,
    status,
    currentUserId,
    addToast,
    callData,
  ]);

  async function handleStartVideoCall() {
    const isGroupCall = chatMode === "GROUP";
    const hasTarget = isGroupCall ? selectedGroup != null : selectedFriend != null;

    if (!hasTarget || isStartingCall || isInCall) return;

    setIsStartingCall(true);
    try {
      const directFriendId = String(
        (selectedFriend as any)?.friend_id ??
        (selectedFriend as any)?._id ??
        (selectedFriend as any)?.id ??
        "",
      );

      if (!isGroupCall && !directFriendId) {
        throw new Error("Khong tim thay ID nguoi nhan de goi 1-1");
      }

      const normalizedGroupId = isGroupCall
        ? String(selectedGroup!.groupId).replace("group_", "")
        : "";

      const rawRoomId = isGroupCall
        ? `group_call_${normalizedGroupId}`
        : `call_1vs1_${[currentUserId, directFriendId].sort().join("_")}`;
      const safeRoomId = sanitizeRoomId(rawRoomId);
      const conversationId = isGroupCall
        ? groupConversationId(selectedGroup!.groupId)
        : dmConversationId(currentUserId, directFriendId);

      const response = await apiClient.get<{ appID: number; token: string }>(
        "/api/calls/token",
        {
          params: {
            userID: currentUserId,
          },
        },
      );

      const payload: ActiveCallData = {
        roomId: safeRoomId,
        token: String(response.data.token),
        appId: Number(response.data.appID),
        userId: currentUserId,
        userName: currentUserName,
        conversationId,
        callerId: currentUserId,
        callerName: currentUserName,
        receiverId: isGroupCall
          ? String(selectedGroup!.groupId)
          : directFriendId,
        isGroupCall,
      };

      if (isGroupCall) {
        const groupCallPayload = {
          groupId: String(selectedGroup!.groupId),
          roomId: safeRoomId,
          callerId: currentUserId,
          callerName: currentUserName,
        };
        console.debug("[ChatWindow][emit group-call-request] payload:", groupCallPayload);
        socket?.emit("group-call-request", groupCallPayload);
      } else {
        const oneToOnePayload = {
          to: String(selectedFriend!.friend_id),
          roomId: safeRoomId,
          callerId: currentUserId,
          callerName: currentUserName,
        };
        console.debug("[ChatWindow][emit call-user] payload:", oneToOnePayload);
        socket?.emit("call-user", oneToOnePayload);
      }

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
            userID: currentUserId,
          },
        },
      );

      const acceptedPayload: ActiveCallData = {
        roomId: sanitizeRoomId(incomingCallData.roomId),
        token: String(response.data.token),
        appId: Number(response.data.appID),
        userId: currentUserId,
        userName: currentUserName,
        conversationId: incomingCallData.conversationId,
        callerId: incomingCallData.callerId,
        callerName: incomingCallData.callerName,
        receiverId: currentUserId,
        isGroupCall: incomingCallData.isGroupCall,
      };

      socket?.emit("call-accepted", {
        to: incomingCallData.callerId,
        roomId: incomingCallData.roomId,
      });
      console.debug("[ChatWindow][emit call-accepted] payload:", {
        to: incomingCallData.callerId,
        roomId: incomingCallData.roomId,
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
    if (shouldEmitSignal && callData && !callData.isGroupCall) {
      const remoteUserId = String(callData.callerId) === currentUserId
        ? String(callData.receiverId)
        : String(callData.callerId);

      emitEndCall({
        conversationId: callData.conversationId,
        roomId: callData.roomId,
        callerId: currentUserId,
        callerName: currentUserName,
        receiverId: remoteUserId,
        to: remoteUserId,
        from: currentUserId,
      });
    }

    setIsInCall(false);
    setCallData(null);
  }

  // Khi chuyển đổi giữa nhóm và DM, clear input
  useEffect(() => {
    setInputValue("");
  }, [chatMode, selectedGroup?.groupId, selectedFriend?.friend_id]);

  const handleSend = useCallback(async () => {
    if (!inputValue.trim()) return;
    if (chatMode === "GROUP") {
      if (groupSending) return;
      await sendGroupMessage(inputValue);
    } else {
      if (dmSending) return;
      await sendDmMessage(inputValue);
    }

    setInputValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    textareaRef.current?.focus();
  }, [inputValue, chatMode, groupSending, dmSending, sendGroupMessage, sendDmMessage]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handlePickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // TODO: hỗ trợ gửi file trong nhóm khi cần
    e.target.value = "";
  }

  async function handleAskAI() {
    const trimmed = aiQuestion.trim();
    if (!trimmed || isAskingAI) return;

    try {
      setIsAskingAI(true);
      setAiError("");
      const response = await askBot(trimmed);
      setAiAnswer(response.content || "AI chưa có phản hồi.");
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message || "Không thể kết nối AI Bot.";
      setAiError(errorMessage);
      setAiAnswer("");
    } finally {
      setIsAskingAI(false);
    }
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

  const placeHolder =
    chatMode === "GROUP"
      ? `Nhắn tin trong ${groupName}`
      : `Nhắn tin cho ${friendName}`;

  // ── Header ──────────────────────────────────────────────────────────
  function renderHeader() {
    const isGroup = chatMode === "GROUP";

    return (
      <div className="h-17 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          {isGroup ? (
            <GroupAvatar members={groupMembers} size={48} />
          ) : (
            <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-xl relative overflow-hidden shrink-0">
              {selectedFriend?.friend_avatar_url ? (
                <img
                  src={selectedFriend.friend_avatar_url}
                  alt={friendName}
                  className="w-full h-full object-cover"
                />
              ) : (
                getAvatarInitial(friendName)
              )}
              {isConnected && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-white rounded-full" />
              )}
            </div>
          )}

          {/* Name + subtitle */}
          <div>
            <h2 className="font-semibold text-gray-900 text-base leading-tight">
              {isGroup ? groupName : friendName}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
              {isGroup ? (
                <>
                  <Users className="w-3 h-3" />
                  {memberCount > 0
                    ? `${memberCount} thành viên`
                    : isConnected
                    ? "Đang hoạt động"
                    : "Kết nối..."
                  }
                </>
              ) : isConnected ? (
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

        {/* Action buttons */}
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
    );
  }

  // ── Message list ────────────────────────────────────────────────────
  function renderMessages() {
    return (
      <div
        ref={activeScrollRef as React.RefObject<HTMLDivElement>}
        className="flex-1 overflow-y-auto p-4 flex flex-col"
      >
        {activeLoading && (
          <div className="flex items-center justify-center py-8 text-gray-400 text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Đang tải tin nhắn...
          </div>
        )}

        {activeError && !activeLoading && (
          <div className="flex items-center justify-center py-8 text-red-400 text-sm">
            {activeError}
          </div>
        )}

        {!activeLoading && !activeError && activeMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <Smile className="w-6 h-6" />
            </div>
            <p className="text-sm">
              {chatMode === "GROUP"
                ? `Bắt đầu trò chuyện trong ${groupName}`
                : `Bắt đầu cuộc trò chuyện với ${friendName}`}
            </p>
            <p className="text-xs">Hãy gửi tin nhắn đầu tiên!</p>
          </div>
        )}

        {activeMessages.map((msg) => {
          // System message
          if (isSystemMessage(msg)) {
            return (
              <SystemMessageBubble
                key={msg.id}
                content={msg.content}
              />
            );
          }

          if (chatMode === "GROUP") {
            return (
              <GroupMessageBubble
                key={msg.id}
                msg={msg}
                authUserId={currentUserId}
              />
            );
          }

          return (
            <PrivateMessageBubble
              key={msg.id}
              msg={msg}
              friendName={friendName}
              friendAvatarUrl={selectedFriend?.friend_avatar_url ?? null}
              authUserId={currentUserId}
            />
          );
        })}

        <div ref={activeSentinelRef as React.RefObject<HTMLDivElement>} />
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────
  if (!selectedFriend && !selectedGroup) {
    return (
      <div className="flex-1 bg-[#f3f5f6] flex flex-col items-center justify-center min-w-0 text-gray-400 px-6">
        <div className="w-16 h-16 rounded-full bg-gray-200/80 flex items-center justify-center mb-4">
          <Smile className="w-8 h-8 text-gray-500" />
        </div>
        <p className="text-sm font-medium text-gray-600">Chọn một cuộc trò chuyện</p>
        <p className="text-xs text-gray-500 mt-1 text-center max-w-sm">
          Danh sách bạn bè hoặc nhóm ở cột bên trái. Tin nhắn mới sẽ cập nhật realtime.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#f3f5f6] flex flex-col relative min-w-0">
      {renderHeader()}

      {renderMessages()}

      {/* Typing indicator */}
      {activeTypingUsers.length > 0 && (
        <div className="px-4 py-1.5 bg-[#f3f5f6]">
          <p className="text-xs italic text-gray-500">
            {activeTypingUsers.length === 1
              ? `${activeTypingUsers[0]} đang soạn tin...`
              : `${activeTypingUsers.slice(0, -1).join(", ")} và ${activeTypingUsers[activeTypingUsers.length - 1]} đang soạn tin...`}
          </p>
        </div>
      )}

      {/* Input area */}
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

        {/* Toolbar */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-b border-gray-100">
          <Smile className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700" />
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={!isConnected || activeSending}
            className="text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Gửi ảnh"
          >
            <Image className="w-5 h-5 cursor-pointer" />
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!isConnected || activeSending}
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

        {/* Text input + send */}
        <div className="flex items-end px-4 py-3 gap-2">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => activeTypingChange(true)}
            onBlur={() => activeTypingChange(false)}
            placeholder={placeHolder}
            disabled={!isConnected || activeSending}
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
              disabled={!inputValue.trim() || !isConnected || activeSending}
              className="w-9 h-9 rounded-md text-blue-500 flex items-center justify-center cursor-pointer hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
              title="Gửi tin nhắn (Enter)"
            >
              {activeSending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ThumbsUp className="w-5 h-5" fill="currentColor" />
              )}
            </button>
          </div>
        </div>

        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
          <p className="text-xs font-semibold text-gray-700 mb-2">Trợ lý AI</p>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={aiQuestion}
              onChange={(e) => setAiQuestion(e.target.value)}
              placeholder="Nhập câu hỏi cho AI..."
              disabled={isAskingAI}
              className="flex-1 h-10 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 disabled:opacity-60"
            />

            <button
              type="button"
              onClick={handleAskAI}
              disabled={!aiQuestion.trim() || isAskingAI}
              className="h-10 px-4 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isAskingAI ? "Đang hỏi..." : "Hỏi AI"}
            </button>
          </div>

          {aiError && <p className="mt-2 text-xs text-red-500">{aiError}</p>}

          {aiAnswer && (
            <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 p-3">
              <p className="text-xs font-medium text-blue-700">AI Bot:</p>
              <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">
                {aiAnswer}
              </p>
            </div>
          )}
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
          const commonProps = {
            roomId: callData.roomId,
            token: callData.token,
            userId: currentUserId,
            userName: currentUserName,
            appId: 816047107,
            onLeave: () => handleHangUp(),
          };

          return callData.isGroupCall ? (
            <VideoCallGroup {...commonProps} />
          ) : (
            <VideoCall1vs1 {...commonProps} />
          );
        })()}
    </div>
  );
}
