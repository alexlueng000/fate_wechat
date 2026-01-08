// pages/login/login.ts
const app = getApp<{
  globalData: { env: "develop" | "trial" | "release"; token: string | null };
}>();

interface Data {
  tempAvatarUrl: string;
  tempNickName: string;
  canLogin: boolean;
  fromPage: string;
}

type Custom = {
  onChooseAvatar(e: any): void;
  onNicknameInput(e: any): void;
  onConfirmLogin(): void;
  onAgreement(): void;
  onPrivacy(): void;
  doBackendLogin(userInfo: any): Promise<void>;
  navigateBack(): void;
};

const options: WechatMiniprogram.Page.Options<Data, Custom> = {
  data: {
    tempAvatarUrl: '',
    tempNickName: '',
    canLogin: false,
    fromPage: 'chat',
  },

  onLoad(options) {
    const from = (options as any).from || 'chat';
    this.setData({ fromPage: from });
  },

  onChooseAvatar(e) {
    const avatarUrl = e.detail.avatarUrl;
    this.setData({
      tempAvatarUrl: avatarUrl,
    });
    this.checkCanLogin();
  },

  onNicknameInput(e) {
    const nickName = (e.detail as any).value;
    this.setData({
      tempNickName: nickName,
    });
    this.checkCanLogin();
  },

  checkCanLogin() {
    const canLogin = this.data.tempNickName.length > 0 && this.data.tempAvatarUrl.length > 0;
    this.setData({ canLogin });
  },

  async onConfirmLogin() {
    if (!this.data.canLogin) {
      wx.showToast({ title: '请完善头像和昵称', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '登录中...', mask: true });

    try {
      // 调用 wx.login 获取 code
      const loginRes = await new Promise<WechatMiniprogram.LoginSuccessCallbackResult>((resolve, reject) => {
        wx.login({
          success: resolve,
          fail: reject,
        });
      });

      if (!loginRes.code) {
        throw new Error('wx.login failed');
      }

      // 调用后端登录接口
      await this.doBackendLogin({
        code: loginRes.code,
        nickname: this.data.tempNickName,
        avatarUrl: this.data.tempAvatarUrl,
      });

      wx.hideLoading();
      wx.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 1500,
      });

      setTimeout(() => {
        this.navigateBack();
      }, 500);

    } catch (err) {
      wx.hideLoading();
      console.error('[login] Error:', err);
    }
  },

  async doBackendLogin(userInfo: { code: string; nickname: string; avatarUrl: string }) {
    const BASE_URL = 'https://api.fateinsight.site';

    return new Promise<void>((resolve, reject) => {
      wx.request({
        url: BASE_URL + '/api/auth/mp/login',
        method: 'POST',
        data: {
          js_code: userInfo.code,
          nickname: userInfo.nickname,
          avatar_url: userInfo.avatarUrl,
        },
        header: {
          'Content-Type': 'application/json',
        },
        success: (res) => {
          console.log('[login] Backend response:', res.statusCode, res.data);

          if (res.statusCode >= 200 && res.statusCode < 300) {
            const data = res.data as any;
            const { access_token, user } = data;

            // 保存 token 和用户信息
            wx.setStorageSync('token', access_token);
            wx.setStorageSync('auth_user', user);
            wx.setStorageSync('user_logged_in', true);
            wx.setStorageSync('user_logged_in_time', Date.now());

            // 更新全局数据
            if (app?.globalData) {
              app.globalData.token = access_token;
            }

            console.log('[login] Backend login success, user:', user);
            resolve();
          } else {
            const errorMsg = (res.data as any)?.detail || '登录失败';
            wx.showModal({
              title: '登录失败',
              content: errorMsg,
              showCancel: false,
            });
            reject(new Error(errorMsg));
          }
        },
        fail: (err) => {
          console.error('[login] Request failed:', err);
          wx.showModal({
            title: '网络错误',
            content: '请检查网络连接后重试',
            showCancel: false,
          });
          reject(err);
        },
      });
    });
  },

  navigateBack() {
    if (this.data.fromPage === 'chat') {
      wx.switchTab({ url: '/pages/chat/chat' });
    } else {
      wx.navigateBack();
    }
  },

  onAgreement() {
    wx.navigateTo({ url: '/pages/privacy/privacy?tab=agreement' });
  },

  onPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },
};

Page<Data, Custom>(options);
