// components/login-modal/login-modal.ts
interface UserInfo {
  avatarUrl: string;
  nickName: string;
}

interface Data {
  show: boolean;
}

type Custom = {
  onOpen(): void;
  onClose(): void;
  onMaskTap(): void;
  onBubbleTap(): void;
  onLogin(): void;
};

const options: WechatMiniprogram.Component.Options<Data, {}, {}, Custom> = {
  options: {
    styleIsolation: 'shared',
  },

  data: {
    show: false,
  },

  methods: {
    onOpen() {
      this.setData({ show: true });
    },

    onClose() {
      this.setData({ show: false });
      this.triggerEvent('cancel');
    },

    onMaskTap() {
      this.onClose();
    },

    onBubbleTap() {
      // 阻止冒泡
    },

    onLogin() {
      // 使用微信 getUserProfile 获取用户信息
      wx.getUserProfile({
        desc: '用于完善会员资料',
        success: (res) => {
          const userInfo = res.userInfo;
          // 保存用户信息
          wx.setStorageSync('user_profile', userInfo);

          this.setData({ show: false });
          this.triggerEvent('login', { userInfo });
        },
        fail: (err) => {
          console.log('getUserProfile fail:', err);
          if (err.errMsg.includes('auth deny')) {
            wx.showToast({ title: '需要授权才能继续', icon: 'none' });
          }
        },
      });
    },
  },
};

Component<Data, {}, {}, Custom>(options);
