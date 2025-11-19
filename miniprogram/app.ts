import { request } from "./utils/request";

type MpLoginPayload = {
  js_code: string;
  nickname?: string;
  avatar_url?: string;
};

type MpLoginResp = {
  access_token: string;
  user: any;
  mode?: string;
};

App({
  globalData: {
    token: null as string | null,
    env: "develop" as "develop" | "trial" | "release",
  },

  onLaunch() {
    // 识别当前环境：开发工具 / 真机体验 / 正式发布
    let info: any = {};
    try {
      if (wx.getAccountInfoSync) {
        info = wx.getAccountInfoSync();
      }
    } catch (e) {
      info = {};
    }

    const envVersion =
      info &&
      info.miniProgram &&
      info.miniProgram.envVersion
        ? info.miniProgram.envVersion
        : "develop";

    this.globalData.env = envVersion as any;

    // 应用更新检查
    this.initUpdateManager();

    // 执行登录流程
    this.bootstrapLogin();
  },

  initUpdateManager() {
    const updateManager = wx.getUpdateManager
      ? wx.getUpdateManager()
      : null;
    if (!updateManager) return;

    updateManager.onCheckForUpdate(function () {});

    updateManager.onUpdateReady(function () {
      wx.showModal({
        title: "更新提示",
        content: "新版本已准备好，是否重启应用？",
        success(res) {
          if (res.confirm) {
            updateManager.applyUpdate();
          }
        },
      });
    });

    updateManager.onUpdateFailed(function () {
      console.warn("小程序更新下载失败");
    });
  },

  /** 按环境选择登录方式 */
  bootstrapLogin() {
    const env = this.globalData.env;
    if (env === "develop") {
      // 开发工具 / 开发版本：直接用 js_code='dev'
      this.loginDev();
    } else {
      // 体验版 / 正式版：走 wx.login
      this.loginWx();
    }
  },

  /** 开发环境登录：后端走 js_code='dev' 分支 */
  loginDev() {
    const nickname = wx.getStorageSync("dev_nickname") || "LocalTester";

    const payload: MpLoginPayload = {
      js_code: "dev",
      nickname,
    };

    this.callLoginApi(payload, "dev");
  },

  /** 体验 / 正式环境：调用 wx.login，拿 code */
  loginWx() {
    wx.login({
      timeout: 10000,
      success: (res) => {
        const code = res.code;
        if (!code) {
          this.toast("登录失败：未获取到 code");
          return;
        }

        const payload: MpLoginPayload = {
          js_code: code,
          nickname: "WeappUser", // 后续你想采集真实昵称再改
        };

        this.callLoginApi(payload, "wx");
      },
      fail: (err) => {
        console.error("wx.login 失败", err);
        this.toast("登录失败：网络异常");
      },
    });
  },

  /** 统一调用后端登录接口 */
  callLoginApi(payload: MpLoginPayload, expectMode: string) {
    // 注意这里走的是 "api/auth/mp/login"，跟你其它 "api/xxx" 一致
    request<MpLoginResp>("api/auth/mp/login", "POST", payload)
      .then((res) => {
        if (!res || !res.access_token) {
          throw new Error("登录返回无 access_token");
        }

        this.setToken(res.access_token);
        // 可选：把 user 存起来，后面要展示头像/昵称的话直接用
        try {
          wx.setStorageSync("auth_user", res.user || null);
        } catch (e) {}

        console.log("Login ok:", res.mode || expectMode);
      })
      .catch((e: any) => {
        console.error("Login failed", e);
        const msg =
          typeof e === "string"
            ? e
            : e && e.message
            ? e.message
            : "";

        if (msg && msg.indexOf("code2session") >= 0) {
          this.toast("后端未实现微信登录（code2session）");
        } else if (msg && msg.indexOf("WeChat code2session 未配置") >= 0) {
          this.toast("后端尚未接入微信登录");
        } else {
          this.toast("登录失败，请稍后重试");
        }
      });
  },

  /** 设置 token（供后续请求用） */
  setToken(token: string) {
    this.globalData.token = token;
    try {
      wx.setStorageSync("token", token);
    } catch (e) {
      console.warn("保存 token 到 storage 失败", e);
    }
  },

  toast(title: string) {
    wx.showToast({ title, icon: "none" });
  },
});
