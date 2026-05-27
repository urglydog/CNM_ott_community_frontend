/** Hàm tiện ích cho message rendering */

/** Lấy chữ cái đầu của tên */
export function getAvatarInitial(name: string): string {
  return name?.charAt(0)?.toUpperCase() ?? "?";
}

/** Format thời gian từ ISO string */
export function formatTime(isoString: string) {
  try {
    return new Date(isoString).toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/** Kiểm tra message có phải là system message không */
export function isSystemMessage(msg: { contentType?: string }): boolean {
  return msg.contentType === "system";
}

/** Lấy nội dung hiển thị của tin nhắn reply */
export function getReplyContent(msg: {
  contentType?: string;
  content?: string | null;
  attachments?: Array<{ type?: string }> | null;
}): string {
  if (msg.contentType === "image") return "[Hình ảnh]";
  if (msg.contentType === "video") return "[Video]";
  if (msg.contentType === "sticker") return "[Sticker]";
  if (msg.contentType === "emoji") return msg.content || "[Biểu tượng cảm xúc]";
  if (Array.isArray(msg.attachments) && msg.attachments.length > 0) {
    const hasImage = msg.attachments.some((a) => a?.type === "image");
    if (hasImage) return "[Hình ảnh]";
  }
  return msg.content || "[Tin nhắn]";
}

/** Kiểm tra message có phải là emoji thuần túy không */
export function isPureEmoji(content: string | undefined): boolean {
  return Boolean(
    content &&
      /^(\p{Emoji_Presentation}|\p{Extended_Pictographic})+$/u.test(
        content.trim(),
      ),
  );
}

/** Kiểm tra message có thể thu hồi được không (trong vòng 24h) */
export function canRevokeMessage(createdAt: string): boolean {
  try {
    const messageTime = new Date(createdAt).getTime();
    const now = Date.now();
    const diffHours = (now - messageTime) / (1000 * 60 * 60);
    return diffHours <= 24;
  } catch {
    return false;
  }
}
