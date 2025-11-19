// pages/profile/index.ts

interface UserInfo {
  id?: number | string;
  nickname?: string;
  [k: string]: any;
}

interface PageData {
  user: UserInfo | null;
  nickname: string;
  userId: string;
  env: string;
  accountType: string;
  initials: string;
  version: string;
}

const app = getApp<{
  globalData: { env: "develop" | "trial" | "release"; token: string | null };
}>();

Page<PageData>({
  data: {
    user: null,
    nickname: "",
    userId: "",
    env: "develop",
    accountType: "匿名账号",
    initials: "FI",
    version: "0.1.0",
  },

  onLoad() {
    // 读全局环境
    const env = app?.globalData?.env || "develop";

    // 从 storage 里取后端返回的 user
    const stored: any = wx.getStorageSync("auth_user") || null;

    let nickname = "";
    let userId = "";
    let accountType = "匿名账号";
    let initials = "FI";

    if (stored) {
      nickname = stored.nickname || stored.name || "";
      userId = String(stored.id || "");
      // 简单区分：有手机号 / 有 unionid 可以认为是“已绑定账号”，你后面可以再细分
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

  /** 清除本地排盘与会话数据（不动 token） */
  onClearLocal() {
    wx.showModal({
      title: "确认清除？",
      content: "将清除本地命盘结果与聊天会话记录，不影响账号登录。",
      confirmText: "清除",
      confirmColor: "#b83227",
      success: (res) => {
        if (!res.confirm) return;

        try {
          wx.removeStorageSync("last_paipan");
          wx.removeStorageSync("last_form");
          wx.removeStorageSync("conversation_id");
          wx.removeStorageSync("start_reply");
          // 你如果还有 messages 之类的本地缓存，在这里一起删
        } catch (e) {}

        wx.showToast({ title: "已清除", icon: "none" });
      },
    });
  },

  /** 退出登录：清 token + user，然后回首页，让 app.ts 重新登录 */
  onLogout() {
    wx.showModal({
      title: "退出登录",
      content: "退出后，下次打开小程序会自动创建新的账号。是否继续？",
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

        // 重启到首页，触发 onLaunch -> bootstrapLogin
        setTimeout(() => {
          wx.reLaunch({
            url: "/pages/index/index",
          });
        }, 500);
      },
    });
  },

  /** 以下三个先用弹窗占位，等你有页面再替换成 navigateTo */

  onPrivacy() {
    wx.showModal({
      title: "隐私政策",
      content: "隐私政策页面暂未完成，目前仅在本地存储必要的数据，不会对外共享。",
      showCancel: false,
      confirmText: "知道了",
    });
  },

  onAgreement() {
    wx.showModal({
      title: "用户协议",
      content: "用户协议页面暂未完成。使用本小程序即表示你知晓本服务仅供娱乐与参考。",
      showCancel: false,
      confirmText: "了解",
    });
  },

  onDisclaimer() {
    wx.showModal({
      title: "免责声明",
      content: "命理与占卜内容仅供参考，不构成任何法律、金融、医疗或心理专业建议。",
      showCancel: false,
      confirmText: "明白",
    });
  },
});
