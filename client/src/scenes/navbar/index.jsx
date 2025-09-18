import { useState } from "react";
import {
  Box,
  IconButton,
  InputBase,
  Typography,
  Select,
  MenuItem,
  FormControl,
  useTheme,
  useMediaQuery,
  Popover,
  List,
  ListItem,
  ListItemAvatar,
  Avatar,
  ListItemText,
  Badge,
  Tooltip,
  TextField,
  Button,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Search,
  Message,
  DarkMode,
  LightMode,
  Notifications,
  Help,
  Menu,
  Close,
} from "@mui/icons-material";
import { useDispatch, useSelector } from "react-redux";
import { config } from "../../config";
import { setMode, setLogout, markAllNotificationsRead, setNotifications, setSearchQuery } from "state";
import { useNavigate } from "react-router-dom";
import FlexBetween from "components/FlexBetween";

const Navbar = () => {
  const [isMobileMenuToggled, setIsMobileMenuToggled] = useState(false);
  const [helpAnchorEl, setHelpAnchorEl] = useState(null);
  const [helpTitle, setHelpTitle] = useState("");
  const [helpDesc, setHelpDesc] = useState("");
  const helpOpen = Boolean(helpAnchorEl);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.user);
  const isNonMobileScreens = useMediaQuery("(min-width: 1000px)");
  const notifications = useSelector((state) => state.notifications) || [];
  const unreadCount = notifications.filter((n) => !n.read).length;
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [notifAnchorEl, setNotifAnchorEl] = useState(null);
  const notifOpen = Boolean(notifAnchorEl);
  const userId = useSelector((state) => state.user?._id);
  const token = useSelector((state) => state.token);
  const handleOpenNotif = (e) => {
    setNotifAnchorEl(e.currentTarget);
    // fetch latest from server
    if (userId && token) {
      fetch(`${config.apiBaseUrl}/users/${userId}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((list) => {
          const normalized = (list || []).map((n) => ({
            id: n._id,
            type: n.type,
            fromUser: n.fromUser || (n.fromUserId ? { _id: n.fromUserId } : {}),
            postId: n.postId,
            createdAt: n.createdAt,
            read: !!n.read,
          }))
          // filter out self-notifications (cannot follow/like yourself)
          .filter((n) => n.fromUser?._id && n.fromUser._id !== userId);
          dispatch(setNotifications(normalized));
          // mark as read locally after viewing
          if (normalized.length > 0) {
            dispatch(markAllNotificationsRead());
          }
        })
        .catch(() => {});
    }
    if (unreadCount > 0) dispatch(markAllNotificationsRead());
  };
  const refreshUnreadMessages = () => {
    if (!userId || !token) return;
    fetch(`${config.apiBaseUrl}/users/${userId}/chat/unread-count`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setUnreadMessages(d?.count || 0))
      .catch(() => {});
  };
  // poll unread messages periodically
  if (typeof window !== "undefined") {
    // lightweight polling without extra effects deps
    setTimeout(refreshUnreadMessages, 500);
  }
  const handleCloseNotif = () => setNotifAnchorEl(null);
  const handleOpenHelp = (e) => setHelpAnchorEl(e.currentTarget);
  const handleCloseHelp = () => setHelpAnchorEl(null);

  const submitFeedback = async () => {
    try {
      const resp = await fetch(`${config.apiBaseUrl}/users/${userId}/support/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: helpTitle.trim(), description: helpDesc.trim() })
      });
      if (!resp.ok) {
        const er = await resp.text();
        console.error('Feedback error:', er);
      }
      handleCloseHelp();
      setHelpTitle("");
      setHelpDesc("");
    } catch (e) {
      handleCloseHelp();
    }
  };

  const theme = useTheme();
  const neutralLight = theme.palette.neutral.light;
  const dark = theme.palette.neutral.dark;
  const background = theme.palette.background.default;
  const primaryLight = theme.palette.primary.light;
  const alt = theme.palette.background.alt;

  const fullName = `${user.firstName} ${user.lastName}`;

  return (
    <>
    <FlexBetween padding="0.4rem 2%" backgroundColor="transparent" sx={{
      position: "sticky",
      top: 0,
      zIndex: 1100,
      backdropFilter: "saturate(180%) blur(10px)",
      borderBottom: "none",
    }}>
      <Box sx={{ width: "100%", maxWidth: 1160, mx: "auto", display: "grid", gridTemplateColumns: isNonMobileScreens ? "1fr auto 1fr" : "1fr auto", alignItems: "center", gap: 2, backgroundColor: alt, borderRadius: 2, border: `1px solid ${neutralLight}`, px: 2, py: 0.6, boxShadow: 3 }}>
        {/* Left: Brand */}
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography
            fontWeight={800}
            fontSize="clamp(1.1rem, 1.8rem, 2.1rem)"
            onClick={() => navigate("/home")}
            sx={{
              background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${primaryLight})`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              letterSpacing: 0.3,
              cursor: "pointer",
              transition: "transform 200ms ease",
              "&:hover": { transform: "translateY(-1px)" },
            }}
          >
            VibeConnect
          </Typography>
        </Box>

        {/* Center: Search */}
        {isNonMobileScreens && (
          <FlexBetween
            sx={{
              justifySelf: 'center',
              backgroundColor: alpha(theme.palette.background.paper, 0.7),
              border: `1px solid ${neutralLight}`,
              borderRadius: "9999px",
              gap: "0.5rem",
              px: 1.25,
              py: 0.4,
              transition: "box-shadow 200ms ease, border-color 200ms ease, width 200ms ease",
              "&:focus-within": {
                boxShadow: `0 8px 20px ${alpha(theme.palette.primary.main, 0.15)}`,
                borderColor: theme.palette.primary.light,
              },
            }}
          >
            <InputBase
              placeholder="Search…"
              onChange={(e)=>dispatch(setSearchQuery(e.target.value))}
              sx={{ width: 260, textAlign: 'center', "&:focus": { width: 360, transition: "width 200ms ease" } }}
            />
            <IconButton onClick={()=>navigate('/home')} size="small" sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: theme.palette.primary.main, "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.2) } }}>
              <Search fontSize="small" />
            </IconButton>
          </FlexBetween>
        )}

      {/* Right: Actions */}
      {isNonMobileScreens ? (
        <FlexBetween gap="1rem" sx={{ justifySelf: 'end' }}>
          <Tooltip title={theme.palette.mode === "dark" ? "Light mode" : "Dark mode"} arrow>
            <IconButton onClick={() => dispatch(setMode())}>
              {theme.palette.mode === "dark" ? (
                <DarkMode sx={{ fontSize: "24px" }} />
              ) : (
                <LightMode sx={{ color: dark, fontSize: "24px" }} />
              )}
            </IconButton>
          </Tooltip>
          <Tooltip title="Messages" arrow>
            <IconButton onClick={() => navigate("/messages")}> 
              <Badge color="error" variant={unreadMessages > 0 ? "dot" : undefined} overlap="circular">
                <Message sx={{ fontSize: "24px" }} />
              </Badge>
            </IconButton>
          </Tooltip>
          <Tooltip title="Notifications" arrow>
            <IconButton onClick={handleOpenNotif}>
              <Badge color="error" badgeContent={unreadCount} invisible={unreadCount === 0} overlap="circular">
                <Notifications sx={{ fontSize: "24px" }} />
              </Badge>
            </IconButton>
          </Tooltip>
          <Popover
            open={notifOpen}
            anchorEl={notifAnchorEl}
            onClose={handleCloseNotif}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            PaperProps={{ sx: { mt: 1, borderRadius: 2, minWidth: 320, maxWidth: 380, boxShadow: 6, border: `1px solid ${neutralLight}` } }}
          >
            <Box sx={{ p: 1.5, borderBottom: `1px solid ${neutralLight}` }}>
              <Typography fontWeight={600}>Notifications</Typography>
            </Box>
            <List sx={{ p: 0, maxHeight: 360, overflowY: "auto" }}>
              {notifications.length === 0 ? (
                <Box sx={{ p: 2 }}>
                  <Typography color={dark}>You're all caught up!</Typography>
                </Box>
              ) : (
                notifications.map((n) => (
                  <ListItem key={n.id} alignItems="flex-start" sx={{ bgcolor: n.read ? "transparent" : "action.hover" }}>
                    <ListItemAvatar>
                      <Avatar src={n.fromUser?.picturePath ? `${config.assetsBaseUrl}/${n.fromUser.picturePath}` : undefined}>
                        {n.fromUser?.firstName?.[0]}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        n.type === "like"
                          ? `${n.fromUser?.firstName || "Someone"} liked your post`
                          : `${n.fromUser?.firstName || "Someone"} started following you`
                      }
                      secondary={new Date(n.createdAt || Date.now()).toLocaleString()}
                    />
                  </ListItem>
                ))
              )}
            </List>
          </Popover>
          <Tooltip title="Help" arrow>
            <Help sx={{ fontSize: "24px", cursor: 'pointer' }} onClick={handleOpenHelp} />
          </Tooltip>
          <FormControl variant="standard" value={fullName}>
            <Select
              value={fullName}
              sx={{
                backgroundColor: neutralLight,
                width: "150px",
                borderRadius: "0.25rem",
                p: "0.25rem 1rem",
                "& .MuiSvgIcon-root": {
                  pr: "0.25rem",
                  width: "3rem",
                },
                "& .MuiSelect-select:focus": {
                  backgroundColor: neutralLight,
                },
              }}
              input={<InputBase />}
            >
              <MenuItem value={fullName}>
                <Typography>{fullName}</Typography>
              </MenuItem>
              <MenuItem onClick={() => dispatch(setLogout())}>Log Out</MenuItem>
            </Select>
          </FormControl>
        </FlexBetween>
      ) : (
        <IconButton
          onClick={() => setIsMobileMenuToggled(!isMobileMenuToggled)}
        >
          <Menu />
        </IconButton>
      )}

      {/* MOBILE NAV */}
      {!isNonMobileScreens && isMobileMenuToggled && (
        <Box
          position="fixed"
          right="0"
          bottom="0"
          height="100%"
          zIndex="10"
          maxWidth="500px"
          minWidth="300px"
          backgroundColor={background}
        >
          {/* CLOSE ICON */}
          <Box display="flex" justifyContent="flex-end" p="1rem">
            <IconButton
              onClick={() => setIsMobileMenuToggled(!isMobileMenuToggled)}
            >
              <Close />
            </IconButton>
          </Box>

          {/* MENU ITEMS */}
          <FlexBetween
            display="flex"
            flexDirection="column"
            justifyContent="center"
            alignItems="center"
            gap="3rem"
          >
            <IconButton
              onClick={() => dispatch(setMode())}
              sx={{ fontSize: "25px" }}
            >
              {theme.palette.mode === "dark" ? (
                <DarkMode sx={{ fontSize: "25px" }} />
              ) : (
                <LightMode sx={{ color: dark, fontSize: "25px" }} />
              )}
            </IconButton>
            <IconButton onClick={() => { setIsMobileMenuToggled(false); navigate('/messages'); }} sx={{ color: theme.palette.text.primary }}>
              <Badge color="error" variant={unreadMessages > 0 ? "dot" : undefined} overlap="circular">
                <Message sx={{ fontSize: "25px" }} />
              </Badge>
            </IconButton>
            <IconButton onClick={(e)=> { setIsMobileMenuToggled(false); handleOpenNotif(e); }} sx={{ color: theme.palette.text.primary }}>
              <Badge color="error" badgeContent={unreadCount} invisible={unreadCount === 0} overlap="circular">
                <Notifications sx={{ fontSize: "25px" }} />
              </Badge>
            </IconButton>
            <IconButton onClick={(e)=> { setHelpAnchorEl(e.currentTarget); }} sx={{ color: theme.palette.text.primary }}>
              <Help sx={{ fontSize: "25px" }} />
            </IconButton>
            <FormControl variant="standard" value={fullName}>
              <Select
                value={fullName}
                sx={{
                  backgroundColor: neutralLight,
                  width: "150px",
                  borderRadius: "0.25rem",
                  p: "0.25rem 1rem",
                  "& .MuiSvgIcon-root": {
                    pr: "0.25rem",
                    width: "3rem",
                  },
                  "& .MuiSelect-select:focus": {
                    backgroundColor: neutralLight,
                  },
                }}
                input={<InputBase />}
              >
                <MenuItem value={fullName}>
                  <Typography>{fullName}</Typography>
                </MenuItem>
                <MenuItem onClick={() => dispatch(setLogout())}>
                  Log Out
                </MenuItem>
              </Select>
            </FormControl>
          </FlexBetween>
        </Box>
      )}
      </Box>
    </FlexBetween>

    <Popover
      open={helpOpen}
      anchorEl={helpAnchorEl}
      onClose={handleCloseHelp}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "left", }}
      PaperProps={{ sx: { mt: 2, p: 2, borderRadius: 2, minWidth: 360, boxShadow: 6, border: `1px solid ${neutralLight}` } }}
    >
      <Typography fontWeight={600} sx={{ mb: 1 }}>Report / Improve VibeConnect</Typography>
      <Box sx={{ display: 'grid', gap: 1 }}>
        <TextField label="Title" value={helpTitle} onChange={(e)=>setHelpTitle(e.target.value)} fullWidth size="small" />
        <TextField label="Description" value={helpDesc} onChange={(e)=>setHelpDesc(e.target.value)} fullWidth multiline minRows={3} />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button onClick={handleCloseHelp}>Cancel</Button>
          <Button variant="contained" onClick={submitFeedback} disabled={!helpTitle.trim() || !helpDesc.trim()}>Submit</Button>
        </Box>
      </Box>
    </Popover>
    </>
  );
};

export default Navbar;
