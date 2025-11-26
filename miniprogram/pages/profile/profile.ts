// pages/profile/profile.ts
const app = getApp<{
  globalData: { env: "develop" | "trial" | "release"; token: string | null };
}>();

interface User {
  id?: number | string;
  nickname?: string;
  name?: string;
  mobile?: string;
  phone?: string;
  [k: string]: any;
}

interface Data {
  user: User | null;
  nickname: string;
  userId: string;
  env: string;
  accountType: string;
  initials: string;
  version: string;
}

Page<Data>({
  data: {
    user: null,
    nickname: "",
    userId: "",
    env: "develop",
    accountType: "匿名账号",
    initials: "FI",
    version: "0.1.0", // 以后你自己改
  },

  onLoad() {
    const env = app?.globalData?.env || "develop";
    const stored: any = wx.getStorageSync("auth_user") || null;

    let nickname = "";
    let userId = "";
    let accountType = "匿名账号";
    let initials = "FI";

    if (stored) {
      nickname = stored.nickname || stored.name || "";
      userId = String(stored.id || "");
      if (stored.mobile || stored.phone) {
        accountType = "已绑定手机";
      } else {
        accountType = "小程序账号";
      }
      const base = nickname || userId || "FateInsight";
      initials = base.slice(0, 2).toUpperCase();
    }

    this.setData({
      user: stored,
      nickname,
      userId,
      env,
      accountType,
      initials,
    });
  },

  /** 清除本地命盘和聊天记录（不影响 token） */
  onClearLocal() {
    wx.showModal({
      title: "确认清除？",
      content: "将清除本地命盘结果、表单数据与聊天记录，不影响登录状态。",
      confirmText: "清除",
      confirmColor: "#b83227",
      success: (res) => {
        if (!res.confirm) return;

        try {
          wx.removeStorageSync("last_paipan");
          wx.removeStorageSync("last_form");
          wx.removeStorageSync("conversation_id");
          wx.removeStorageSync("start_reply");
          // 如果以后你把 messages 也存本地，这里顺便一起清
        } catch (e) {}

        wx.showToast({ title: "已清除", icon: "none" });
      },
    });
  },

  /** 退出登录：清掉 token + user，下次重启重新登录 */
  onLogout() {
    wx.showModal({
      title: "退出登录",
      content: "退出后，下次打开小程序将自动创建新的登录会话。是否继续？",
      confirmText: "退出登录",
      confirmColor: "#c0392b",
      success: (res) => {
        if (!res.confirm) return;

        try {
          wx.removeStorageSync("token");
          wx.removeStorageSync("auth_user");
          app.globalData.token = null;
        } catch (e) {}

        wx.showToast({ title: "已退出，将重新登录", icon: "none" });

        setTimeout(() => {
          wx.reLaunch({ url: "/pages/index/index" });
        }, 500);
      },
    });
  },

  /** 隐私政策 */
  onPrivacy() {
    wx.showModal({
      title: "隐私政策",
      content:
        "目前仅在本地存储必要数据（如命盘与对话记录），用于提供服务和体验优化，不会对外出售或共享你的个人信息。",
      showCancel: false,
      confirmText: "知道了",
    });
  },

  /** 用户协议 */
  onAgreement() {
    wx.showModal({
      title: "用户协议",
      content:
        "使用本小程序即表示你知晓并同意：本服务仅作为命理娱乐与参考工具，不对任何决策结果承担法律责任。",
      showCancel: false,
      confirmText: "了解",
    });
  },

  /** 免责声明 */
  onDisclaimer() {
    wx.showModal({
      title: "免责声明",
      content:
        "本小程序提供的命盘与解读内容仅供参考，不构成任何法律、金融、医疗、心理等专业建议，请勿将其作为唯一决策依据。",
      showCancel: false,
      confirmText: "明白",
    });
  },
});
