// components/login-modal/login-modal.ts

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
      // 直接跳转到登录页面
      this.setData({ show: false });
      this.triggerEvent('cancel');
      wx.navigateTo({ url: '/pages/login/login?from=chat' });
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
      // 跳转到登录页面
      this.setData({ show: false });
      this.triggerEvent('cancel');
      wx.navigateTo({ url: '/pages/login/login?from=chat' });
    },
  },
};

Component<Data, {}, {}, Custom>(options);
