// pages/chat/chat.ts
import { API_BASE } from "../../utils/config";
import type { ChatMessage } from "../../../typings/types/message";
import { request } from "../../utils/request";

type StartResp = { conversation_id: string; reply: string };

// 每条消息：在原有 ChatMessage 上加一个 nodes 字段给 rich-text 用
interface UIMsg extends ChatMessage {
  nodes: any[];
}

interface Data {
  messages: UIMsg[];
  input: string;
  loading: boolean;
  toView: string;
  conversationId: string;
}

type Custom = {
  onInput(e: WechatMiniprogram.Input): void;
  onSend(): void;
  appendUser(text: string): void;
  appendAssistant(text: string): void;
  replaceLastAssistant(text: string): void;
  toBottom(): void;
  onQuickAsk(e: WechatMiniprogram.BaseEvent): void;
  onClear(): void;
  onStartFromChat(): void;
  autoSendPrompt(actual: string): Promise<void>;
};

const QUICK_MAP: Record<string, string> = {
  personality: "结合原局，用子平和盲派深度分析人物性格优势",
  avatar: "结合原局（加入性别），用子平和盲派深度分析人物画像身高体型气质动作等等",
  partner_avatar: "结合原局（加入性别），用子平和盲派深度分析正缘人物画像",
  career:
    "结合原局和大运流年，用子平和盲派深度分析事业方向和可执行的建议（需引导用户加上当前工作背景，如果是问学业需要强调哪些年期间读高中/大学，学业情况如何）",
  wealth: "结合原局和大运流年，用子平和盲派深度分析未来3年每年财运吉凶和可执行的建议",
  health: "结合原局和大运流年，用子平和盲派深度分析健康建议",
  love_timing:
    "结合原局和大运流年，用子平和盲派深度分析哪个流年应期概率最高（需要引导客户补充背景，当前单身/有对象，已婚/离异）",
};

function normalizeReply(text: string): string {
  if (!text) return text;

  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\u00A0/g, " ")
    .replace(/\u2002|\u2003|\u2009/g, " ")
    .split("\n")
    .map((line) =>
      line.replace(/^[\uFEFF\u3000\u00A0\u2002\u2003\u2009 \t]+/, "")
    );

  let start = 0;
  while (start < lines.length && lines[start].trim() === "") start++;
  const cleaned = lines.slice(start);

  const collapsed: string[] = [];
  for (const l of cleaned) {
    if (!l.trim()) {
      if (!collapsed.length) continue;
      if (collapsed[collapsed.length - 1] === "") continue;
      collapsed.push("");
    } else {
      collapsed.push(l);
    }
  }

  return collapsed.join("\n");
}

// ===== 内联加粗：**xxx** =====
function parseInline(str: string): any[] {
  const children: any[] = [];
  const boldRe = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = boldRe.exec(str)) !== null) {
    const idx = m.index;
    if (idx > lastIndex) {
      children.push({ type: "text", text: str.slice(lastIndex, idx) });
    }
    children.push({
      name: "strong",
      children: [{ type: "text", text: m[1] }],
    });
    lastIndex = idx + m[0].length;
  }

  if (lastIndex < str.length) {
    children.push({ type: "text", text: str.slice(lastIndex) });
  }

  if (!children.length) {
    children.push({ type: "text", text: str });
  }

  return children;
}

