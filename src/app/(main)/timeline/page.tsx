"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Bookmark,
  Edit2,
  FolderOpen,
  Heart,
  ImageIcon,
  Link as LinkIcon,
  MapPin,
  MessageSquare,
  Music,
  Newspaper,
  Send,
  Share2,
  Smile,
  Trash2,
  User,
  Users,
  Video,
  X,
} from "lucide-react";
import {
  createComment,
  createPost,
  createStory,
  deletePost,
  getComments,
  getFeedPosts,
  getFriendsList,
  getPresignedViewUrl,
  getStoryFeed,
  replyToStory,
  toggleHighlightStory,
  toggleLikeStory,
  toggleLikePost,
  updatePost,
  uploadFileDirect,
} from "../../../api/client";
import type { StoryItem } from "../../../api/client";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import { formatPostTime } from "../../../utils/postTime";
import { CommentsModal, ReactionModal, reactionSummary } from "./TimelineModals";

interface CommentReply {
  id: string;
  userId: string;
  authorName: string;
  authorAvatar: string | null;
  content: string;
  createdAt: string;
}

interface PostComment {
  id: string;
  userId: string;
  authorName: string;
  authorAvatar: string | null;
  content: string;
  createdAt: string;
  likesCount: number;
  replies?: CommentReply[];
}

interface TimelinePost {
  id: string;
  userId: string;
  authorName: string;
  authorAvatar: string | null;
  content: string;
  imageUrl?: string;
  createdAt: string;
  likedBy: { userId: string; displayName: string; avatarUrl: string | null }[];
  comments: PostComment[];
  commentCount?: number;
}

