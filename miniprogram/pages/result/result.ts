type Table = { tiangan: string[]; dizhi: string[]; changsheng: string[]; };
type Dayun = { ganzhi: string; age: string; };
type Wuxing = { name: string; percent: number; cls: string; };

Page({
  data: {
    table: <Table>{
      tiangan: ["甲","乙","丙","丁"],
      dizhi:   ["子","丑","寅","卯"],
      changsheng: ["帝旺","衰","病","死"]
    },
    dayun: <Dayun[]>[
      { ganzhi:"乙丑", age:"10岁" },
      { ganzhi:"丙寅", age:"20岁" },
      { ganzhi:"丁卯", age:"30岁" },
      { ganzhi:"戊辰", age:"40岁" },
      { ganzhi:"己巳", age:"50岁" }
    ],
    wuxing: <Wuxing[]>[
      { name:"金", percent:20, cls:"wx-gold" },
      { name:"木", percent:15, cls:"wx-wood" },
      { name:"水", percent:30, cls:"wx-water" },
      { name:"火", percent:20, cls:"wx-fire" },
      { name:"土", percent:15, cls:"wx-earth" }
    ]
  },

  onLoad() {},

  onConsult() {
    wx.showToast({ title:"咨询入口（占位）", icon:"none" });
  },

  onFeature(e: WechatMiniprogram.BaseEvent) {
    const key = (e.currentTarget.dataset as any).key || "";
    wx.showToast({ title: "功能：" + key, icon:"none" });
  },

  onStartChat() {
    // TODO: 跳转对话页或带入上下文
    wx.showToast({ title:"进入对话（占位）", icon:"none" });
  }
});