// ===== Markdown -> rich-text nodes =====
function formatMarkdownImpl(text: string): any[] {
  if (!text) return [];

  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const nodes: any[] = [];

  let paraBuf: string[] = [];
  let listBuf: string[] | null = null;

  const flushPara = () => {
    if (!paraBuf.length) return;
    const content = paraBuf.join(" ").trim();
    if (!content) {
      paraBuf = [];
      return;
    }
    nodes.push({
      name: "p",
      children: parseInline(content),
    });
    paraBuf = [];
  };

  const flushList = () => {
    if (!listBuf || !listBuf.length) return;
    nodes.push({
      name: "ul",
      children: listBuf.map((item) => ({
        name: "li",
        children: parseInline(item.trim()),
      })),
    });
    listBuf = null;
  };

  for (let raw of lines) {
    const line = raw.replace(/\s+$/g, "");
    const trimmed = line.trim();

    if (!trimmed) {
      flushPara();
      flushList();
      continue;
    }

    // 标题：支持前空格 & 无空格写法
    const headingMatch = trimmed.match(/^(#{1,6})\s*(.*)$/);
    if (headingMatch) {
      flushPara();
      flushList();
      const level = Math.min(headingMatch[1].length, 3);
      const tag = ("h" + level) as "h1" | "h2" | "h3";
      const content = headingMatch[2].trim();
      nodes.push({
        name: tag,
        children: parseInline(content),
      });
      continue;
    }

    // 列表
    const listMatch = trimmed.match(/^[-*+]\s+(.*)$/);
    if (listMatch) {
      flushPara();
      if (!listBuf) listBuf = [];
      listBuf.push(listMatch[1]);
      continue;
    }

    // 普通段落
    paraBuf.push(trimmed);
  }

  flushPara();
  flushList();

  return nodes;
}

// ========== Page ==========
const options: WechatMiniprogram.Page.Options<Data, Custom> = {
  data: {
    messages: [] as UIMsg[],
    input: "",
    loading: false,
    toView: "end",
    conversationId: "",
  },

  onLoad(options) {
    // 开场白
    this.appendAssistant(
      "你好呀～（微笑）\n" +
        "我不是来剧透你人生的编剧，只是帮你找找藏在命盘里的小彩蛋——可能是你还没发现的潜力，或是未来路上悄悄亮起的路灯（✨）\n" +
        "毕竟你才是人生的主角，我嘛…只是个带地图的导游～（轻松摊手）\n" +
        "准备好一起逛逛你的‘人生剧本杀’了吗？放心，不用怕泄露天机，我今天的‘仙气’储备充足！"
    );

    let injected = false;

    const ec = (this as any).getOpenerEventChannel?.();
    if (ec && ec.on) {
      ec.on("startData", (payload: { cid?: string; reply?: string }) => {
        if (payload?.cid) {
          this.setData({ conversationId: payload.cid });
          wx.setStorageSync("conversation_id", payload.cid);
        }
        if (!injected && payload?.reply) {
          this.appendAssistant(payload.reply);
          injected = true;
        }
        wx.removeStorageSync("start_reply");
      });
    }

    if (!injected) {
      const boot = (wx.getStorageSync("start_reply") as string) || "";
      if (boot) {
        this.appendAssistant(boot);
        injected = true;
        wx.removeStorageSync("start_reply");
      }
    }

    const qCid = (options as any)?.cid ? String((options as any).cid) : "";
    if (qCid) {
      this.setData({ conversationId: qCid });
      wx.setStorageSync("conversation_id", qCid);
    } else if (!this.data.conversationId) {
      const saved = (wx.getStorageSync("conversation_id") as string) || "";
      if (saved) this.setData({ conversationId: saved });
    }
  },

  onInput(e) {
    const val = (e.detail as any).value as string;
    this.setData({ input: val });
  },

  toBottom() {
    this.setData({ toView: "end" });
  },

  appendUser(text) {
    const msg: UIMsg = {
      role: "user",
      content: text,
      nodes: formatMarkdownImpl(text),
    } as any;
    const msgs = this.data.messages.concat(msg);
    this.setData({ messages: msgs }, () => this.toBottom());
  },

  appendAssistant(text) {
    const clean = normalizeReply(text);
    const msg: UIMsg = {
      role: "assistant",
      content: clean,
      nodes: formatMarkdownImpl(clean),
    } as any;
    const msgs = this.data.messages.concat(msg);
    this.setData({ messages: msgs }, () => this.toBottom());
  },

  replaceLastAssistant(text) {
    const clean = normalizeReply(text);
    const msgs = this.data.messages.slice();
    const node = formatMarkdownImpl(clean);

    if (msgs.length && msgs[msgs.length - 1].role === "assistant") {
      msgs[msgs.length - 1].content = clean;
      (msgs[msgs.length - 1] as any).nodes = node;
    } else {
      msgs.push({
        role: "assistant",
        content: clean,
        nodes: node,
      } as any);
    }
    this.setData({ messages: msgs }, () => this.toBottom());
  },

  onQuickAsk(e: WechatMiniprogram.BaseEvent) {
    const ds: any = e?.currentTarget?.dataset || {};
    const key: string = String(ds.key || "");
    const label: string = String(ds.label || ds.text || "提问");

    if (!this.data.conversationId) {
      wx.showToast({ title: "请先开始对话", icon: "none" });
      return;
    }
    if (this.data.loading) return;

    this.appendUser(label);

    const actual = QUICK_MAP[key] || label;
    this.autoSendPrompt(actual);
  },

  async autoSendPrompt(actual: string) {
    this.setData({ loading: true });
    this.appendAssistant("思考中…");

    try {
      const resp = await request<{ reply: string }>(
        "/api/chat?stream=0&_ts=" + Date.now(),
        "POST",
        { conversation_id: this.data.conversationId, message: actual },
        { Accept: "application/json" }
      );
      const reply = normalizeReply((resp?.reply || "").replace(/\r\n/g, "\n"));
      this.replaceLastAssistant(reply);
      console.log("raw reply:", JSON.stringify(reply));
      this.setData({ toView: "end" });
    } catch (err) {
      this.replaceLastAssistant("网络似乎有点慢，稍后再试～");
    } finally {
      this.setData({ loading: false });
    }
  },

  onClear() {
    this.setData({ messages: [] });
    wx.showToast({ title: "已清空", icon: "none" });
    this.toBottom();
  },

  onStartFromChat() {
    if (this.data.loading) return;

    const cached: any = wx.getStorageSync("last_paipan");
    if (!cached || !cached.mingpan) {
      wx.showToast({ title: "没有命盘数据", icon: "none" });
      return;
    }

    this.setData({ loading: true });
    wx.showLoading({ title: "生成解读…" });

    request<StartResp>(
      "/chat/start?stream=0&_ts=" + Date.now(),
      "POST",
      { paipan: cached.mingpan, kb_index_dir: "", kb_topk: 3 },
      { Accept: "application/json" }
    )
      .then((resp) => {
        wx.setStorageSync("conversation_id", resp.conversation_id);
        this.setData({ conversationId: resp.conversation_id as any });

        const reply = normalizeReply(resp.reply || "（无响应）");
        this.appendAssistant(reply);
      })
      .catch((err: any) => {
        wx.showToast({ title: err?.message || "启动失败", icon: "none" });
      })
      .finally(() => {
        this.setData({ loading: false }, () => this.toBottom());
        wx.hideLoading();
      });
  },

  onSend() {
    const text = this.data.input.trim();
    if (!text || this.data.loading) return;

    const cid =
      this.data.conversationId ||
      ((wx.getStorageSync("conversation_id") as string) || "");
    if (!cid) {
      wx.showToast({ title: "请先在排盘页点击“开始对话”", icon: "none" });
      return;
    }

    this.setData({ input: "", loading: true });
    this.appendUser(text);
    this.appendAssistant("思考中…");

    const url = `${API_BASE}/api/chat?stream=0&_ts=${Date.now()}`;
    const payload = { conversation_id: cid, message: text };

    console.log("[chat] POST", url, payload);

    wx.request<{ reply: string }>({
      url,
      method: "POST",
      header: {
        "content-type": "application/json",
        Accept: "application/json",
      },
      data: payload,
      timeout: 15000,
      success: (res) => {
        const { statusCode } = res;
        if (statusCode >= 200 && statusCode < 300) {
          const raw =
            res.data && typeof (res.data as any).reply === "string"
              ? (res.data as any).reply
              : "（无响应）";
          const reply = normalizeReply(raw);
          this.replaceLastAssistant(reply);
          console.log("raw reply:", JSON.stringify(raw));
        } else {
          const msg =
            (res.data as any)?.detail?.[0]?.msg ||
            (res.data as any)?.detail ||
            `HTTP ${statusCode}`;
          this.replaceLastAssistant(`服务端错误：${msg}`);
        }
      },
      fail: (err) => {
        console.warn("[chat] request fail:", err);
        this.replaceLastAssistant("网络连接失败，请稍后再试。");
      },
      complete: () =>
        this.setData({ loading: false }, () => this.toBottom()),
    });
  },
};

Page<Data, Custom>(options);
