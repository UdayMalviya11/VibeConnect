import {
  ChatBubbleOutlineOutlined,
  FavoriteBorderOutlined,
  FavoriteOutlined,
  ShareOutlined,
} from "@mui/icons-material";
import { Box, Divider, IconButton, Typography, useTheme, TextField, Button, Avatar, Menu, ListItemText, Dialog, DialogTitle, DialogContent, List, ListItemButton } from "@mui/material";
import FlexBetween from "components/FlexBetween";
import Friend from "components/Friend";
import WidgetWrapper from "components/WidgetWrapper";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { setPost } from "state";
import { config } from "../../config";

const PostWidget = ({
  postId,
  postUserId,
  name,
  description,
  location,
  picturePath,
  attachments = [],
  userPicturePath,
  likes,
  comments,
}) => {
  const [isComments, setIsComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [replyByCommentId, setReplyByCommentId] = useState({});
  const [expandedReplies, setExpandedReplies] = useState({});
  const [showAllComments, setShowAllComments] = useState(false);
  const [shareAnchor, setShareAnchor] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [friends, setFriends] = useState([]);
  const user = useSelector((state)=> state.user);

  const loadFriends = async () => {
    try {
      const resp = await fetch(`${config.apiBaseUrl}/users/${user._id}/friends`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await resp.json();
      setFriends(Array.isArray(data) ? data : []);
    } catch { setFriends([]); }
  };
  const dispatch = useDispatch();
  const token = useSelector((state) => state.token);
  const loggedInUserId = useSelector((state) => state.user._id);
  const isLiked = Boolean(likes[loggedInUserId]);
  const likeCount = Object.keys(likes).length;

  const { palette } = useTheme();
  const main = palette.neutral.main;
  const primary = palette.primary.main;
  const navigate = useNavigate();
  

  // Filter out null/empty comments and calculate count
  const validComments = Array.isArray(comments) 
    ? comments.filter(c => c && c.text && c.text.trim() && c.userId)
    : [];
  
  const totalCommentCount = validComments.reduce((acc, c) => {
    const validReplies = Array.isArray(c.replies) 
      ? c.replies.filter(r => r && r.text && r.text.trim() && r.userId)
      : [];
    return acc + 1 + validReplies.length;
  }, 0);

  const [userCache, setUserCache] = useState({});

  const fetchUser = async (userId) => {
    if (!userId || userCache[userId]) return userCache[userId];
    try {
      const resp = await fetch(`${config.apiBaseUrl}/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      setUserCache((prev) => ({ ...prev, [userId]: data }));
      return data;
    } catch {
      return null;
    }
  };

  const patchLike = async () => {
    const response = await fetch(`${config.apiBaseUrl}/posts/${postId}/like`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: loggedInUserId }),
    });
    const updatedPost = await response.json();
    dispatch(setPost({ post: updatedPost }));
  };

  const submitComment = async () => {
    if (!newComment.trim()) return;
    
    console.log("=== COMMENT SUBMISSION DEBUG ===");
    console.log("Post ID:", postId);
    console.log("User ID:", loggedInUserId);
    console.log("Comment text:", newComment.trim());
    console.log("Token present:", !!token);
    
    try {
      const requestBody = { userId: loggedInUserId, text: newComment.trim() };
      console.log("Request body:", requestBody);
      
      const response = await fetch(`${config.apiBaseUrl}/posts/${postId}/comments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });
      
      console.log("Response status:", response.status);
      console.log("Response headers:", response.headers);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error response data:", errorData);
        console.error("Full error response:", await response.text());
        return;
      }
      
      const updatedPost = await response.json();
      console.log("Success! Updated post:", updatedPost);
      dispatch(setPost({ post: updatedPost }));
      setNewComment("");
    } catch (error) {
      console.error("Network/parsing error:", error);
    }
  };

  const likeAComment = async (commentId) => {
    const response = await fetch(`${config.apiBaseUrl}/posts/${postId}/comments/${commentId}/like`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: loggedInUserId }),
    });
    const updatedPost = await response.json();
    dispatch(setPost({ post: updatedPost }));
  };

  const submitReply = async (commentId) => {
    const text = (replyByCommentId[commentId] || "").trim();
    if (!text) return;
    const response = await fetch(`${config.apiBaseUrl}/posts/${postId}/comments/${commentId}/replies`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: loggedInUserId, text }),
    });
    const updatedPost = await response.json();
    dispatch(setPost({ post: updatedPost }));
    setReplyByCommentId((prev) => ({ ...prev, [commentId]: "" }));
  };

  const likeAReply = async (commentId, replyId) => {
    const response = await fetch(`${config.apiBaseUrl}/posts/${postId}/comments/${commentId}/replies/${replyId}/like`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: loggedInUserId }),
    });
    const updatedPost = await response.json();
    dispatch(setPost({ post: updatedPost }));
  };

  return (
    <WidgetWrapper m="2rem 0">
      <Friend
        friendId={postUserId}
        name={name}
        subtitle={location}
        userPicturePath={userPicturePath}
      />
      <Typography color={main} sx={{ mt: "1rem" }}>
        {description}
      </Typography>
      {(picturePath || (attachments && attachments.some(a => a && a.type === 'image'))) && (
        <Box
          sx={{
            mt: "0.75rem",
            overflow: "hidden",
            borderRadius: "0.75rem",
            border: `1px solid ${palette.neutral.light}`,
            position: "relative",
            aspectRatio: "16 / 9",
            backgroundColor: palette.neutral.light,
          }}
        >
          <img
            alt="post"
            src={`${config.assetsBaseUrl}/${picturePath || attachments.find(a=>a.type==='image')?.path}`}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        </Box>
      )}

      {/* Render other attachments */}
      {attachments && attachments.filter(a => a && a.type !== 'image').length > 0 && (
        <Box sx={{ mt: 1, display: 'grid', gap: 1 }}>
          {attachments.filter(a => a && a.type !== 'image').map((a, idx) => (
            <Box key={`${a.path}-${idx}`} sx={{ p: 1, border: `1px solid ${palette.neutral.light}`, borderRadius: 1 }}>
              {a.type === 'video' && (
                <video controls style={{ width: '100%', borderRadius: 6 }} src={`${config.assetsBaseUrl}/${a.path}`} />
              )}
              {a.type === 'audio' && (
                <audio controls style={{ width: '100%' }} src={`${config.assetsBaseUrl}/${a.path}`} />
              )}
              {a.type === 'file' && (
                <Button variant="outlined" size="small" href={`${config.assetsBaseUrl}/${a.path}`} target="_blank" rel="noreferrer">
                  Download {a.name || 'file'}
                </Button>
              )}
            </Box>
          ))}
        </Box>
      )}

      
      <FlexBetween mt="0.25rem">
        <FlexBetween gap="1rem">
          <FlexBetween gap="0.3rem">
            <IconButton onClick={patchLike}>
              {isLiked ? (
                <FavoriteOutlined sx={{ color: primary }} />
              ) : (
                <FavoriteBorderOutlined />
              )}
            </IconButton>
            <Typography>{likeCount}</Typography>
          </FlexBetween>

          <FlexBetween gap="0.3rem">
            <IconButton onClick={() => setIsComments(!isComments)}>
              <ChatBubbleOutlineOutlined />
            </IconButton>
            <Typography>{totalCommentCount}</Typography>
          </FlexBetween>
        </FlexBetween>

        <IconButton onClick={async (e)=>{ setShareAnchor(e.currentTarget); await loadFriends(); setShareOpen(true); }}>
          <ShareOutlined />
        </IconButton>
        <Menu anchorEl={shareAnchor} open={false} onClose={()=>setShareAnchor(null)} />
        <Dialog open={shareOpen} onClose={()=>setShareOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>Send post to…</DialogTitle>
          <DialogContent dividers>
            <List sx={{ p:0 }}>
              {friends.map(f => (
                <ListItemButton key={f._id} onClick={async ()=>{
                  // send message with post snapshot
                  const snapshot = { description, picturePath, authorId: postUserId, authorName: name };
                  try {
                    await fetch(`${config.apiBaseUrl}/users/${user._id}/chat/${f._id}/message`, {
                      method: "POST",
                      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                      body: JSON.stringify({ postId: postId, postSnapshot: snapshot }),
                    });
                  } catch {}
                  setShareOpen(false);
                }}>
                  <Avatar src={f.picturePath ? `${config.assetsBaseUrl}/${f.picturePath}` : undefined}>{f.firstName?.[0]}</Avatar>
                  <ListItemText sx={{ ml: 1 }} primary={`${f.firstName} ${f.lastName}`} />
                </ListItemButton>
              ))}
              {friends.length === 0 && (
                <Typography variant="body2" sx={{ p: 1 }}>No friends to share with.</Typography>
              )}
            </List>
          </DialogContent>
        </Dialog>
      </FlexBetween>
      {isComments && (
        <Box mt="0.75rem">
          {/* New comment input */}
          <Box display="flex" gap="0.5rem" alignItems="center" px="0.5rem" pb="0.75rem">
            <TextField
              fullWidth
              size="small"
              placeholder="Write a comment…"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
            <Button variant="contained" onClick={submitComment} disabled={!newComment.trim()}>
              Post
            </Button>
          </Box>
          <Divider />
          {/* Comments list */}
          {(showAllComments ? validComments : validComments.slice(0, 2)).map((comment) => {
            const commentLikes = comment.likes || {};
            const isCommentLiked = Boolean(commentLikes[loggedInUserId]);
            const commentLikeCount = Object.keys(commentLikes).length;
            // prefetch minimal author data
            fetchUser(comment.userId);
            return (
              <Box key={comment._id} sx={{ pl: "0.5rem" }}>
                <Box display="flex" alignItems="flex-start" justifyContent="space-between" mt="0.5rem">
                  <Box display="flex" gap="0.5rem" alignItems="flex-start">
                    <Avatar
                      src={userCache[comment.userId]?.picturePath ? `${config.assetsBaseUrl}/${userCache[comment.userId].picturePath}` : undefined}
                      sx={{ width: 28, height: 28, cursor: "pointer" }}
                      onClick={() => navigate(`/profile/${comment.userId}`)}
                    />
                    <Box>
                      <Typography
                        sx={{
                          color: main,
                          fontWeight: 500,
                          cursor: "pointer",
                          "&:hover": { textDecoration: "underline" },
                        }}
                        onClick={() => navigate(`/profile/${comment.userId}`)}
                      >
                        {userCache[comment.userId]?.firstName ? `${userCache[comment.userId].firstName} ${userCache[comment.userId].lastName}` : "User"}
                      </Typography>
                      <Typography sx={{ color: main }}>{comment.text}</Typography>
                    </Box>
                  </Box>
                  <FlexBetween gap="0.25rem">
                    <IconButton onClick={() => likeAComment(comment._id)}>
                      {isCommentLiked ? (
                        <FavoriteOutlined sx={{ color: primary }} />
                      ) : (
                        <FavoriteBorderOutlined />
                      )}
                    </IconButton>
                    <Typography>{commentLikeCount}</Typography>
                  </FlexBetween>
                </Box>
                {/* Replies */}
                {Array.isArray(comment.replies) && comment.replies.filter(r => r && r.text && r.text.trim() && r.userId).length > 0 && (
                  <Box ml="2.5rem" mt="0.25rem">
                    {!expandedReplies[comment._id] ? (
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => setExpandedReplies((prev) => ({ ...prev, [comment._id]: true }))}
                        sx={{ textTransform: "none", px: 0 }}
                      >
                        View replies ({comment.replies.filter(r => r && r.text && r.text.trim() && r.userId).length})
                      </Button>
                    ) : (
                      <>
                        {comment.replies.filter(r => r && r.text && r.text.trim() && r.userId).map((reply) => {
                          fetchUser(reply.userId);
                          const replyLikes = reply.likes || {};
                          const isReplyLiked = Boolean(replyLikes[loggedInUserId]);
                          const replyLikeCount = Object.keys(replyLikes).length;
                          return (
                            <Box key={reply._id} display="flex" alignItems="flex-start" justifyContent="space-between" mt="0.4rem">
                              <Box display="flex" gap="0.5rem" alignItems="flex-start">
                                <Avatar
                                  src={userCache[reply.userId]?.picturePath ? `${config.assetsBaseUrl}/${userCache[reply.userId].picturePath}` : undefined}
                                  sx={{ width: 24, height: 24, cursor: "pointer" }}
                                  onClick={() => navigate(`/profile/${reply.userId}`)}
                                />
                                <Box>
                                  <Typography
                                    sx={{
                                      color: main,
                                      fontWeight: 500,
                                      cursor: "pointer",
                                      "&:hover": { textDecoration: "underline" },
                                    }}
                                    onClick={() => navigate(`/profile/${reply.userId}`)}
                                  >
                                    {userCache[reply.userId]?.firstName ? `${userCache[reply.userId].firstName} ${userCache[reply.userId].lastName}` : "User"}
                                  </Typography>
                                  <Typography sx={{ color: main }}>{reply.text}</Typography>
                                </Box>
                              </Box>
                              <FlexBetween gap="0.25rem">
                                <IconButton onClick={() => likeAReply(comment._id, reply._id)}>
                                  {isReplyLiked ? (
                                    <FavoriteOutlined sx={{ color: primary }} />
                                  ) : (
                                    <FavoriteBorderOutlined />
                                  )}
                                </IconButton>
                                <Typography>{replyLikeCount}</Typography>
                              </FlexBetween>
                            </Box>
                          );
                        })}
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => setExpandedReplies((prev) => ({ ...prev, [comment._id]: false }))}
                          sx={{ textTransform: "none", px: 0, mt: 0.5 }}
                        >
                          Hide replies
                        </Button>
                      </>
                    )}
                  </Box>
                )}
                {/* Reply input */}
                <Box display="flex" gap="0.5rem" alignItems="center" ml="2rem" my="0.5rem">
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Reply…"
                    value={replyByCommentId[comment._id] || ""}
                    onChange={(e) =>
                      setReplyByCommentId((prev) => ({ ...prev, [comment._id]: e.target.value }))
                    }
                  />
                  <Button
                    variant="text"
                    onClick={() => submitReply(comment._id)}
                    disabled={!((replyByCommentId[comment._id] || "").trim())}
                  >
                    Reply
                  </Button>
                </Box>
                <Divider />
              </Box>
            );
          })}
          {comments.length > 2 && (
            <Box display="flex" justifyContent="center" mt="0.5rem">
              <Button
                size="small"
                variant="text"
                onClick={() => setShowAllComments((v) => !v)}
                sx={{ textTransform: "none" }}
              >
                {showAllComments ? "Show less comments" : `Show more comments (${comments.length - 2})`}
              </Button>
            </Box>
          )}
        </Box>
      )}
    </WidgetWrapper>
  );
};

export default PostWidget;
