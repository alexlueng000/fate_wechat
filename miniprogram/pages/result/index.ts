// pages/result/index.ts
import { request } from "../../utils/request";

// —— 安全引入 marked，并提供兜底 ——
let parseMarkdown: (md: string) => string = (md) =>
  (md || "").replace(/\r\n/g, "\n").replace(/\n/g, "<br/>");
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { marked } = require("marked");
  marked.setOptions({ gfm: true, breaks: true });
  parseMarkdown = (md: string) => (marked.parse(md || "") as string);
} catch (e) {
  console.warn("marked 加载失败，降级为纯文本换行：", e);
}

/** ========== 类型定义 ========== */
type FourPillars = {
  year: [string, string];
  month: [string, string];
  day: [string, string];
  hour: [string, string];
};
type DayunItem = { age: number; start_year: number; pillar: string[] };
type MingpanData = { four_pillars: FourPillars; dayun: DayunItem[] };
type LastPaipan = { mingpan: MingpanData } | { paipan: MingpanData }; // 兼容两种 key
type Msg = { role: "assistant" | "user"; content: string; html?: string };

type PillarsFlat = { year: string; month: string; day: string; hour: string };
type Table = { tiangan: string[]; dizhi: string[]; changsheng: string[] };

interface Data {
  pillars: PillarsFlat;
  table: Table;
  dayun: Array<{ ganzhi: string; age: string }>;
  summaryOpen: boolean;

  messages: Msg[];
  inputValue: string;
  sending: boolean;
  chatting: boolean;
  scrollInto: string;
  conversationId: string;
}

