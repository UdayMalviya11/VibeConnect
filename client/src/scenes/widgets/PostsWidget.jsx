import { useEffect, useRef, useState, useCallback } from "react";
import { config } from "../../config";
import { useDispatch, useSelector } from "react-redux";
import { setPosts } from "state";
import PostWidget from "./PostWidget";

const PostsWidget = ({ userId, isProfile = false }) => {
  const dispatch = useDispatch();
  const posts = useSelector((state) => state.posts);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef(null);
  const query = (useSelector((state)=> state.searchQuery) || "").toLowerCase();
  const token = useSelector((state) => state.token);

  const getPosts = useCallback(async (pageNum) => {
    if (isLoading) return;
    setIsLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(pageNum));
    params.set("limit", "10");
    const response = await fetch(`${config.apiBaseUrl}/posts?${params.toString()}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    const list = Array.isArray(data) ? data : (Array.isArray(data?.posts) ? data.posts : []);
    if (pageNum === 0) {
      dispatch(setPosts({ posts: list }));
    } else {
      dispatch(setPosts({ posts: [...(Array.isArray(posts) ? posts : []), ...list] }));
    }
    setHasMore(list.length === 10);
    setIsLoading(false);
  }, [dispatch, token, posts, isLoading]);

  const getUserPosts = useCallback(async (pageNum) => {
    if (isLoading) return;
    setIsLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(pageNum));
    params.set("limit", "10");
    const response = await fetch(`${config.apiBaseUrl}/posts/${userId}/posts?${params.toString()}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    const list = Array.isArray(data) ? data : (Array.isArray(data?.posts) ? data.posts : []);
    if (pageNum === 0) {
      dispatch(setPosts({ posts: list }));
    } else {
      dispatch(setPosts({ posts: [...(Array.isArray(posts) ? posts : []), ...list] }));
    }
    setHasMore(list.length === 10);
    setIsLoading(false);
  }, [dispatch, token, posts, userId, isLoading]);

  useEffect(() => {
    setPage(0);
    setHasMore(true);
    if (isProfile) {
      getUserPosts(0);
    } else {
      getPosts(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProfile, userId]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      const first = entries[0];
      if (first.isIntersecting && hasMore && !isLoading) {
        const next = page + 1;
        setPage(next);
        if (isProfile) getUserPosts(next); else getPosts(next);
      }
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [page, hasMore, isLoading, getPosts, getUserPosts, isProfile]);

  return (
    <>
      {(Array.isArray(posts) ? posts : []).filter(p => {
        if (!query) return true;
        const hay = `${p.firstName} ${p.lastName} ${p.description || ""} ${p.location || ""}`.toLowerCase();
        return hay.includes(query);
      }).map(
        ({
          _id,
          userId,
          firstName,
          lastName,
          description,
          location,
          picturePath,
          attachments,
          userPicturePath,
          likes,
          comments,
        }) => (
          <PostWidget
            key={_id}
            postId={_id}
            postUserId={userId}
            name={`${firstName} ${lastName}`}
            description={description}
            location={location}
            picturePath={picturePath}
            attachments={attachments}
            userPicturePath={userPicturePath}
            likes={likes}
            comments={comments}
          />
        )
      )}
      {/* Skeleton loaders */}
      {isLoading && (
        <>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={`skeleton-${i}`} style={{ padding: '16px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)', margin: '12px 0', background: 'rgba(0,0,0,0.02)' }} />
          ))}
        </>
      )}
      <div ref={sentinelRef} />
    </>
  );
};

export default PostsWidget;
