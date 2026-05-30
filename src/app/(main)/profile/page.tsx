"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  CheckCircle,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Phone,
  Save,
  Send,
  Shield,
  User,
  XCircle,
  Newspaper,
  Heart,
  Share2,
  ImageIcon,
  Music,
  FolderOpen,
  Users as UsersIcon,
  Smile,
  Video,
  Link as LinkIcon,
  MapPin,
  ChevronDown,
  MessageSquare,
  Edit2,
  Trash2,
  List,
} from "lucide-react";
import { useAuth, VALIDATION_MESSAGES, VALIDATION_PATTERNS } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import {
  changePassword,
  getCurrentProfile,
  getPresignedUploadUrl,
  getPresignedViewUrl,
  sendEmailOTP,
  sendPhoneOTP,
  uploadFileDirect,
  uploadFileToPresignedUrl,
  updateProfile,
  verifyEmailOTP,
  verifyPhoneOTP,
  getFriendsList,
  buildPublicS3Url,
  createPost,
  getFeedPosts,
  getUserPosts,
  toggleLikePost,
  deletePost,
  createComment,
  getComments,
  deleteComment,
  updatePost,
} from "../../../api/client";
import ForgotPasswordModal from "../../../components/auth/ForgotPasswordModal";

type OptionKey = "profile" | "password" | "manage_posts";
type VerifyType = "email" | "phone" | null;

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

interface SafeAvatarProps {
  url?: string | null;
  name: string;
  className?: string;
}

