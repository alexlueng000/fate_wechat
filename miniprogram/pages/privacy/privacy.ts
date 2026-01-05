// pages/privacy/privacy.ts
interface Data {
  tab: string;
}

Page<Data>({
  data: {
    tab: "privacy",
  },

  onLoad(options: Record<string, string>) {
    const tab = options?.tab || "privacy";
    this.setData({ tab });

    // Update navigation bar title based on tab
    const titles: Record<string, string> = {
      privacy: "隐私政策",
      agreement: "用户协议",
      disclaimer: "免责声明",
    };
    wx.setNavigationBarTitle({ title: titles[tab] || "隐私政策" });
  },
});
