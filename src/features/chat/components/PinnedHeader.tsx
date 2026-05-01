import React, { useState } from "react";
import { Pin, ChevronDown, ChevronUp, ChevronRight, MoreHorizontal, X } from "lucide-react";

interface PinnedHeaderProps {
  pinnedMessages: any[];
  onFocusMessage: (id: string | number) => void;
  onUnpinMessage: (id: string | number) => void;
  canUnpin: (pin: any) => boolean;
}

export function PinnedHeader({
  pinnedMessages,
  onFocusMessage,
  onUnpinMessage,
  canUnpin,
}: PinnedHeaderProps) {
  const [isPinnedExpanded, setIsPinnedExpanded] = useState(false);

  if (!pinnedMessages || pinnedMessages.length === 0) return null;

  const isMulti = pinnedMessages.length > 1;

  if (!isPinnedExpanded) {
    const mainPin = pinnedMessages[0];
    return (
      <div className="bg-white/95 backdrop-blur-md border-b border-gray-200 px-4 py-2 flex items-center gap-3 relative z-20 shadow-sm animate-in slide-in-from-top duration-300 group">
        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
          <Pin className="w-4 h-4 text-blue-500 fill-blue-500" />
        </div>
        
        <div 
          className="flex-1 min-w-0 cursor-pointer py-0.5"
          onClick={() => onFocusMessage(mainPin.id)}
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Tin nhắn được ghim</span>
            {isMulti && (
              <div 
                className="flex items-center gap-0.5 bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-bold cursor-pointer hover:bg-blue-200 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPinnedExpanded(true);
                }}
              >
                <span className="text-[9px]">+{pinnedMessages.length - 1} ghim khác</span>
                <ChevronDown className="w-2.5 h-2.5" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
             <span className="text-xs font-semibold text-gray-900 truncate max-w-[120px]">{mainPin.senderName}:</span>
             <p className="text-xs text-gray-600 truncate">{mainPin.content || "[Tin nhắn tệp/sticker]"}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {isMulti && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsPinnedExpanded(true);
              }}
              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
              title="Xem danh sách"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          )}
          {canUnpin(mainPin) && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onUnpinMessage(mainPin.id);
              }}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
              title="Bỏ ghim"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/98 backdrop-blur-lg border-b border-gray-200 relative z-30 shadow-xl animate-in slide-in-from-top duration-300">
      <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <span className="text-xs font-bold text-gray-700">Danh sách ghim ({pinnedMessages.length})</span>
        <button 
          onClick={() => setIsPinnedExpanded(false)}
          className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-blue-600 transition-colors"
        >
          Thu gọn
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="max-h-[300px] overflow-y-auto scrollbar-thin">
        {pinnedMessages.map((pin, index) => (
          <div 
            key={`${pin.id}-${index}`}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50/40 transition-colors border-b border-gray-50 last:border-none group"
          >
            <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
              <Pin className="w-3.5 h-3.5 text-blue-400 fill-blue-400" />
            </div>
            
            <div 
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() => {
                onFocusMessage(pin.id);
                setIsPinnedExpanded(false);
              }}
            >
              <p className="text-[11px] font-bold text-blue-600 mb-0.5 uppercase tracking-tight">Tin nhắn</p>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-gray-800 truncate max-w-[150px]">{pin.senderName}:</span>
                <p className="text-xs text-gray-600 truncate">{pin.content || "[Tin nhắn tệp/sticker]"}</p>
              </div>
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {canUnpin(pin) && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnpinMessage(pin.id);
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                  title="Bỏ ghim"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <div className="px-4 py-2 bg-gray-50/30 flex justify-center border-t border-gray-100">
        <button className="text-[11px] font-bold text-gray-400 hover:text-blue-500 transition-colors flex items-center gap-1">
           Xem tất cả ở bảng tin nhóm
           <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
