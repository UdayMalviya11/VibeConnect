import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  mode: "light",
  user: null,
  token: null,
  posts: [],
  friends: [],
  notifications: [], // { id, type: 'like'|'follow', fromUser, postId?, createdAt, read }
  searchQuery: "",
};

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setMode: (state) => {
      state.mode = state.mode === "light" ? "dark" : "light";
    },
    setLogin: (state, action) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
    },
    setLogout: (state) => {
      state.user = null;
      state.token = null;
    },
    setFriends: (state, action) => {
      if (state.user) {
        state.user.friends = action.payload.friends;
      } else {
        console.error("user friends non-existent :(");
      }
    },
    setPosts: (state, action) => {
      state.posts = action.payload.posts;
    },
    setPost: (state, action) => {
      const updatedPosts = state.posts.map((post) => {
        if (post._id === action.payload.post._id) return action.payload.post;
        return post;
      });
      state.posts = updatedPosts;
    },
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload || "";
    },
    addNotification: (state, action) => {
      const notif = action.payload; // { id, type, fromUser, postId?, createdAt }
      state.notifications.unshift({ ...notif, read: false });
    },
    markAllNotificationsRead: (state) => {
      state.notifications = state.notifications.map((n) => ({ ...n, read: true }));
    },
    removeNotification: (state, action) => {
      const id = action.payload;
      state.notifications = state.notifications.filter((n) => n.id !== id);
    },
    setNotifications: (state, action) => {
      state.notifications = action.payload || [];
    },
  },
});

export const { setMode, setLogin, setLogout, setFriends, setPosts, setPost, addNotification, markAllNotificationsRead, removeNotification, setNotifications, setSearchQuery } =
  authSlice.actions;
export default authSlice.reducer;
