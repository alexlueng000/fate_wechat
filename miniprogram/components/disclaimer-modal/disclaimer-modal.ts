interface Data {
  show: boolean;
}

type Custom = {
  onOpen(): void;
  onAgree(): void;
  onBubbleTap(): void;
};

const STORAGE_KEY = 'disclaimer_accepted_v1';

const options: WechatMiniprogram.Component.Options<Data, {}, {}, Custom> = {
  options: {
    styleIsolation: 'shared',
  },

  data: {
    show: false,
  },

  methods: {
    onOpen() {
      // 检查是否已同意
      const accepted = wx.getStorageSync(STORAGE_KEY);
      if (accepted && accepted.accepted) {
        return; // 已同意，不显示
      }
      this.setData({ show: true });
    },

    onAgree() {
      // 保存同意状态到 Storage
      wx.setStorageSync(STORAGE_KEY, {
        accepted: true,
        acceptedAt: new Date().toISOString(),
        version: '1.0'
      });

      this.setData({ show: false });
      this.triggerEvent('agree');
    },

    onBubbleTap() {
      // 阻止冒泡
    },
  },
};

Component<Data, {}, {}, Custom>(options);
