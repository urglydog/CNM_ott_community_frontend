"use client";

import { Users } from "lucide-react";
import type { GroupMember } from "../../groups/types";

/** Lấy chữ cái đầu của tên */
function getAvatarInitial(name: string): string {
  return name?.charAt(0)?.toUpperCase() ?? "?";
}

/** Tạo avatar ghép (Zalo style) từ danh sách avatar thành viên */
function buildGroupAvatarUrls(
  members: GroupMember[],
  maxCount = 4,
): (string | null)[] {
  return members.slice(0, maxCount).map((m) => m.avatarUrl);
}

/** Avatar group: hiển thị lưới 2x2 avatar thành viên hoặc icon mặc định */
export function GroupAvatar({
  members,
  size = 48,
}: {
  members: GroupMember[];
  size?: number;
}) {
  const urls = buildGroupAvatarUrls(members, 4);
  const initials = urls.map(
    (_, i) => members[i]?.displayName?.charAt(0)?.toUpperCase() ?? "?",
  );
  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-orange-500",
  ];
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
          <div
            className={`${colors[0]} w-full h-full flex items-center justify-center`}
          >
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
            <div
              className={`w-full h-full flex items-center justify-center text-white text-[10px] font-semibold ${colors[i]}`}
            >
              {initials[i]}
            </div>
          )}
        </div>
      ))}
      {urls.slice(2, 4).map((url, i) => (
        <div
          key={i + 2}
          className="relative"
          style={{ width: half, height: half }}
        >
          {url ? (
            <img src={url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div
              className={`w-full h-full flex items-center justify-center text-white text-[10px] font-semibold ${colors[i + 2]}`}
            >
              {initials[i + 2]}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** Avatar người gửi (Zalo style) */
export function SenderAvatar({
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
        <img
          src={avatarUrl}
          alt={name}
          className="w-full h-full object-cover"
        />
      ) : (
        getAvatarInitial(name)
      )}
    </div>
  );
}
