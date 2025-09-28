// pages/result/index.ts
import { request } from "../../utils/request";

// —— 安全引入 marked，并提供兜底 ——
// 有些项目没构建 NPM 或打包异常会导致 import 失败，我们用 try/catch 兜底为“纯文本换行”
let parseMarkdown: (md: string) => string = (md) =>
  md.replace(/\r\n/g, "\n").replace(/\n/g, "<br/>");

try {
  // 构建了 NPM 的正常路径
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { marked } = require("marked");
  marked.setOptions({ gfm: true, breaks: true });
  parseMarkdown = (md: string) => marked.parse(md || "") as string;
} catch (e) {
  console.warn("marked 加载失败，降级为纯文本换行：", e);
}

type FourPillars = {
  year: [string, string];
  month: [string, string];
  day: [string, string];
  hour: [string, string];
};
type DayunItem = { age: number; start_year: number; pillar: string[] };
type MingpanData = { four_pillars: FourPillars; dayun: DayunItem[] };
type LastPaipan = { mingpan: MingpanData };
type Msg = { role: "assistant" | "user"; content: string; html?: string };

const QUICK_MAP: Record<string, string> = {
  personality: "请基于我的八字概述性格优点、潜在短板，并给出改进建议。",
  avatar: "请用三五句话写出我的人物画像（气质、处事风格、优势场景）。",
  partner_avatar: "我的正缘大致是什么样的人？性格特征与相处建议有哪些？",
  career: "根据命盘，适合的发展赛道与三条行动建议？",
  wealth: "未来一年在偏财/正财方面的趋势如何？给出两条风险提示。",
  health: "需要重点关注的健康方向是什么？给出作息/饮食建议三条。",
  love_timing: "近期（未来12个月）与感情相关的关键时间点与建议。",
};

Page<Record<string, any>, {
  pillars: { year: string; month: string; day: string; hour: string };
  table: { tiangan: string[]; dizhi: string[]; changsheng: string[] };
  dayun: Array<{ ganzhi: string; age: string }>;
  summaryOpen: boolean;

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
    summaryOpen: true,

    messages: [],
    inputValue: "",
    sending: false,
    chatting: false,
    scrollInto: "bottom-anchor",
    conversationId: "",
  },

  onLoad() {
    try {
      const cached: LastPaipan | null = wx.getStorageSync("last_paipan");
      if (!cached || !cached.mingpan) {
        wx.showToast({ title: "没有结果数据", icon: "none" });
        return;
      }
      this.applyMingpan(cached.mingpan);
    } catch (e) {
      console.error("onLoad error:", e);
      wx.showToast({ title: "页面初始化失败", icon: "none" });
    }
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

  // 生成/重新生成解读（一次性 JSON）
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
        `/chat/start?stream=0&_ts=${Date.now()}`,
        "POST",
        { paipan: cached.mingpan, kb_index_dir: "", kb_topk: 3 },
        { Accept: "application/json" }
      );

      const md = (resp.reply || "").replace(/\r\n/g, "\n");
      const html = parseMarkdown(md);

      this.setData({
        conversationId: resp.conversation_id,
        messages: [{ role: "assistant", content: md, html }],
      });
      this.toBottom();
    } catch (err: any) {
      console.error("chat/start error:", err);
      wx.showToast({ title: err?.message || "启动对话失败", icon: "none" });
    } finally {
      wx.hideLoading();
      this.setData({ chatting: false });
    }
  },

  // 继续一次性对话
  async onSend() {
    const text = (this.data.inputValue || "").trim();
    if (!text) return;
    if (this.data.sending) return;
    if (!this.data.conversationId) {
      wx.showToast({ title: "请先点击上方“开始对话”", icon: "none" });
      return;
    }

    // 先落地用户消息（纯文本）
    const nextMsgs = [...this.data.messages, { role: "user", content: text } as Msg];
    this.setData({ messages: nextMsgs, inputValue: "", sending: true });
    this.toBottom();

    try {
      const resp = await request<{ reply: string }>(
        `/chat/send?stream=0&_ts=${Date.now()}`,
        "POST",
        { conversation_id: this.data.conversationId, text },
        { Accept: "application/json" }
      );

      const md = (resp.reply || "").replace(/\r\n/g, "\n");
      const html = parseMarkdown(md);

      this.setData({
        messages: [...this.data.messages, { role: "assistant", content: md, html }],
      });
      this.toBottom();
    } catch (err: any) {
      console.error("chat/send error:", err);
      wx.showToast({ title: err?.message || "发送失败", icon: "none" });
    } finally {
      this.setData({ sending: false });
    }
  },

  toBottom() {
    this.setData({ scrollInto: "bottom-anchor" });
  },

  onQuickAsk(e: any) {
    const key = e.currentTarget?.dataset?.key as string;
    const text = QUICK_MAP[key] || "";
    if (!text) return;
    this.setData({ inputValue: text });
    // 如果想点击即发送，取消下行注释：
    // this.onSend();
  },
  
  onClearChat() {
    this.setData({ messages: [] });
    wx.showToast({ title: "已清空", icon: "none" });
  },

  onInput(e: any) { this.setData({ inputValue: e.detail.value }); },
});