const SafeAvatar: React.FC<SafeAvatarProps> = ({ url, name, className = "" }) => {
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function resolve() {
      if (!url) {
        setResolved(null);
        return;
      }
      const trimmed = url.trim();
      if (!trimmed) {
        setResolved(null);
        return;
      }
      if (trimmed.startsWith("http") && !trimmed.includes("amazonaws.com")) {
        if (mounted) setResolved(trimmed);
        return;
      }
      try {
        const res = await getPresignedViewUrl({ url: trimmed });
        if (mounted) {
          setResolved(res.viewUrl || trimmed);
        }
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
    <div className={`overflow-hidden flex items-center justify-center font-bold bg-blue-100 text-blue-600 shrink-0 ${className}`}>
      {resolved ? (
        <img src={resolved} alt={name} className="w-full h-full object-cover" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  );
};

interface SafePostImageProps {
  url?: string | null;
  className?: string;
}

const SafePostImage: React.FC<SafePostImageProps> = ({ url, className = "" }) => {
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function resolve() {
      if (!url) {
        setResolved(null);
        return;
      }
      const trimmed = url.trim();
      if (!trimmed) {
        setResolved(null);
        return;
      }
      if (trimmed.startsWith("http") && !trimmed.includes("amazonaws.com")) {
        if (mounted) setResolved(trimmed);
        return;
      }
      try {
        const res = await getPresignedViewUrl({ url: trimmed });
        if (mounted) {
          setResolved(res.viewUrl || trimmed);
        }
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
    <div className={`overflow-hidden border border-slate-100 bg-slate-50 ${className}`}>
      <img src={resolved} alt="post-attachment" className="w-full h-full object-cover" />
    </div>
  );
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, updateUser, logout } = useAuth();
  const { addToast } = useToast();

  const [activeOption, setActiveOption] = useState<OptionKey>("profile");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showAvatarPreview, setShowAvatarPreview] = useState(false);
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState<string | null>(null);
  const [resolvedCoverUrl, setResolvedCoverUrl] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  // States Bạn bè thực tế và Tường nhà (Timeline chung)
  const [webFriends, setWebFriends] = useState<any[]>([]);
  const [timelinePosts, setTimelinePosts] = useState<TimelinePost[]>([]);
  const [postCommentsMap, setPostCommentsMap] = useState<Record<string, PostComment[]>>({});
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  
  // States Tạo bài viết
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostImageUrl, setNewPostImageUrl] = useState("");
  
  // States Chỉnh sửa bài viết
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");

  // States Tương tác bình luận & Trả lời bình luận
  const [activeCommentInput, setActiveCommentInput] = useState<{ [postId: string]: string }>({});
  const [activeReplyInput, setActiveReplyInput] = useState<{ [commentId: string]: string }>({});
  const [replyTargetCommentId, setReplyTargetCommentId] = useState<string | null>(null);

  const [profileForm, setProfileForm] = useState({
    displayName: user?.displayName ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    avatarUrl: user?.avatarUrl ?? null,
    coverUrl: user?.coverUrl || (user as any)?.coverImage || (user as any)?.cover_url || null,
  });
  const [profileErrors, setProfileErrors] = useState<{ email?: string; phone?: string; displayName?: string }>({});

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState({ current: false, next: false, confirm: false });
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [verification, setVerification] = useState({
    type: null as VerifyType,
    target: "",
    otp: "",
    loading: false,
    step: "idle" as "idle" | "otp",
    error: "",
    debugOtp: "",
  });

  const passwordStrength = useMemo(() => {
    const v = passwordForm.newPassword;
    return [v.length >= 8, /[A-Z]/.test(v), /[a-z]/.test(v), /\d/.test(v)].filter(Boolean).length;
  }, [passwordForm.newPassword]);

  const formatPhoneForDisplay = (phone: string) => {
    const value = String(phone || '').trim();
    if (!value) return '';
    if (value.startsWith('+')) return value.replace(/\s+/g, '');

    const digits = value.replace(/\D/g, '');
    if (/^0[3-9][0-9]{8}$/.test(digits)) {
      return `+84${digits.slice(1)}`;
    }
    if (/^84[3-9][0-9]{8}$/.test(digits)) {
      return `+${digits}`;
    }
    return value;
  };

  const phoneDisplayValue = formatPhoneForDisplay(profileForm.phone);

  // Load danh sách bạn bè thật sự trên web
  useEffect(() => {
    let mounted = true;
    async function loadFriendsData() {
      try {
        const list = await getFriendsList();
        const resolvedList = await Promise.all(
          list.map(async (f: any) => {
            let resolvedAvatar = f.friend_avatar_url || f.avatar_url || null;
            if (resolvedAvatar && /\.amazonaws\.com/i.test(resolvedAvatar)) {
              try {
                const res = await getPresignedViewUrl({ url: resolvedAvatar });
                resolvedAvatar = res.viewUrl || resolvedAvatar;
              } catch {}
            }
            return {
              id: f.friend_id || f.userId,
              displayName: f.friend_display_name || f.display_name || "",
              avatarUrl: resolvedAvatar,
            };
          })
        );
        if (mounted) setWebFriends(resolvedList);
      } catch {}
    }
    if (user?.id) {
      loadFriendsData();
    }
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  // Ánh xạ dữ liệu từ backend sang TimelinePost
  const mapBackendPostToTimeline = (p: any): TimelinePost => {
    const imageUrl = p.media && p.media.length > 0 ? p.media[0].url : undefined;
    
    const likedBy = Array.isArray(p.likes) ? p.likes.map((id: string) => {
      if (id === user?.id) {
        return {
          userId: id,
          displayName: user?.displayName || user?.username || "Tôi",
          avatarUrl: resolvedAvatarUrl || user?.avatarUrl || null
        };
      }
      const foundFriend = webFriends.find(f => String(f.id) === String(id) || String(f.userId) === String(id));
      return {
        userId: id,
        displayName: foundFriend ? foundFriend.displayName : "Một người bạn",
        avatarUrl: foundFriend ? foundFriend.avatarUrl : null
      };
    }) : [];

    const comments = Array.isArray(p.comments) ? p.comments.map((c: any) => ({
      id: c.commentId || c.id,
      userId: c.userId,
      authorName: c.authorName || "Ẩn danh",
      authorAvatar: c.authorAvatar || null,
      content: c.content,
      createdAt: c.createdAt,
      likesCount: c.likesCount || 0,
      replies: c.replies || []
    })) : [];

    return {
      id: p.postId || p.id,
      userId: p.userId,
      authorName: p.authorName || "Người dùng",
      authorAvatar: p.authorAvatar || null,
      content: p.content || "",
      imageUrl,
      createdAt: p.createdAt,
      likedBy,
      comments,
      commentCount: p.commentCount || comments.length || 0
    } as any;
  };

  // Nạp timeline từ API Backend
  const loadTimelinePosts = async () => {
    try {
      const res = await getFeedPosts(50);
      const mapped = (res.posts || []).map(mapBackendPostToTimeline);
      setTimelinePosts(mapped);
    } catch (err) {
      console.error("Failed to load feed posts:", err);
      const saved = localStorage.getItem("app_timeline_posts");
      if (saved) {
        setTimelinePosts(JSON.parse(saved));
      }
    }
  };

  const toggleCommentsSection = async (postId: string) => {
    if (expandedComments[postId]) {
      setExpandedComments(prev => ({ ...prev, [postId]: false }));
      return;
    }

    try {
      const res = await getComments(postId);
      const mappedComments: PostComment[] = (res.comments || []).map((c: any) => ({
        id: c.commentId || c.id,
        userId: c.userId,
        authorName: c.authorName || "Ẩn danh",
        authorAvatar: c.authorAvatar || null,
        content: c.content || "",
        createdAt: c.createdAt,
        likesCount: c.likesCount || 0,
        replies: c.replies || []
      }));

      setPostCommentsMap(prev => ({ ...prev, [postId]: mappedComments }));
      setExpandedComments(prev => ({ ...prev, [postId]: true }));
    } catch (err: any) {
      addToast(`Tải bình luận thất bại: ${err.message || "Lỗi hệ thống"}`, "error");
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadTimelinePosts();
    }
  }, [user?.id, resolvedAvatarUrl, webFriends]);

  const handleCreatePost = async () => {
    if (!newPostContent.trim()) return;
    try {
      const media = newPostImageUrl.trim() ? [{ url: newPostImageUrl.trim(), type: "image" as const }] : undefined;
      const created = await createPost({
        content: newPostContent.trim(),
        media
      });
      const mapped = mapBackendPostToTimeline(created);
      
      const updated = [mapped, ...timelinePosts];
      setTimelinePosts(updated);
      localStorage.setItem("app_timeline_posts", JSON.stringify(updated));
      
      setNewPostContent("");
      setNewPostImageUrl("");
      addToast("Đăng bài thành công lên tường nhà!", "success");
    } catch (err: any) {
      addToast(`Đăng bài thất bại: ${err.message || "Lỗi hệ thống"}`, "error");
    }
  };

  const handleLikePost = async (postId: string) => {
    try {
      const res = await toggleLikePost(postId);
      
      const updated = timelinePosts.map(p => {
        if (p.id === postId) {
          const likedBy = res.likes.map((id: string) => ({
            userId: id,
            displayName: id === user?.id ? (user?.displayName || user?.username) : "Một người bạn",
            avatarUrl: id === user?.id ? (resolvedAvatarUrl || user?.avatarUrl || null) : null
          }));
          return {
            ...p,
            likedBy
          };
        }
        return p;
      });
      setTimelinePosts(updated);
      localStorage.setItem("app_timeline_posts", JSON.stringify(updated));
    } catch (err: any) {
      addToast(`Tương tác thất bại: ${err.message || "Lỗi hệ thống"}`, "error");
    }
  };

  const handleEditPost = (post: TimelinePost) => {
    const timeDiff = Date.now() - new Date(post.createdAt).getTime();
    const isUnder7Days = timeDiff < 7 * 24 * 60 * 60 * 1000;
    
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
      const updatedPost = mapBackendPostToTimeline(await updatePost(postId, editingContent.trim()));
      const updated = timelinePosts.map(p => p.id === postId ? updatedPost : p);
      setTimelinePosts(updated);
      localStorage.setItem("app_timeline_posts", JSON.stringify(updated));
      setEditingPostId(null);
      setEditingContent("");
      addToast("Đã cập nhật bài viết!", "success");
    } catch (err: any) {
      addToast(`Cập nhật bài viết thất bại: ${err.message || "Lỗi hệ thống"}`, "error");
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await deletePost(postId);
      const updated = timelinePosts.filter(p => p.id !== postId);
      setTimelinePosts(updated);
      localStorage.setItem("app_timeline_posts", JSON.stringify(updated));
      addToast("Đã xóa bài viết!", "success");
    } catch (err: any) {
      addToast(`Xóa bài viết thất bại: ${err.message || "Lỗi hệ thống"}`, "error");
    }
  };

  const handleAddComment = async (postId: string) => {
    const commentText = activeCommentInput[postId];
    if (!commentText || !commentText.trim()) return;

    try {
      const created = await createComment(postId, commentText.trim());
      
      const newComment: PostComment = {
        id: created.commentId,
        userId: created.userId,
        authorName: created.authorName || (user?.displayName || user?.username || "Người dùng"),
        authorAvatar: created.authorAvatar || resolvedAvatarUrl || user?.avatarUrl || null,
        content: created.content,
        createdAt: created.createdAt,
        likesCount: 0,
        replies: []
      };

      // 1. Thêm comment mới vào map của post đó
      setPostCommentsMap(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), newComment]
      }));

      // 2. Tăng số lượng bình luận hiển thị trên post
      setTimelinePosts(prevPosts => prevPosts.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            commentCount: (p.commentCount || 0) + 1
          };
        }
        return p;
      }));

      // 3. Tự động mở hộp thoại bình luận nếu chưa mở
      setExpandedComments(prev => ({ ...prev, [postId]: true }));

      setActiveCommentInput(prev => ({ ...prev, [postId]: "" }));
      addToast("Đã gửi bình luận!", "success");
    } catch (err: any) {
      addToast(`Gửi bình luận thất bại: ${err.message || "Lỗi hệ thống"}`, "error");
    }
  };

  const handleLikeComment = (postId: string, commentId: string) => {
    setPostCommentsMap(prev => {
      const postComments = prev[postId] || [];
      const updated = postComments.map(c => {
        if (c.id === commentId) {
          return { ...c, likesCount: (c.likesCount || 0) + 1 };
        }
        return c;
      });
      return { ...prev, [postId]: updated };
    });
    addToast("Đã thả tim bình luận!", "success");
  };

  const handleAddReply = (postId: string, commentId: string) => {
    const replyText = activeReplyInput[commentId];
    if (!replyText || !replyText.trim()) return;

    const newReply: CommentReply = {
      id: `r-${Date.now()}`,
      userId: String(user?.id || ""),
      authorName: user?.displayName || user?.username || "Tôi",
      authorAvatar: resolvedAvatarUrl || user?.avatarUrl || null,
      content: replyText.trim(),
      createdAt: new Date().toISOString()
    };

    setPostCommentsMap(prev => {
      const postComments = prev[postId] || [];
      const updated = postComments.map(c => {
        if (c.id === commentId) {
          return {
            ...c,
            replies: [...(c.replies || []), newReply]
          };
        }
        return c;
      });
      return { ...prev, [postId]: updated };
    });

    setActiveReplyInput(prev => ({ ...prev, [commentId]: "" }));
    setReplyTargetCommentId(null);
    addToast("Đã trả lời bình luận!", "success");
  };

  const mapProfileToUser = (raw: any) => ({
    displayName: raw.display_name || raw.displayName || raw.fullName || user?.displayName || "",
    email: raw.email ?? undefined,
    phone: raw.phone_number ?? raw.phone ?? raw.phoneNumber ?? undefined,
    avatarUrl: raw.avatar_url || raw.avatarUrl || null,
    coverUrl: raw.coverImage || raw.cover_url || raw.coverUrl || null,
    emailVerified: Boolean(raw.email_verified ?? raw.emailVerified ?? false),
    phoneVerified: Boolean(raw.phone_verified ?? raw.phoneVerified ?? false),
  });

  useEffect(() => {
    let mounted = true;
    async function syncProfile() {
      try {
        const data = await getCurrentProfile();
        if (!mounted) return;
        const mapped = mapProfileToUser(data || {});
        updateUser(mapped);
        setProfileForm((prev) => ({
          ...prev,
          displayName: mapped.displayName ?? prev.displayName,
          email: mapped.email ?? prev.email,
          phone: mapped.phone ?? prev.phone,
          avatarUrl: mapped.avatarUrl ?? prev.avatarUrl,
          coverUrl: mapped.coverUrl ?? prev.coverUrl,
        }));
      } catch {
        // giữ nguyên dữ liệu local
      }
    }
    syncProfile();
    return () => {
      mounted = false;
    };
  }, [updateUser]);

  // Ký và phân giải AvatarUrl
  useEffect(() => {
    let mounted = true;
    async function resolveAvatar() {
      const rawUrl = profileForm.avatarUrl || user?.avatarUrl || null;
      if (!rawUrl) {
        if (mounted) setResolvedAvatarUrl(null);
        return;
      }
      try {
        if (!/\.amazonaws\.com/i.test(rawUrl)) {
          if (mounted) setResolvedAvatarUrl(rawUrl);
          return;
        }
        const signed = await getPresignedViewUrl({ url: rawUrl });
        if (mounted) {
          setResolvedAvatarUrl(signed.viewUrl || rawUrl);
        }
      } catch {
        if (mounted) setResolvedAvatarUrl(rawUrl);
      }
    }
    resolveAvatar();
    return () => {
      mounted = false;
    };
  }, [profileForm.avatarUrl, user?.avatarUrl]);

  // Ký và phân giải CoverUrl
  useEffect(() => {
    let mounted = true;
    async function resolveCover() {
      const rawCover = profileForm.coverUrl || user?.coverUrl || (user as any)?.coverImage || (user as any)?.cover_url || null;
      if (!rawCover) {
        if (mounted) setResolvedCoverUrl(null);
        return;
      }
      try {
        if (!/\.amazonaws\.com/i.test(rawCover)) {
          if (mounted) setResolvedCoverUrl(rawCover);
          return;
        }
        const signed = await getPresignedViewUrl({ url: rawCover });
        if (mounted) {
          setResolvedCoverUrl(signed.viewUrl || rawCover);
        }
      } catch {
        if (mounted) setResolvedCoverUrl(rawCover);
      }
    }
    resolveCover();
    return () => {
      mounted = false;
    };
  }, [profileForm.coverUrl, user?.coverUrl, (user as any)?.coverImage, (user as any)?.cover_url]);

  const handleAvatarPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      addToast("Vui lòng chọn tệp ảnh hợp lệ", "error");
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const keyPrefix = `avatars/${user?.id || ""}`;
      let publicUrl = "";
      try {
        const presigned = await getPresignedUploadUrl({ keyPrefix, contentType: file.type });
        await uploadFileToPresignedUrl(presigned.uploadUrl, file);
        publicUrl = buildPublicS3Url(presigned.key, presigned.bucket);
      } catch {
        const direct = await uploadFileDirect(file, keyPrefix);
        publicUrl = direct.url || buildPublicS3Url(direct.key, direct.bucket);
      }

      await updateProfile({
        avatarUrl: publicUrl,
        avatar_url: publicUrl,
        avatarImage: publicUrl
      } as any);
      setProfileForm((prev) => ({ ...prev, avatarUrl: publicUrl }));
      updateUser({ avatarUrl: publicUrl });
      setResolvedAvatarUrl(publicUrl);
      addToast("Cập nhật ảnh đại diện thành công", "success");
    } catch {
      addToast("Tải ảnh đại diện thất bại", "error");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleCoverPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      addToast("Vui lòng chọn tệp ảnh hợp lệ", "error");
      return;
    }

    setIsUploadingCover(true);
    try {
      const keyPrefix = `covers/${user?.id || ""}`;
      let publicUrl = "";
      try {
        const presigned = await getPresignedUploadUrl({ keyPrefix, contentType: file.type });
        await uploadFileToPresignedUrl(presigned.uploadUrl, file);
        publicUrl = buildPublicS3Url(presigned.key, presigned.bucket);
      } catch {
        const direct = await uploadFileDirect(file, keyPrefix);
        publicUrl = direct.url || buildPublicS3Url(direct.key, direct.bucket);
      }

      await updateProfile({
        coverUrl: publicUrl,
        coverImage: publicUrl,
        cover_url: publicUrl
      } as any);
      setProfileForm((prev) => ({ ...prev, coverUrl: publicUrl }));
      updateUser({ coverUrl: publicUrl });
      setResolvedCoverUrl(publicUrl);
      addToast("Cập nhật ảnh nền thành công", "success");
    } catch {
      addToast("Tải ảnh nền thất bại", "error");
    } finally {
      setIsUploadingCover(false);
    }
  };

  const validateProfileForm = () => {
    const errors: { email?: string; phone?: string; displayName?: string } = {};

    if (!profileForm.displayName.trim()) {
      errors.displayName = "Vui lòng nhập tên hiển thị";
    } else if (!VALIDATION_PATTERNS.fullName.test(profileForm.displayName.trim())) {
      errors.displayName = VALIDATION_MESSAGES.fullName;
    }

    if (profileForm.email.trim() && !VALIDATION_PATTERNS.email.test(profileForm.email.trim())) {
      errors.email = VALIDATION_MESSAGES.email;
    }

    if (!profileForm.phone.trim()) {
      errors.phone = "Số điện thoại là bắt buộc";
    } else if (!VALIDATION_PATTERNS.phone.test(profileForm.phone.trim())) {
      errors.phone = VALIDATION_MESSAGES.phone;
    }

    setProfileErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveProfile = async () => {
    if (!validateProfileForm()) return;

    setIsSaving(true);
    try {
      await updateProfile({
        displayName: profileForm.displayName.trim(),
        email: profileForm.email.trim() || undefined,
        phone: profileForm.phone.trim(),
      });

      updateUser({
        displayName: profileForm.displayName.trim(),
        email: profileForm.email.trim() || undefined,
        phone: profileForm.phone.trim(),
        avatarUrl: profileForm.avatarUrl,
        coverUrl: profileForm.coverUrl,
      });

      addToast("Cập nhật hồ sơ thành công", "success");
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : "Cập nhật hồ sơ thất bại", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const startVerify = async (type: VerifyType) => {
    if (verification.loading) return;
    const target = type === "email" ? profileForm.email.trim() : profileForm.phone.trim();
    if (!target) {
      addToast(type === "email" ? "Vui lòng nhập email trước" : "Vui lòng nhập số điện thoại trước", "error");
      return;
    }

    setVerification({ type, target, otp: "", loading: true, step: "idle", error: "", debugOtp: "" });
    try {
      if (type === "email") {
        const result = await sendEmailOTP(target);
        setVerification((prev) => ({ ...prev, debugOtp: result.debugOtp || "" }));
      } else {
        const result = await sendPhoneOTP(target);
        setVerification((prev) => ({ ...prev, debugOtp: result.debugOtp || "" }));
      }
      setVerification((prev) => ({ ...prev, type, target, otp: "", loading: false, step: "otp", error: "" }));
      addToast("Đã gửi mã xác thực", "success");
    } catch (err: unknown) {
      setVerification({ type: null, target: "", otp: "", loading: false, step: "idle", error: "", debugOtp: "" });
      addToast(err instanceof Error ? err.message : "Không gửi được mã xác thực", "error");
    }
  };

  const confirmVerify = async () => {
    if (verification.otp.length < 6 || !verification.type) {
      setVerification((prev) => ({ ...prev, error: "Vui lòng nhập mã OTP 6 số" }));
      return;
    }

    setVerification((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      if (verification.type === "email") {
        await verifyEmailOTP({ email: verification.target, otp: verification.otp });
        updateUser({ email: verification.target, emailVerified: true });
      } else {
        await verifyPhoneOTP({ phone: verification.target, otp: verification.otp });
        updateUser({ phone: verification.target, phoneVerified: true });
      }
      addToast("Xác thực thành công", "success");
      setVerification({ type: null, target: "", otp: "", loading: false, step: "idle", error: "", debugOtp: "" });
    } catch (err: unknown) {
      setVerification((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Mã xác thực không hợp lệ",
      }));
    }
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    if (!passwordForm.currentPassword) {
      setPasswordError("Vui lòng nhập mật khẩu hiện tại");
      return;
    }
    if (!VALIDATION_PATTERNS.password.test(passwordForm.newPassword)) {
      setPasswordError(VALIDATION_MESSAGES.password);
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError(VALIDATION_MESSAGES.confirmPassword);
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      addToast("Đổi mật khẩu thành công. Hệ thống sẽ đăng xuất để đăng nhập lại", "success");
      setTimeout(() => {
        logout();
        router.replace("/login");
      }, 1500);
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : "Đổi mật khẩu thất bại");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogoutConfirmed = () => {
    setShowLogoutConfirm(false);
    logout();
    router.replace("/login");
  };

  const myPosts = useMemo(() => {
    return timelinePosts.filter(p => p.userId === user?.id);
  }, [timelinePosts, user?.id]);

  const hasSideWidgets = activeOption === "profile" || activeOption === "manage_posts";

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-[#f2f5fa] px-6 py-6">
      <div className="mx-auto max-w-7xl">
        {/* Banner Ảnh Bền & Ảnh Đại Diện chuẩn Zalo */}
        <div className="mb-5 rounded-2xl bg-white shadow-sm overflow-hidden">
          <div className="relative w-full h-48 md:h-64 bg-gradient-to-r from-blue-400 to-indigo-500 overflow-hidden group">
            {resolvedCoverUrl ? (
              <img src={resolvedCoverUrl} alt="cover" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-blue-400 to-indigo-500" />
            )}
            
            {/* Lớp phủ gradient mờ ở đáy ảnh bìa để làm nổi bật avatar và chữ */}
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
            
            {/* Nút thay đổi ảnh bìa */}
            <button
              onClick={() => coverInputRef.current?.click()}
              disabled={isUploadingCover}
              className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-60"
            >
              {isUploadingCover ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
              <span>Đổi ảnh bìa</span>
            </button>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverPick}
              className="hidden"
            />
          </div>

          <div className="p-6 pt-0 relative flex flex-col md:flex-row items-center md:items-end gap-4 px-8">
            <div className="relative z-10 -mt-12 md:-mt-16">
              <div className="flex h-24 w-24 md:h-28 md:w-28 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-blue-100 text-3xl font-bold text-blue-600 shadow-sm">
                {resolvedAvatarUrl ? (
                  <button
                    type="button"
                    onClick={() => setShowAvatarPreview(true)}
                    className="h-full w-full"
                    title="Xem ảnh đại diện"
                  >
                    <img src={resolvedAvatarUrl} alt="avatar" className="h-full w-full object-cover" />
                  </button>
                ) : (
                  (user?.displayName || user?.username || "Tôi").charAt(0).toUpperCase()
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-white hover:bg-blue-700 shadow disabled:opacity-60"
                title="Đổi ảnh đại diện"
              >
                {isUploadingAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarPick}
                className="hidden"
              />
            </div>
            
            <div className="text-center md:text-left mb-2">
              <h1 className="text-2xl font-extrabold text-slate-950 tracking-tight drop-shadow-sm">{user?.displayName || user?.username || "Người dùng"}</h1>
              <p className="text-sm text-slate-500">@{user?.username || "user"}</p>
              <div className="mt-1 flex flex-wrap justify-center md:justify-start gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${user?.emailVerified ? "bg-green-50 text-green-700 border border-green-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                  {user?.emailVerified ? "Email đã xác thực" : "Email chưa xác thực"}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${user?.phoneVerified ? "bg-green-50 text-green-700 border border-green-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                  {user?.phoneVerified ? "SĐT đã xác thực" : "SĐT chưa xác thực"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className={`grid grid-cols-1 gap-6 ${hasSideWidgets ? "lg:grid-cols-[280px,1fr,320px]" : "lg:grid-cols-[280px,1fr]"}`}>
          {/* Cột 1: Options Sidebar */}
          <aside className="rounded-2xl bg-white p-4 shadow-sm h-fit">
            <p className="mb-3 px-2 text-xs font-bold uppercase tracking-wider text-slate-500">Tùy chọn</p>
            
            <button
              onClick={() => {
                setActiveOption("manage_posts");
                router.push("/profile");
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${
                activeOption === "manage_posts" ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="flex items-center gap-2"><List className="h-4 w-4" /> Quản lý bài viết</span>
              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              onClick={() => {
                setActiveOption("profile");
                router.push("/profile");
              }}
              className={`mt-1 flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${
                activeOption === "profile" ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="flex items-center gap-2"><User className="h-4 w-4" /> Cập nhật thông tin</span>
              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              onClick={() => {
                setActiveOption("password");
                router.push("/profile");
              }}
              className={`mt-1 flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${
                activeOption === "password" ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="flex items-center gap-2"><Shield className="h-4 w-4" /> Đổi mật khẩu</span>
              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              onClick={() => setShowForgotModal(true)}
              className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <span className="flex items-center gap-2"><Lock className="h-4 w-4" /> Quên mật khẩu</span>
              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="mt-4 w-full rounded-xl border border-red-200 px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
            >
              Đăng xuất
            </button>
          </aside>

          {/* Cột 2: Main Content Block */}
          <section className="rounded-2xl bg-white p-6 shadow-sm h-fit">
            {/* TAB: Cập nhật thông tin */}
            {activeOption === "profile" && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-slate-900">Thông tin cá nhân</h2>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Tên hiển thị</label>
                  <input
                    value={profileForm.displayName}
                    onChange={(e) => {
                      setProfileForm((prev) => ({ ...prev, displayName: e.target.value }));
                      setProfileErrors((prev) => ({ ...prev, displayName: undefined }));
                    }}
                    className="w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none"
                    placeholder="Nhập tên hiển thị"
                  />
                  {profileErrors.displayName && <p className="mt-1 text-xs text-red-500">{profileErrors.displayName}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Email (tùy chọn)</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={profileForm.email}
                        onChange={(e) => {
                          setProfileForm((prev) => ({ ...prev, email: e.target.value }));
                          setProfileErrors((prev) => ({ ...prev, email: undefined }));
                        }}
                        className="w-full rounded-xl border-2 border-slate-200 py-2.5 pl-9 pr-3 text-sm focus:border-blue-400 focus:outline-none"
                        placeholder="you@example.com"
                      />
                    </div>
                    <button
                      onClick={() => startVerify("email")}
                      disabled={verification.loading}
                      className="rounded-xl border border-blue-200 px-3 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="inline-flex items-center gap-1"><Send className="h-4 w-4" /> Xác thực</span>
                    </button>
                  </div>
                  {user?.emailVerified && <p className="mt-1 text-xs text-green-600">Email đã được xác thực</p>}
                  {profileErrors.email && <p className="mt-1 text-xs text-red-500">{profileErrors.email}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Số điện thoại</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={profileForm.phone}
                        onChange={(e) => {
                          setProfileForm((prev) => ({ ...prev, phone: e.target.value }));
                          setProfileErrors((prev) => ({ ...prev, phone: undefined }));
                        }}
                        className="w-full rounded-xl border-2 border-slate-200 py-2.5 pl-9 pr-3 text-sm focus:border-blue-400 focus:outline-none"
                        placeholder="0912345678"
                      />
                    </div>
                    <button
                      onClick={() => startVerify("phone")}
                      disabled={verification.loading}
                      className="rounded-xl border border-blue-200 px-3 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="inline-flex items-center gap-1"><Send className="h-4 w-4" /> Xác thực</span>
                    </button>
                  </div>
                  {phoneDisplayValue && (
                    <p className="mt-1 text-xs text-slate-500">
                      Sẽ hiển thị và gửi SMS theo chuẩn quốc tế: <span className="font-medium text-slate-700">{phoneDisplayValue}</span>
                    </p>
                  )}
                  {user?.phoneVerified && <p className="mt-1 text-xs text-green-600">Số điện thoại đã được xác thực</p>}
                  {profileErrors.phone && <p className="mt-1 text-xs text-red-500">{profileErrors.phone}</p>}
                </div>

                {verification.step === "otp" && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-2 text-sm text-slate-700">
                      Nhập OTP đã gửi đến {verification.type === "email" ? verification.target : formatPhoneForDisplay(verification.target)}
                    </p>
                    {verification.type === "phone" && verification.debugOtp && (
                      <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                        OTP test: {verification.debugOtp}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <input
                        value={verification.otp}
                        onChange={(e) => setVerification((prev) => ({ ...prev, otp: e.target.value.replace(/\D/g, "") }))}
                        maxLength={6}
                        className="flex-1 rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm tracking-widest focus:border-blue-400 focus:outline-none"
                        placeholder="_ _ _ _ _ _"
                      />
                      <button
                        onClick={confirmVerify}
                        disabled={verification.loading}
                        className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        {verification.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Xác nhận"}
                      </button>
                    </div>
                    {verification.error && <p className="mt-2 text-xs text-red-500">{verification.error}</p>}
                  </div>
                )}

                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Lưu thay đổi
                </button>
              </div>
            )}

            {/* TAB: Nhật ký hoạt động (Timeline) */}
            {false && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900 font-sans">Bảng tin cộng đồng</h2>
                </div>

                {/* Khung đăng bài chuẩn mạng xã hội */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3 bg-slate-50 px-3 py-1.5 rounded-full w-fit cursor-pointer border border-slate-100 hover:bg-slate-100 transition">
                    <UsersIcon className="w-3.5 h-3.5 text-slate-600" />
                    <span className="text-xs font-bold text-slate-700">Bạn bè chung</span>
                    <ChevronDown className="w-3 h-3 text-slate-500" />
                  </div>

                  <textarea
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    placeholder="Bạn đang nghĩ gì?"
                    className="w-full h-24 resize-none border-none outline-none text-sm placeholder-slate-400 text-slate-700 focus:ring-0"
                  />

                  {/* Nút hành động nhanh */}
                  <div className="flex items-center gap-3 py-2 border-t border-slate-100 mt-2">
                    <button className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 transition px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 border border-slate-100">
                      <Music className="w-3.5 h-3.5 text-pink-500" />
                      <span>Nhạc</span>
                    </button>
                    <button className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 transition px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 border border-slate-100">
                      <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
                      <span>Album</span>
                    </button>
                    <button className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 transition px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 border border-slate-100">
                      <UsersIcon className="w-3.5 h-3.5 text-blue-500" />
                      <span>Với bạn bè</span>
                    </button>
                  </div>

                  {/* Thanh công cụ sát đáy */}
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4 text-slate-500">
                      <button className="hover:text-amber-500 transition"><Smile className="w-5 h-5" /></button>
                      <div className="flex items-center gap-2 group relative">
                        <button className="hover:text-green-500 transition"><ImageIcon className="w-5 h-5" /></button>
                        <input
                          value={newPostImageUrl}
                          onChange={(e) => setNewPostImageUrl(e.target.value)}
                          placeholder="Dán link ảnh..."
                          className="bg-slate-50 text-[10px] outline-none px-2 py-1 rounded border border-slate-100 w-32 focus:w-44 transition-all placeholder-slate-400"
                        />
                      </div>
                      <button className="hover:text-red-500 transition"><Video className="w-5 h-5" /></button>
                      <button className="hover:text-blue-500 transition"><LinkIcon className="w-5 h-5" /></button>
                      <button className="hover:text-purple-500 transition"><MapPin className="w-5 h-5" /></button>
                    </div>

                    <button
                      onClick={handleCreatePost}
                      disabled={!newPostContent.trim()}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Đăng bài
                    </button>
                  </div>
                </div>

                {/* Danh sách các bài đăng cộng đồng */}
                <div className="space-y-4">
                  {timelinePosts.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl border border-slate-100 text-slate-400">
                      <Newspaper className="w-12 h-12 mx-auto mb-2 stroke-1" />
                      <p className="text-sm">Chưa có bài đăng nào trên tường nhà. Hãy là người đầu tiên đăng bài nhé!</p>
                    </div>
                  ) : (
                    timelinePosts.map((post) => {
                      const containsLink = post.content && (post.content.includes("http://") || post.content.includes("https://"));
                      const matchedLink = containsLink ? post.content.match(/https?:\/\/[^\s]+/)?.[0] : null;
                      
                      const timeDiff = Date.now() - new Date(post.createdAt).getTime();
                      const isUnder7Days = timeDiff < 7 * 24 * 60 * 60 * 1000;
                      const isMyPost = post.userId === user?.id;

                      return (
                        <div key={post.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <SafeAvatar 
                                url={post.authorAvatar} 
                                name={post.authorName} 
                                className="w-10 h-10 rounded-full" 
                              />
                              <div>
                                <h4 className="font-bold text-sm text-slate-800">{post.authorName}</h4>
                                <p className="text-[11px] text-slate-400 font-semibold font-mono">
                                  {new Date(post.createdAt).toLocaleString("en-US")}
                                </p>
                              </div>
                            </div>
                            
                            {/* Nút sửa/xóa bài */}
                            {isMyPost && (
                              <div className="flex items-center gap-2">
                                {isUnder7Days && (
                                  <button
                                    onClick={() => handleEditPost(post)}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 transition"
                                    title="Chỉnh sửa bài đăng (< 7 ngày)"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeletePost(post.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 transition"
                                  title="Xóa bài viết"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Khung nội dung hiển thị hoặc chỉnh sửa */}
                          {editingPostId === post.id ? (
                            <div className="space-y-2 mb-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                              <textarea
                                value={editingContent}
                                onChange={(e) => setEditingContent(e.target.value)}
                                className="w-full text-sm bg-white border border-slate-200 rounded-lg p-2 resize-none outline-none focus:border-blue-400"
                                rows={3}
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => setEditingPostId(null)}
                                  className="px-3 py-1 bg-slate-200 hover:bg-slate-300 rounded-md text-xs font-bold"
                                >
                                  Hủy
                                </button>
                                <button
                                  onClick={() => handleSaveEditedPost(post.id)}
                                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold"
                                >
                                  Lưu
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed mb-3">{post.content}</p>
                          )}

                          {matchedLink && (
                            <div className="bg-[#F2F3F5] hover:bg-[#E4E6EB] transition rounded-2xl p-4 mb-3 border border-slate-200 cursor-pointer">
                              <span className="text-xs text-blue-600 font-bold block mb-1">facebook.com</span>
                              <span className="text-xs font-semibold text-slate-700 truncate block">{matchedLink}</span>
                            </div>
                          )}

                          {post.imageUrl && (
                            <SafePostImage 
                              url={post.imageUrl} 
                              className="mt-3 rounded-lg max-h-[350px]" 
                            />
                          )}

                          {/* Danh sách người thả tim */}
                          {post.likedBy && post.likedBy.length > 0 && (
                            <div className="mt-2.5 px-3 py-1.5 bg-red-50/50 rounded-lg text-[11px] text-slate-600 flex items-center gap-1.5 flex-wrap">
                              <Heart className="w-3 h-3 text-red-500 fill-current" />
                              <span className="font-semibold">Thả tim bởi:</span>
                              <span className="font-bold text-slate-800">
                                {post.likedBy.map(like => like.displayName).join(", ")}
                              </span>
                            </div>
                          )}

                          {/* Action panel */}
                          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-slate-500 text-xs">
                            <div className="flex items-center gap-6">
                              <button
                                onClick={() => handleLikePost(post.id)}
                                className={`flex items-center gap-1.5 hover:text-red-500 transition-colors font-bold ${
                                  post.likedBy.some(l => l.userId === user?.id) ? "text-red-500" : ""
                                  }`}
                              >
                                <Heart className={`w-4 h-4 ${post.likedBy.some(l => l.userId === user?.id) ? "fill-current" : ""}`} />
                                <span>Thích ({post.likedBy.length || 0})</span>
                              </button>
                              
                              <button 
                                onClick={() => toggleCommentsSection(post.id)}
                                className={`flex items-center gap-1.5 hover:text-blue-500 transition-colors font-bold ${expandedComments[post.id] ? "text-blue-600" : ""}`}
                              >
                                <MessageSquare className="w-4 h-4" />
                                <span>Bình luận ({post.commentCount || 0})</span>
                              </button>
                            </div>
                            
                            <button className="flex items-center gap-1.5 hover:text-blue-500 transition-colors font-bold">
                              <Share2 className="w-4 h-4" /> Chia sẻ
                            </button>
                          </div>

                          {/* Comments Section */}
                          {expandedComments[post.id] && (
                            <div className="mt-4 pt-4 border-t border-slate-50 bg-slate-50/50 rounded-xl p-3 space-y-3">
                              {(postCommentsMap[post.id] || []).length > 0 && (
                                <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                                  {(postCommentsMap[post.id] || []).map((comment) => (
                                    <div key={comment.id} className="space-y-1.5">
                                      <div className="flex gap-2 text-xs">
                                        <SafeAvatar 
                                          url={comment.authorAvatar} 
                                          name={comment.authorName} 
                                          className="w-7 h-7 rounded-full" 
                                        />
                                        <div className="bg-slate-100 rounded-2xl px-3 py-2 flex-1">
                                          <div className="flex justify-between items-center mb-0.5">
                                            <span className="font-bold text-slate-800">{comment.authorName}</span>
                                            <span className="text-[9px] text-slate-400 font-mono">
                                              {new Date(comment.createdAt).toLocaleTimeString()}
                                            </span>
                                          </div>
                                          <p className="text-slate-600">{comment.content}</p>
                                          
                                          {/* Actions comment: Tim comment, Trả lời */}
                                          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-500 font-bold">
                                            <button
                                              onClick={() => handleLikeComment(post.id, comment.id)}
                                              className="hover:text-red-500 flex items-center gap-0.5"
                                            >
                                              <Heart className="w-3 h-3 text-red-400 fill-current" /> Thả tim ({comment.likesCount || 0})
                                            </button>
                                            <button
                                              onClick={() => setReplyTargetCommentId(comment.id)}
                                              className="hover:text-blue-500"
                                            >
                                              Trả lời
                                            </button>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Danh sách các câu Trả lời (Replies) */}
                                      {comment.replies && comment.replies.length > 0 && (
                                        <div className="pl-9 space-y-2">
                                          {comment.replies.map((reply) => (
                                            <div key={reply.id} className="flex gap-2 text-xs">
                                              <SafeAvatar 
                                                url={reply.authorAvatar} 
                                                name={reply.authorName} 
                                                className="w-6 h-6 rounded-full" 
                                              />
                                              <div className="bg-white border border-slate-100 rounded-xl px-2.5 py-1.5 flex-1">
                                                <span className="font-bold text-slate-800 block text-[11px]">{reply.authorName}</span>
                                                <p className="text-slate-600 text-[11px]">{reply.content}</p>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      {/* Hộp nhập trả lời cụ thể */}
                                      {replyTargetCommentId === comment.id && (
                                        <div className="pl-9 flex gap-2">
                                          <input
                                            value={activeReplyInput[comment.id] || ""}
                                            onChange={(e) => setActiveReplyInput(prev => ({ ...prev, [comment.id]: e.target.value }))}
                                            placeholder={`Trả lời ${comment.authorName}...`}
                                            className="flex-1 bg-white border border-slate-200 rounded-full px-3 py-1 text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none"
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter") handleAddReply(post.id, comment.id);
                                            }}
                                          />
                                          <button
                                            onClick={() => handleAddReply(post.id, comment.id)}
                                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-full text-xs font-bold"
                                          >
                                            Gửi
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Ô nhập bình luận chính */}
                              <div className="flex gap-2">
                                <input
                                  value={activeCommentInput[post.id] || ""}
                                  onChange={(e) => setActiveCommentInput(prev => ({ ...prev, [post.id]: e.target.value }))}
                                  placeholder="Viết bình luận..."
                                  className="flex-1 bg-white border border-slate-200 rounded-full px-4 py-1.5 text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleAddComment(post.id);
                                  }}
                                />
                                <button
                                  onClick={() => handleAddComment(post.id)}
                                  className="bg-blue-600 text-white rounded-full p-1.5 hover:bg-blue-700 transition"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB: Kho quản lý bài viết của riêng tôi */}
            {activeOption === "manage_posts" && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-slate-900">Quản lý bài viết của tôi</h2>
                <p className="text-xs text-slate-500">
                  Hiển thị toàn bộ các bài đăng do bạn chia sẻ lên dòng thời gian chung.
                </p>

                <div className="space-y-4">
                  {myPosts.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl border border-slate-100 text-slate-400">
                      <Newspaper className="w-12 h-12 mx-auto mb-2 stroke-1" />
                      <p className="text-sm">Bạn chưa đăng bài viết nào lên bảng tin chung.</p>
                    </div>
                  ) : (
                    myPosts.map((post) => {
                      const timeDiff = Date.now() - new Date(post.createdAt).getTime();
                      const isUnder7Days = timeDiff < 7 * 24 * 60 * 60 * 1000;

                      return (
                        <div key={post.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div className="flex-1">
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono font-bold block w-fit mb-1.5">
                              {new Date(post.createdAt).toLocaleString("en-US")}
                            </span>
                            <p className="text-sm text-slate-800 font-semibold truncate max-w-lg">{post.content}</p>
                            {post.imageUrl && <p className="text-[10px] text-blue-500 font-semibold truncate mt-1">Đính kèm ảnh: {post.imageUrl}</p>}
                          </div>
                          
                          <div className="flex items-center gap-2 shrink-0">
                            {isUnder7Days && (
                              <button
                                onClick={() => {
                                  router.push("/timeline");
                                }}
                                className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-blue-100 transition"
                              >
                                <Edit2 className="w-3 h-3" /> Sửa bài
                              </button>
                            )}
                            <button
                              onClick={() => handleDeletePost(post.id)}
                              className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-red-100 transition"
                            >
                              <Trash2 className="w-3 h-3" /> Xóa bài
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB: Đổi mật khẩu */}
            {activeOption === "password" && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-slate-900">Đổi mật khẩu</h2>

                <PasswordInput
                  label="Mật khẩu hiện tại"
                  value={passwordForm.currentPassword}
                  onChange={(v) => setPasswordForm((p) => ({ ...p, currentPassword: v }))}
                  visible={showPassword.current}
                  onToggle={() => setShowPassword((s) => ({ ...s, current: !s.current }))}
                />
                <PasswordInput
                  label="Mật khẩu mới"
                  value={passwordForm.newPassword}
                  onChange={(v) => setPasswordForm((p) => ({ ...p, newPassword: v }))}
                  visible={showPassword.next}
                  onToggle={() => setShowPassword((s) => ({ ...s, next: !s.next }))}
                />

                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className={`h-1.5 flex-1 rounded-full ${passwordStrength >= i ? "bg-green-400" : "bg-slate-200"}`} />
                  ))}
                </div>
                <p className="text-xs text-slate-500">Mật khẩu mạnh cần tối thiểu 8 ký tự gồm chữ hoa, chữ thường và số.</p>

                <PasswordInput
                  label="Xác nhận mật khẩu mới"
                  value={passwordForm.confirmPassword}
                  onChange={(v) => setPasswordForm((p) => ({ ...p, confirmPassword: v }))}
                  visible={showPassword.confirm}
                  onToggle={() => setShowPassword((s) => ({ ...s, confirm: !s.confirm }))}
                />

                {passwordError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {passwordError}
                  </div>
                )}

                <button
                  onClick={handleChangePassword}
                  disabled={isChangingPassword}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  {isChangingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />} Xác nhận đổi mật khẩu
                </button>
              </div>
            )}
          </section>

          {/* Cột 3: Sidebar Widgets */}
          {hasSideWidgets && (
            <div className="space-y-4">
              {/* Widget Ảnh */}
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 text-base">Ảnh</span>
                    <span className="text-xs text-slate-400">({[resolvedCoverUrl, resolvedAvatarUrl].filter(Boolean).length})</span>
                  </div>
                  <button
                    onClick={() => {
                      router.push("/timeline");
                    }}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    Xem tất cả
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {/* Ảnh thật đã ký signed URL */}
                  {[resolvedCoverUrl, resolvedAvatarUrl].filter(Boolean).map((url: any, idx) => (
                    <div key={idx} className="aspect-square rounded-xl overflow-hidden border border-slate-100 bg-slate-50 relative group cursor-pointer">
                      <img src={url} alt="media" className="w-full h-full object-cover group-hover:scale-105 transition duration-200" />
                    </div>
                  ))}
                  {/* Ô dashed rỗng */}
                  {Array.from({ length: Math.max(0, 3 - [resolvedCoverUrl, resolvedAvatarUrl].filter(Boolean).length) }).map((_, idx) => (
                    <div key={`empty-${idx}`} className="aspect-square rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-300">
                      <ImageIcon className="w-5 h-5 text-slate-300 stroke-1" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Widget Bạn bè */}
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 text-base">Bạn bè</span>
                    <span className="text-xs text-slate-400">({webFriends.length})</span>
                  </div>
                  <button
                    onClick={() => router.push("/contacts")}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    Xem tất cả
                  </button>
                </div>

                {webFriends.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">Chưa có bạn bè nào trong danh bạ</p>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {webFriends.slice(0, 6).map((friend) => (
                      <div key={friend.id} className="flex flex-col items-center">
                        <div className="w-12 h-12 rounded-2xl overflow-hidden bg-blue-50 border border-slate-100 flex items-center justify-center font-bold text-blue-600 mb-1.5">
                          {friend.avatarUrl ? (
                            <img src={friend.avatarUrl} alt={friend.displayName} className="w-full h-full object-cover" />
                          ) : (
                            friend.displayName.charAt(0).toUpperCase()
                          )}
                        </div>
                        <span className="text-[11px] font-semibold text-slate-700 truncate w-full text-center">{friend.displayName}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <ForgotPasswordModal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
        onSuccess={() => {
          setShowForgotModal(false);
          addToast("Đặt lại mật khẩu thành công, vui lòng đăng nhập lại", "success");
          logout();
          router.replace("/login");
        }}
      />

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
            <div className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
                <LogOut className="h-7 w-7 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Đăng xuất</h3>
              <p className="mt-2 text-sm text-slate-600">Bạn có chắc chắn muốn đăng xuất không?</p>
            </div>
            <div className="flex border-t border-slate-100">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Huỷ
              </button>
              <button
                onClick={handleLogoutConfirmed}
                className="flex-1 border-l border-slate-100 py-3.5 text-sm font-semibold text-red-500 transition-colors hover:bg-red-50"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}

      {showAvatarPreview && resolvedAvatarUrl && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 px-4"
          onClick={() => setShowAvatarPreview(false)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setShowAvatarPreview(false)}
              className="absolute -right-3 -top-3 rounded-full bg-white p-1.5 text-slate-700 shadow"
              title="Đóng"
            >
              <XCircle className="h-5 w-5" />
            </button>
            <img
              src={resolvedAvatarUrl}
              alt="Ảnh đại diện"
              className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface PasswordInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
}

function PasswordInput({ label, value, onChange, visible, onToggle }: PasswordInputProps) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-600">{label}</label>
      <div className="relative">
        <Shield className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border-2 border-slate-200 py-2.5 pl-9 pr-10 text-sm focus:border-blue-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
