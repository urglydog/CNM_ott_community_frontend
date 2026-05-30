"use client";

import { useEffect, useMemo, useState } from "react";
import { Edit2, Heart, Send, Trash2, X } from "lucide-react";
import { createComment, deleteComment, getComments, getPresignedViewUrl, toggleLikeComment, updateComment, type CommentItem, type ReactionUser } from "../../../api/client";
import { formatPostTime } from "../../../utils/postTime";

function Avatar({ user, size = "h-9 w-9" }: { user: { displayName: string; avatarUrl?: string | null }; size?: string }) {
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function resolve() {
      if (!user.avatarUrl?.trim()) {
        setResolved(null);
        return;
      }
      const url = user.avatarUrl.trim();
      if (url.startsWith("http") && !url.includes("amazonaws.com")) {
        if (mounted) setResolved(url);
        return;
      }
      try {
        const result = await getPresignedViewUrl({ url });
        if (mounted) setResolved(result.viewUrl || url);
      } catch {
        if (mounted) setResolved(url);
      }
    }
    resolve();
    return () => {
      mounted = false;
    };
  }, [user.avatarUrl]);

  return (
    <div className={`${size} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 font-bold text-blue-600`}>
      {resolved ? <img src={resolved} alt={user.displayName} className="h-full w-full object-cover" /> : user.displayName.charAt(0).toUpperCase()}
    </div>
  );
}

export function reactionSummary(likes: ReactionUser[], currentUserId?: string) {
  if (!likes.length) return "";
  const includesMe = likes.some((item) => String(item.userId) === String(currentUserId));
  if (includesMe) return likes.length === 1 ? "Bạn" : `Bạn và ${likes.length - 1} người khác`;
  return likes.length === 1 ? likes[0].displayName : `${likes[0].displayName} và ${likes.length - 1} người khác`;
}