function SafeAvatar({ url, name, className = "" }: { url?: string | null; name: string; className?: string }) {
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function resolve() {
      if (!url?.trim()) {
        setResolved(null);
        return;
      }

      const trimmed = url.trim();
      if (trimmed.startsWith("http") && !trimmed.includes("amazonaws.com")) {
        if (mounted) setResolved(trimmed);
        return;
      }

      try {
        const res = await getPresignedViewUrl({ url: trimmed });
        if (mounted) setResolved(res.viewUrl || trimmed);
      } catch {
        if (mounted) setResolved(trimmed);
      }
    }

    resolve();
    return () => {
      mounted = false;
    };
  }, [url]);

  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden bg-blue-100 font-bold text-blue-600 ${className}`}>
      {resolved ? <img src={resolved} alt={name} className="h-full w-full object-cover" /> : name.charAt(0).toUpperCase()}
    </div>
  );
}

function SafePostImage({ url }: { url?: string | null }) {
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function resolve() {
      if (!url?.trim()) {
        setResolved(null);
        return;
      }

      const trimmed = url.trim();
      if (trimmed.startsWith("http") && !trimmed.includes("amazonaws.com")) {
        if (mounted) setResolved(trimmed);
        return;
      }

      try {
        const res = await getPresignedViewUrl({ url: trimmed });
        if (mounted) setResolved(res.viewUrl || trimmed);
      } catch {
        if (mounted) setResolved(trimmed);
      }
    }

    resolve();
    return () => {
      mounted = false;
    };
  }, [url]);

  if (!resolved) return null;

  return (
    <div className="mt-3 max-h-[420px] overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
      <img src={resolved} alt="post-attachment" className="h-full w-full object-cover" />
    </div>
  );
}

function SafeStoryImage({ url, className = "" }: { url?: string | null; className?: string }) {
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!url?.trim()) {
      setResolved(null);
      return;
    }
    getPresignedViewUrl({ url })
      .then((result) => {
        if (mounted) setResolved(result.viewUrl || url);
      })
      .catch(() => {
        if (mounted) setResolved(url);
      });
    return () => {
      mounted = false;
    };
  }, [url]);

  return resolved ? <img src={resolved} alt="story" className={className} /> : null;
}

function formatStoryAge(createdAt: string) {
  const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / (60 * 1000));
  if (minutes <= 0) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  return `${Math.floor(minutes / 60)}h trước`;
}

export default function TimelinePage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [friends, setFriends] = useState<any[]>([]);
  const [posts, setPosts] = useState<TimelinePost[]>([]);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, PostComment[]>>({});
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostImageUrl, setNewPostImageUrl] = useState("");
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [replyTargetCommentId, setReplyTargetCommentId] = useState<string | null>(null);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [reactionUsers, setReactionUsers] = useState<{ userId: string; displayName: string; avatarUrl: string | null }[] | null>(null);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [activeStory, setActiveStory] = useState<StoryItem | null>(null);
  const [showStoryComposer, setShowStoryComposer] = useState(false);
  const [storyText, setStoryText] = useState("");
  const [storyImageFile, setStoryImageFile] = useState<File | null>(null);
  const [storyImagePreview, setStoryImagePreview] = useState("");
  const [isCreatingStory, setIsCreatingStory] = useState(false);
  const [storyReplyText, setStoryReplyText] = useState("");
  const [isUpdatingStory, setIsUpdatingStory] = useState(false);
  const storyFileInputRef = useRef<HTMLInputElement>(null);
  const [, setClock] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let mounted = true;

    getFriendsList()
      .then((list) => {
        if (mounted) setFriends(list);
      })
      .catch(() => {
        if (mounted) setFriends([]);
      });

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const loadStories = useCallback(async () => {
    if (!user?.id) return;
    try {
      const result = await getStoryFeed();
      setStories(result.stories || []);
    } catch (error) {
      console.error("Failed to load stories:", error);
      setStories([]);
    }
  }, [user?.id]);

  useEffect(() => {
    loadStories();
  }, [loadStories]);

  const closeStoryComposer = () => {
    setShowStoryComposer(false);
    setStoryText("");
    setStoryImageFile(null);
    setStoryImagePreview("");
  };

  const handleStoryImagePick = (file?: File) => {
    if (!file) return;
    setStoryImageFile(file);
    setStoryImagePreview(URL.createObjectURL(file));
  };

  const handleCreateStory = async () => {
    if (!storyImageFile && !storyText.trim()) return;
    setIsCreatingStory(true);
    try {
      let mediaUrl: string | undefined;
      if (storyImageFile) {
        const upload = await uploadFileDirect(storyImageFile, "stories");
        mediaUrl = upload.url;
      }
      const created = await createStory({
        type: mediaUrl ? "image" : "text",
        text: storyText.trim(),
        mediaUrl,
        backgroundColor: "#2563EB",
      });
      setStories((current) => [created, ...current]);
      closeStoryComposer();
      addToast("Đã đăng story", "success");
    } catch (error: any) {
      addToast(error.message || "Không thể đăng story", "error");
    } finally {
      setIsCreatingStory(false);
    }
  };

  const updateActiveStory = (updated: StoryItem) => {
    setActiveStory(updated);
    setStories((current) => current.map((story) => story.storyId === updated.storyId ? updated : story));
  };

  const handleToggleStoryLike = async () => {
    if (!activeStory || isUpdatingStory) return;
    setIsUpdatingStory(true);
    try {
      updateActiveStory(await toggleLikeStory(activeStory.storyId));
    } catch (error: any) {
      addToast(error.message || "Không thể thả tim story", "error");
    } finally {
      setIsUpdatingStory(false);
    }
  };

  const handleToggleStoryHighlight = async () => {
    if (!activeStory || isUpdatingStory) return;
    setIsUpdatingStory(true);
    try {
      const updated = await toggleHighlightStory(activeStory.storyId);
      updateActiveStory(updated);
      addToast(
        updated.isHighlighted
          ? "Đã lưu vào Tin nổi bật trên trang cá nhân mobile"
          : "Đã bỏ story khỏi Tin nổi bật",
        "success"
      );
    } catch (error: any) {
      addToast(error.message || "Không thể lưu story", "error");
    } finally {
      setIsUpdatingStory(false);
    }
  };

  const handleReplyToStory = async () => {
    if (!activeStory || !storyReplyText.trim()) return;
    try {
      await replyToStory(activeStory.storyId, storyReplyText.trim());
      setStoryReplyText("");
      addToast("Đã gửi phản hồi story", "success");
    } catch (error: any) {
      addToast(error.message || "Không thể gửi phản hồi", "error");
    }
  };

  const mapPost = useCallback(
    (post: any): TimelinePost => {
      const likedBy = Array.isArray(post.likeUsers) && post.likeUsers.length
        ? post.likeUsers
        : Array.isArray(post.likes) ? post.likes.map((id: string) => {
            const friend = friends.find((item) => String(item.friend_id || item.userId) === String(id));
            return {
              userId: id,
              displayName:
                id === user?.id
                  ? user?.displayName || user?.username || "Tôi"
                  : friend?.friend_display_name || friend?.display_name || "Một người bạn",
              avatarUrl:
                id === user?.id ? user?.avatarUrl || null : friend?.friend_avatar_url || friend?.avatar_url || null,
            };
          }) : [];
      const comments = Array.isArray(post.comments)
        ? post.comments.map((comment: any) => ({
            id: comment.commentId || comment.id,
            userId: comment.userId,
            authorName: comment.authorName || "Ẩn danh",
            authorAvatar: comment.authorAvatar || null,
            content: comment.content || "",
            createdAt: comment.createdAt,
            likesCount: comment.likesCount || 0,
            replies: comment.replies || [],
          }))
        : [];

      return {
        id: post.postId || post.id,
        userId: post.userId,
        authorName: post.authorName || "Người dùng",
        authorAvatar: post.authorAvatar || null,
        content: post.content || "",
        imageUrl: post.media?.[0]?.url,
        createdAt: post.createdAt,
        likedBy,
        comments,
        commentCount: post.commentCount || comments.length || 0,
      };
    },
    [friends, user]
  );

  const loadPosts = useCallback(async () => {
    try {
      const res = await getFeedPosts(50);
      setPosts((res.posts || []).map(mapPost));
    } catch (error) {
      console.error("Failed to load feed posts:", error);
      const saved = localStorage.getItem("app_timeline_posts");
      setPosts(saved ? JSON.parse(saved) : []);
    }
  }, [mapPost]);

  useEffect(() => {
    if (user?.id) loadPosts();
  }, [loadPosts, user?.id]);

  const persistPosts = (nextPosts: TimelinePost[]) => {
    setPosts(nextPosts);
    localStorage.setItem("app_timeline_posts", JSON.stringify(nextPosts));
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim()) return;

    try {
      const media = newPostImageUrl.trim() ? [{ url: newPostImageUrl.trim(), type: "image" as const }] : undefined;
      const created = await createPost({ content: newPostContent.trim(), media });
      persistPosts([mapPost(created), ...posts]);
      setNewPostContent("");
      setNewPostImageUrl("");
      addToast("Đăng bài thành công lên tường nhà!", "success");
    } catch (error: any) {
      addToast(`Đăng bài thất bại: ${error.message || "Lỗi hệ thống"}`, "error");
    }
  };

  const handleLikePost = async (postId: string) => {
    try {
      const res = await toggleLikePost(postId);
      persistPosts(
        posts.map((post) =>
          post.id === postId
            ? {
                ...post,
                likedBy: res.likeUsers,
              }
            : post
        )
      );
    } catch (error: any) {
      addToast(`Tương tác thất bại: ${error.message || "Lỗi hệ thống"}`, "error");
    }
  };

  const handleEditPost = (post: TimelinePost) => {
    const isUnder7Days = Date.now() - new Date(post.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000;
    if (!isUnder7Days) {
      addToast("Bài viết đăng quá 7 ngày không thể chỉnh sửa!", "error");
      return;
    }
    setEditingPostId(post.id);
    setEditingContent(post.content);
  };

  const handleSaveEditedPost = async (postId: string) => {
    if (!editingContent.trim()) return;
    try {
      const updated = mapPost(await updatePost(postId, editingContent.trim()));
      persistPosts(posts.map((post) => (post.id === postId ? updated : post)));
      setEditingPostId(null);
      setEditingContent("");
      addToast("Đã cập nhật bài viết!", "success");
    } catch (error: any) {
      addToast(`Cập nhật bài viết thất bại: ${error.message || "Lỗi hệ thống"}`, "error");
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await deletePost(postId);
      persistPosts(posts.filter((post) => post.id !== postId));
      addToast("Đã xóa bài viết!", "success");
    } catch (error: any) {
      addToast(`Xóa bài viết thất bại: ${error.message || "Lỗi hệ thống"}`, "error");
    }
  };

  const toggleComments = async (postId: string) => {
    if (expandedComments[postId]) {
      setExpandedComments((current) => ({ ...current, [postId]: false }));
      return;
    }

    try {
      const res = await getComments(postId);
      setCommentsByPost((current) => ({
        ...current,
        [postId]: (res.comments || []).map((comment: any) => ({
          id: comment.commentId || comment.id,
          userId: comment.userId,
          authorName: comment.authorName || "Ẩn danh",
          authorAvatar: comment.authorAvatar || null,
          content: comment.content || "",
          createdAt: comment.createdAt,
          likesCount: comment.likesCount || 0,
          replies: comment.replies || [],
        })),
      }));
      setExpandedComments((current) => ({ ...current, [postId]: true }));
    } catch (error: any) {
      addToast(`Tải bình luận thất bại: ${error.message || "Lỗi hệ thống"}`, "error");
    }
  };

  const handleAddComment = async (postId: string) => {
    const content = commentInputs[postId]?.trim();
    if (!content) return;

    try {
      const created = await createComment(postId, content);
      const comment: PostComment = {
        id: created.commentId,
        userId: created.userId,
        authorName: created.authorName || user?.displayName || user?.username || "Người dùng",
        authorAvatar: created.authorAvatar || user?.avatarUrl || null,
        content: created.content,
        createdAt: created.createdAt,
        likesCount: 0,
        replies: [],
      };
      setCommentsByPost((current) => ({ ...current, [postId]: [...(current[postId] || []), comment] }));
      setPosts((current) =>
        current.map((post) => (post.id === postId ? { ...post, commentCount: (post.commentCount || 0) + 1 } : post))
      );
      setExpandedComments((current) => ({ ...current, [postId]: true }));
      setCommentInputs((current) => ({ ...current, [postId]: "" }));
      addToast("Đã gửi bình luận!", "success");
    } catch (error: any) {
      addToast(`Gửi bình luận thất bại: ${error.message || "Lỗi hệ thống"}`, "error");
    }
  };

  const handleLikeComment = (postId: string, commentId: string) => {
    setCommentsByPost((current) => ({
      ...current,
      [postId]: (current[postId] || []).map((comment) =>
        comment.id === commentId ? { ...comment, likesCount: comment.likesCount + 1 } : comment
      ),
    }));
  };

  const handleAddReply = (postId: string, commentId: string) => {
    const content = replyInputs[commentId]?.trim();
    if (!content) return;

    const reply: CommentReply = {
      id: `r-${Date.now()}`,
      userId: String(user?.id || ""),
      authorName: user?.displayName || user?.username || "Tôi",
      authorAvatar: user?.avatarUrl || null,
      content,
      createdAt: new Date().toISOString(),
    };

    setCommentsByPost((current) => ({
      ...current,
      [postId]: (current[postId] || []).map((comment) =>
        comment.id === commentId ? { ...comment, replies: [...(comment.replies || []), reply] } : comment
      ),
    }));
    setReplyInputs((current) => ({ ...current, [commentId]: "" }));
    setReplyTargetCommentId(null);
  };

  return (
    <div className="h-screen flex-1 overflow-y-auto bg-[#f2f5fa] px-6 py-6">
      <main className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-center justify-between rounded-2xl bg-white px-5 py-4 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Tường nhà</h1>
            <p className="mt-1 text-xs text-slate-500">Bảng tin cộng đồng và nhật ký hoạt động</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Tin 24 giờ</p>
          <div className="flex items-center gap-4 overflow-x-auto pb-1">
            <button onClick={() => setShowStoryComposer(true)} className="group flex w-16 shrink-0 flex-col items-center">
              <div className="relative">
                <SafeAvatar url={user?.avatarUrl} name="Tạo mới" className="h-12 w-12 rounded-full border-2 border-white" />
                <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-xs font-bold text-white">+</div>
              </div>
              <span className="mt-2 w-full truncate text-center text-[10px] font-semibold text-slate-600">Tạo mới</span>
            </button>
            {stories.map((story) => (
              <button key={story.storyId} onClick={() => setActiveStory(story)} className="group flex w-16 shrink-0 flex-col items-center">
                <div className="h-13 w-13 rounded-full border-2 border-blue-500 p-0.5 transition group-hover:scale-105">
                  <SafeAvatar url={story.authorAvatar} name={story.authorName} className="h-full w-full rounded-full border border-white" />
                </div>
                <span className="mt-2 w-full truncate text-center text-[10px] font-semibold text-slate-600">{story.authorName}</span>
                <span className="w-full truncate text-center text-[9px] text-slate-400">{formatStoryAge(story.createdAt)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex w-fit items-center gap-2 rounded-full border border-slate-100 bg-slate-50 px-3 py-1.5">
            <Users className="h-3.5 w-3.5 text-slate-600" />
            <span className="text-xs font-bold text-slate-700">Bạn bè chung</span>
            <ChevronDown className="h-3 w-3 text-slate-500" />
          </div>
          <textarea
            value={newPostContent}
            onChange={(event) => setNewPostContent(event.target.value)}
            placeholder="Bạn đang nghĩ gì?"
            className="h-24 w-full resize-none border-none text-sm text-slate-700 outline-none placeholder-slate-400"
          />
          <div className="flex items-center gap-3 border-t border-slate-100 py-2">
            <button className="flex items-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
              <Music className="h-3.5 w-3.5 text-pink-500" /> Nhạc
            </button>
            <button className="flex items-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
              <FolderOpen className="h-3.5 w-3.5 text-amber-500" /> Album
            </button>
            <button className="flex items-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
              <Users className="h-3.5 w-3.5 text-blue-500" /> Với bạn bè
            </button>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
            <div className="flex items-center gap-4 text-slate-500">
              <Smile className="h-5 w-5" />
              <div className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-green-500" />
                <input
                  value={newPostImageUrl}
                  onChange={(event) => setNewPostImageUrl(event.target.value)}
                  placeholder="Dán link ảnh..."
                  className="w-32 rounded border border-slate-100 bg-slate-50 px-2 py-1 text-[10px] outline-none transition-all focus:w-44"
                />
              </div>
              <Video className="h-5 w-5" />
              <LinkIcon className="h-5 w-5" />
              <MapPin className="h-5 w-5" />
            </div>
            <button
              onClick={handleCreatePost}
              disabled={!newPostContent.trim()}
              className="flex items-center gap-1.5 rounded-full bg-blue-600 px-5 py-2 text-xs font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" /> Đăng bài
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {posts.length === 0 ? (
            <div className="rounded-xl border border-slate-100 bg-white py-12 text-center text-slate-400">
              <Newspaper className="mx-auto mb-2 h-12 w-12 stroke-1" />
              <p className="text-sm">Chưa có bài đăng nào trên tường nhà. Hãy là người đầu tiên đăng bài nhé!</p>
            </div>
          ) : (
            posts.map((post) => {
              const matchedLink = post.content.match(/https?:\/\/[^\s]+/)?.[0];
              const isMyPost = post.userId === user?.id;
              const isUnder7Days = Date.now() - new Date(post.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000;

              return (
                <article key={post.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <SafeAvatar url={post.authorAvatar} name={post.authorName} className="h-10 w-10 rounded-full" />
                      <div>
                        <h2 className="text-sm font-bold text-slate-800">{post.authorName}</h2>
                        <p className="text-[11px] font-semibold text-slate-400">{formatPostTime(post.createdAt)}</p>
                      </div>
                    </div>
                    {isMyPost && (
                      <div className="flex items-center gap-2">
                        {isUnder7Days && (
                          <button onClick={() => handleEditPost(post)} className="p-1.5 text-slate-400 hover:text-blue-600" title="Chỉnh sửa bài đăng">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button onClick={() => handleDeletePost(post.id)} className="p-1.5 text-slate-400 hover:text-red-600" title="Xóa bài viết">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {editingPostId === post.id ? (
                    <div className="mb-3 space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <textarea value={editingContent} onChange={(event) => setEditingContent(event.target.value)} rows={3} className="w-full resize-none rounded-lg border border-slate-200 bg-white p-2 text-sm outline-none focus:border-blue-400" />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingPostId(null)} className="rounded-md bg-slate-200 px-3 py-1 text-xs font-bold">Hủy</button>
                        <button onClick={() => handleSaveEditedPost(post.id)} className="rounded-md bg-blue-600 px-3 py-1 text-xs font-bold text-white">Lưu</button>
                      </div>
                    </div>
                  ) : (
                    <p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{post.content}</p>
                  )}

                  {matchedLink && (
                    <div className="mb-3 rounded-2xl border border-slate-200 bg-[#F2F3F5] p-4">
                      <span className="mb-1 block text-xs font-bold text-blue-600">Liên kết đính kèm</span>
                      <span className="block truncate text-xs font-semibold text-slate-700">{matchedLink}</span>
                    </div>
                  )}
                  <SafePostImage url={post.imageUrl} />

                  {post.likedBy.length > 0 && (
                    <button onClick={() => setReactionUsers(post.likedBy)} className="mt-2.5 flex w-full flex-wrap items-center gap-1.5 rounded-lg bg-red-50/50 px-3 py-1.5 text-left text-[11px] text-slate-600 hover:bg-red-50">
                      <Heart className="h-3 w-3 fill-current text-red-500" />
                      <span className="font-bold text-slate-800">{reactionSummary(post.likedBy, user?.id ? String(user.id) : undefined)}</span>
                    </button>
                  )}

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                    <div className="flex items-center gap-6">
                      <button onClick={() => handleLikePost(post.id)} className={`flex items-center gap-1.5 font-bold hover:text-red-500 ${post.likedBy.some((like) => like.userId === user?.id) ? "text-red-500" : ""}`}>
                        <Heart className={`h-4 w-4 ${post.likedBy.some((like) => like.userId === user?.id) ? "fill-current" : ""}`} /> Thích ({post.likedBy.length})
                      </button>
                      <button onClick={() => setCommentsPostId(post.id)} className="flex items-center gap-1.5 font-bold hover:text-blue-500">
                        <MessageSquare className="h-4 w-4" /> Bình luận ({post.commentCount || 0})
                      </button>
                    </div>
                    <button className="flex items-center gap-1.5 font-bold hover:text-blue-500"><Share2 className="h-4 w-4" /> Chia sẻ</button>
                  </div>

                  {false && expandedComments[post.id] && (
                    <div className="mt-4 space-y-3 rounded-xl border-t border-slate-50 bg-slate-50/50 p-3">
                      {(commentsByPost[post.id] || []).map((comment) => (
                        <div key={comment.id} className="space-y-1.5">
                          <div className="flex gap-2 text-xs">
                            <SafeAvatar url={comment.authorAvatar} name={comment.authorName} className="h-7 w-7 rounded-full" />
                            <div className="flex-1 rounded-2xl bg-slate-100 px-3 py-2">
                              <span className="font-bold text-slate-800">{comment.authorName}</span>
                              <p className="text-slate-600">{comment.content}</p>
                              <div className="mt-1.5 flex items-center gap-3 text-[10px] font-bold text-slate-500">
                                <button onClick={() => handleLikeComment(post.id, comment.id)} className="flex items-center gap-0.5 hover:text-red-500"><Heart className="h-3 w-3 fill-current text-red-400" /> Thả tim ({comment.likesCount})</button>
                                <button onClick={() => setReplyTargetCommentId(comment.id)} className="hover:text-blue-500">Trả lời</button>
                              </div>
                            </div>
                          </div>
                          {(comment.replies || []).map((reply) => (
                            <div key={reply.id} className="flex gap-2 pl-9 text-xs">
                              <SafeAvatar url={reply.authorAvatar} name={reply.authorName} className="h-6 w-6 rounded-full" />
                              <div className="flex-1 rounded-xl border border-slate-100 bg-white px-2.5 py-1.5">
                                <span className="block text-[11px] font-bold text-slate-800">{reply.authorName}</span>
                                <p className="text-[11px] text-slate-600">{reply.content}</p>
                              </div>
                            </div>
                          ))}
                          {replyTargetCommentId === comment.id && (
                            <div className="flex gap-2 pl-9">
                              <input value={replyInputs[comment.id] || ""} onChange={(event) => setReplyInputs((current) => ({ ...current, [comment.id]: event.target.value }))} placeholder={`Trả lời ${comment.authorName}...`} className="flex-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs outline-none" />
                              <button onClick={() => handleAddReply(post.id, comment.id)} className="rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white">Gửi</button>
                            </div>
                          )}
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <input value={commentInputs[post.id] || ""} onChange={(event) => setCommentInputs((current) => ({ ...current, [post.id]: event.target.value }))} placeholder="Viết bình luận..." className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs outline-none" />
                        <button onClick={() => handleAddComment(post.id)} className="rounded-full bg-blue-600 p-1.5 text-white hover:bg-blue-700"><Send className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </main>
      {showStoryComposer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Tạo story</h2>
              <button onClick={closeStoryComposer}><X className="h-5 w-5 text-slate-500" /></button>
            </div>
            {storyImagePreview ? <img src={storyImagePreview} alt="preview" className="mb-3 max-h-64 w-full rounded-xl object-cover" /> : null}
            <textarea value={storyText} onChange={(event) => setStoryText(event.target.value)} placeholder="Nhập nội dung story..." className="h-28 w-full resize-none rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-500" />
            <input ref={storyFileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => handleStoryImagePick(event.target.files?.[0])} />
            <div className="mt-4 flex items-center justify-between gap-3">
              <button onClick={() => storyFileInputRef.current?.click()} className="flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
                <ImageIcon className="h-4 w-4 text-green-500" /> Chọn ảnh
              </button>
              <button disabled={isCreatingStory || (!storyImageFile && !storyText.trim())} onClick={handleCreateStory} className="rounded-full bg-blue-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
                {isCreatingStory ? "Đang đăng..." : "Chia sẻ"}
              </button>
            </div>
          </div>
        </div>
      )}
      {activeStory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <button onClick={() => setActiveStory(null)} className="absolute right-5 top-5 rounded-full bg-black/40 p-2 text-white"><X className="h-6 w-6" /></button>
          <div className="relative flex h-[78vh] w-full max-w-md items-center justify-center overflow-hidden rounded-2xl text-white" style={{ backgroundColor: activeStory.backgroundColor || "#111827" }}>
            {activeStory.type === "image" ? <SafeStoryImage url={activeStory.mediaUrl} className="h-full w-full object-contain" /> : null}
            {activeStory.text ? <p className="absolute inset-x-6 text-center text-2xl font-bold drop-shadow" style={{ transform: `translate(${activeStory.textX || 0}px, ${activeStory.textY || 0}px) scale(${activeStory.textScale || 1}) rotate(${activeStory.textRotation || 0}deg)` }}>{activeStory.text}</p> : null}
            <div className="absolute left-4 top-4">
              <p className="font-bold">{activeStory.authorName}</p>
              <p className="text-xs text-white/80">{formatStoryAge(activeStory.createdAt)}</p>
            </div>
            <div className="absolute inset-x-4 bottom-4 flex items-center gap-2">
              {String(activeStory.userId) !== String(user?.id) && (
                <div className="flex flex-1 items-center gap-2 rounded-full border border-white/70 bg-black/20 px-4 py-2">
                  <input value={storyReplyText} onChange={(event) => setStoryReplyText(event.target.value)} onKeyDown={(event) => event.key === "Enter" && handleReplyToStory()} placeholder="Gửi tin nhắn..." className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/70" />
                  {!!storyReplyText.trim() && <button onClick={handleReplyToStory}><Send className="h-4 w-4" /></button>}
                </div>
              )}
              <button onClick={handleToggleStoryLike} disabled={isUpdatingStory} className="flex flex-col items-center text-xs text-white">
                <Heart className={`h-7 w-7 ${activeStory.likes?.some((id) => String(id) === String(user?.id)) ? "fill-red-500 text-red-500" : ""}`} />
                {!!activeStory.likeCount && <span>{activeStory.likeCount}</span>}
              </button>
              {String(activeStory.userId) === String(user?.id) && (
                <button onClick={handleToggleStoryHighlight} disabled={isUpdatingStory} className="flex flex-col items-center text-[10px] text-white">
                  <Bookmark className={`h-7 w-7 ${activeStory.isHighlighted ? "fill-white" : ""}`} />
                  <span>{activeStory.isHighlighted ? "Đã lưu" : "Bộ sưu tập"}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {commentsPostId && (
        <CommentsModal
          postId={commentsPostId}
          currentUserId={user?.id ? String(user.id) : undefined}
          onClose={() => setCommentsPostId(null)}
          onCommentAdded={() => setPosts((current) => current.map((post) => post.id === commentsPostId ? { ...post, commentCount: (post.commentCount || 0) + 1 } : post))}
          onCommentsDeleted={(count) => setPosts((current) => current.map((post) => post.id === commentsPostId ? { ...post, commentCount: Math.max(0, (post.commentCount || 0) - count) } : post))}
        />
      )}
      {reactionUsers && <ReactionModal users={reactionUsers} onClose={() => setReactionUsers(null)} />}
    </div>
  );
}
