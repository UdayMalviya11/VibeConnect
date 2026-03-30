import { Box } from "@mui/material";
import { useEffect, useState } from "react";
import { config } from "../../config";
import { useParams } from "react-router-dom";
import Navbar from "scenes/navbar";
import PostWidget from "scenes/widgets/PostWidget";
import { useSelector } from "react-redux";

const PostPage = () => {
  const { postId } = useParams();
  const token = useSelector((s)=>s.token);
  const [post, setPost] = useState(null);

  useEffect(()=>{
    (async ()=>{
      const r = await fetch(`${config.apiBaseUrl}/posts/${postId}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      setPost(d);
    })();
  }, [postId, token]);

  return (
    <Box>
      <Navbar />
      <Box width="100%" padding={{ xs: "1rem", md: "2rem 6%" }} display="flex" justifyContent="center">
        <Box sx={{ width: "100%", maxWidth: 760 }}>
          {post && (
            <PostWidget
              postId={post._id}
              postUserId={post.userId}
              name={`${post.firstName} ${post.lastName}`}
              description={post.description}
              location={post.location}
              picturePath={post.picturePath}
              userPicturePath={post.userPicturePath}
              likes={post.likes}
              comments={post.comments}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default PostPage;


