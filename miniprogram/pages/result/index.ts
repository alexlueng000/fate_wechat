// pages/result/index.ts
import { request } from "../../utils/request";

Page({
  data: {
    pillars: { year: "", month: "", day: "", hour: "" },
    table: { tiangan: [], dizhi: [], changsheng: ["—","—","—","—"] },
    dayun: [],
    summaryOpen: true,
  },

  onLoad() {
    try {
      const cached = wx.getStorageSync("last_paipan");
      if (!cached || !cached.mingpan) {
        wx.showToast({ title: "没有结果数据", icon: "none" });
        return;
      }
      this.applyMingpan(cached.mingpan);
    } catch (e) {
      console.error(e);
      wx.showToast({ title: "页面初始化失败", icon: "none" });
    }
  },

  applyMingpan(m: any) {
    const fp = m?.four_pillars ?? { year:["",""], month:["",""], day:["",""], hour:["",""] };
    const y = Array.isArray(fp.year)?fp.year:["",""];
    const mo= Array.isArray(fp.month)?fp.month:["",""];
    const d = Array.isArray(fp.day)?fp.day:["",""];
    const h = Array.isArray(fp.hour)?fp.hour:["",""];

    const pillars = { year: y.join(""), month: mo.join(""), day: d.join(""), hour: h.join("") };
    const table   = { tiangan:[y[0],mo[0],d[0],h[0]], dizhi:[y[1],mo[1],d[1],h[1]], changsheng: this.data.table?.changsheng ?? [] };

    const dayun = (Array.isArray(m.dayun)?m.dayun:[]).map(item => ({
      ganzhi: Array.isArray(item?.pillar) && item.pillar.length ? item.pillar.join("") : "—",
      age: String(item?.age ?? "") + "岁 / " + String(item?.start_year ?? "")
    }));

    this.setData({ pillars, table, dayun });
  },

  toggleSummary() {
    this.setData({ summaryOpen: !this.data.summaryOpen });
  },

  // pages/result/index.ts
  async onStartChat() {
    const cached: any = wx.getStorageSync("last_paipan");
    if (!cached || !cached.mingpan) {
      wx.showToast({ title: "没有命盘数据", icon: "none" });
      return;
    }
  
    wx.showLoading({ title: "生成解读…" });
  
    try {
      const resp = await request<{ conversation_id: string; reply: string }>(
        "api/chat/start?stream=0&_ts=" + Date.now(),   // 没必要带前导 /
        "POST",
        { paipan: cached.mingpan, kb_index_dir: "", kb_topk: 3 },
        { Accept: "application/json" }
      );
  
      // 存到 storage，给 chat 页在 onLoad 里兜底读取
      wx.setStorageSync("conversation_id", resp.conversation_id);
      wx.setStorageSync("start_reply", resp.reply || "");
  
      // 直接切到「解读」Tab，不再用 navigateTo + eventChannel
      wx.switchTab({
        url: "/pages/chat/chat",
      });
    } catch (e: any) {
      wx.showToast({
        title: e?.message || "启动对话失败",
        icon: "none",
      });
    } finally {
      wx.hideLoading();
    }
  }


});
