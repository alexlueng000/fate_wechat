// pages/result/index.ts
import { request } from "../../utils/request";

/** ========== marked 安全加载，失败则降级为换行 ========== */
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
type LastPaipan = { mingpan: MingpanData };
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
  personality: "请基于我的八字概述性格优点、潜在短板，并给出改进建议。",
  avatar: "请用三五句话写出我的人物画像（气质、处事风格、优势场景）。",
  partner_avatar: "我的正缘大致是什么样的人？性格特征与相处建议有哪些？",
  career: "根据命盘，适合的发展赛道与三条行动建议？",
  wealth: "未来一年在偏财/正财方面的趋势如何？给出两条风险提示。",
  health: "需要重点关注的健康方向是什么？给出作息/饮食建议三条。",
  love_timing: "近期（未来12个月）与感情相关的关键时间点与建议。",
};

/** ========== 页面定义 ========== */
Page<Data>({
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
    const fp = m && m.four_pillars ? m.four_pillars : {
      year: ["", ""],
      month: ["", ""],
      day: ["", ""],
      hour: ["", ""],
    };

    const y = Array.isArray(fp.year) ? fp.year : ["", ""];
    const mo = Array.isArray(fp.month) ? fp.month : ["", ""];
    const d = Array.isArray(fp.day) ? fp.day : ["", ""];
    const h = Array.isArray(fp.hour) ? fp.hour : ["", ""];

    const pillars: PillarsFlat = {
      year: y.join(""),
      month: mo.join(""),
      day: d.join(""),
      hour: h.join(""),
    };

    const table: Table = {
      tiangan: [y[0], mo[0], d[0], h[0]],
      dizhi: [y[1], mo[1], d[1], h[1]],
      changsheng:
        this.data && this.data.table && Array.isArray(this.data.table.changsheng)
          ? this.data.table.changsheng
          : [],
    };

    const dayunSrc: DayunItem[] = Array.isArray(m.dayun) ? m.dayun : [];
    const dayun = dayunSrc.map(function (item) {
      const p = item && Array.isArray(item.pillar) ? item.pillar : null;
      const hasP = p && p.length > 0;
      const ageStr =
        (item && item.age != null ? String(item.age) : "") +
        "岁 / " +
        (item && item.start_year != null ? String(item.start_year) : "");
      return {
        ganzhi: hasP ? p!.join("") : "—",
        age: ageStr,
      };
    });

    this.setData({ pillars, table, dayun });
  },

  toggleSummary() {
    this.setData({ summaryOpen: !this.data.summaryOpen });
  },

  /** 生成/重新生成解读（一次性 JSON） */
  async onStartChat() {
    if (this.data.chatting) return;

    const cached: LastPaipan | null = wx.getStorageSync("last_paipan");
    if (!cached || !cached.mingpan) {
      wx.showToast({ title: "没有命盘数据", icon: "none" });
      return;
    }

    this.setData({ chatting: true });
    wx.showLoading({
      title: this.data.conversationId ? "重新生成…" : "生成解读…",
    });

    try {
      const resp = await request<{ conversation_id: string; reply: string }>(
        "/chat/start?stream=0&_ts=" + Date.now(),
        "POST",
        { paipan: cached.mingpan, kb_index_dir: "", kb_topk: 3 },
        { Accept: "application/json" }
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
      const anyErr: any = err as any;
      const title =
        anyErr && anyErr.message ? anyErr.message : "启动对话失败";
      wx.showToast({ title, icon: "none" });
    } finally {
      wx.hideLoading();
      this.setData({ chatting: false });
    }
  },

  /** 继续一次性对话 */
  async onSend() {
    const text = (this.data.inputValue || "").trim();
    if (!text) return;
    if (this.data.sending) return;
    if (!this.data.conversationId) {
      wx.showToast({ title: "请先点击上方“开始对话”", icon: "none" });
      return;
    }

    const nextMsgs = [
      ...this.data.messages,
      { role: "user", content: text } as Msg,
    ];
    this.setData({ messages: nextMsgs, inputValue: "", sending: true });
    this.toBottom();

    try {
      const resp = await request<{ reply: string }>(
        "/chat/send?stream=0&_ts=" + Date.now(),
        "POST",
        { conversation_id: this.data.conversationId, text },
        { Accept: "application/json" }
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

  toBottom() {
    this.setData({ scrollInto: "bottom-anchor" });
  },

  onQuickAsk(e: any) {
    const ds =
      e && e.currentTarget && e.currentTarget.dataset
        ? e.currentTarget.dataset
        : {};
    const key: string = ds && (ds as any).key != null ? String((ds as any).key) : "";
    const text = QUICK_MAP && QUICK_MAP[key] ? QUICK_MAP[key] : "";
    if (!text) return;
    this.setData({ inputValue: text });
    // this.onSend();
  },

  onClearChat() {
    this.setData({ messages: [] });
    wx.showToast({ title: "已清空", icon: "none" });
  },

  onInput(e: any) {
    this.setData({ inputValue: e && e.detail ? e.detail.value : "" });
  },
});
