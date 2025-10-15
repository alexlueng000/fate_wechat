import { request } from "./utils/request";
// import type { TokenResponse } from "../typings/types/api";

App({
  globalData: {
    token: null,
    env: "develop", // develop | trial | release
  },

  onLaunch() {
    // 识别当前环境：开发工具/真机体验/正式发布（兼容无可选链）
    var info = {};
    try {
      if (wx.getAccountInfoSync) {
        info = wx.getAccountInfoSync();
      }
    } catch (e) {
      info = {};
    }
    var envVersion =
      info && info.miniProgram && info.miniProgram.envVersion
        ? info.miniProgram.envVersion
        : "develop";
    this.globalData.env = envVersion;

    // 可选：应用更新检查（兼容写法）
    this.initUpdateManager();

    // 执行登录流程
    this.bootstrapLogin();
  },

  initUpdateManager() {
    var updateManager = wx.getUpdateManager ? wx.getUpdateManager() : null;
    if (!updateManager) return;

    updateManager.onCheckForUpdate(function () {});
    updateManager.onUpdateReady(function () {
      wx.showModal({
        title: "更新提示",
        content: "新版本已准备好，是否重启应用？",
        success: function (res) {
          if (res.confirm) updateManager.applyUpdate();
        },
      });
    });
    updateManager.onUpdateFailed(function () {
      console.warn("小程序更新下载失败");
    });
  },

  // 按环境选择登录方式
  bootstrapLogin() {
    var env = this.globalData.env;
    if (env === "develop") {
      // 开发工具/真机“开发版”预览
      this.loginDev();
    } else {
      // trial=体验版，release=正式版
      this.loginWx();
    }
  },

  // 开发环境：后端走 js_code='dev'
  loginDev() {
    var nickname = wx.getStorageSync("dev_nickname") || "LocalTester";
    this.callLoginApi(
      {
        js_code: "dev",
        nickname: nickname,
      },
      "dev"
    );
  },

  // 体验/正式环境：用 wx.login 拿临时登录凭证
  loginWx() {
    wx.login({
      timeout: 10000,
      success: (res) => {
        var code = res.code;
        if (!code) {
          this.toast("登录失败：未获取到 code");
          return;
        }
        this.callLoginApi(
          {
            js_code: code,
            // 不强依赖用户授权昵称；后端可兜底
            nickname: "WeappUser",
          },
          "wx"
        );
      },
      fail: (err) => {
        console.error("wx.login 失败", err);
        this.toast("登录失败：网络异常");
      },
    });
  },

  // 统一调用后端登录接口
  callLoginApi(payload, expectMode) {
    // 你的 request(path, method, data)
    request("/auth/mp/login", "POST", payload)
      .then((res) => {
        if (!res || !res.token) {
          throw new Error("登录返回无 token");
        }
        this.setToken(res.token);
        console.log("Login ok:", res.mode || expectMode);
      })
      .catch((e) => {
        console.error("Login failed", e);
        var msg = typeof e === "string" ? e : (e && e.message) ? e.message : "";
        // 兼容：不要用 String.prototype.includes
        if (msg && msg.indexOf("jscode2session") >= 0) {
          this.toast("后端未实现微信登录（jscode2session）");
        } else {
          this.toast("登录失败，请稍后重试");
        }
      });
  },

  // 统一设置 token（供后续请求用）
  setToken(token) {
    this.globalData.token = token;
    try {
      wx.setStorageSync("token", token);
    } catch (e) {}
    // 兼容：避免可选链
    if (request && typeof request.setToken === "function") {
      try {
        request.setToken(token);
      } catch (e) {}
    }
  },

  toast(title) {
    wx.showToast({ title: title, icon: "none" });
  },
});
