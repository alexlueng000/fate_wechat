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
    accountType: "小程序账号",
    initials: "FI",
    version: "1.0.0",
  },

  onLoad() {
    const env = app?.globalData?.env || "develop";
    const stored: any = wx.getStorageSync("auth_user") || null;

    let nickname = "";
    let userId = "";
    let accountType = "小程序账号";
    let initials = "FI";

    if (stored) {
      nickname = stored.nickname || stored.name || "";
      userId = String(stored.id || "");
      if (stored.mobile || stored.phone) {
        accountType = "已绑定手机";
      } else {
        accountType = "小程序账号";
      }
      const base = nickname || userId || "命理八字";
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
        console.log("客服打开成功");
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
