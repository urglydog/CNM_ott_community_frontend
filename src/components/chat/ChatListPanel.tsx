"use client";

import { ChevronDown, LayoutGrid, Phone, PhoneOff, Search, UserPlus, Users } from "lucide-react";
import { AuthUser, Group } from "../../types";

interface ChatListPanelProps {
  authUser: AuthUser;
  groups: Group[];
  selectedGroup: Group | null;
  loadingGroups: boolean;
  groupsError: string | null;
  onSelectGroup: (group: Group) => void;
  activeView: "chat" | "profile";
  onActiveViewChange: (view: "chat" | "profile") => void;
}

export default function ChatListPanel({
  authUser,
  groups,
  selectedGroup,
  loadingGroups,
  groupsError,
  onSelectGroup,
  activeView,
  onActiveViewChange
}: ChatListPanelProps) {
  return (
    <div className="w-[340px] bg-white border-r border-gray-200 flex flex-col z-10 relative flex-shrink-0">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between gap-2 mb-4">
          <button
            type="button"
            onClick={() => onActiveViewChange("profile")}
            className="flex items-center gap-2 group"
          >
            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-xs">
              {(authUser.displayName || authUser.username).trim().charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col max-w-[160px] text-left">
              <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide group-hover:text-gray-700">
                Hồ sơ của tôi
              </span>
              <span className="font-semibold text-gray-800 text-sm truncate">
                {authUser.displayName}
              </span>
              <span className="text-[11px] text-gray-500 truncate">
                @{authUser.username}
              </span>
            </div>
          </button>
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-gray-600 cursor-pointer hover:text-gray-800" />
            <Users className="w-5 h-5 text-gray-600 cursor-pointer hover:text-gray-800" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-2.5 top-2 text-gray-500" />
            <input
              type="text"
              placeholder="Tìm bạn bè, nhóm và tin nhắn"
              className="w-full bg-gray-100 text-xs rounded-md pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500"
            />
          </div>
        </div>
      </div>

      <div className="px-4 py-2 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2 cursor-pointer group">
          <span className="text-xs font-semibold text-gray-500 group-hover:text-gray-700">Phân loại</span>
          <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <span className="whitespace-nowrap px-3 py-1 bg-blue-100 text-blue-600 text-xs rounded-full font-medium cursor-pointer">
            Tất cả
          </span>
          <span className="whitespace-nowrap px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full font-medium cursor-pointer hover:bg-gray-200">
            Khách hàng
          </span>
          <span className="whitespace-nowrap px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full font-medium cursor-pointer hover:bg-gray-200">
            Gia đình
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center px-4 py-3 bg-gray-100 cursor-pointer">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mr-3 flex-shrink-0">
            <LayoutGrid className="w-6 h-6 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-baseline mb-0.5">
              <span className="font-medium text-gray-900 truncate">Cộng đồng của bạn</span>
            </div>
            <p className="text-xs text-gray-500 truncate">Danh sách nhóm được tải từ backend</p>
          </div>
        </div>

        {loadingGroups && (
          <div className="px-4 py-3 text-xs text-gray-500">
            Đang tải danh sách cộng đồng...
          </div>
        )}

        {groupsError && !loadingGroups && (
          <div className="px-4 py-3 text-xs text-red-500">{groupsError}</div>
        )}

        {!loadingGroups && !groupsError &&
          groups.map((group) => (
            <div
              key={group.groupId}
              className={`flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer ${
                selectedGroup?.groupId === group.groupId ? "bg-blue-50" : ""
              }`}
              onClick={() => onSelectGroup(group)}
            >
              <div className="w-12 h-12 rounded-full bg-purple-200 flex items-center justify-center mr-3 flex-shrink-0 text-purple-700 font-semibold">
                {group.name?.trim()?.charAt(0)?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                  <span className="font-medium text-gray-900 truncate">{group.name}</span>
                </div>
                <p className="text-xs text-gray-500 truncate">
                  {group.description || "Nhóm cộng đồng OTT"}
                </p>
              </div>
            </div>
          ))}
      </div>

      <div className="absolute bottom-4 left-4 right-4 bg-white rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.1)] border border-gray-200 p-3 flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
            KN
          </div>
          <span className="text-sm font-medium text-gray-800">Kim Ngân đang gọi...</span>
        </div>
        <div className="flex gap-2">
          <button className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 transition-colors">
            <PhoneOff className="w-5 h-5" fill="currentColor" />
          </button>
          <button className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white hover:bg-green-600 transition-colors animate-pulse">
            <Phone className="w-5 h-5" fill="currentColor" />
          </button>
        </div>
      </div>
    </div>
  );
}
