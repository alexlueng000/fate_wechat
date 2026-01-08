// components/login-modal/login-modal.ts

// 简单的登录标记，不再使用已废弃的 getUserProfile
const LOGIN_STORAGE_KEY = 'user_logged_in';

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
      // 标记用户已登录（用于解锁完整内容）
      wx.setStorageSync(LOGIN_STORAGE_KEY, true);
      wx.setStorageSync('user_logged_in_time', Date.now());

      this.setData({ show: false });
      this.triggerEvent('login', { loggedIn: true });

      wx.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 1500,
      });
    },
  },
};

Component<Data, {}, {}, Custom>(options);
