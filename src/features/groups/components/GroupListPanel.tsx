"use client";

import { Users, Plus } from "lucide-react";
import type { Group } from "../types";

interface GroupListPanelProps {
  groups: Group[];
  isLoading: boolean;
  selectedGroup: Group | null;
  onSelectGroup: (group: Group) => void;
  onOpenCreateGroup: () => void;
  onOpenJoinGroup: () => void;
}

function getAvatarInitial(name: string): string {
  return name?.charAt(0)?.toUpperCase() ?? "?";
}

export default function GroupListPanel({
  groups,
  isLoading,
  selectedGroup,
  onSelectGroup,
  onOpenCreateGroup,
  onOpenJoinGroup,
}: GroupListPanelProps) {
  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-[#005ae0]" />
          <h2 className="text-[15px] font-semibold text-gray-900">
            Nhóm của tôi
          </h2>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {groups.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenJoinGroup}
            className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-[#005ae0] transition-colors"
            title="Tham gia nhóm bằng mã mời"
            aria-label="Tham gia nhóm bằng mã mời"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
          <button
            onClick={onOpenCreateGroup}
            className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-[#005ae0] transition-colors"
            title="Tạo nhóm mới"
            aria-label="Tạo nhóm mới"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Group List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-8 h-8 border-2 border-[#005ae0] border-t-transparent rounded-full animate-spin" />
            <p className="text-[13px] text-gray-400">Đang tải nhóm...</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4 px-4">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
              <Users className="w-8 h-8 text-gray-300" />
            </div>
            <div className="text-center">
              <p className="text-[14px] font-medium text-gray-700 mb-1">
                Chưa có nhóm nào
              </p>
              <p className="text-[13px] text-gray-400">
                Tạo nhóm mới hoặc tham gia bằng mã mời
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onOpenJoinGroup}
                className="px-4 py-2 text-[13px] font-medium rounded-md border border-[#005ae0] text-[#005ae0] hover:bg-blue-50 transition-colors"
              >
                Tham gia nhóm
              </button>
              <button
                onClick={onOpenCreateGroup}
                className="px-4 py-2 text-[13px] font-medium rounded-md bg-[#005ae0] text-white hover:bg-[#0047b3] transition-colors"
              >
                Tạo nhóm
              </button>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {groups.map((group) => {
              const isSelected =
                selectedGroup &&
                String(selectedGroup.groupId) === String(group.groupId);
              return (
                <li key={String(group.groupId)}>
                  <button
                    onClick={() => onSelectGroup(group)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left ${
                      isSelected ? "bg-blue-50 border-l-2 border-[#005ae0]" : ""
                    }`}
                    aria-current={isSelected ? "true" : undefined}
                  >
                    {/* Group Avatar */}
                    <div className="w-10 h-10 rounded-full bg-[#005ae0] text-white flex items-center justify-center text-[15px] font-semibold shrink-0 overflow-hidden">
                      {group.avatarUrl ? (
                        <img
                          src={group.avatarUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        getAvatarInitial(group.name)
                      )}
                    </div>

                    {/* Group Info */}
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold text-gray-900 truncate">
                        {group.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <svg
                          className="w-3.5 h-3.5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        <span className="text-[12px] text-gray-500">
                          {group.memberCount ?? 0} thành viên
                        </span>
                      </div>
                      {group.description && (
                        <p className="text-[12px] text-gray-400 truncate mt-0.5">
                          {group.description}
                        </p>
                      )}
                    </div>

                    {/* Arrow */}
                    <svg
                      className="w-4 h-4 text-gray-300 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}