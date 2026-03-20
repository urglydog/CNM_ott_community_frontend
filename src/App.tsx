/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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

export default function App() {
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
          {/* Truyền File */}
          <div className="flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mr-3 flex-shrink-0">
              <Cloud className="w-6 h-6 text-blue-500" fill="currentColor" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline mb-0.5">
                <span className="font-medium text-gray-900 truncate">Truyền File</span>
              </div>
              <p className="text-xs text-gray-500 truncate">Trao đổi file giữa các thiết bị của bạn</p>
            </div>
          </div>

          {/* Mẹ */}
          <div className="flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer">
            <div className="w-12 h-12 rounded-full bg-pink-200 flex items-center justify-center mr-3 flex-shrink-0 text-pink-700 font-semibold">
              M
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline mb-0.5">
                <span className="font-medium text-gray-900 truncate">Mẹ</span>
                <span className="text-xs text-gray-400">17 giờ</span>
              </div>
              <p className="text-xs text-gray-500 truncate">Bạn: [Sticker]</p>
            </div>
          </div>

          {/* KN (Selected) */}
          <div className="flex items-center px-4 py-3 bg-gray-100 cursor-pointer">
            <div className="w-12 h-12 rounded-full bg-purple-200 flex items-center justify-center mr-3 flex-shrink-0 text-purple-700 font-semibold relative">
              K
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline mb-0.5">
                <span className="font-medium text-gray-900 truncate">KN</span>
                <span className="text-xs text-gray-400">20 giờ</span>
              </div>
              <p className="text-xs text-gray-500 truncate">[Hình ảnh]</p>
            </div>
          </div>

          {/* Zalo Hỗ Trợ PC */}
          <div className="flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer">
            <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center mr-3 flex-shrink-0 text-white font-bold text-xl">
              Z
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline mb-0.5">
                <span className="font-medium text-gray-900 truncate">Zalo Hỗ Trợ PC</span>
                <span className="text-xs text-gray-400">Hôm qua</span>
              </div>
              <p className="text-xs text-gray-500 truncate">Cập nhật phiên bản v.19.12.01: Zalo PC...</p>
            </div>
          </div>

          {/* Tqh */}
          <div className="flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer">
            <div className="w-12 h-12 rounded-full bg-green-200 flex items-center justify-center mr-3 flex-shrink-0 text-green-700 font-semibold">
              T
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline mb-0.5">
                <span className="font-medium text-gray-900 truncate">Tqh</span>
                <span className="text-xs text-gray-400">2 ngày</span>
              </div>
              <p className="text-xs text-gray-500 truncate">Ok em</p>
            </div>
          </div>

          {/* 1 */}
          <div className="flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer">
            <div className="w-12 h-12 rounded-full bg-orange-200 flex items-center justify-center mr-3 flex-shrink-0 text-orange-700 font-semibold">
              1
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline mb-0.5">
                <span className="font-medium text-gray-900 truncate">1</span>
                <span className="text-xs text-gray-400">3 ngày</span>
              </div>
              <p className="text-xs text-gray-500 truncate">Bạn: [Cuộc gọi đi]</p>
            </div>
          </div>
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
              K
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 text-base leading-tight">KN</h2>
              <p className="text-xs text-gray-500 mt-0.5">Truy cập 18 phút trước</p>
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
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
          {/* Date Divider */}
          <div className="flex justify-center">
            <span className="bg-black/20 text-white text-[11px] px-3 py-1 rounded-full font-medium">
              12:22 20/12/2019
            </span>
          </div>

          {/* Friendship Card */}
          <div className="mx-auto w-[420px] bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col items-center relative overflow-hidden">
            {/* Confetti Graphics */}
            <div className="absolute top-3 left-3 text-yellow-400 opacity-80"><Sparkles className="w-6 h-6" /></div>
            <div className="absolute top-3 right-3 text-pink-400 opacity-80"><Sparkles className="w-6 h-6" /></div>
            <div className="absolute bottom-3 left-3 text-blue-400 opacity-80"><Sparkles className="w-4 h-4" /></div>
            <div className="absolute bottom-3 right-3 text-green-400 opacity-80"><Sparkles className="w-5 h-5" /></div>
            
            {/* Emotion Icons */}
            <div className="flex gap-3 mb-5 text-gray-400">
              <ThumbsUp className="w-5 h-5 text-blue-500 fill-current" />
              <Heart className="w-5 h-5 text-red-500 fill-current" />
              <Smile className="w-5 h-5 text-yellow-500 fill-current" />
            </div>

            {/* Central Avatar */}
            <div className="w-20 h-20 rounded-full bg-purple-200 flex items-center justify-center text-purple-700 font-bold text-3xl mb-4 relative shadow-sm">
              K
              <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-blue-100 rounded-full border-2 border-white flex items-center justify-center text-[10px] text-blue-600 font-bold overflow-hidden">
                <img src="https://picsum.photos/seed/avatar/30/30" alt="KN" className="w-full h-full object-cover" />
              </div>
            </div>

            <h3 className="font-bold text-gray-800 text-base mb-1.5">Bạn và KN đã trở thành bạn</h3>
            <p className="text-sm text-gray-500 mb-6">Chọn một sticker dưới đây để bắt đầu trò chuyện</p>

            {/* Sticker Selection */}
            <div className="flex items-center justify-between w-full px-2">
              <button className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <div className="flex gap-6">
                {/* Sticker 1 */}
                <div className="flex flex-col items-center cursor-pointer hover:-translate-y-1 transition-transform group">
                  <div className="w-16 h-16 bg-blue-50 rounded-xl flex items-center justify-center mb-2 group-hover:bg-blue-100 transition-colors">
                    <span className="text-3xl">🐰</span>
                  </div>
                  <span className="text-[11px] font-bold text-blue-500 uppercase tracking-wide">Hii!</span>
                </div>
                {/* Sticker 2 */}
                <div className="flex flex-col items-center cursor-pointer hover:-translate-y-1 transition-transform group">
                  <div className="w-16 h-16 bg-orange-50 rounded-xl flex items-center justify-center mb-2 group-hover:bg-orange-100 transition-colors">
                    <span className="text-3xl">🐶</span>
                  </div>
                  <span className="text-[11px] font-bold text-orange-500 uppercase tracking-wide">HELP!</span>
                </div>
                {/* Sticker 3 */}
                <div className="flex flex-col items-center cursor-pointer hover:-translate-y-1 transition-transform group">
                  <div className="w-16 h-16 bg-green-50 rounded-xl flex items-center justify-center mb-2 group-hover:bg-green-100 transition-colors">
                    <span className="text-3xl">🐕</span>
                  </div>
                  <span className="text-[11px] font-bold text-green-500 uppercase tracking-wide">HELLO!</span>
                </div>
              </div>
              <button className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors">
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Date Divider */}
          <div className="flex justify-center mt-2">
            <span className="bg-black/20 text-white text-[11px] px-3 py-1 rounded-full font-medium">
              12:23
            </span>
          </div>

          {/* User Message */}
          <div className="flex justify-end items-end gap-2">
            <div className="bg-[#e5efff] text-gray-800 px-4 py-2.5 rounded-2xl rounded-br-sm max-w-[70%] shadow-sm border border-blue-100 text-[15px]">
              Hello cô ba
            </div>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 overflow-hidden flex-shrink-0">
              <img src="https://picsum.photos/seed/user/32/32" alt="User" className="w-full h-full object-cover" />
            </div>
          </div>

          {/* Date Divider */}
          <div className="flex justify-center mt-2">
            <span className="bg-black/20 text-white text-[11px] px-3 py-1 rounded-full font-medium">
              13:24 20/12/2019
            </span>
          </div>

          {/* Notification */}
          <div className="flex justify-center">
            <span className="text-gray-500 text-xs flex items-center gap-1.5 bg-white/50 px-3 py-1 rounded-full">
              <span className="text-[6px] text-gray-400">●</span> Kim Ngân
            </span>
          </div>

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
              placeholder="Nhập @, tin nhắn tới KN" 
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

