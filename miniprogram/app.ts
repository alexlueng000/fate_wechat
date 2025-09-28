import { request } from "./utils/request";
// import type { TokenResponse } from "../typings/types/api";

App({
  globalData: {
    token: null,
    env: 'develop',           // develop | trial | release
  },

  onLaunch() {
    // 识别当前环境：开发工具/真机体验/正式发布
    try {
      const info = wx.getAccountInfoSync();
      this.globalData.env = info?.miniProgram?.envVersion || 'develop';
    } catch (_) {
      this.globalData.env = 'develop';
    }

    // 可选：应用更新检查
    this.initUpdateManager();

    // 执行登录流程
    this.bootstrapLogin();
  },

  initUpdateManager() {
    const updateManager = wx.getUpdateManager?.();
    if (!updateManager) return;
    updateManager.onCheckForUpdate(() => {});
    updateManager.onUpdateReady(() => {
      wx.showModal({
        title: '更新提示',
        content: '新版本已准备好，是否重启应用？',
        success: (res) => {
          if (res.confirm) updateManager.applyUpdate();
        },
      });
    });
    updateManager.onUpdateFailed(() => {
      console.warn('小程序更新下载失败');
    });
  },

  // 按环境选择登录方式
  bootstrapLogin() {
    const env = this.globalData.env;
    if (env === 'develop') {
      // 开发工具/真机“开发版”预览
      this.loginDev();
    } else {
      // trial=体验版，release=正式版
      this.loginWx();
    }
  },

  // 开发环境：后端走 js_code='dev'
  loginDev() {
    // 不要依赖用户授权昵称，这里给个默认值即可
    const nickname = wx.getStorageSync('dev_nickname') || 'LocalTester';
    this.callLoginApi({
      js_code: 'dev',
      nickname,
    }, 'dev');
  },

  // 体验/正式环境：用 wx.login 拿临时登录凭证
  loginWx() {
    wx.login({
      timeout: 10000,
      success: (res) => {
        const code = res.code;
        if (!code) {
          this.toast('登录失败：未获取到 code');
          return;
        }
        this.callLoginApi({
          js_code: code,
          // 这里不用强依赖用户授权昵称；后端会兜底生成 username/nickname
          nickname: 'WeappUser',
        }, 'wx');
      },
      fail: (err) => {
        console.error('wx.login 失败', err);
        this.toast('登录失败：网络异常');
      },
    });
  },

  // 统一调用后端登录接口
  callLoginApi(payload, expectMode) {
    // 你项目里的 request 签名是：request(path, method, data)
    request('/auth/mp/login', 'POST', payload)
      .then((res) => {
        // 期望后端返回 { token, mode }
        if (!res || !res.token) {
          throw new Error('登录返回无 token');
        }
        this.setToken(res.token);
        console.log('Login ok:', res.mode || expectMode);
      })
      .catch((e) => {
        console.error('Login failed', e);
        const msg = (typeof e === 'string' ? e : e?.message) || '';
        if (msg.includes('jscode2session')) {
          // 给出更明确的提示，便于你排查后端是否已实现
          this.toast('后端未实现微信登录（jscode2session）');
        } else {
          this.toast('登录失败，请稍后重试');
        }
      });
  },

  // 统一设置 token（供后续请求用）
  setToken(token) {
    this.globalData.token = token;
    try {
      wx.setStorageSync('token', token);
    } catch (_) {}
    // 如你的 request 工具有支持设置全局 token，可在此注入
    if (typeof request?.setToken === 'function') {
      try { request.setToken(token); } catch (_) {}
    }
  },

  toast(title) {
    wx.showToast({ title, icon: 'none' });
  },
});