/** ========== 快捷提问 ========== */
const QUICK_MAP: Record<string, string> = {
  personality: "结合原局，用子平和盲派深度分析人物性格优势",
  avatar: "结合原局（加入性别），用子平和盲派深度分析人物画像身高体型气质动作等等",
  partner_avatar: "结合原局（加入性别），用子平和盲派深度分析正缘人物画像",
  career: "结合原局和大运流年，用子平和盲派深度分析事业方向和可执行的建议（需引导用户加上当前工作背景，如果是问学业需要强调哪些年期间读高中/大学，学业情况如何）",
  wealth: "结合原局和大运流年，用子平和盲派深度分析未来3年每年财运吉凶和可执行的建议",
  health: "结合原局和大运流年，用子平和盲派深度分析健康建议",
  love_timing: "结合原局和大运流年，用子平和盲派深度分析哪个流年应期概率最高（需要引导客户补充背景，当前单身/有对象，已婚/离异）",
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

  autoStarted: boolean;
}>({
  data: {
    pillars: { year: "", month: "", day: "", hour: "" },
    table: { tiangan: [], dizhi: [], changsheng: ["—", "—", "—", "—"] },
    dayun: [],
    summaryOpen: true,

    messages: [],
    inputValue: "",
    sending: false,
    chatting: false,
    scrollInto: "bottom-anchor",
    conversationId: "",

    autoStarted: false,
  },

  // 进页面初始化数据 + 自动触发（第一次进入触发）
  onLoad() {
    try {
      const cached: LastPaipan | null = wx.getStorageSync("last_paipan");
      const mp: MingpanData | null =
        (cached && (cached as any).mingpan) || (cached && (cached as any).paipan) || null;

      console.log("[result] onLoad, mp exists =", !!mp);

      if (!mp) {
        wx.showToast({ title: "没有结果数据", icon: "none" });
        return;
      }
      this.applyMingpan(mp);

      // 触发自动发起
      this.autoStartOnce();
    } catch (e) {
      console.error("onLoad error:", e);
      wx.showToast({ title: "页面初始化失败", icon: "none" });
    }
  },

  // 从别的页面返回到本页时，若还没自动发过，也再尝试一次
  onShow() {
    this.autoStartOnce();
  },

  // ★ 核心：只自动触发一次 /api/chat/start
  autoStartOnce() {
    if (this.data.autoStarted) return;
    if (this.data.conversationId) return;

    const cached: LastPaipan | null = wx.getStorageSync("last_paipan");
    const mp: MingpanData | null =
      (cached && (cached as any).mingpan) || (cached && (cached as any).paipan) || null;

    console.log("[result] autoStartOnce, canStart =", !!mp, "autoStarted=", this.data.autoStarted);

    if (!mp) return;

    this.setData({ autoStarted: true });

    // 用微任务更稳，避免 setTimeout/this 偶发问题
    Promise.resolve().then(() => this.onStartChat());
  },

  applyMingpan(m: MingpanData) {
    if (!m || !m.four_pillars) {
      wx.showToast({ title: "命盘数据不完整", icon: "none" });
      return;
    }
    const fp = m.four_pillars;
    const pillars = {
      year: fp.year.join(""),
      month: fp.month.join(""),
      day: fp.day.join(""),
      hour: fp.hour.join(""),
    };
    const table = {
      tiangan: [fp.year[0], fp.month[0], fp.day[0], fp.hour[0]],
      dizhi: [fp.year[1], fp.month[1], fp.day[1], fp.hour[1]],
      changsheng: this.data.table.changsheng,
    };
    const dayun = (m.dayun || []).map((d) => ({
      ganzhi: d.pillar?.length ? d.pillar.join("") : "—",
      age: `${d.age}岁 / ${d.start_year}`,
    }));
    this.setData({ pillars, table, dayun });
  },

  toggleSummary() {
    this.setData({ summaryOpen: !this.data.summaryOpen });
  },

  /** 生成/重新生成解读（一次性 JSON） */
  async onStartChat() {
    console.log("[result] onStartChat enter, chatting=", this.data.chatting);
    if (this.data.chatting) return;

    const cached: LastPaipan | null = wx.getStorageSync("last_paipan");
    const paipan: MingpanData | null =
      (cached && (cached as any).mingpan) || (cached && (cached as any).paipan) || null;

    if (!paipan) {
      wx.showToast({ title: "没有命盘数据", icon: "none" });
      return;
    }

    this.setData({ chatting: true });
    wx.showLoading({
      title: this.data.conversationId ? "重新生成…" : "生成解读…",
    });

    try {
      const payload = { paipan, kb_index_dir: "", kb_topk: 3 };
      console.log("[result] POST /api/chat/start payload =", JSON.stringify(payload));

      const resp = await request<{ conversation_id: string; reply: string }>(
        "/api/chat/start?stream=0&_ts=" + Date.now(), // ← 统一以 / 开头
        "POST",
        payload,
        { Accept: "application/json", "Content-Type": "application/json" }
      );

      const md = ((resp && resp.reply) ? resp.reply : "").replace(/\r\n/g, "\n");
      const html = parseMarkdown(md);

      this.setData({
        conversationId: resp ? resp.conversation_id : "",
        messages: [{ role: "assistant", content: md, html }],
      });
      this.toBottom();
    } catch (err) {
      console.error("chat/start error:", err);
      wx.showToast({ title: err?.message || "启动对话失败", icon: "none" });
      // 失败时允许再次自动/手动重试
      this.setData({ autoStarted: false });
    } finally {
      wx.hideLoading();
      this.setData({ chatting: false });
    }
  },

  // 输入框点击发送（复用 sendText）
  async onSend() {
    const text = (this.data.inputValue || "").trim();
    if (!text) return;
    this.setData({ inputValue: "" });
    await this.sendText(text);
  },

  // 统一滚动到底
  toBottom() {
    this.setData({ scrollInto: "bottom-anchor" });
  },

  // 快捷提问：直接发送，不写入输入框
  onQuickAsk(e: any) {
    const key = e.currentTarget?.dataset?.key as string;
    const text = QUICK_MAP[key] || "";
    if (!text) return;
    this.sendText(text);
  },

  onClearChat() {
    this.setData({ messages: [] });
    wx.showToast({ title: "已清空", icon: "none" });
  },

  onInput(e: any) {
    this.setData({ inputValue: e.detail.value });
  },

  // ① 通用发送逻辑（不影响输入框）
  async sendText(text: string) {
    const msg = (text || "").trim();
    if (!msg) return;
    if (this.data.sending) return;

    // 没有会话则先自动开启一次
    if (!this.data.conversationId) {
      await this.onStartChat();
      if (!this.data.conversationId) {
        wx.showToast({ title: "请稍后再试", icon: "none" });
        return;
      }
    }

    // 先落地用户消息
    const nextMsgs = [...this.data.messages, { role: "user", content: msg }];
    this.setData({ messages: nextMsgs, sending: true });
    this.toBottom();

    try {
      const resp = await request<{ reply: string }>(
        "/api/chat?stream=0&_ts=" + Date.now(), // ← 统一以 / 开头
        "POST",
        {
          conversation_id: this.data.conversationId,
          // 后端要求 message 对象
          message: msg,
        },
        { Accept: "application/json", "Content-Type": "application/json" }
      );

      const md = ((resp && resp.reply) ? resp.reply : "").replace(/\r\n/g, "\n");
      const html = parseMarkdown(md);
      this.setData({
        messages: [...this.data.messages, { role: "assistant", content: md, html }],
      });
      this.toBottom();
    } catch (err) {
      console.error("chat/send error:", err);
      const e: any = err as any;
      const title = e && e.message ? e.message : "发送失败";
      wx.showToast({ title, icon: "none" });
    } finally {
      this.setData({ sending: false });
    }
  },
});
