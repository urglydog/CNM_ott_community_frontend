"use client";

import type { ReadReceiptReader } from "../../../types";
import { getAvatarInitial } from "../utils/messageUtils";

/** Hiển thị avatar của những người đã đọc tin nhắn (Zalo style) */
export function ReadByAvatars({
  readers,
  maxShow = 3,
  size = 18,
}: {
  readers: ReadReceiptReader[];
  maxShow?: number;
  size?: number;
}) {
  if (!readers || readers.length === 0) return null;

  const visibleReaders = readers.slice(0, maxShow);
  const remainingCount = readers.length - maxShow;

  return (
    <div className="flex items-center gap-1 mt-1">
      <div className="flex -space-x-1.5">
        {visibleReaders.map((reader, index) => (
          <div
            key={reader.userId}
            className="relative rounded-full ring-2 ring-white overflow-hidden"
            style={{
              width: size,
              height: size,
              zIndex: maxShow - index,
            }}
            title={reader.readerName}
          >
            {reader.readerAvatar ? (
              <img
                src={reader.readerAvatar}
                alt={reader.readerName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-300 flex items-center justify-center text-gray-600 text-[8px] font-medium">
                {getAvatarInitial(reader.readerName)}
              </div>
            )}
          </div>
        ))}
      </div>
      {remainingCount > 0 && (
        <span className="text-[10px] text-gray-500 ml-1">
          +{remainingCount}
        </span>
      )}
    </div>
  );
}