export function ReactionModal({ users, onClose }: { users: ReactionUser[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/45 px-4" onClick={onClose}>
      <div className="max-h-[70vh] w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-bold text-slate-900">Lượt thả tim ({users.length})</h2>
          <button onClick={onClose} className="rounded-full p-1 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="max-h-[58vh] space-y-3 overflow-y-auto p-4">
          {users.map((user) => (
            <div key={user.userId} className="flex items-center gap-3">
              <Avatar user={user} />
              <span className="flex-1 text-sm font-semibold text-slate-800">{user.displayName}</span>
              <Heart className="h-4 w-4 fill-current text-red-500" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type CommentNode = CommentItem & { children: CommentNode[] };

function buildTree(comments: CommentItem[]) {
  const nodes = new Map<string, CommentNode>();
  comments.forEach((comment) => nodes.set(comment.commentId, { ...comment, children: [] }));
  const roots: CommentNode[] = [];
  nodes.forEach((node) => {
    const parent = node.parentCommentId ? nodes.get(node.parentCommentId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });
  return roots;
}

export function CommentsModal({
  postId,
  currentUserId,
  onClose,
  onCommentAdded,
  onCommentsDeleted,
}: {
  postId: string;
  currentUserId?: string;
  onClose: () => void;
  onCommentAdded: () => void;
  onCommentsDeleted: (count: number) => void;
}) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [text, setText] = useState("");
  const [replyTarget, setReplyTarget] = useState<CommentItem | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [reactionUsers, setReactionUsers] = useState<ReactionUser[] | null>(null);
  const [editingComment, setEditingComment] = useState<CommentItem | null>(null);
  const [editingText, setEditingText] = useState("");
  const roots = useMemo(() => buildTree(comments), [comments]);

  useEffect(() => {
    getComments(postId).then((result) => setComments(result.comments || [])).catch(() => setComments([]));
  }, [postId]);

  const send = async () => {
    if (!text.trim()) return;
    const created = await createComment(postId, text.trim(), replyTarget?.commentId);
    setComments((current) => [...current, { ...created, likes: created.likes || [], likeCount: created.likeCount || 0 }]);
    if (replyTarget) setExpanded((current) => new Set(current).add(replyTarget.commentId));
    setText("");
    setReplyTarget(null);
    onCommentAdded();
  };

  const toggleLike = async (commentId: string) => {
    const result = await toggleLikeComment(commentId);
    setComments((current) => current.map((comment) => comment.commentId === commentId ? { ...comment, ...result } : comment));
  };

  const saveEdit = async () => {
    if (!editingComment || !editingText.trim()) return;
    const updated = await updateComment(editingComment.commentId, editingText.trim());
    setComments((current) => current.map((comment) => comment.commentId === updated.commentId ? { ...comment, ...updated } : comment));
    setEditingComment(null);
    setEditingText("");
  };

  const remove = async (commentId: string) => {
    if (!window.confirm("Xóa bình luận này và toàn bộ phản hồi bên dưới?")) return;
    const result = await deleteComment(commentId);
    const ids = new Set(result.deletedCommentIds || [commentId]);
    setComments((current) => current.filter((comment) => !ids.has(comment.commentId)));
    onCommentsDeleted(ids.size);
  };

  const renderNode = (comment: CommentNode, depth = 0) => {
    const isExpanded = expanded.has(comment.commentId);
    const likeUsers = comment.likeUsers || [];
    return (
      <div key={comment.commentId} className={depth ? "ml-7 border-l border-slate-200 pl-3" : ""}>
        <div className="flex gap-2 py-2">
          <Avatar user={{ displayName: comment.authorName, avatarUrl: comment.authorAvatar }} size="h-8 w-8" />
          <div className="min-w-0 flex-1">
            <div className="rounded-2xl bg-slate-100 px-3 py-2">
              <p className="text-xs font-bold text-slate-800">{comment.authorName}</p>
              {editingComment?.commentId === comment.commentId ? (
                <div className="mt-1 flex gap-2">
                  <input value={editingText} onChange={(event) => setEditingText(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none" autoFocus />
                  <button onClick={saveEdit} className="text-xs font-bold text-blue-600">Lưu</button>
                  <button onClick={() => setEditingComment(null)} className="text-xs font-bold text-slate-500">Hủy</button>
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-xs text-slate-700">{comment.content}</p>
              )}
            </div>
            <div className="mt-1 flex items-center gap-3 px-2 text-[11px] font-semibold text-slate-500">
              <span>{formatPostTime(comment.createdAt)}</span>
              <button onClick={() => toggleLike(comment.commentId)} className={comment.likes?.includes(String(currentUserId)) ? "text-red-500" : "hover:text-red-500"}>Thích</button>
              <button onClick={() => setReplyTarget(comment)} className="hover:text-blue-600">Trả lời</button>
              {String(comment.userId) === String(currentUserId) && (
                <>
                  <button onClick={() => { setEditingComment(comment); setEditingText(comment.content); }} className="hover:text-blue-600"><Edit2 className="h-3 w-3" /></button>
                  <button onClick={() => remove(comment.commentId)} className="hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                </>
              )}
              {comment.likeCount > 0 && <button onClick={() => setReactionUsers(likeUsers)} className="ml-auto flex items-center gap-1 text-red-500"><Heart className="h-3 w-3 fill-current" /> {comment.likeCount}</button>}
            </div>
          </div>
        </div>
        {comment.children.length > 0 && !isExpanded && (
          <button onClick={() => setExpanded((current) => new Set(current).add(comment.commentId))} className="ml-10 pb-2 text-xs font-bold text-slate-600 hover:text-blue-600">
            Xem {comment.children.length} phản hồi
          </button>
        )}
        {isExpanded && (
          <div>
            {comment.children.map((child) => renderNode(child, depth + 1))}
            <button onClick={() => setExpanded((current) => { const next = new Set(current); next.delete(comment.commentId); return next; })} className="ml-10 pb-2 text-xs font-bold text-slate-500">
              Ẩn phản hồi
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4" onClick={onClose}>
        <div className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-bold text-slate-900">Bình luận</h2>
            <button onClick={onClose} className="rounded-full p-1 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
          </div>
          <div className="min-h-48 flex-1 overflow-y-auto px-4 py-2">
            {roots.length ? roots.map((comment) => renderNode(comment)) : <p className="py-12 text-center text-sm text-slate-400">Chưa có bình luận</p>}
          </div>
          {replyTarget && (
            <div className="flex items-center justify-between bg-slate-50 px-4 py-2 text-xs text-slate-600">
              <span>Đang trả lời <b>{replyTarget.authorName}</b></span>
              <button onClick={() => setReplyTarget(null)}><X className="h-4 w-4" /></button>
            </div>
          )}
          <div className="flex gap-2 border-t border-slate-100 p-3">
            <input value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") send(); }} placeholder={replyTarget ? `Trả lời ${replyTarget.authorName}...` : "Viết bình luận..."} className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-blue-400" />
            <button onClick={send} disabled={!text.trim()} className="rounded-full bg-blue-600 p-2 text-white disabled:opacity-50"><Send className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
      {reactionUsers && <ReactionModal users={reactionUsers} onClose={() => setReactionUsers(null)} />}
    </>
  );
}
