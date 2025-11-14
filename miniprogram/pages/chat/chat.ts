// pages/chat/chat.ts
import { API_BASE } from "../../utils/config";
import type { ChatMessage } from "../../../typings/types/message";
import { request } from "../../utils/request";

// 启动解读接口返回
type StartResp = { conversation_id: string; reply: string };

// --------- Page 的 data 类型 ----------
interface Data {
  messages: ChatMessage[];
  input: string;
  loading: boolean;
  toView: string;          // 用于滚动到底部
  conversationId: string;  // 当前会话 id
}

// --------- 自定义方法类型 ----------
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
  formatMarkdown(text: string): any[];
};

// --------- 快捷问法映射 ----------
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

// 简单把 Markdown 语法清洗掉，变成正常段落
function normalizeReply(text: string): string {
  if (!text) return text;
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => {
      let s = line.trim();
      if (!s) return "";

      // 标题
      if (s.startsWith("### ")) return s.slice(4);
      if (s.startsWith("## ")) return s.slice(3);
      if (s.startsWith("# ")) return s.slice(2);

      // 列表项
      if (s.startsWith("- #### ")) return "• " + s.slice(7);
      if (s.startsWith("- ### ")) return "• " + s.slice(6);
      if (s.startsWith("- ")) return "• " + s.slice(2);

      return s;
    })
    .join("\n");
}


// --------- Markdown -> rich-text 的简单转换 ----------
const formatMarkdownImpl = (text: string): any[] => {
  if (!text) return [];

  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n/g, "<br/>")
    .replace(/### (.*?)<br\/>/g, "<h2>$1</h2>")
    .replace(/## (.*?)<br\/>/g, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .split("<br/>")
    .map((p) => ({
      name: "p",
      children: [{ type: "text", text: p }],
    }));
};

/** Page 配置 —— 注意泛型顺序：Options<Data, Custom> */
const options: WechatMiniprogram.Page.Options<Data, Custom> = {
  data: {
    messages: [] as ChatMessage[],
    input: "",
    loading: false,
    toView: "end",
    conversationId: "",
  },

  // 让 WXML 能直接用 formatMarkdown(msg.content)
  formatMarkdown(text: string) {
    return formatMarkdownImpl(text);
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

    // 1) eventChannel 带过来的启动解读
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

    // 2) 兜底：从 storage 兜启动解读
    if (!injected) {
      const boot = (wx.getStorageSync("start_reply") as string) || "";
      if (boot) {
        this.appendAssistant(boot);
        injected = true;
        wx.removeStorageSync("start_reply");
      }
    }

    // 3) URL ?cid= 场景
    const qCid = (options as any)?.cid ? String((options as any).cid) : "";
    if (qCid) {
      this.setData({ conversationId: qCid });
      wx.setStorageSync("conversation_id", qCid);
    } else if (!this.data.conversationId) {
      const saved = (wx.getStorageSync("conversation_id") as string) || "";
      if (saved) this.setData({ conversationId: saved });
    }
  },

  /** 输入框 */
  onInput(e) {
    const val = (e.detail as any).value as string;
    this.setData({ input: val });
  },

  /** 滚到底部 */
  toBottom() {
    this.setData({ toView: "end" });
  },

  /** 追加用户消息 */
  appendUser(text) {
    const msgs = this.data.messages.concat([{ role: "user", content: text }]);
    this.setData({ messages: msgs }, this.toBottom);
  },

  /** 追加助手消息 */
  appendAssistant(text) {
    const clean = normalizeReply(text);
    const msgs = this.data.messages.concat([{ role: "assistant", content: clean }]);
    this.setData({ messages: msgs }, this.toBottom);
  },

  /** 替换最后一条助手消息（或追加） */
  replaceLastAssistant(text) {
    const clean = normalizeReply(text);
    const msgs = this.data.messages.slice();
    if (msgs.length && msgs[msgs.length - 1].role === "assistant") {
      msgs[msgs.length - 1].content = clean;
    } else {
      msgs.push({ role: "assistant", content: clean });
    }
    this.setData({ messages: msgs }, this.toBottom);
  },
  /** 快捷按钮：显示 label，发送映射 prompt */
  onQuickAsk(e: WechatMiniprogram.BaseEvent) {
    const ds: any = e?.currentTarget?.dataset || {};
    const key: string = String(ds.key || "");
    const label: string = String(ds.label || ds.text || "提问");

    if (!this.data.conversationId) {
      wx.showToast({ title: "请先开始对话", icon: "none" });
      return;
    }
    if (this.data.loading) return;

    // 界面展示：按钮文案
    this.appendUser(label);

    const actual = QUICK_MAP[key] || label;
    this.autoSendPrompt(actual);
  },

  /** 复用发送流程：用真实 prompt 调用 /chat ，不显示在界面里 */
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
      this.setData({ toView: "end" });
    } catch (err) {
      this.replaceLastAssistant("网络似乎有点慢，稍后再试～");
    } finally {
      this.setData({ loading: false });
    }
  },

  /** 清空对话 */
  onClear() {
    this.setData({ messages: [] });
    wx.showToast({ title: "已清空", icon: "none" });
    this.toBottom();
  },

  /** 从 chat 页重新触发一次 start_chat（一般用不到，只是兜底） */
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
        this.setData({ loading: false }, this.toBottom);
        wx.hideLoading();
      });
  },

  /** 普通输入发送 */
  onSend() {
    const text = this.data.input.trim();
    if (!text || this.data.loading) return;

    const cid = this.data.conversationId || (wx.getStorageSync("conversation_id") as string) || "";
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
      header: { "content-type": "application/json", Accept: "application/json" },
      data: payload,
      timeout: 15000,
      success: (res) => {
        const { statusCode } = res;
        if (statusCode >= 200 && statusCode < 300) {
          const raw =
            (res.data && typeof (res.data as any).reply === "string")
              ? (res.data as any).reply
              : "（无响应）";
          const reply = normalizeReply(raw);
          this.replaceLastAssistant(reply);
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
      complete: () => this.setData({ loading: false }, this.toBottom),
    });
  },
};

Page<Data, Custom>(options);
