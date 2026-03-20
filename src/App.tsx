"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';

import {
  AtSign,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Contact,
  Gift,
  Heart,
  Image,
  LayoutGrid,
  Link as LinkIcon,
  MapPin,
  MessageCircle,
  Minus,
  MoreHorizontal,
  Newspaper,
  Paperclip,
  Phone,
  PhoneOff,
  ScrollText,
  Search,
  Settings,
  Smile,
  SmilePlus,
  Sparkles,
  Square,
  ThumbsUp,
  Type,
  UserPlus,
  Users,
  Video,
  X
} from 'lucide-react';

type Group = {
  groupId: string | number;
  name: string;
  description?: string;
  topic?: string;
};

type Channel = {
  id: number;
  groupId: number;
  name: string;
  type: 'text_chat' | 'voice_room';
};

type MessageItem = {
  id: number;
  conversationId: string;
  senderId: number;
  contentType: string;
  content: string;
  createdAt: string;
};

export default function App() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState<boolean>(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingChannels, setLoadingChannels] = useState<boolean>(false);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchGroups() {
      try {
        setLoadingGroups(true);
        setGroupsError(null);

        const res = await fetch('http://localhost:4000/api/groups');
        if (!res.ok) {
          throw new Error(`Failed to load groups (${res.status})`);
        }
        const data = await res.json();
        const list: Group[] = Array.isArray(data) ? data : [];
        setGroups(list);
        if (list.length > 0) {
          setSelectedGroup(list[0]);
        }
      } catch (error: any) {
        setGroupsError(error?.message || 'Không tải được danh sách cộng đồng');
      } finally {
        setLoadingGroups(false);
      }
    }

    fetchGroups();
  }, []);

  // Khi chọn group, tải danh sách channel của group đó
  useEffect(() => {
    async function fetchChannels() {
      if (!selectedGroup) {
        setChannels([]);
        setSelectedChannel(null);
        return;
      }
      try {
        setLoadingChannels(true);
        setChannelsError(null);
        setChannels([]);
        setSelectedChannel(null);

        const res = await fetch(`http://localhost:4000/api/channels/group/${selectedGroup.groupId}`);
        if (!res.ok) {
          throw new Error(`Failed to load channels (${res.status})`);
        }
        const data = await res.json();
        const list: Channel[] = Array.isArray(data) ? data : [];
        setChannels(list);
        if (list.length > 0) {
          setSelectedChannel(list[0]);
        }
      } catch (error: any) {
        setChannelsError(error?.message || 'Không tải được danh sách kênh');
      } finally {
        setLoadingChannels(false);
      }
    }

    fetchChannels();
  }, [selectedGroup]);

  // Khi chọn channel, tải messages của channel đó
  useEffect(() => {
    async function fetchMessages() {
      if (!selectedChannel) {
        setMessages([]);
        return;
      }
      try {
        setLoadingMessages(true);
        setMessagesError(null);
        setMessages([]);

        const res = await fetch(`http://localhost:4000/api/messages/channel/${selectedChannel.id}`);
        if (!res.ok) {
          throw new Error(`Failed to load messages (${res.status})`);
        }
        const data = await res.json();
        const list: MessageItem[] = Array.isArray(data) ? data : [];
        setMessages(list);
      } catch (error: any) {
        setMessagesError(error?.message || 'Không tải được tin nhắn');
      } finally {
        setLoadingMessages(false);
      }
    }

    fetchMessages();
  }, [selectedChannel]);

  return (
    <div className="flex h-screen w-full bg-gray-100 overflow-hidden font-sans text-sm">
      {/* 1. Left Main Navigation Sidebar */}
      <div className="w-[64px] bg-[#005ae0] flex flex-col items-center py-4 justify-between z-20">
        {/* Top Icons */}
        <div className="flex flex-col items-center gap-4 w-full">
          {/* Zalo Logo Placeholder */}
          <div className="w-10 h-10 bg-white text-[#005ae0] rounded-2xl flex items-center justify-center font-bold text-2xl mb-2 shadow-sm">
            Z
          </div>
          
          {/* Messages (Selected) */}
          <div className="w-full flex justify-center py-3 bg-[#1a66e3] relative cursor-pointer">
            <MessageCircle className="text-white w-6 h-6" fill="currentColor" />
            <div className="absolute top-2 right-3 w-2.5 h-2.5 bg-red-500 border-2 border-[#1a66e3] rounded-full"></div>
          </div>
          
          {/* Contacts */}
          <div className="w-full flex justify-center py-3 hover:bg-[#1a66e3] cursor-pointer relative">
            <Users className="text-white/90 w-6 h-6" />
            <div className="absolute top-2 right-3 w-2.5 h-2.5 bg-red-500 border-2 border-[#005ae0] rounded-full"></div>
          </div>
          
          {/* Groups */}
          <div className="w-full flex justify-center py-3 hover:bg-[#1a66e3] cursor-pointer">
            <LayoutGrid className="text-white/90 w-6 h-6" />
          </div>
          
          {/* News */}
          <div className="w-full flex justify-center py-3 hover:bg-[#1a66e3] cursor-pointer">
            <Newspaper className="text-white/90 w-6 h-6" />
          </div>
          
          {/* Diary */}
          <div className="w-full flex justify-center py-3 hover:bg-[#1a66e3] cursor-pointer">
            <ScrollText className="text-white/90 w-6 h-6" />
          </div>
        </div>
        
        {/* Bottom Icons */}
        <div className="flex flex-col items-center gap-4 w-full">
          <div className="w-full flex justify-center py-3 hover:bg-[#1a66e3] cursor-pointer">
            <Settings className="text-white/90 w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 2. Center Chat List Panel */}
      <div className="w-[340px] bg-white border-r border-gray-200 flex flex-col z-10 relative flex-shrink-0">
        {/* Search Bar & Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-xs">
              KN
            </div>
            <span className="font-semibold text-gray-800">Zalo - Kim Ngân</span>
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
            <UserPlus className="w-5 h-5 text-gray-600 cursor-pointer hover:text-gray-800" />
            <Users className="w-5 h-5 text-gray-600 cursor-pointer hover:text-gray-800" />
          </div>
        </div>

        {/* Categorization Bar */}
        <div className="px-4 py-2 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2 cursor-pointer group">
            <span className="text-xs font-semibold text-gray-500 group-hover:text-gray-700">Phân loại</span>
            <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <span className="whitespace-nowrap px-3 py-1 bg-blue-100 text-blue-600 text-xs rounded-full font-medium cursor-pointer">Tất cả</span>
            <span className="whitespace-nowrap px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full font-medium cursor-pointer hover:bg-gray-200">Khách hàng</span>
            <span className="whitespace-nowrap px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full font-medium cursor-pointer hover:bg-gray-200">Gia đình</span>
            <span className="whitespace-nowrap px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full font-medium cursor-pointer hover:bg-gray-200">Công việc</span>
            <span className="whitespace-nowrap px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full font-medium cursor-pointer hover:bg-gray-200">Bạn bè</span>
            <span className="whitespace-nowrap px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full font-medium cursor-pointer hover:bg-gray-200">Trả lời sau</span>
            <span className="whitespace-nowrap px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full font-medium cursor-pointer hover:bg-gray-200">Đồng nghiệp</span>
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {/* Dòng đầu tiên cố định cho "Cộng đồng" */}
          <div className="flex items-center px-4 py-3 bg-gray-100 cursor-pointer">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mr-3 flex-shrink-0">
              <LayoutGrid className="w-6 h-6 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline mb-0.5">
                <span className="font-medium text-gray-900 truncate">Cộng đồng của bạn</span>
              </div>
              <p className="text-xs text-gray-500 truncate">
                Danh sách nhóm được tải từ backend
              </p>
            </div>
          </div>

          {loadingGroups && (
            <div className="px-4 py-3 text-xs text-gray-500">Đang tải danh sách cộng đồng...</div>
          )}

          {groupsError && !loadingGroups && (
            <div className="px-4 py-3 text-xs text-red-500">{groupsError}</div>
          )}

          {!loadingGroups && !groupsError && groups.length === 0 && (
            <div className="px-4 py-3 text-xs text-gray-500">
              Chưa có cộng đồng nào. Hãy tạo group mới trong backend.
            </div>
          )}

          {!loadingGroups && !groupsError && groups.map((group) => {
            const initial = group.name?.trim()?.charAt(0)?.toUpperCase() || '?';
            const topic = group.topic || 'community';

            return (
              <div
                key={group.groupId}
                className={`flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer ${
                  selectedGroup?.groupId === group.groupId ? 'bg-blue-50' : ''
                }`}
                onClick={() => setSelectedGroup(group)}
              >
                <div className="w-12 h-12 rounded-full bg-purple-200 flex items-center justify-center mr-3 flex-shrink-0 text-purple-700 font-semibold">
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span className="font-medium text-gray-900 truncate">{group.name}</span>
                    <span className="text-xs text-gray-400 uppercase">{topic}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {group.description || 'Nhóm cộng đồng OTT' }
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Call Preview Pop-up */}
        <div className="absolute bottom-4 left-4 right-4 bg-white rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.1)] border border-gray-200 p-3 flex items-center justify-between z-30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
              KN
            </div>
            <span className="text-sm font-medium text-gray-800">Kim Ngân đang gọi...</span>
          </div>
          <div className="flex gap-2">
            <button className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 shadow-sm transition-colors">
              <PhoneOff className="w-5 h-5" fill="currentColor" />
            </button>
            <button className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white hover:bg-green-600 shadow-sm transition-colors animate-pulse">
              <Phone className="w-5 h-5" fill="currentColor" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Right Chat Conversation Panel */}
      <div className="flex-1 bg-[#f3f5f6] flex flex-col relative min-w-0">
        {/* Window Controls */}
        <div className="absolute top-0 right-0 flex z-50">
          <div className="w-11 h-8 hover:bg-gray-200 flex items-center justify-center cursor-pointer text-gray-500 transition-colors">
            <Minus className="w-4 h-4" />
          </div>
          <div className="w-11 h-8 hover:bg-gray-200 flex items-center justify-center cursor-pointer text-gray-500 transition-colors">
            <Square className="w-3 h-3" />
          </div>
          <div className="w-11 h-8 hover:bg-red-500 hover:text-white flex items-center justify-center cursor-pointer text-gray-500 transition-colors">
            <X className="w-4 h-4" />
          </div>
        </div>

        {/* Conversation Header */}
        <div className="h-[68px] bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-purple-200 flex items-center justify-center text-purple-700 font-semibold text-xl relative">
              {(selectedGroup?.name || 'K').trim().charAt(0).toUpperCase()}
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 text-base leading-tight">
                {selectedGroup?.name || 'Chọn một cộng đồng'}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {selectedGroup
                  ? 'Nhóm cộng đồng trong OTT Community'
                  : 'Truy cập 18 phút trước'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 pr-32"> {/* Padding right to avoid window controls */}
            <div className="p-2 hover:bg-gray-100 rounded-md cursor-pointer text-gray-600 transition-colors" title="Thêm bạn">
              <UserPlus className="w-5 h-5" />
            </div>
            <div className="p-2 hover:bg-gray-100 rounded-md cursor-pointer text-gray-600 transition-colors" title="Gọi thoại">
              <Phone className="w-5 h-5" />
            </div>
            <div className="p-2 hover:bg-gray-100 rounded-md cursor-pointer text-gray-600 transition-colors" title="Gọi video">
              <Video className="w-5 h-5" />
            </div>
            <div className="w-px h-5 bg-gray-300 mx-1"></div>
            <div className="p-2 hover:bg-gray-100 rounded-md cursor-pointer text-gray-600 transition-colors" title="Tìm kiếm">
              <Search className="w-5 h-5" />
            </div>
            <div className="p-2 hover:bg-gray-100 rounded-md cursor-pointer text-gray-600 transition-colors" title="Cài đặt khác">
              <MoreHorizontal className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Chat History Area */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {!selectedGroup && (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
              Chọn một cộng đồng để xem tin nhắn
            </div>
          )}

          {selectedGroup && (
            <>
              {/* Thông tin kênh hiện tại */}
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-gray-500">
                  Kênh:
                  <span className="font-medium text-gray-800 ml-1">
                    {selectedChannel ? selectedChannel.name : 'Chưa có kênh'}
                  </span>
                </div>
                {loadingChannels && (
                  <span className="text-xs text-gray-400">Đang tải kênh...</span>
                )}
              </div>

              {channelsError && (
                <div className="text-xs text-red-500 mb-2">{channelsError}</div>
              )}

              {/* Danh sách kênh (nếu muốn chọn tay, hiện tại chỉ hiển thị) */}
              {channels.length > 1 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {channels.map((ch) => (
                    <button
                      key={ch.id}
                      onClick={() => setSelectedChannel(ch)}
                      className={`px-3 py-1 rounded-full text-xs border ${
                        selectedChannel?.id === ch.id
                          ? 'bg-blue-100 text-blue-700 border-blue-300'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {ch.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Nội dung tin nhắn */}
              {loadingMessages && (
                <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
                  Đang tải tin nhắn...
                </div>
              )}

              {messagesError && !loadingMessages && (
                <div className="text-sm text-red-500">{messagesError}</div>
              )}

              {!loadingMessages && !messagesError && messages.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
                  Chưa có tin nhắn nào trong kênh này.
                </div>
              )}

              {!loadingMessages && !messagesError && messages.length > 0 && (
                <div className="flex flex-col gap-2 mt-1">
                  {messages.map((msg) => (
                    <div key={msg.id} className="flex justify-start items-end gap-2">
                      <div className="bg-white text-gray-800 px-3 py-2 rounded-2xl rounded-bl-sm max-w-[70%] shadow-sm border border-gray-200 text-[14px]">
                        <div className="text-xs text-gray-500 mb-0.5">Người gửi #{msg.senderId}</div>
                        <div>{msg.content || '[Không có nội dung]'}</div>
                        <div className="mt-1 text-[10px] text-gray-400">
                          {new Date(msg.createdAt).toLocaleString('vi-VN')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-gray-200 flex flex-col flex-shrink-0">
          {/* Toolbar */}
          <div className="flex items-center gap-4 px-4 py-2.5 border-b border-gray-100">
            <Smile className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-800 transition-colors" />
            <Image className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-800 transition-colors" />
            <div className="relative cursor-pointer group">
              <Paperclip className="w-5 h-5 text-gray-500 group-hover:text-gray-800 transition-colors" />
              <span className="absolute -top-1.5 -right-3 text-[9px] font-medium bg-gray-200 text-gray-600 px-1 rounded">1GB</span>
            </div>
            <LinkIcon className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-800 transition-colors ml-2" />
            <MapPin className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-800 transition-colors" />
            <Contact className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-800 transition-colors" />
            <CheckSquare className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-800 transition-colors" />
            <Type className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-800 transition-colors" />
            <MoreHorizontal className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-800 transition-colors" />
          </div>

          {/* Text Input */}
          <div className="flex items-end px-4 py-3 gap-2">
            <textarea 
              placeholder={selectedGroup
                ? `Nhập tin nhắn tới ${selectedGroup.name}`
                : 'Nhập tin nhắn vào cuộc trò chuyện'} 
              className="flex-1 resize-none h-11 max-h-32 focus:outline-none text-[15px] text-gray-800 pt-2.5 placeholder-gray-400"
              rows={1}
            ></textarea>
            <div className="flex items-center gap-3 pb-1">
              <SmilePlus className="w-6 h-6 text-gray-400 cursor-pointer hover:text-gray-600 transition-colors" />
              <AtSign className="w-5 h-5 text-gray-400 cursor-pointer hover:text-gray-600 transition-colors" />
              <Gift className="w-5 h-5 text-gray-400 cursor-pointer hover:text-gray-600 transition-colors" />
              <div className="w-9 h-9 rounded-md text-blue-500 flex items-center justify-center cursor-pointer hover:bg-blue-50 transition-colors">
                <ThumbsUp className="w-6 h-6" fill="currentColor" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

