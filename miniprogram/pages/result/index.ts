// pages/result/index.ts

type FourPillars = {
  year: [string, string];   // [天干, 地支]
  month: [string, string];
  day: [string, string];
  hour: [string, string];
};

type DayunItem = {
  age: number;
  start_year: number;
  pillar: string[];         // ["甲","申"] 或 []
};

type MingpanResp = {
  mingpan: {
    four_pillars: FourPillars;
    dayun: DayunItem[];
    // 将来可扩: wuxing 等
  };
};

interface TableData {
  tiangan: string[];   // 年/月/日/时 天干
  dizhi: string[];     // 年/月/日/时 地支
  changsheng: string[]; // 先占位: ["—","—","—","—"]（等你后端给或前端计算）
}

interface WuxingItem {
  name: string;
  percent: number; // 0~100
  cls: string;     // 颜色类名（如 'jin','mu'），你 wxss 里自行定义
}

Page({
  data: {
    // 四柱表格
    table: {
      tiangan: [] as string[],
      dizhi: [] as string[],
      changsheng: ["—","—","—","—"] as string[],
    } as TableData,

    // 大运 chips
    dayun: [] as Array<{ ganzhi: string; age: string }>,

    // 五行（暂时无数据，先留空）
    wuxing: [] as WuxingItem[],
  },

  onLoad() {
    // 1) 优先读取上个页面存的缓存
    const cached: MingpanResp | null = wx.getStorageSync("last_paipan");
    if (!cached || !cached.mingpan) {
      wx.showToast({ title: "没有结果数据", icon: "none" });
      return;
    }
    this.applyMingpan(cached.mingpan);
  },

  applyMingpan(m: MingpanResp["mingpan"]) {
    // 2) 解析四柱
    const fp = m.four_pillars;
    const tiangan = [fp.year[0], fp.month[0], fp.day[0], fp.hour[0]];
    const dizhi   = [fp.year[1], fp.month[1], fp.day[1], fp.hour[1]];

    // 3) 解析大运（把 pillar 数组拼成干支；age 带上起运年份更直观）
    const dayun = (m.dayun || []).map((d) => ({
      ganzhi: d.pillar?.length ? d.pillar.join("") : "—",
      age: `${d.age}岁 / ${d.start_year}`,
    }));

    // 4) 五行：当前后端未给，保持空数组；若后续返回 {jin, mu, shui, huo, tu} 再映射

    this.setData({
      table: { tiangan, dizhi, changsheng: this.data.table.changsheng },
      dayun,
      // wuxing: [...]
    });
  },

  // —— 下面是你 wxml 里绑定到的点击事件占位，避免未定义报错 ——
  onConsult() {
    wx.showToast({ title: "咨询功能开发中", icon: "none" });
  },
  onFeature(e: any) {
    const key = e.currentTarget?.dataset?.key;
    wx.showToast({ title: `功能 ${key} 开发中`, icon: "none" });
  },
  onStartChat() {
    wx.showToast({ title: "对话模式稍后接入", icon: "none" });
  },
});
