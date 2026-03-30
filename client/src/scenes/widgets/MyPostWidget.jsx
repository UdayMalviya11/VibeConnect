import {
  DeleteOutlined,
  AttachFileOutlined,
  GifBoxOutlined,
  ImageOutlined,
  MicOutlined,
  MoreHorizOutlined,
} from "@mui/icons-material";
import {
  Box,
  Divider,
  Typography,
  InputBase,
  useTheme,
  Button,
  IconButton,
  useMediaQuery,
} from "@mui/material";
import FlexBetween from "components/FlexBetween";
import Dropzone from "react-dropzone";
import UserImage from "components/UserImage";
import WidgetWrapper from "components/WidgetWrapper";
import { useState } from "react";
import { config } from "../../config";
import { useDispatch, useSelector } from "react-redux";
import { setPosts } from "state";

const MyPostWidget = ({ picturePath }) => {
  const dispatch = useDispatch();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [post, setPost] = useState("");
  const { palette } = useTheme();
  const user = useSelector((state) => state.user);
  const { _id } = user;
  const token = useSelector((state) => state.token);
  const postsState = useSelector((state) => state.posts);
  const isNonMobileScreens = useMediaQuery("(min-width: 1000px)");
  const mediumMain = palette.neutral.mediumMain;
  const medium = palette.neutral.medium;

  const handlePost = async () => {
    const formData = new FormData();
    formData.append("userId", _id);
    formData.append("description", post);
    files.forEach((f) => formData.append("attachments", f));

    try {
      // optimistic placeholder
      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticPost = {
        _id: optimisticId,
        userId: _id,
        firstName: user.firstName,
        lastName: user.lastName,
        location: user.location,
        description: post,
        userPicturePath: picturePath,
        picturePath: files.find(f => f.type.startsWith('image/'))?.name,
        attachments: files.map(f => ({ type: f.type.startsWith('image/') ? 'image' : f.type.startsWith('video/') ? 'video' : f.type.startsWith('audio/') ? 'audio' : 'file', path: f.name, name: f.name })),
        likes: {},
        comments: [],
        createdAt: new Date().toISOString(),
      };
      dispatch(setPosts({ posts: [optimisticPost, ...(postsState || [])] }));
      setFiles([]);
      setPost("");

      const response = await fetch(`${config.apiBaseUrl}/posts`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const raw = await response.text();
      let data;
      try { data = JSON.parse(raw); } catch { data = raw; }
      if (!response.ok) {
        console.error("Create post failed:", data);
        throw new Error((data && data.message) || "Upload failed");
      }
      const posts = data;
      dispatch(setPosts({ posts }));
    } catch (e) {
      console.error("Create post error:", e);
      alert(e.message || "Failed to create post");
    }
  };

  return (
    <WidgetWrapper>
      <FlexBetween gap="1.5rem">
        <UserImage image={picturePath} />
        <InputBase
          placeholder="Share your thoughts…"
          onChange={(e) => setPost(e.target.value)}
          value={post}
          sx={{
            width: "100%",
            backgroundColor: palette.neutral.light,
            borderRadius: "2rem",
            padding: "1rem 1.25rem",
          }}
        />
      </FlexBetween>
      {isPickerOpen && (
        <Box
          border={`1px solid ${medium}`}
          borderRadius="5px"
          mt="1rem"
          p="1rem"
        >
          <Dropzone
            accept={{
              'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
              'video/*': ['.mp4', '.webm', '.mov'],
              'audio/*': ['.mp3', '.wav', '.m4a', '.aac', '.ogg'],
              '*/*': ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.zip']
            }}
            multiple
            onDrop={(acceptedFiles) => setFiles((prev) => [...prev, ...acceptedFiles])}
          >
            {({ getRootProps, getInputProps }) => (
              <FlexBetween>
                <Box
                  {...getRootProps()}
                  border={`2px dashed ${palette.primary.main}`}
                  p="1rem"
                  width="100%"
                  sx={{ "&:hover": { cursor: "pointer" } }}
                >
                  <input {...getInputProps()} />
                  {files.length === 0 ? (
                    <Typography color={medium}>Drop files here or click to upload (images, videos, audio, pdf/docs)</Typography>
                  ) : (
                    <Box>
                      {files.map((f, idx) => (
                        <FlexBetween key={`${f.name}-${idx}`} sx={{ py: 0.5 }}>
                          <Typography variant="body2" sx={{ mr: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</Typography>
                          <IconButton size="small" onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}><DeleteOutlined /></IconButton>
                        </FlexBetween>
                      ))}
                    </Box>
                  )}
                </Box>
              </FlexBetween>
            )}
          </Dropzone>
        </Box>
      )}

      <Divider sx={{ margin: "1.25rem 0" }} />

      <FlexBetween>
        <FlexBetween gap="0.25rem" onClick={() => setIsPickerOpen(!isPickerOpen)} sx={{ cursor: 'pointer' }}>
          <ImageOutlined sx={{ color: mediumMain, cursor: 'pointer' }} />
          <Typography
            color={mediumMain}
            sx={{ "&:hover": { cursor: "pointer", color: medium } }}
          >
            Attach
          </Typography>
        </FlexBetween>

        {isNonMobileScreens ? (
          <>
            <FlexBetween gap="0.25rem" onClick={() => setIsPickerOpen(true)} sx={{ cursor: 'pointer' }}>
              <GifBoxOutlined sx={{ color: mediumMain }} />
              <Typography color={mediumMain}>Video</Typography>
            </FlexBetween>

            <FlexBetween gap="0.25rem" onClick={() => setIsPickerOpen(true)} sx={{ cursor: 'pointer' }}>
              <AttachFileOutlined sx={{ color: mediumMain }} />
              <Typography color={mediumMain}>Files</Typography>
            </FlexBetween>

            <FlexBetween gap="0.25rem" onClick={() => setIsPickerOpen(true)} sx={{ cursor: 'pointer' }}>
              <MicOutlined sx={{ color: mediumMain }} />
              <Typography color={mediumMain}>Audio</Typography>
            </FlexBetween>
          </>
        ) : (
          <FlexBetween gap="0.25rem" onClick={() => setIsPickerOpen(true)} sx={{ cursor: 'pointer' }}>
            <MoreHorizOutlined sx={{ color: mediumMain }} />
          </FlexBetween>
        )}

        <Button
          disabled={!post && files.length === 0}
          onClick={handlePost}
          sx={{
            color: "white !important",
            backgroundColor: palette.primary.main,
            borderRadius: "3rem",
            cursor: "pointer",
            "&:hover": {
              backgroundColor: palette.primary.dark,
            },
          }}
        >

          POST
        </Button>
      </FlexBetween>
    </WidgetWrapper>
  );
};

export default MyPostWidget;
