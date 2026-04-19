"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { StickerData } from "../../../types";

// ── Sticker Packs ─────────────────────────────────────────────────────────────

interface StickerPack {
  id: string;
  name: string;
  icon: string;
  stickers: StickerItem[];
}

interface StickerItem {
  id: string;
  name: string;
  /** Free CDN sticker image */
  url: string;
}

const STICKER_PACKS: StickerPack[] = [
  {
    id: "reactions",
    name: "Phản ứng",
    icon: "👍",
    stickers: [
      { id: "thumbs_up", name: "Thích", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f44d.png" },
      { id: "clap", name: "Vỗ tay", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f44f.png" },
      { id: "heart", name: "Yêu thích", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/2764.png" },
      { id: "ok_hand", name: "OK", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f44c.png" },
      { id: "wave", name: "Chào", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f44b.png" },
      { id: "pray", name: "Cầu nguyện", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f64f.png" },
      { id: "fire", name: "Hot", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f525.png" },
      { id: "star", name: "Yêu thích", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/2b50.png" },
      { id: "100", name: "Tuyệt vời", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f4af.png" },
    ],
  },
  {
    id: "celebration",
    name: "Kỷ niệm",
    icon: "🎉",
    stickers: [
      { id: "party", name: "Tiệc", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f389.png" },
      { id: "balloon", name: "Bóng bay", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f388.png" },
      { id: "confetti", name: "Kẹo giấy", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f38a.png" },
      { id: "tada", name: "Chúc mừng", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f38b.png" },
      { id: "cake", name: "Bánh", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f382.png" },
      { id: "gift", name: "Quà", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f381.png" },
      { id: "sparkler", name: "Pháo hoa", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f387.png" },
      { id: "medal", name: "Huy hiệu", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f3c6.png" },
      { id: "trophy", name: "Cúp", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.0.2/assets/unicode/1f3c6.png" },
    ],
  },
  {
    id: "emotions",
    name: "Cảm xúc",
    icon: "😀",
    stickers: [
      { id: "smile", name: "Mỉm cười", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f600.png" },
      { id: "laugh", name: "Cười", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f602.png" },
      { id: "love_eyes", name: "Mắt tim", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f60d.png" },
      { id: "kiss", name: "Hôn", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f618.png" },
      { id: "think", name: "Suy nghĩ", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f914.png" },
      { id: "sleepy", name: "Buồn ngủ", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f634.png" },
      { id: "cry", name: "Khóc", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f622.png" },
      { id: "angry", name: "Tức giận", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f621.png" },
      { id: "cool", name: "Ngầu", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f60e.png" },
    ],
  },
  {
    id: "animals",
    name: "Động vật",
    icon: "🐱",
    stickers: [
      { id: "cat", name: "Mèo", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f431.png" },
      { id: "dog", name: "Chó", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f436.png" },
      { id: "rabbit", name: "Thỏ", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f430.png" },
      { id: "bear", name: "Gấu", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f43b.png" },
      { id: "panda", name: "Gấu trúc", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f43c.png" },
      { id: "koala", name: "Koala", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f428.png" },
      { id: "unicorn", name: "Kỳ lân", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f984.png" },
      { id: "butterfly", name: "Bướm", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f98b.png" },
      { id: "bird", name: "Chim", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f426.png" },
    ],
  },
  {
    id: "food",
    name: "Đồ ăn",
    icon: "🍕",
    stickers: [
      { id: "pizza", name: "Pizza", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f355.png" },
      { id: "sushi", name: "Sushi", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f363.png" },
      { id: "ramen", name: "Mì", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f35c.png" },
      { id: "coffee", name: "Cà phê", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/2615.png" },
      { id: "bento", name: "Cơm", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f371.png" },
      { id: "bread", name: "Bánh mì", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f35e.png" },
      { id: "icecream", name: "Kem", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f366.png" },
      { id: "apple", name: "Táo", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f34e.png" },
      { id: "banana", name: "Chuối", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/unicode/1f34c.png" },
    ],
  },
];

type Tab = "emoji" | "sticker";

// ── Props ─────────────────────────────────────────────────────────────────────

interface EmojiStickerPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onStickerSelect: (stickerData: StickerData) => void;
  /** Whether the picker is visible */
  isOpen: boolean;
  /** Called when picker wants to close itself */
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EmojiStickerPicker({
  onEmojiSelect,
  onStickerSelect,
  isOpen,
  onClose,
}: EmojiStickerPickerProps) {
  const [activeTab, setActiveTab] = useState<Tab>("emoji");
  const [activePackId, setActivePackId] = useState(STICKER_PACKS[0].id);
  const pickerRef = useRef<HTMLDivElement>(null);
  const emojiGridRef = useRef<HTMLDivElement>(null);

  const activePack = STICKER_PACKS.find((p) => p.id === activePackId) ?? STICKER_PACKS[0];

  // Dynamically import emoji-picker-react to avoid SSR issues
  const handleEmojiClick = useCallback(
    async (emoji: string) => {
      onEmojiSelect(emoji);
    },
    [onEmojiSelect],
  );

  const handleEmojiClickLazy = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      const btn = event.currentTarget as HTMLButtonElement;
      const emoji = btn.getAttribute("data-emoji") ?? "";
      onEmojiSelect(emoji);
    },
    [onEmojiSelect],
  );

  const handleStickerClick = useCallback(
    (sticker: StickerItem) => {
      const stickerData: StickerData = {
        stickerId: sticker.id,
        stickerUrl: sticker.url,
        stickerPack: activePackId,
        stickerName: sticker.name,
      };
      onStickerSelect(stickerData);
    },
    [onStickerSelect, activePackId],
  );

  // Close when clicking outside
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose],
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={pickerRef}
        className="absolute bottom-full mb-2 z-50"
        style={{ right: 0 }}
        initial={{ opacity: 0, y: 8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.96 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Backdrop for outside click */}
        <div
          className="fixed inset-0 z-[-1]"
          onClick={handleBackdropClick}
          aria-hidden="true"
        />

        <div className="w-[360px] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
          {/* Header: Tab switcher */}
          <div className="flex border-b border-gray-100 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("emoji")}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === "emoji"
                  ? "text-blue-600 border-b-2 border-blue-500"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              Biểu tượng cảm xúc
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("sticker")}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === "sticker"
                  ? "text-blue-600 border-b-2 border-blue-500"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              Sticker
            </button>
          </div>

          {/* Content */}
          <div className="h-[320px] flex flex-col">
            {/* Emoji tab */}
            {activeTab === "emoji" && (
              <EmojiGrid onEmojiClick={handleEmojiClickLazy} />
            )}

            {/* Sticker tab */}
            {activeTab === "sticker" && (
              <>
                {/* Pack selector strip */}
                <div className="flex items-center gap-1 px-2 py-2 border-b border-gray-100 overflow-x-auto shrink-0 scrollbar-hide">
                  {STICKER_PACKS.map((pack) => (
                    <button
                      key={pack.id}
                      type="button"
                      onClick={() => setActivePackId(pack.id)}
                      title={pack.name}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 transition-all ${
                        activePackId === pack.id
                          ? "bg-blue-50 ring-2 ring-blue-400 shadow-sm"
                          : "bg-gray-50 hover:bg-gray-100"
                      }`}
                    >
                      {pack.icon}
                    </button>
                  ))}
                </div>

                {/* Sticker grid */}
                <div className="flex-1 overflow-y-auto p-2">
                  <p className="text-xs text-gray-400 font-medium px-1 mb-2">
                    {activePack.name}
                  </p>
                  <div className="grid grid-cols-4 gap-1">
                    {activePack.stickers.map((sticker) => (
                      <button
                        key={sticker.id}
                        type="button"
                        onClick={() => handleStickerClick(sticker)}
                        title={sticker.name}
                        className="aspect-square rounded-xl hover:bg-gray-50 active:bg-blue-50 transition-colors flex items-center justify-center p-2 group"
                      >
                        <img
                          src={sticker.url}
                          alt={sticker.name}
                          className="w-full h-full object-contain group-hover:scale-110 transition-transform"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Emoji Grid ────────────────────────────────────────────────────────────────

const EMOJI_CATEGORIES = [
  {
    label: "Mới nhất",
    emojis: ["😀", "😂", "😍", "🥰", "😘", "🤔", "😅", "🥳", "😎", "🤩", "😜", "🤗"],
  },
  {
    label: "Mặt",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "😊", "😇", "🥰",
      "😍", "🤩", "😘", "😗", "😚", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗",
      "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬",
      "😮‍💨", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮",
      "🤧", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "🥸", "😎", "🤓", "🧐",
    ],
  },
  {
    label: "Tay",
    emojis: [
      "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘",
      "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛",
      "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💅", "🤳", "💪", "🦾",
    ],
  },
  {
    label: "Trái tim",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕",
      "💞", "💓", "💗", "💖", "💘", "💝", "💟", "♥️", "💑", "💏", "🫶", "💋",
    ],
  },
  {
    label: "Động vật",
    emojis: [
      "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮",
      "🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🐤", "🦆", "🦅", "🦉", "🦇", "🐺",
      "🐗", "🐴", "🦄", "🐝", "🐛", "🦋", "🐌", "🐞", "🐜", "🦟", "🐢", "🐍",
    ],
  },
  {
    label: "Đồ ăn",
    emojis: [
      "🍎", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍈", "🍒", "🍑", "🥭",
      "🍍", "🥥", "🥝", "🍅", "🍆", "🥑", "🥦", "🥬", "🥒", "🌶️", "🫑", "🌽",
      "🍕", "🍔", "🍟", "🌭", "🍿", "🧂", "🥓", "🍳", "🥞", "🧇", "🥐", "🥨",
    ],
  },
  {
    label: "Hoạt động",
    emojis: [
      "⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱", "🪀", "🏓",
      "🏸", "🏒", "🏑", "🥍", "🏏", "🪃", "🥅", "⛳", "🪁", "🏹", "🎣", "🤿",
      "🥊", "🥋", "🎽", "🛹", "🛼", "🛷", "⛸️", "🥌", "🎿", "⛷️", "🏂", "🪂",
    ],
  },
  {
    label: "Vật thể",
    emojis: [
      "⌚", "📱", "💻", "⌨️", "🖥️", "🖨️", "🖱️", "🖲️", "💽", "💾", "💿", "📀",
      "📼", "📷", "📸", "📹", "🎥", "📽️", "🎞️", "📞", "☎️", "📟", "📠", "📺",
      "📻", "🎙️", "🎚️", "🎛️", "🧭", "⏱️", "⏲️", "⏰", "🕰️", "⌛", "⏳",
    ],
  },
];

interface EmojiGridProps {
  onEmojiClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

function EmojiGrid({ onEmojiClick }: EmojiGridProps) {
  const [activeCategory, setActiveCategory] = useState(0);
  const active = EMOJI_CATEGORIES[activeCategory];

  return (
    <div className="flex flex-col h-full">
      {/* Category strip */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 overflow-x-auto shrink-0">
        {EMOJI_CATEGORIES.map((cat, idx) => (
          <button
            key={cat.label}
            type="button"
            onClick={() => setActiveCategory(idx)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium shrink-0 transition-colors ${
              activeCategory === idx
                ? "bg-blue-50 text-blue-600 font-semibold"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Emoji grid */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-8 gap-0.5">
          {active.emojis.map((emoji) => (
            <button
              key={`${activeCategory}-${emoji}`}
              type="button"
              data-emoji={emoji}
              onClick={onEmojiClick}
              className="w-9 h-9 flex items-center justify-center text-xl rounded-lg hover:bg-gray-50 active:bg-blue-50 transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
