import {
  ManageAccountsOutlined,
  EditOutlined,
  LocationOnOutlined,
  WorkOutlineOutlined,
} from "@mui/icons-material";
import { Box, Typography, Divider, useTheme, TextField, IconButton, Button } from "@mui/material";
import UserImage from "components/UserImage";
import FlexBetween from "components/FlexBetween";
import WidgetWrapper from "components/WidgetWrapper";
import { useSelector } from "react-redux";
import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { config } from "../../config";
import { useNavigate } from "react-router-dom";

const UserWidget = ({ userId, picturePath }) => {
  const [user, setUser] = useState(null);
  const [editSocials, setEditSocials] = useState(false);
  const [twitterUrl, setTwitterUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const { palette } = useTheme();
  const navigate = useNavigate();
  const token = useSelector((state) => state.token);
  const loggedInUserId = useSelector((state) => state.user?._id);
  const dark = palette.neutral.dark;
  const socketRef = useRef(null);
  const [liveViewed, setLiveViewed] = useState(0);
  const [liveImpressions, setLiveImpressions] = useState(0);
  const medium = palette.neutral.medium;
  const main = palette.neutral.main;
  const isOwnProfile = String(userId) === String(loggedInUserId);

  const getUser = async () => {
    const response = await fetch(`${config.apiBaseUrl}/users/${userId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    setUser(data);
    setTwitterUrl(data.twitterUrl || "");
    setLinkedinUrl(data.linkedinUrl || "");
  };
  const saveSocials = async () => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/users/${userId}/socials`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ twitterUrl: twitterUrl.trim(), linkedinUrl: linkedinUrl.trim() }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const updated = await response.json();
      setUser(updated);
      setEditSocials(false);
    } catch (e) {
      console.error("Error saving socials:", e);
      setEditSocials(false);
    }
  };

  useEffect(() => {
    getUser();
    // initialize live counts to zero to avoid showing seeded/static numbers
    if (isOwnProfile) {
      setLiveViewed(0);
      setLiveImpressions(0);
    }
    // periodic refresh for own profile to reflect real-time engagement
    const interval = setInterval(() => {
      if (isOwnProfile) getUser();
    }, 5000);
    // refresh on window focus
    const onFocus = () => { if (isOwnProfile) getUser(); };
    window.addEventListener('focus', onFocus);

    // realtime: subscribe to engagement updates for this user
    try {
      if (!socketRef.current && token) {
        const s = io(config.apiBaseUrl, { auth: { token } });
        socketRef.current = s;
        s.on("engagement:update", (payload) => {
          if (payload?.userId && String(payload.userId) === String(userId)) {
            setUser((prev) => prev ? { ...prev, viewedProfile: payload.viewedProfile, impressions: payload.impressions } : prev);
            setLiveViewed(payload.viewedProfile || 0);
            setLiveImpressions(payload.impressions || 0);
          }
        });
      }
    } catch {}
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.off("engagement:update");
      }
    };
  }, [userId, isOwnProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) {
    return null;
  }

  const {
    firstName,
    lastName,
    location,
    occupation,
    friends,
    twitterUrl: userTwitterUrl,
    linkedinUrl: userLinkedinUrl,
  } = user;

  return (
    <WidgetWrapper>
      {/* FIRST ROW */}
      <FlexBetween
        gap="0.5rem"
        pb="1.1rem"
        onClick={() => navigate(`/profile/${userId}`)}
      >
        <FlexBetween gap="1rem">
          <UserImage image={picturePath} />
          <Box>
            <Typography
              variant="h4"
              color={dark}
              fontWeight="500"
              sx={{
                "&:hover": {
                  color: palette.primary.light,
                  cursor: "pointer",
                },
              }}
            >
              {firstName} {lastName}
            </Typography>
            <Typography color={medium}>{friends?.length || 0} friends</Typography>
          </Box>
        </FlexBetween>
        <ManageAccountsOutlined />
      </FlexBetween>

      <Divider />

      {/* SECOND ROW */}
      <Box p="1rem 0">
        <Box display="flex" alignItems="center" gap="1rem" mb="0.5rem">
          <LocationOnOutlined fontSize="large" sx={{ color: main }} />
          <Typography color={medium}>{location}</Typography>
        </Box>
        <Box display="flex" alignItems="center" gap="1rem">
          <WorkOutlineOutlined fontSize="large" sx={{ color: main }} />
          <Typography color={medium}>{occupation}</Typography>
        </Box>
      </Box>

      <Divider />

      {/* THIRD ROW: Only for own profile */}
      {isOwnProfile && (
        <>
          <Box p="1rem 0">
            <FlexBetween mb="0.5rem">
              <Typography color={medium}>Who's viewed your profile</Typography>
              <Typography color={main} fontWeight="500">{isOwnProfile ? liveViewed : 0}</Typography>
            </FlexBetween>
            <FlexBetween>
              <Typography color={medium}>Impressions of your post</Typography>
              <Typography color={main} fontWeight="500">{isOwnProfile ? liveImpressions : 0}</Typography>
            </FlexBetween>
          </Box>

          <Divider />

          {/* FOURTH ROW: Social Profiles only for own profile */}
          <Box p="1rem 0">
            <Typography fontSize="1rem" color={main} fontWeight="500" mb="1rem">
              Social Profiles
            </Typography>

            {!editSocials ? (
              <>
                <FlexBetween gap="1rem" mb="0.75rem">
                  <FlexBetween gap="1rem">
                    <img src="/assets/twitter.png" alt="twitter" />
                    <Box>
                      <Typography color={main} fontWeight="500">
                        Twitter / X
                      </Typography>
                      {userTwitterUrl ? (
                        <Typography color={palette.primary.main} sx={{ cursor: "pointer" }}
                          onClick={() => window.open(userTwitterUrl, "_blank", "noopener,noreferrer")}
                        >
                          {userTwitterUrl}
                        </Typography>
                      ) : (
                        <Typography color={medium}>Add your profile link</Typography>
                      )}
                    </Box>
                  </FlexBetween>
                  <IconButton onClick={() => setEditSocials(true)}>
                    <EditOutlined sx={{ color: main }} />
                  </IconButton>
                </FlexBetween>

                <FlexBetween gap="1rem">
                  <FlexBetween gap="1rem">
                    <img src="/assets/linkedin.png" alt="linkedin" />
                    <Box>
                      <Typography color={main} fontWeight="500">
                        LinkedIn
                      </Typography>
                      {userLinkedinUrl ? (
                        <Typography color={palette.primary.main} sx={{ cursor: "pointer" }}
                          onClick={() => window.open(userLinkedinUrl, "_blank", "noopener,noreferrer")}
                        >
                          {userLinkedinUrl}
                        </Typography>
                      ) : (
                        <Typography color={medium}>Add your profile link</Typography>
                      )}
                    </Box>
                  </FlexBetween>
                  <IconButton onClick={() => setEditSocials(true)}>
                    <EditOutlined sx={{ color: main }} />
                  </IconButton>
                </FlexBetween>
              </>
            ) : (
              <Box display="grid" gap="0.75rem">
                <Box display="flex" alignItems="center" gap="0.75rem">
                  <img src="/assets/twitter.png" alt="twitter" />
                  <TextField
                    fullWidth
                    size="small"
                    label="Twitter / X URL"
                    value={twitterUrl}
                    onChange={(e) => setTwitterUrl(e.target.value)}
                  />
                </Box>
                <Box display="flex" alignItems="center" gap="0.75rem">
                  <img src="/assets/linkedin.png" alt="linkedin" />
                  <TextField
                    fullWidth
                    size="small"
                    label="LinkedIn URL"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                  />
                </Box>
                <Box display="flex" gap="0.5rem" justifyContent="flex-end">
                  <Button variant="text" onClick={() => { setEditSocials(false); setTwitterUrl(userTwitterUrl || ""); setLinkedinUrl(userLinkedinUrl || ""); }}>Cancel</Button>
                  <Button variant="contained" onClick={saveSocials}>Save</Button>
                </Box>
              </Box>
            )}
          </Box>
        </>
      )}
    </WidgetWrapper>
  );
};

export default UserWidget;
