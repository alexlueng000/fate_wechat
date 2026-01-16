// pages/chat/chat.ts
import type { ChatMessage } from "../../../typings/types/message";
import { request } from "../../utils/request";
import { ChatWebSocket } from "../../utils/websocket";
import { WS_BASE } from "../../utils/config";

type StartResp = { conversation_id: string; reply: string };

// 模块级标志：防止自动启动重复执行（不受 setData 异步影响）
let _hasAutoStarted = false;

// 每条消息：在原有 ChatMessage 上加一个 nodes 字段给 rich-text 用
interface UIMsg extends ChatMessage {
  nodes: any[];
  truncated?: boolean;
  fullContent?: string;
  isGreeting?: boolean;
}

interface Data {
  messages: UIMsg[];
  input: string;
  loading: boolean;
  toView: string;
  conversationId: string;
  isLoggedIn: boolean;
  // 引导卡片和自动启动相关状态
  showGuideCard: boolean;
  hasPaipan: boolean;
  autoStarted: boolean;
  // 流式响应相关
  streamingText: string;
}

type Custom = {
  onInput(e: WechatMiniprogram.Input): void;
  onSend(): void;
  appendUser(text: string): void;
  appendAssistant(text: string, isGreeting?: boolean): void;
  replaceLastAssistant(text: string, isGreeting?: boolean): void;
  toBottom(): void;
  onQuickAsk(e: WechatMiniprogram.BaseEvent): void;
  onQuickStart(): void;
  onClear(): void;
  onGoToResult(): void;
  onStartFromChat(): void;
  autoSendPrompt(actual: string): Promise<void>;
  onShowBaziDialog(): void;
  onBaziDialogClose(): void;
  truncateContent(content: string): string;
  onUnlockMessage(e: WechatMiniprogram.BaseEvent): void;
  onLoginSuccess(e: any): void;
  checkLoginStatus(): void;
  // 新增方法
  checkAndAutoStart(): void;
  onGoToPaipan(): void;
  onShowHistory(): void;
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

// ===== 内联加粗：**xxx** 和 【xxx】 =====
function parseInline(str: string): any[] {
  const children: any[] = [];
  // 匹配 **bold**、【bracketed】、〖warning〗、《info》
  const boldRe = /\*\*(.+?)\*\*/g;
  const bracketRe = /【(.+?)】/g;
  const warningRe = /〖(.+?)〗/g;
  const infoRe = /《(.+?)》/g;

  // 先处理【】
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  // 收集所有标记位置
  const markers: { index: number; end: number; type: "bold" | "bracket" | "warning" | "info"; content: string }[] = [];

  while ((m = boldRe.exec(str)) !== null) {
    markers.push({ index: m.index, end: m.index + m[0].length, type: "bold", content: m[1] });
  }
  boldRe.lastIndex = 0;

  while ((m = bracketRe.exec(str)) !== null) {
    markers.push({ index: m.index, end: m.index + m[0].length, type: "bracket", content: m[1] });
  }
  bracketRe.lastIndex = 0;

  while ((m = warningRe.exec(str)) !== null) {
    markers.push({ index: m.index, end: m.index + m[0].length, type: "warning", content: m[1] });
  }
  warningRe.lastIndex = 0;

  while ((m = infoRe.exec(str)) !== null) {
    markers.push({ index: m.index, end: m.index + m[0].length, type: "info", content: m[1] });
  }
  infoRe.lastIndex = 0;

  // 按位置排序
  markers.sort((a, b) => a.index - b.index);

  // 构建节点
  lastIndex = 0;
  for (const mark of markers) {
    if (mark.index < lastIndex) continue; // 跳过嵌套

    // 添加前面的普通文本
    if (mark.index > lastIndex) {
      children.push({ type: "text", text: str.slice(lastIndex, mark.index) });
    }

    // 添加标记内容
    if (mark.type === "bold") {
      children.push({
        name: "strong",
        children: [{ type: "text", text: mark.content }],
      });
    } else if (mark.type === "bracket") {
      // 【xxx】红色强调
      children.push({
        name: "span",
        attrs: { class: "highlight" },
        children: [{ type: "text", text: mark.content }],
      });
    } else if (mark.type === "warning") {
      // 〖xxx〗橙色强调
      children.push({
        name: "span",
        attrs: { class: "highlight-warning" },
        children: [{ type: "text", text: mark.content }],
      });
    } else if (mark.type === "info") {
      // 《xxx》蓝色强调
      children.push({
        name: "span",
        attrs: { class: "highlight-info" },
        children: [{ type: "text", text: mark.content }],
      });
    }
    lastIndex = mark.end;
  }

  // 添加剩余文本
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

    // 列表：支持 - * + 和数字列表
    const listMatch = trimmed.match(/^[-*+]\s+(.*)$/);
    const numListMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (listMatch || numListMatch) {
      flushPara();
      if (!listBuf) listBuf = [];
      listBuf.push((listMatch || numListMatch)![1]);
      continue;
    }

    // 普通段落：先清空列表缓冲区
    flushList();
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
    isLoggedIn: false,
    // 引导卡片和自动启动相关状态
    showGuideCard: false,
    hasPaipan: false,
    autoStarted: false,
    // 流式响应相关
    streamingText: "",
  },

  onLoad(options) {
    // 重置自动启动标志（允许页面重新加载时重新检查）
    _hasAutoStarted = false;

    // 检查登录状态
    this.checkLoginStatus();
    // 开场白 - 不截断
    const greetingText =
      "你好呀～我不是来剧透人生的，只是帮你找找藏在命盘里的小彩蛋。" +
      "你才是主角，我只是个带地图的导游。准备好了吗？一起逛逛你的'人生剧本'～";



    const cleanGreeting = normalizeReply(greetingText);
    const msg: UIMsg = {
      role: "assistant",
      content: cleanGreeting,
      nodes: formatMarkdownImpl(cleanGreeting),
      isGreeting: true,
    } as any;
    this.setData({ messages: [msg] });

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

    // 检查命盘数据并自动启动或显示引导卡片
    this.checkAndAutoStart();
  },

  onShow() {
    // 每次页面显示时检查登录状态（从登录页返回时会触发）
    const wasLoggedIn = this.data.isLoggedIn;
    this.checkLoginStatus();

    // 如果刚刚登录，展开所有被截断的消息
    if (!wasLoggedIn && this.data.isLoggedIn) {
      const hasTruncated = this.data.messages.some(m => m.truncated);
      if (hasTruncated) {
        const msgs = this.data.messages.map(msg => {
          if (msg.truncated && msg.fullContent) {
            return {
              ...msg,
              content: msg.fullContent,
              truncated: false,
              nodes: formatMarkdownImpl(msg.fullContent),
            };
          }
          return msg;
        });
        this.setData({ messages: msgs });
      }
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

  appendAssistant(text, isGreeting = false) {
    const clean = normalizeReply(text);
    const isLoggedIn = this.data.isLoggedIn;

    // 如果是开场白或已登录，不截断
    let displayContent = clean;
    let isTruncated = false;
    if (!isGreeting && !isLoggedIn && clean.length > 50) {
      displayContent = clean.slice(0, Math.floor(clean.length * 0.5));
      isTruncated = true;
    }

    const msg: UIMsg = {
      role: "assistant",
      content: displayContent,
      fullContent: isTruncated ? clean : undefined,
      truncated: isTruncated,
      isGreeting: isGreeting,
      nodes: formatMarkdownImpl(displayContent),
    } as any;
    const msgs = this.data.messages.concat(msg);
    this.setData({ messages: msgs }, () => this.toBottom());
  },

  replaceLastAssistant(text, isGreeting = false) {
    const clean = normalizeReply(text);
    const msgs = this.data.messages.slice();
    const isLoggedIn = this.data.isLoggedIn;

    // 如果是开场白或已登录，不截断
    let displayContent = clean;
    let isTruncated = false;
    if (!isGreeting && !isLoggedIn && clean.length > 50) {
      displayContent = clean.slice(0, Math.floor(clean.length * 0.5));
      isTruncated = true;
    }

    const node = formatMarkdownImpl(displayContent);

    if (msgs.length && msgs[msgs.length - 1].role === "assistant") {
      msgs[msgs.length - 1].content = displayContent;
      msgs[msgs.length - 1].fullContent = isTruncated ? clean : undefined;
      msgs[msgs.length - 1].truncated = isTruncated;
      (msgs[msgs.length - 1] as any).nodes = node;
    } else {
      msgs.push({
        role: "assistant",
        content: displayContent,
        fullContent: isTruncated ? clean : undefined,
        truncated: isTruncated,
        isGreeting: isGreeting,
        nodes: node,
      } as any);
    }
    this.setData({ messages: msgs }, () => this.toBottom());
  },

  onQuickStart() {
    if (this.data.loading) return;

    const cached: any = wx.getStorageSync("last_paipan");
    if (!cached || !cached.mingpan) {
      wx.showToast({ title: "请先在排盘页生成命盘", icon: "none" });
      return;
    }

    const form: any = wx.getStorageSync("last_form") || {};
    const gender = form.gender || "男";
    const paipan = { ...cached.mingpan, gender };

    this.setData({ loading: true, streamingText: "" });
    this.appendUser("命盘分析");
    this.appendAssistant("思考中…");

    // 使用 WebSocket 流式响应
    const ws = new ChatWebSocket(
      `${WS_BASE}/chat`,
      (data) => {
        // 处理 meta 事件
        if (data.meta?.conversation_id) {
          wx.setStorageSync("conversation_id", data.meta.conversation_id);
          this.setData({ conversationId: data.meta.conversation_id as any });
          return;
        }

        // 处理 text 事件（增量更新）
        if (data.text) {
          // 后端 send replace: true 表示发送的是累积文本，直接替换；否则累加
          const displayText = (data as any).replace === true
            ? data.text
            : this.data.streamingText + data.text;

          this.setData({ streamingText: displayText });
          this.replaceLastAssistant(displayText);
          this.toBottom();
        }
      },
      () => {
        // 流式完成
        this.setData({ loading: false, streamingText: "" });
        this.toBottom();
      },
      (err: any) => {
        console.error("Quick start failed", err);
        this.replaceLastAssistant("生成失败，请稍后再试");
        this.setData({ loading: false, streamingText: "" });
      }
    );

    ws.connect({
      action: "start",
      paipan: paipan,
      kb_index_dir: "",
      kb_topk: 3,
    });
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
    this.setData({ loading: true, streamingText: "" });
    this.appendAssistant("思考中…");

    // 使用 WebSocket 流式响应
    const ws = new ChatWebSocket(
      `${WS_BASE}/chat`,
      (data) => {
        // 处理 text 事件（增量更新）
        if (data.text) {
          // 后端 send replace: true 表示发送的是累积文本，直接替换；否则累加
          const displayText = (data as any).replace === true
            ? data.text
            : this.data.streamingText + data.text;

          this.setData({ streamingText: displayText });
          this.replaceLastAssistant(displayText);
          this.toBottom();
        }
      },
      () => {
        // 流式完成
        this.setData({ loading: false, streamingText: "" });
        this.toBottom();
      },
      (err) => {
        console.error("[WebSocket] error:", err);
        this.replaceLastAssistant("网络似乎有点慢，稍后再试～");
        this.setData({ loading: false, streamingText: "" });
      }
    );

    ws.connect({
      action: "send",
      conversation_id: this.data.conversationId,
      message: actual,
    });
  },

  onClear() {
    wx.showModal({
      title: "清空对话",
      content: "确定要清空当前对话记录吗？清空后需要重新开始对话。",
      confirmText: "清空",
      confirmColor: "#b83227",
      success: (res) => {
        if (!res.confirm) return;

        // 清空消息
        this.setData({ messages: [] });

        // 清空会话ID
        this.setData({ conversationId: "" });
        try {
          wx.removeStorageSync("conversation_id");
        } catch (e) {}

        // 重置自动启动标志，允许下次进入时自动启动
        _hasAutoStarted = false;
        try {
          wx.removeStorageSync("last_start_date");
        } catch (e) {}

        // 重新显示开场白
        const greetingText =
          "你好呀～我不是来剧透人生的，只是帮你找找藏在命盘里的小彩蛋。" +
          "你才是主角，我只是个带地图的导游。准备好了吗？一起逛逛你的'人生剧本'～";
        this.appendAssistant(greetingText, true);

        wx.showToast({ title: "已清空", icon: "none" });
      },
    });
  },

  onGoToResult() {
    const cached: any = wx.getStorageSync("last_paipan");
    if (!cached || !cached.mingpan) {
      wx.showToast({ title: "请先在排盘页生成命盘", icon: "none" });
      return;
    }
    wx.navigateTo({ url: "/pages/result/index" });
  },

  onShowFormatGuide() {
    wx.showModal({
      title: "Markdown格式说明",
      content:
        "AI回复支持以下格式:\n\n" +
        "【重要】- 红色强调\n" +
        "〖注意〗- 橙色强调\n" +
        "《参考》- 蓝色强调\n\n" +
        "## 主标题\n" +
        "### 次标题\n" +
        "#### 三级标题\n\n" +
        "**粗体** *斜体*",
      showCancel: false,
      confirmText: "知道了"
    });
  },

  onStartFromChat() {
    if (this.data.loading) return;

    const cached: any = wx.getStorageSync("last_paipan");
    if (!cached || !cached.mingpan) {
      wx.showToast({ title: "没有命盘数据", icon: "none" });
      return;
    }

    const form: any = wx.getStorageSync("last_form") || {};
    const gender = form.gender || "男";
    const paipan = { ...cached.mingpan, gender };

    this.setData({ loading: true });
    wx.showLoading({ title: "生成解读…" });

    request<StartResp>(
      "/chat/start?stream=0&_ts=" + Date.now(),
      "POST",
      { paipan, kb_index_dir: "", kb_topk: 3 },
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
      wx.showToast({ title: "请先在排盘页点击「开始对话」", icon: "none" });
      return;
    }

    this.setData({ input: "", loading: true, streamingText: "" });
    this.appendUser(text);
    this.appendAssistant("思考中…");

    // 使用 WebSocket 流式响应
    const ws = new ChatWebSocket(
      `${WS_BASE}/chat`,
      (data) => {
        // 处理 meta 事件
        if (data.meta?.conversation_id) {
          wx.setStorageSync("conversation_id", data.meta.conversation_id);
          this.setData({ conversationId: data.meta.conversation_id as any });
          return;
        }

        // 处理 text 事件（增量更新）
        if (data.text) {
          // 后端 send replace: true 表示发送的是累积文本，直接替换；否则累加
          const displayText = (data as any).replace === true
            ? data.text
            : this.data.streamingText + data.text;

          this.setData({ streamingText: displayText });
          this.replaceLastAssistant(displayText);
          this.toBottom();
        }
      },
      () => {
        // 流式完成
        this.setData({ loading: false, streamingText: "" });
        this.toBottom();
      },
      (err) => {
        console.error("[WebSocket] error:", err);
        this.replaceLastAssistant("网络似乎有点慢，请重试～");
        this.setData({ loading: false, streamingText: "" });
      }
    );

    ws.connect({
      action: "send",
      conversation_id: cid,
      message: text,
    });
  },

  onShowBaziDialog() {
    const cached: any = wx.getStorageSync("last_paipan");
    if (!cached || !cached.mingpan) {
      wx.showToast({ title: "请先在排盘页生成命盘", icon: "none" });
      return;
    }

    const dialog = this.selectComponent("#baziDialog");
    if (dialog) {
      // 可以从缓存中读取五行数据，如果没有则使用默认值
      const wuxing = cached?.mingpan?.wuxing_count;
      let elements: any[] = [
        { name: 'wood', chinese: '木', percent: 18, color: '#5D8A4A' },
        { name: 'fire', chinese: '火', percent: 8, color: '#D4534A' },
        { name: 'earth', chinese: '土', percent: 18, color: '#A67C52' },
        { name: 'metal', chinese: '金', percent: 23, color: '#B8860B' },
        { name: 'water', chinese: '水', percent: 33, color: '#4A7BA7' },
      ];

      if (wuxing) {
        // 如果后端返回了五行数据，使用后端数据
        elements = [
          { name: 'wood', chinese: '木', percent: wuxing.木 || 0, color: '#5D8A4A' },
          { name: 'fire', chinese: '火', percent: wuxing.火 || 0, color: '#D4534A' },
          { name: 'earth', chinese: '土', percent: wuxing.土 || 0, color: '#A67C52' },
          { name: 'metal', chinese: '金', percent: wuxing.金 || 0, color: '#B8860B' },
          { name: 'water', chinese: '水', percent: wuxing.水 || 0, color: '#4A7BA7' },
        ];
      }

      dialog.onOpen({
        score: 83,
        elements: elements,
      });
    }
  },

  onBaziDialogClose() {
    // Dialog closed
  },

  checkLoginStatus() {
    try {
      // 统一只检查 token，与 profile.ts 保持一致
      const token = wx.getStorageSync("token");
      const isLoggedIn = !!token;

      // 调试日志
      console.log('[chat] checkLoginStatus:', {
        hasToken: !!token,
        isLoggedIn,
      });

      this.setData({ isLoggedIn });
    } catch (e) {
      this.setData({ isLoggedIn: false });
    }
  },

  truncateContent(content: string): string {
    // 截取50%的内容
    if (content.length <= 50) return content;
    return content.slice(0, Math.floor(content.length * 0.5));
  },

  onUnlockMessage(e: WechatMiniprogram.BaseEvent) {
    const index = e.currentTarget.dataset.index;

    if (this.data.isLoggedIn) {
      // 已登录，直接展开
      const msgs = this.data.messages.slice();
      const msg = msgs[index];
      if (msg && msg.fullContent) {
        msg.content = msg.fullContent;
        msg.truncated = false;
        (msg as any).nodes = formatMarkdownImpl(msg.fullContent);
        this.setData({ messages: msgs });
      }
    } else {
      // 未登录，显示登录弹窗
      const loginModal = this.selectComponent("#loginModal");
      if (loginModal) {
        loginModal.onOpen();
      }
    }
  },

  onLoginSuccess(e: any) {
    // 登录成功，保存状态到 storage（持久化）
    wx.setStorageSync("user_logged_in", true);
    wx.setStorageSync("user_logged_in_time", Date.now());

    // 更新页面状态
    this.setData({ isLoggedIn: true });

    // 展开所有被截断的消息
    const msgs = this.data.messages.map(msg => {
      if (msg.truncated && msg.fullContent) {
        return {
          ...msg,
          content: msg.fullContent,
          truncated: false,
          nodes: formatMarkdownImpl(msg.fullContent),
        };
      }
      return msg;
    });

    this.setData({ messages: msgs });

    // Toast 已经在 login-modal 中显示了，这里不需要再显示
  },

  // ========== 引导卡片和自动启动 ==========

  /**
   * 检查命盘数据，有则自动开始解读，无则显示引导卡片
   */
  checkAndAutoStart() {
    // 使用模块级变量检查（同步，立即生效）
    if (_hasAutoStarted) {
      return;
    }

    // 立即设置标志（防止竞态）
    _hasAutoStarted = true;

    const cached: any = wx.getStorageSync("last_paipan");
    const form: any = wx.getStorageSync("last_form") || {};

    if (!cached || !cached.mingpan) {
      // 无命盘数据 - 显示引导卡片（不发起请求）
      this.setData({
        hasPaipan: false,
        showGuideCard: true,
        autoStarted: true
      });
      return;
    }

    // 检查出生地是否为用户提供
    if (!form.birthplace_provided) {
      // 有命盘但无出生地 - 显示引导卡片并提示
      this.setData({
        hasPaipan: true,
        showGuideCard: true,
        autoStarted: true
      });

      // 添加友好提示消息
      const promptText =
        "检测到您还没有输入出生地点哦～\n\n" +
        "出生地点对于准确的命理分析很重要，因为它影响真太阳时的计算。\n\n" +
        "建议您返回排盘页面补充出生地信息，以获得更精准的解读。";
      this.appendAssistant(promptText, true);
      return;
    }

    // 有命盘数据 - 自动开始解读
    const gender = form.gender || "男";
    const paipan = { ...cached.mingpan, gender };

    this.setData({
      hasPaipan: true,
      showGuideCard: false,
      autoStarted: true,
      loading: true,
      streamingText: ""
    });

    // 先添加"思考中…"消息，避免替换开场白
    this.appendAssistant("思考中…");

    // 使用 WebSocket 流式响应
    const ws = new ChatWebSocket(
      `${WS_BASE}/chat`,
      (data) => {
        // 处理 meta 事件
        if (data.meta?.conversation_id) {
          wx.setStorageSync("conversation_id", data.meta.conversation_id);
          this.setData({ conversationId: data.meta.conversation_id as any });
          return;
        }

        // 处理 text 事件（增量更新）
        if (data.text) {
          // 后端 send replace: true 表示发送的是累积文本，直接替换；否则累加
          const displayText = (data as any).replace === true
            ? data.text
            : this.data.streamingText + data.text;

          this.setData({ streamingText: displayText });
          this.replaceLastAssistant(displayText);
          this.toBottom();
        }
      },
      () => {
        // 流式完成
        this.setData({ loading: false, streamingText: "" });
        this.toBottom();
      },
      (err: any) => {
        console.error("Auto-start failed", err);
        // 失败后显示引导卡片，让用户手动重试
        this.setData({
          showGuideCard: true,
          hasPaipan: true,
          loading: false,
          streamingText: ""
        });
      }
    );

    ws.connect({
      action: "start",
      paipan: paipan,
      kb_index_dir: "",
      kb_topk: 3,
    });
  },

  /**
   * 跳转到排盘页
   */
  onGoToPaipan() {
    wx.switchTab({ url: "/pages/index/index" });
  },

  /**
   * 查看历史命盘
   */
  onShowHistory() {
    wx.navigateTo({ url: "/pages/history/history" });
  },
};

Page<Data, Custom>(options);
