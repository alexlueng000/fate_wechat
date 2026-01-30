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
  username: string;
  env: string;
  accountType: string;
  initials: string;
  version: string;
  avatarUrl: string;      // 用户头像 URL
  hasAuthorized: boolean;  // 是否已授权
  isLoggedIn: boolean;     // 是否已登录
}

Page<Data>({
  data: {
    user: null,
    nickname: "",
    username: "",
    env: "develop",
    accountType: "小程序账号",
    initials: "FI",
    version: "1.0.0",
    avatarUrl: "",
    hasAuthorized: false,
    isLoggedIn: false,
  },

  onLoad() {
    this.loadUserInfo();
  },

  onShow() {
    // 每次显示页面时重新加载用户信息（登录后返回会触发）
    this.loadUserInfo();
  },

  loadUserInfo() {
    const env = app?.globalData?.env || "develop";
    const stored: any = wx.getStorageSync("auth_user") || null;
    const token = wx.getStorageSync("token") || null;

    let nickname = "";
    let username = "";
    let accountType = "小程序账号";
    let initials = "FI";
    let avatarUrl = "";
    let hasAuthorized = false;
    let isLoggedIn = !!token;  // 有 token 即为已登录

    if (stored) {
      nickname = stored.nickname || stored.name || "";
      username = stored.username || "";
      avatarUrl = stored.avatarUrl || stored.avatar_url || "";
      hasAuthorized = !!(stored.nickName || nickname && avatarUrl);
      if (stored.mobile || stored.phone) {
        accountType = "已绑定手机";
      } else {
        accountType = "小程序账号";
      }
      const base = nickname || username || "命理八字";
      initials = base.slice(0, 2).toUpperCase();
    }

    this.setData({
      user: stored,
      nickname,
      username,
      env,
      accountType,
      initials,
      avatarUrl,
      hasAuthorized,
      isLoggedIn,
    });
  },

  /** 历史排盘 */
  onHistory() {
    wx.navigateTo({ url: "/pages/history/history" });
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
          wx.removeStorageSync("paipan_history");
          wx.removeStorageSync("conversation_id");
          wx.removeStorageSync("start_reply");
        } catch (e) {}

        wx.showToast({ title: "已清除", icon: "none" });
      },
    });
  },

  /** 使用帮助 */
  onHelp() {
    wx.showModal({
      title: "使用帮助",
      content:
        "1. 在「排盘」页面输入出生信息，点击「开始排盘」\n" +
        "2. 查看命盘结果，可点击「开始对话」进行AI解读\n" +
        "3. 在「解读」页面可进行多轮对话，了解性格、事业、财运等\n" +
        "4. 在「我的」页面可查看历史记录和管理数据",
      showCancel: false,
      confirmText: "知道了",
    });
  },

  /** 意见反馈 */
  onFeedback() {
    wx.navigateTo({ url: "/pages/feedback/feedback" });
  },

  /** 联系客服 */
  onContact() {
    // 打开微信客服
    wx.openCustomerServiceChat({
      extInfo: { url: "https://api.fateinsight.site" },
      corpId: "", // 请替换为您企业的 corpId
      success: () => {
        // 客服打开成功
      },
      fail: () => {
        // 如果未配置客服，显示联系方式
        wx.showModal({
          title: "联系客服",
          content: "客服邮箱：support@fateinsight.site\n微信号：FateInsight",
          showCancel: false,
          confirmText: "知道了",
        });
      },
    });
  },

  /** 关于我们 */
  onAbout() {
    wx.navigateTo({ url: "/pages/about/about" });
  },

  /** 隐私政策 */
  onPrivacy() {
    wx.navigateTo({ url: "/pages/privacy/privacy" });
  },

  /** 用户协议 */
  onAgreement() {
    wx.navigateTo({ url: "/pages/privacy/privacy?tab=agreement" });
  },

  /** 免责声明 */
  onDisclaimer() {
    wx.navigateTo({ url: "/pages/privacy/privacy?tab=disclaimer" });
  },

  /** 登录/授权：跳转到登录页 */
  onAuthorize() {
    wx.navigateTo({
      url: '/pages/login/login?from=profile'
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
          wx.removeStorageSync("user_logged_in");
          wx.removeStorageSync("user_logged_in_time");
          wx.removeStorageSync("mp_openid");  // 清除 auth.ts 中的本地 openid
          app.globalData.token = null;
        } catch (e) {}

        // 重置页面状态
        this.setData({
          user: null,
          nickname: "",
          username: "",
          avatarUrl: "",
          hasAuthorized: false,
          isLoggedIn: false,
          initials: "FI",
          accountType: "小程序账号",
        });

        wx.showToast({ title: "已退出，将重新登录", icon: "none" });

        setTimeout(() => {
          wx.reLaunch({ url: "/pages/index/index" });
        }, 500);
      },
    });
  },

  /** 给我们评分 */
  onRate() {
    wx.showModal({
      title: "感谢支持",
      content: "感谢您的使用！如需评分，请在微信中搜索本小程序并进行评分。",
      showCancel: false,
      confirmText: "知道了",
    });
  },
});
