const DEFAULT_GREET =
  "你好呀～（微笑）\n" +
  "我不是来剧透你人生的编剧，只是帮你找找藏在命盘里的小彩蛋——可能是你还没发现的潜力，或是未来路上悄悄亮起的路灯（✨）\n" +
  "毕竟你才是人生的主角，我嘛…只是个带地图的导游～（轻松摊手）\n" +
  "准备好一起逛逛你的‘人生剧本杀’了吗？放心，不用怕泄露天机，我今天的‘仙气’储备充足！";

Page({
  data: {
    nickname: "",
    gender: "男",          // 男 / 女
    calendar: "公历",      // 公历 / 农历
    datetime: "",          // YYYY-MM-DD HH:mm
    datetimeDisplay: "-/-/- --:--",
    greet: DEFAULT_GREET
  },

  onLoad() {},

  onTheme() {
    // 这里可切换暗色；先留空
  },
  onSetting() {
    // 跳设置页或弹窗；先留空
  },

  onNickname(e: WechatMiniprogram.Input) {
    const v = (e.detail as any).value as string;
    this.setData({ nickname: v });
  },

  setMale()   { this.setData({ gender: "男"  }); },
  setFemale() { this.setData({ gender: "女"  }); },

  setSolar()  { this.setData({ calendar: "公历" }); },
  setLunar()  { this.setData({ calendar: "农历" }); },

  onPickDatetime(e: any) {
    const v = e.detail.value || "";
    // v 形如 "2025-08-14 08:30"
    this.setData({ datetime: v, datetimeDisplay: v || "-/-/- --:--" });
  },

  onStart() {
    // 这里接你的排盘/对话逻辑；先做必填校验
    if (!this.data.datetime) {
      wx.showToast({ title: "请选择出生日期时间", icon: "none" });
      return;
    }
    // TODO：跳转到对话页或调用后端
    wx.showToast({ title: "已开始排盘（示例）", icon: "none" });
  }
});
