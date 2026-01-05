// pages/about/about.ts
Page({
  data: {},

  onLoad() {},

  onShareAppMessage() {
    return {
      title: "命理八字 - 探索你的命盘",
      path: "/pages/index/index",
      imageUrl: "",
    };
  },

  onShareTimeline() {
    return {
      title: "命理八字 - 探索你的命盘",
      query: "",
      imageUrl: "",
    };
  },
});
