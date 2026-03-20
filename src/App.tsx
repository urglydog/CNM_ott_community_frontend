"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, FormEvent } from 'react';

import { Channel, Group, MessageItem, AuthUser } from './types';
import AuthScreen, { AuthFormState, AuthMode } from './components/auth/AuthScreen';
import Sidebar from './components/layout/Sidebar';
import ChatListPanel from './components/chat/ChatListPanel';
import ChatWindow from './components/chat/ChatWindow';
import ProfileOverlay from './components/profile/ProfileOverlay';
import {
  authRequest,
  fetchGroups as apiFetchGroups,
  fetchChannelsByGroup as apiFetchChannelsByGroup,
  fetchMessagesByChannel as apiFetchMessagesByChannel
} from './api/client';

export default function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authForm, setAuthForm] = useState<AuthFormState>({
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

  useEffect(() => {
    async function loadGroups() {
      try {
        setLoadingGroups(true);
        setGroupsError(null);

        const list: Group[] = await apiFetchGroups();
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

    loadGroups();
  }, []);

  // Khi chọn group, tải danh sách channel của group đó
  useEffect(() => {
    async function loadChannels() {
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

        const list: Channel[] = await apiFetchChannelsByGroup(selectedGroup.groupId);
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

    loadChannels();
  }, [selectedGroup]);

  // Khi chọn channel, tải messages của channel đó
  useEffect(() => {
    async function loadMessages() {
      if (!selectedChannel) {
        setMessages([]);
        return;
      }
      try {
        setLoadingMessages(true);
        setMessagesError(null);
        setMessages([]);

        const list: MessageItem[] = await apiFetchMessagesByChannel(selectedChannel.id);
        setMessages(list);
      } catch (error: any) {
        setMessagesError(error?.message || 'Không tải được tin nhắn');
      } finally {
        setLoadingMessages(false);
      }
    }

    loadMessages();
  }, [selectedChannel]);

  async function handleAuthSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      setAuthLoading(true);
      setAuthError(null);

      const body: any = {
        username: authForm.username,
        password: authForm.password
      };
      if (authMode === 'register') {
        body.email = authForm.email || `${authForm.username}@example.com`;
        body.displayName = authForm.displayName || authForm.username;
      }

      const { user, token } = await authRequest(authMode, body);
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
      <AuthScreen
        authMode={authMode}
        authForm={authForm}
        authLoading={authLoading}
        authError={authError}
        onAuthModeChange={setAuthMode}
        onAuthFormChange={setAuthForm}
        onSubmit={handleAuthSubmit}
      />
    );
  }

  return (
    <div className="flex h-screen w-full bg-gray-100 overflow-hidden font-sans text-sm relative">
      <Sidebar />
      <ChatListPanel
        authUser={authUser}
        groups={groups}
        selectedGroup={selectedGroup}
        loadingGroups={loadingGroups}
        groupsError={groupsError}
        onSelectGroup={setSelectedGroup}
        activeView={activeView}
        onActiveViewChange={setActiveView}
      />
      <ChatWindow selectedGroup={selectedGroup} messages={messages} />
      <ProfileOverlay
        activeView={activeView}
        authUser={authUser}
        onClose={() => setActiveView('chat')}
        onLogout={handleLogout}
      />
    </div>
  );
}