"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Bell, ArrowLeft, Filter, Sparkles } from "lucide-react";
import { useToast } from "../../contexts/ToastContext";

type DemoMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
};

const DEMO_MESSAGES: DemoMessage[] = [
  {
    id: "m1",
    conversationId: "dm:101:202",
    senderId: "101",
    senderName: "An",
    content: "Tối nay họp nhóm lúc 8 giờ nhé.",
    createdAt: "2026-04-29T08:15:00.000Z",
  },
  {
    id: "m2",
    conversationId: "dm:101:202",
    senderId: "202",
    senderName: "Bình",
    content: "Ok, mình sẽ chuẩn bị slide.",
    createdAt: "2026-04-29T08:20:00.000Z",
  },
  {
    id: "m3",
    conversationId: "group:study",
    senderId: "303",
    senderName: "Chi",
    content: "Đã upload tài liệu môn CNM lên nhóm rồi.",
    createdAt: "2026-04-28T14:45:00.000Z",
  },
  {
    id: "m4",
    conversationId: "group:study",
    senderId: "101",
    senderName: "An",
    content: "Mọi người lọc theo ngày là ra đúng đoạn cần tìm.",
    createdAt: "2026-04-28T15:10:00.000Z",
  },
  {
    id: "m5",
    conversationId: "dm:101:404",
    senderId: "404",
    senderName: "Dũng",
    content: "Nhắc mình gửi file báo cáo trước chiều mai.",
    createdAt: "2026-04-27T09:30:00.000Z",
  },
];

export default function DemoPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [keyword, setKeyword] = useState("");
  const [senderId, setSenderId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const results = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    const sender = senderId.trim();
    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(`${toDate}T23:59:59.999`) : null;

    return DEMO_MESSAGES.filter((message) => {
      if (sender && message.senderId !== sender) return false;
      const created = new Date(message.createdAt);
      if (from && created < from) return false;
      if (to && created > to) return false;
      if (kw && !`${message.content} ${message.senderName}`.toLowerCase().includes(kw)) {
        return false;
      }
      return true;
    });
  }, [keyword, senderId, fromDate, toDate]);

  const triggerToast = () => {
    addToast("[Demo] Tin nhắn mới vừa đến khi app đang mở", "message");
  };

  const triggerPushPreview = () => {
    addToast("[Demo] Đây là mô phỏng thông báo đẩy khi app chạy ngầm", "success");
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_30%),linear-gradient(180deg,_#07111f_0%,_#0b1728_50%,_#111827_100%)] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 md:px-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại đăng nhập
          </button>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-blue-200">
            <Sparkles className="h-4 w-4" />
            Demo offline
          </div>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/6 shadow-2xl backdrop-blur-xl">
            <div className="border-b border-white/10 px-6 py-5">
              <h1 className="text-2xl font-semibold text-white">Test tìm kiếm tin nhắn</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Dùng trang này khi tài khoản AWS bị khóa hoặc chưa đăng nhập được. Dữ liệu ở đây là mẫu cục bộ, không ảnh hưởng tới backend thật.
              </p>
            </div>

            <div className="grid gap-4 border-b border-white/10 px-6 py-5 md:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="flex items-center gap-2 text-slate-200"><Search className="h-4 w-4" /> Từ khóa</span>
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Nhập nội dung cần tìm"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-blue-400/40"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="flex items-center gap-2 text-slate-200"><Filter className="h-4 w-4" /> Sender ID</span>
                <input
                  value={senderId}
                  onChange={(e) => setSenderId(e.target.value)}
                  placeholder="Ví dụ: 101"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-blue-400/40"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="text-slate-200">Từ ngày</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-slate-100 outline-none ring-0 focus:border-blue-400/40"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="text-slate-200">Đến ngày</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-slate-100 outline-none ring-0 focus:border-blue-400/40"
                />
              </label>
            </div>

            <div className="px-6 py-5">
              <div className="mb-4 flex items-center justify-between text-sm text-slate-300">
                <span>Kết quả: {results.length}</span>
                <span>Conversation mẫu: {results[0]?.conversationId || "không có"}</span>
              </div>

              <div className="space-y-3">
                {results.map((message) => (
                  <article key={message.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                      <span>{message.senderName} · senderId {message.senderId}</span>
                      <span>{new Date(message.createdAt).toLocaleString("vi-VN")}</span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-100">{message.content}</p>
                  </article>
                ))}
                {results.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/30 p-6 text-sm text-slate-400">
                    Không có kết quả nào khớp bộ lọc hiện tại.
                  </div>
                )}
              </div>
            </div>
          </div>

          <aside className="space-y-4 rounded-[28px] border border-white/10 bg-white/6 p-6 shadow-2xl backdrop-blur-xl">
            <div>
              <h2 className="text-xl font-semibold text-white">Test thông báo</h2>
              <p className="mt-2 text-sm text-slate-300">
                Nút dưới đây mô phỏng toast realtime và push preview để bạn kiểm tra UI ngay cả khi chưa login.
              </p>
            </div>

            <button
              type="button"
              onClick={triggerToast}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-400"
            >
              <Bell className="h-4 w-4" />
              Bắn toast realtime
            </button>

            <button
              type="button"
              onClick={triggerPushPreview}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
            >
              <Bell className="h-4 w-4" />
              Mô phỏng push khi app ngầm
            </button>

            <div className="rounded-2xl border border-blue-400/15 bg-blue-400/10 p-4 text-sm text-blue-100">
              <p className="font-semibold">Cách dùng nhanh</p>
              <p className="mt-2 leading-relaxed text-blue-100/80">
                1. Mở trang này từ login.
                2. Gõ từ khóa hoặc lọc theo sender / ngày.
                3. Bấm nút thông báo để kiểm tra toast ngay trên UI.
              </p>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}