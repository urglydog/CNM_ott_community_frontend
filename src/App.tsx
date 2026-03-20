"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, FormEvent } from 'react';

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

type AuthUser = {
  id: number;
  username: string;
  displayName: string;
  email?: string;
  token: string;
};

export default function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authForm, setAuthForm] = useState({
    username: '',
    password: '',
    email: '',
    displayName: ''
  });

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
  const [activeView, setActiveView] = useState<'chat' | 'profile'>('chat');

  const apiBase = 'http://localhost:4000';

  useEffect(() => {
    async function fetchGroups() {
      try {
        setLoadingGroups(true);
        setGroupsError(null);

        const res = await fetch(`${apiBase}/api/groups`);
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

        const res = await fetch(`${apiBase}/api/channels/group/${selectedGroup.groupId}`);
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

        const res = await fetch(`${apiBase}/api/messages/channel/${selectedChannel.id}`);
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

  async function handleAuthSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      setAuthLoading(true);
      setAuthError(null);

      const endpoint = authMode === 'login' ? '/api/users/login' : '/api/users/register';
      const body: any = {
        username: authForm.username,
        password: authForm.password
      };
      if (authMode === 'register') {
        body.email = authForm.email || `${authForm.username}@example.com`;
        body.displayName = authForm.displayName || authForm.username;
      }

      const res = await fetch(`${apiBase}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || `Auth failed (${res.status})`);
      }
      const data = await res.json();
      const user = data.user;
      const token = data.token as string;
      setAuthUser({
        id: user.id,
        username: user.username,
        displayName: user.display_name || user.displayName || user.username,
        email: user.email,
        token
      });
    } catch (error: any) {
      setAuthError(error?.message || 'Đăng nhập/Đăng ký thất bại');
    } finally {
      setAuthLoading(false);
    }
  }

  function handleLogout() {
    setAuthUser(null);
    setSelectedGroup(null);
    setChannels([]);
    setSelectedChannel(null);
    setMessages([]);
    setActiveView('chat');
  }

  if (!authUser) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-100 font-sans">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-6 border border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900 mb-1 text-center">
            OTT Community - Đăng nhập
          </h1>
          <p className="text-xs text-gray-500 mb-4 text-center">
            Đề tài: OTT cho Cộng đồng & Nhóm xã hội
          </p>
          <div className="flex justify-center mb-4 text-xs gap-2">
            <button
              type="button"
              className={`px-3 py-1 rounded-full border ${
                authMode === 'login'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300'
              }`}
              onClick={() => setAuthMode('login')}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              className={`px-3 py-1 rounded-full border ${
                authMode === 'register'
                  ? 'bg-blue-50 text-blue-700 border-blue-300'
                  : 'bg-white text-gray-700 border-gray-300'
              }`}
              onClick={() => setAuthMode('register')}
            >
              Đăng ký
            </button>
          </div>
          <form onSubmit={handleAuthSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Tên đăng nhập</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={authForm.username}
                onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Mật khẩu</label>
              <input
                type="password"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={authForm.password}
                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                required
              />
            </div>
            {authMode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email (tuỳ chọn)</label>
                  <input
                    type="email"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={authForm.email}
                    onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tên hiển thị (tuỳ chọn)</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={authForm.displayName}
                    onChange={(e) => setAuthForm({ ...authForm, displayName: e.target.value })}
                  />
                </div>
              </>
            )}
            {authError && (
              <p className="text-xs text-red-500">{authError}</p>
            )}
            <button
              type="submit"
              className="w-full mt-1 bg-blue-600 text-white rounded-md py-2 text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
              disabled={authLoading}
            >
              {authLoading ? 'Đang xử lý...' : authMode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-gray-100 overflow-hidden font-sans text-sm relative">
      {/* 1. Left Main Navigation Sidebar */}
      <div className="w-[64px] bg-[#005ae0] flex flex-col items-center py-4 justify-between z-20">
        <div className="flex flex-col items-center gap-4 w-full">
          <div className="w-10 h-10 bg-white text-[#005ae0] rounded-2xl flex items-center justify-center font-bold text-2xl mb-2 shadow-sm">
            Z
          </div>
          <div className="w-full flex justify-center py-3 bg-[#1a66e3] relative cursor-pointer">
            <MessageCircle className="text-white w-6 h-6" fill="currentColor" />
            <div className="absolute top-2 right-3 w-2.5 h-2.5 bg-red-500 border-2 border-[#1a66e3] rounded-full"></div>
          </div>
          <div className="w-full flex justify-center py-3 hover:bg-[#1a66e3] cursor-pointer relative">
            <Users className="text-white/90 w-6 h-6" />
            <div className="absolute top-2 right-3 w-2.5 h-2.5 bg-red-500 border-2 border-[#005ae0] rounded-full"></div>
          </div>
          <div className="w-full flex justify-center py-3 hover:bg-[#1a66e3] cursor-pointer">
            <LayoutGrid className="text-white/90 w-6 h-6" />
          </div>
          <div className="w-full flex justify-center py-3 hover:bg-[#1a66e3] cursor-pointer">
            <Newspaper className="text-white/90 w-6 h-6" />
          </div>
          <div className="w-full flex justify-center py-3 hover:bg-[#1a66e3] cursor-pointer">
            <ScrollText className="text-white/90 w-6 h-6" />
          </div>
        </div>
        <div className="flex flex-col items-center gap-4 w-full">
          <div className="w-full flex justify-center py-3 hover:bg-[#1a66e3] cursor-pointer">
            <Settings className="text-white/90 w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 2. Center Chat List Panel */}
      <div className="w-[340px] bg-white border-r border-gray-200 flex flex-col z-10 relative flex-shrink-0">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between gap-2 mb-4">
            <button
              type="button"
              onClick={() => setActiveView('profile')}
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
            <span className="whitespace-nowrap px-3 py-1 bg-blue-100 text-blue-600 text-xs rounded-full font-medium cursor-pointer">Tất cả</span>
            <span className="whitespace-nowrap px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full font-medium cursor-pointer hover:bg-gray-200">Khách hàng</span>
            <span className="whitespace-nowrap px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full font-medium cursor-pointer hover:bg-gray-200">Gia đình</span>
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
            <div className="px-4 py-3 text-xs text-gray-500">Đang tải danh sách cộng đồng...</div>
          )}

          {groups.map((group) => (
            <div
              key={group.groupId}
              className={`flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer ${
                selectedGroup?.groupId === group.groupId ? 'bg-blue-50' : ''
              }`}
              onClick={() => setSelectedGroup(group)}
            >
              <div className="w-12 h-12 rounded-full bg-purple-200 flex items-center justify-center mr-3 flex-shrink-0 text-purple-700 font-semibold">
                {group.name?.trim()?.charAt(0)?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                  <span className="font-medium text-gray-900 truncate">{group.name}</span>
                </div>
                <p className="text-xs text-gray-500 truncate">{group.description || 'Nhóm cộng đồng OTT' }</p>
              </div>
            </div>
          ))}
        </div>

        <div className="absolute bottom-4 left-4 right-4 bg-white rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.1)] border border-gray-200 p-3 flex items-center justify-between z-30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">KN</div>
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

      {/* 3. Right Chat Conversation Panel */}
      <div className="flex-1 bg-[#f3f5f6] flex flex-col relative min-w-0">
        <div className="absolute top-0 right-0 flex z-50">
          <div className="w-11 h-8 hover:bg-gray-200 flex items-center justify-center cursor-pointer text-gray-500 transition-colors"><Minus className="w-4 h-4" /></div>
          <div className="w-11 h-8 hover:bg-gray-200 flex items-center justify-center cursor-pointer text-gray-500 transition-colors"><Square className="w-3 h-3" /></div>
          <div className="w-11 h-8 hover:bg-red-500 hover:text-white flex items-center justify-center cursor-pointer text-gray-500 transition-colors"><X className="w-4 h-4" /></div>
        </div>

        <div className="h-[68px] bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-purple-200 flex items-center justify-center text-purple-700 font-semibold text-xl relative">
              {(selectedGroup?.name || 'K').trim().charAt(0).toUpperCase()}
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 text-base leading-tight">{selectedGroup?.name || 'Chọn một cộng đồng'}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{selectedGroup ? 'Nhóm cộng đồng trong OTT Community' : 'Truy cập 18 phút trước'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 pr-32">
            <div className="p-2 hover:bg-gray-100 rounded-md cursor-pointer text-gray-600 transition-colors" title="Thêm bạn"><UserPlus className="w-5 h-5" /></div>
            <div className="p-2 hover:bg-gray-100 rounded-md cursor-pointer text-gray-600 transition-colors" title="Gọi thoại"><Phone className="w-5 h-5" /></div>
            <div className="p-2 hover:bg-gray-100 rounded-md cursor-pointer text-gray-600 transition-colors" title="Gọi video"><Video className="w-5 h-5" /></div>
            <div className="w-px h-5 bg-gray-300 mx-1"></div>
            <div className="p-2 hover:bg-gray-100 rounded-md cursor-pointer text-gray-600 transition-colors" title="Tìm kiếm"><Search className="w-5 h-5" /></div>
            <div className="p-2 hover:bg-gray-100 rounded-md cursor-pointer text-gray-600 transition-colors" title="Cài đặt khác"><MoreHorizontal className="w-5 h-5" /></div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {selectedGroup && messages.map((msg) => (
            <div key={msg.id} className="flex justify-start items-end gap-2">
              <div className="bg-white text-gray-800 px-3 py-2 rounded-2xl rounded-bl-sm max-w-[70%] shadow-sm border border-gray-200 text-[14px]">
                <div className="text-xs text-gray-500 mb-0.5">Người gửi #{msg.senderId}</div>
                <div>{msg.content}</div>
                <div className="mt-1 text-[10px] text-gray-400">{new Date(msg.createdAt).toLocaleString('vi-VN')}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white border-t border-gray-200 flex flex-col flex-shrink-0">
          <div className="flex items-center gap-4 px-4 py-2.5 border-b border-gray-100">
            <Smile className="w-5 h-5 text-gray-500 cursor-pointer" /><Image className="w-5 h-5 text-gray-500 cursor-pointer" />
            <Paperclip className="w-5 h-5 text-gray-500" /><LinkIcon className="w-5 h-5 text-gray-500" />
            <MapPin className="w-5 h-5 text-gray-500" /><Contact className="w-5 h-5 text-gray-500" />
            <CheckSquare className="w-5 h-5 text-gray-500" /><Type className="w-5 h-5 text-gray-500" /><MoreHorizontal className="w-5 h-5 text-gray-500" />
          </div>
          <div className="flex items-end px-4 py-3 gap-2">
            <textarea placeholder="Nhập tin nhắn..." className="flex-1 resize-none h-11 max-h-32 focus:outline-none text-[15px] pt-2.5" rows={1}></textarea>
            <div className="flex items-center gap-3 pb-1">
              <SmilePlus className="w-6 h-6 text-gray-400" /><AtSign className="w-5 h-5 text-gray-400" /><Gift className="w-5 h-5 text-gray-400" />
              <div className="w-9 h-9 rounded-md text-blue-500 flex items-center justify-center cursor-pointer hover:bg-blue-50"><ThumbsUp className="w-6 h-6" fill="currentColor" /></div>
            </div>
          </div>
        </div>
      </div>

      {activeView === 'profile' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/10 px-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-lg border border-gray-200 p-6 relative">
            <X className="absolute top-4 right-4 cursor-pointer text-gray-400 hover:text-gray-600" onClick={() => setActiveView('chat')} />
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Hồ sơ cá nhân</h2>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-xl">
                {(authUser.displayName || authUser.username).charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-sm text-gray-500">Tên hiển thị</div>
                <div className="text-base font-semibold text-gray-900">{authUser.displayName}</div>
                <div className="mt-1 text-xs text-gray-500">@{authUser.username}</div>
              </div>
            </div>
            <div className="space-y-2 text-sm text-gray-700 mb-4 border-t pt-4">
              <div className="flex justify-between"><span className="text-gray-500">ID người dùng</span><span>{authUser.id}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Email</span><span className="truncate">{authUser.email}</span></div>
            </div>
            <div className="flex justify-end"><button onClick={handleLogout} className="px-3 py-1.5 text-xs rounded-md border border-red-300 text-red-600 hover:bg-red-50">Đăng xuất</button></div>
          </div>
        </div>
      )}
    </div>
  );
}