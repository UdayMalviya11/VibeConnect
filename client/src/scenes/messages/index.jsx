import { Box, Typography, useTheme, Divider, TextField, Button, List, ListItem, Avatar, ListItemText, ListItemButton, IconButton } from "@mui/material";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import { useEffect, useState, useCallback, useRef } from "react";
import { io } from "socket.io-client";
import { config } from "../../config";
import { useSelector } from "react-redux";
import Navbar from "scenes/navbar";

const MessagesPage = () => {
  const { palette } = useTheme();
  const user = useSelector((state) => state.user);
  const token = useSelector((state) => state.token);
  const [friends, setFriends] = useState([]);
  const [overview, setOverview] = useState([]);
  const [friendIdToUnread, setFriendIdToUnread] = useState({});
  const [selectedFriend, setSelectedFriend] = useState(null);
  const selectedFriendRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef(null);
  const socketRef = useRef(null);
  const [onlineMap, setOnlineMap] = useState({});
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const fetchFriends = async () => {
    try {
      const resp = await fetch(`${config.apiBaseUrl}/users/${user._id}/friends`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      setFriends(Array.isArray(data) ? data : []);
    } catch {
      setFriends([]);
    }
  };

  const fetchOverview = async () => {
    try {
      const resp = await fetch(`${config.apiBaseUrl}/users/${user._id}/chat/overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      const list = Array.isArray(data) ? data : [];
      setOverview(list);
      const unreadMap = {};
      list.forEach(o => { unreadMap[o.friendId] = o.unreadCount || 0; });
      setFriendIdToUnread(unreadMap);
    } catch {
      setOverview([]);
    }
  };

  useEffect(() => {
    if (user?._id && token) { fetchFriends(); fetchOverview(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  const fetchHistory = useCallback(async (friendId) => {
    if (!friendId) return;
    try {
      const resp = await fetch(`${config.apiBaseUrl}/users/${user._id}/chat/${friendId}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch {
      setMessages([]);
    }
  }, [token, user?._id]);

  const markRead = useCallback(async (friendId) => {
    try {
      await fetch(`${config.apiBaseUrl}/users/${user._id}/chat/${friendId}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      setFriendIdToUnread((prev)=> ({ ...prev, [friendId]: 0 }));
    } catch {}
  }, [token, user?._id]);

  useEffect(() => {
    if (selectedFriend?._id) {
      fetchHistory(selectedFriend._id);
      markRead(selectedFriend._id);
    } else {
      setMessages([]);
    }
  }, [selectedFriend?._id, fetchHistory, markRead]);

  useEffect(() => {
    selectedFriendRef.current = selectedFriend;
  }, [selectedFriend]);

  // Fallback: periodic refresh to ensure new messages appear even if a socket event is missed
  useEffect(() => {
    if (!selectedFriend?._id) return;
    const interval = setInterval(() => {
      fetchHistory(selectedFriendRef.current?._id);
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedFriend?._id, fetchHistory]);

  // Realtime socket connection and listener
  useEffect(() => {
    if (!token) return;
    if (!socketRef.current) {
      const s = io(config.apiBaseUrl, { auth: { token } });
      socketRef.current = s;
      s.on("chat:new_message", (msg) => {
        const current = selectedFriendRef.current;
        // append if message belongs to open conversation; otherwise bump unread map
        if (current?._id && (
          (msg.fromUserId === current._id && msg.toUserId === user._id) ||
          (msg.fromUserId === user._id && msg.toUserId === current._id)
        )) {
          setMessages((prev) => {
            if (Array.isArray(prev) && prev.some((m) => String(m._id) === String(msg._id))) return prev;
            return [...prev, msg];
          });
          if (msg.toUserId === user._id && current?._id === msg.fromUserId) {
            markRead(msg.fromUserId);
          }
        } else if (msg.toUserId === user._id) {
          setFriendIdToUnread((prev)=> ({ ...prev, [msg.fromUserId]: (prev[msg.fromUserId]||0)+1 }));
        }
      });
      s.on("presence:snapshot", (ids)=>{
        const map = {};
        (ids||[]).forEach((id)=> map[id]=true);
        setOnlineMap(map);
      });
      s.on("presence:update", ({ userId: uid, online })=>{
        setOnlineMap((prev)=> ({ ...prev, [uid]: online }));
      });
      s.on("chat:typing", ({ fromUserId, typing }) => {
        if (selectedFriend?._id && fromUserId === selectedFriend._id) {
          setIsPeerTyping(!!typing);
          if (typing) {
            clearTimeout(window.__typingTimer);
            window.__typingTimer = setTimeout(()=> setIsPeerTyping(false), 2500);
          }
        }
      });
    }
    return () => {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.off("chat:new_message");
        socketRef.current.off("presence:snapshot");
        socketRef.current.off("presence:update");
      }
    };
  }, [token, selectedFriend?._id, user?._id]);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    const text = draft.trim();
    if (!selectedFriend?._id || !text) return;
    // optimistic append
    const optimistic = {
      _id: `tmp_${Date.now()}`,
      conversationId: "tmp",
      fromUserId: user._id,
      toUserId: selectedFriend._id,
      text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    try {
      const resp = await fetch(`${config.apiBaseUrl}/users/${user._id}/chat/${selectedFriend._id}/message`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.message || "Failed to send");
      // replace optimistic with real message by refetching history for accuracy
      fetchHistory(selectedFriend._id);
    } catch (e) {
      // rollback optimistic
      setMessages((prev) => prev.filter((m) => m._id !== optimistic._id));
      setDraft(text); // restore draft
    }
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 200;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setShowScrollToBottom(!atBottom);
  };

  return (
    <Box>
      <Navbar />
      <Box width="100%" padding={{ xs: "1rem", sm: "1.5rem 4%", md: "2rem 6%" }} display="grid" gridTemplateColumns={{ md: "320px 1fr" }} gap={{ xs: "1rem", md: "2rem" }}>
        {/* Left: Friends list */}
        <Box sx={{ border: `1px solid ${palette.neutral.light}`, borderRadius: "10px", overflow: "hidden", bgcolor: palette.background.paper, boxShadow: "0 4px 14px rgba(0,0,0,0.06)" }}>
          <Box sx={{ p: 1.5 }}>
            <Typography fontWeight={600}>Messages</Typography>
          </Box>
          <Divider />
          <List sx={{ p: 0, maxHeight: { xs: 320, sm: 420, md: 560 }, overflowY: "auto", scrollbarWidth: 'thin', scrollbarColor: `${palette.neutral.light} transparent`, '&::-webkit-scrollbar': { width: 8 }, '&::-webkit-scrollbar-track': { backgroundColor: palette.background.paper }, '&::-webkit-scrollbar-thumb': { backgroundColor: palette.neutral.light, borderRadius: 8, border: `2px solid ${palette.background.paper}` }, '&::-webkit-scrollbar-thumb:hover': { backgroundColor: palette.neutral.medium } }}>
            {(() => {
              // merge friends and overview to ensure all friends listed, with previews and unread
              const fromOverview = overview.map(o => ({
                _id: o.friendId,
                firstName: o.friend?.firstName,
                lastName: o.friend?.lastName,
                picturePath: o.friend?.picturePath,
                preview: o.lastMessageText,
              }));
              const map = new Map(fromOverview.map(f => [f._id, f]));
              friends.forEach(f => {
                if (!map.has(f._id)) {
                  map.set(f._id, { ...f, preview: f.occupation || f.location || "Friend" });
                }
              });
              return Array.from(map.values());
            })().map((f) => (
              <ListItem key={f._id} disablePadding sx={{}}
              >
                <ListItemButton selected={selectedFriend?._id === f._id} onClick={() => { selectedFriendRef.current = f; setSelectedFriend(f); }}
                  sx={{ py: 1, '&.Mui-selected': { bgcolor: palette.action.selected }, '&:hover': { bgcolor: palette.action.hover } }}
                >
                  <Box sx={{ position: 'relative', mr: 2 }}>
                    <Avatar src={f.picturePath ? `${config.assetsBaseUrl}/${f.picturePath}` : undefined}>
                      {f.firstName?.[0]}
                    </Avatar>
                    <Box sx={{ position: 'absolute', top: -1, right: -1, width: 10, height: 10, borderRadius: '50%', bgcolor: onlineMap[f._id] ? 'success.main' : 'text.disabled', border: '2px solid white' }} />
                  </Box>
                  <ListItemText primaryTypographyProps={{ noWrap: true }} secondaryTypographyProps={{ noWrap: true }} primary={`${f.firstName} ${f.lastName}`} secondary={f.preview || "Start a chat"} />
                  {friendIdToUnread[f._id] > 0 && (
                    <Box sx={{ ml: 1 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'error.main' }} />
                    </Box>
                  )}
                </ListItemButton>
              </ListItem>
            ))}
            {friends.length === 0 && (
              <ListItem>
                <ListItemText primary="No friends yet" secondary="Follow users to start chatting" />
              </ListItem>
            )}
          </List>
        </Box>
        {/* Right: Conversation */}
        <Box ref={scrollRef} onScroll={handleScroll} sx={{ position: 'relative', border: `1px solid ${palette.neutral.light}`, borderRadius: "12px", display: "flex", flexDirection: "column", height: { xs: 'calc(100vh - 140px)', md: '70vh' }, overflowY: "auto", bgcolor: palette.background.paper, boxShadow: "0 6px 20px rgba(0,0,0,0.06)", scrollbarWidth: 'thin', scrollbarColor: `${palette.neutral.light} transparent`, '&::-webkit-scrollbar': { width: 8 }, '&::-webkit-scrollbar-track': { backgroundColor: palette.background.paper }, '&::-webkit-scrollbar-thumb': { backgroundColor: palette.neutral.light, borderRadius: 8, border: `2px solid ${palette.background.paper}` }, '&::-webkit-scrollbar-thumb:hover': { backgroundColor: palette.neutral.medium } }}>
          <Box sx={{ position: 'sticky', top: 0, zIndex: 2, bgcolor: palette.background.paper, p: 1.5, display: "flex", alignItems: "center", justifyContent: 'space-between', gap: 1.25, backdropFilter: 'blur(4px)', borderBottom: `1px solid ${palette.neutral.light}` }}>
            {selectedFriend ? (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Avatar src={selectedFriend.picturePath ? `${config.assetsBaseUrl}/${selectedFriend.picturePath}` : undefined}>
                    {selectedFriend.firstName?.[0]}
                  </Avatar>
                  <Box>
                    <Typography fontWeight={600}>{selectedFriend.firstName} {selectedFriend.lastName}</Typography>
                    <Typography variant="body2" color={palette.neutral.medium}>{isPeerTyping ? 'Typing…' : (selectedFriend.occupation || selectedFriend.location || "Friend")}</Typography>
                  </Box>
                </Box>
              </>
            ) : (
              <Typography fontWeight={600}>Conversation</Typography>
            )}
          </Box>
          <Box sx={{ flex: 1, p: 2, backgroundColor: palette.background.alt }}>
            {!selectedFriend ? (
              <Typography color={palette.neutral.medium}>Select a chat to start messaging.</Typography>
            ) : (
              <List sx={{ p: 0 }}>
                {messages.map((m) => {
                  const isMine = m.fromUserId === user._id;
                  const isRecipientOnline = onlineMap[selectedFriend?._id];
                  const isRead = !!m.read; // backend sets read when recipient opens chat
                  return (
                  <ListItem key={m._id} sx={{ justifyContent: isMine ? "flex-end" : "flex-start" }}>
                    <Box sx={{ maxWidth: "70%", bgcolor: isMine ? palette.primary.main : palette.background.paper, color: isMine ? "#fff" : palette.neutral.dark, px: 1.25, py: 0.75, borderRadius: 2, boxShadow: isMine ? '0 6px 14px rgba(33,150,243,0.25)' : '0 6px 14px rgba(0,0,0,0.08)', animation: 'fadeInUp 160ms ease-out', transformOrigin: isMine ? 'right bottom' : 'left bottom' }}>
                      {m.postSnapshot ? (
                        <Box onClick={()=>{ window.location.href = `/post/${m.postId}`; }} sx={{ cursor: "pointer" }}>
                          {m.postSnapshot.picturePath && (
                            <Box sx={{ mb: 0.5, borderRadius: 1, overflow: 'hidden', border: `1px solid ${palette.neutral.light}` }}>
                              <img alt="shared post" src={`${config.assetsBaseUrl}/${m.postSnapshot.picturePath}`} style={{ width: '220px', display: 'block' }} />
                            </Box>
                          )}
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{m.postSnapshot.authorName}</Typography>
                          <Typography variant="body2">{m.postSnapshot.description}</Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2">{m.text}</Typography>
                      )}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption" sx={{ opacity: 0.7 }}>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Typography>
                        {isMine && (
                          <Typography variant="caption" sx={{ opacity: 0.9 }}>
                            {isRead ? '✓✓' : (isRecipientOnline ? '✓✓' : '✓')}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </ListItem>
                );})}
              </List>
            )}
            {showScrollToBottom && (
              <IconButton onClick={()=>{ if(scrollRef.current){ scrollRef.current.scrollTop = scrollRef.current.scrollHeight; } }}
                sx={{ position: 'absolute', right: 12, bottom: 12, bgcolor: palette.background.paper, border: `1px solid ${palette.neutral.light}`, boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}
              >
                <ArrowDownwardIcon />
              </IconButton>
            )}
            {showScrollToBottom && (
              <IconButton onClick={()=>{ if(scrollRef.current){ scrollRef.current.scrollTop = scrollRef.current.scrollHeight; } }}
                sx={{ position: 'sticky', bottom: 16, left: '100%', transform: 'translateX(-56px)', bgcolor: palette.background.paper, border: `1px solid ${palette.neutral.light}`, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 2 }}
              >
                <ArrowDownwardIcon />
              </IconButton>
            )}
          </Box>
          <Box sx={{ position: 'sticky', bottom: 0, zIndex: 2, p: 1.25, display: "flex", gap: 1, borderTop: `1px solid ${palette.neutral.light}`, bgcolor: palette.background.paper }}>
            <TextField
              fullWidth
              size="small"
              placeholder={selectedFriend ? `Message ${selectedFriend.firstName}…` : "Write a message…"}
              disabled={!selectedFriend}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <Button variant="contained" size={"small"} disabled={!selectedFriend || !draft.trim()} onMouseDown={()=>{
              if (socketRef.current && selectedFriend?._id) {
                socketRef.current.emit('chat:typing', { toUserId: selectedFriend._id, typing: true });
              }
            }} onKeyDown={()=>{
              if (socketRef.current && selectedFriend?._id) {
                socketRef.current.emit('chat:typing', { toUserId: selectedFriend._id, typing: true });
              }
            }} onClick={sendMessage}>Send</Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default MessagesPage;


