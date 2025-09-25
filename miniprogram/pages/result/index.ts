// pages/result/index.ts
import { request } from "../../utils/request";

type FourPillars = {
  year: [string, string];
  month: [string, string];
  day: [string, string];
  hour: [string, string];
};
type DayunItem = { age: number; start_year: number; pillar: string[] };
type MingpanData = { four_pillars: FourPillars; dayun: DayunItem[] };
type LastPaipan = { mingpan: MingpanData };
type Msg = { role: "assistant" | "user"; content: string };

Page<Record<string, any>, {
  // 摘要/折叠
  pillars: { year: string; month: string; day: string; hour: string };
  table: { tiangan: string[]; dizhi: string[]; changsheng: string[] };
  dayun: Array<{ ganzhi: string; age: string }>;
  summaryOpen: boolean;

  // 聊天
  messages: Msg[];
  inputValue: string;
  sending: boolean;
  chatting: boolean;
  scrollInto: string;
  conversationId: string;
}>({
  data: {
    pillars: { year: "", month: "", day: "", hour: "" },
    table: { tiangan: [], dizhi: [], changsheng: ["—","—","—","—"] },
    dayun: [],
    summaryOpen: false,

    messages: [],
    inputValue: "",
    sending: false,
    chatting: false,
    scrollInto: "bottom-anchor",
    conversationId: "",
  },

  onLoad() {
    const cached: LastPaipan | null = wx.getStorageSync("last_paipan");
    if (!cached || !cached.mingpan) {
      wx.showToast({ title: "没有结果数据", icon: "none" });
      return;
    }
    this.applyMingpan(cached.mingpan);
  },

  applyMingpan(m: MingpanData) {
    const fp = m.four_pillars;
    const pillars = {
      year: fp.year.join(""),
      month: fp.month.join(""),
      day: fp.day.join(""),
      hour: fp.hour.join(""),
    };
    const table = {
      tiangan: [fp.year[0], fp.month[0], fp.day[0], fp.hour[0]],
      dizhi:   [fp.year[1], fp.month[1], fp.day[1], fp.hour[1]],
      changsheng: this.data.table.changsheng,
    };
    const dayun = (m.dayun || []).map(d => ({
      ganzhi: d.pillar?.length ? d.pillar.join("") : "—",
      age: `${d.age}岁 / ${d.start_year}`,
    }));
    this.setData({ pillars, table, dayun });
  },

  toggleSummary() {
    this.setData({ summaryOpen: !this.data.summaryOpen });
  },

  // 首次/重新生成解读（一次性返回 JSON）
  async onStartChat() {
    if (this.data.chatting) return;

    const cached: LastPaipan | null = wx.getStorageSync("last_paipan");
    if (!cached || !cached.mingpan) {
      wx.showToast({ title: "没有命盘数据", icon: "none" });
      return;
    }

    this.setData({ chatting: true });
    wx.showLoading({ title: this.data.conversationId ? "重新生成…" : "生成解读…" });

    try {
      const resp = await request<{ conversation_id: string; reply: string }>(
        `/chat/start?stream=0&_ts=${Date.now()}`,   // ★ 显式非流式 + 防缓存
        "POST",
        { paipan: cached.mingpan, kb_index_dir: "", kb_topk: 3 },
        { Accept: "application/json" }             // ★ 兜底
      );

      const first = (resp.reply || "").replace(/\r\n/g, "\n");
      // 清空旧消息，放入新首条
      this.setData({
        conversationId: resp.conversation_id,
        messages: [{ role: "assistant", content: first }],
      });
      this.toBottom();
    } catch (err: any) {
      wx.showToast({ title: err?.message || "启动对话失败", icon: "none" });
    } finally {
      wx.hideLoading();
      this.setData({ chatting: false });
    }
  },

  // 继续一次性对话（/chat/send?stream=0）
  async onSend() {
    const text = (this.data.inputValue || "").trim();
    if (!text) return;
    if (this.data.sending) return;
    if (!this.data.conversationId) {
      wx.showToast({ title: "请先点击上方“开始对话”", icon: "none" });
      return;
    }

    // 先落地用户消息
    const nextMsgs = [...this.data.messages, { role: "user", content: text } as Msg];
    this.setData({ messages: nextMsgs, inputValue: "", sending: true });
    this.toBottom();

    try {
      const resp = await request<{ reply: string }>(
        `/chat/send?stream=0&_ts=${Date.now()}`,     // ★ 显式非流式
        "POST",
        { conversation_id: this.data.conversationId, text },
        { Accept: "application/json" }               // ★ 兜底
      );
      const ans = (resp.reply || "").replace(/\r\n/g, "\n");
      this.setData({ messages: [...this.data.messages, { role: "assistant", content: ans }] });
      this.toBottom();
    } catch (err: any) {
      wx.showToast({ title: err?.message || "发送失败", icon: "none" });
    } finally {
      this.setData({ sending: false });
    }
  },

  toBottom() {
    this.setData({ scrollInto: "bottom-anchor" });
  },

  onInput(e: any) { this.setData({ inputValue: e.detail.value }); },
});
