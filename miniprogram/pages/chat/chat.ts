// pages/chat/chat.ts
import { API_BASE } from "../../utils/config";
import type { ChatMessage } from "../../../typings/types/message";
// pages/result/index.ts
import { request } from "../../utils/request";

type StartResp = { conversation_id: string; reply: string };

interface Data {
  messages: ChatMessage[];
  input: string;
  loading: boolean;
  toView: string; // 用于滚动到底部
}

/** 自定义方法类型（注意：不包含 data） */
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
};

const QUICK_MAP: Record<string, string> = {
  personality: "结合原局，用子平和盲派深度分析人物性格优势",
  avatar: "结合原局（加入性别），用子平和盲派深度分析人物画像身高体型气质动作等等",
  partner_avatar: "结合原局（加入性别），用子平和盲派深度分析正缘人物画像",
  career: "结合原局和大运流年，用子平和盲派深度分析事业方向和可执行的建议（需引导用户加上当前工作背景，如果是问学业需要强调哪些年期间读高中/大学，学业情况如何）",
  wealth: "结合原局和大运流年，用子平和盲派深度分析未来3年每年财运吉凶和可执行的建议",
  health: "结合原局和大运流年，用子平和盲派深度分析健康建议",
  love_timing: "结合原局和大运流年，用子平和盲派深度分析哪个流年应期概率最高（需要引导客户补充背景，当前单身/有对象，已婚/离异）",
};

/** ✅ 注意这里的泛型顺序：Options<Data, Custom> */
const options: WechatMiniprogram.Page.Options<Data, Custom> = {
  data: {
    messages: [] as ChatMessage[],
    input: "",
    loading: false,
    toView: "end",
  },

  onLoad() {
    // ✅ 保留你的开场白
    this.appendAssistant(
      "你好呀～（微笑）\n" +
        "我不是来剧透你人生的编剧，只是帮你找找藏在命盘里的小彩蛋——可能是你还没发现的潜力，或是未来路上悄悄亮起的路灯（✨）\n" +
        "毕竟你才是人生的主角，我嘛…只是个带地图的导游～（轻松摊手）\n" +
        "准备好一起逛逛你的‘人生剧本杀’了吗？放心，不用怕泄露天机，我今天的‘仙气’储备充足！"
    );
  },

  /** 输入框 */
  onInput(e) {
    const val = (e.detail as any).value as string;
    this.setData({ input: val });
  },

  /** 视图滚动到底部 */
  toBottom() {
    // 触发 scroll-into-view
    this.setData({ toView: "end" });
  },

  /** 追加一条用户消息 */
  appendUser(text) {
    const msgs = this.data.messages.concat([{ role: "user", content: text }]);
    this.setData({ messages: msgs }, this.toBottom);
  },

  /** 追加一条助手消息 */
  appendAssistant(text) {
    const msgs = this.data.messages.concat([{ role: "assistant", content: text }]);
    this.setData({ messages: msgs }, this.toBottom);
  },

  /** 用最新内容替换最后一条助手消息（不存在则追加） */
  replaceLastAssistant(text) {
    const msgs = this.data.messages.slice();
    if (msgs.length && msgs[msgs.length - 1].role === "assistant") {
      msgs[msgs.length - 1].content = text;
    } else {
      msgs.push({ role: "assistant", content: text });
    }
    this.setData({ messages: msgs }, this.toBottom);
  },

  /** 快捷问法：把预设文案填到输入框 */
  onQuickAsk(e) {
    const key = String((e.currentTarget?.dataset as any)?.key || "");
    const text = QUICK_MAP[key] || "";
    if (text) this.setData({ input: text });
  },

  /** 清空对话 */
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
        // 存储 & 设置会话
        wx.setStorageSync("conversation_id", resp.conversation_id);
        this.setData({ conversationId: resp.conversation_id as any });
  
        // 把起始解读落到消息里
        this.appendAssistant(resp.reply || "（无响应）");
      })
      .catch((err: any) => {
        wx.showToast({ title: err?.message || "启动失败", icon: "none" });
      })
      .finally(() => {
        this.setData({ loading: false }, this.toBottom);
        wx.hideLoading();
      });
  },

  /** 发送（一次性，仍按你的 /chat 接口，传 messages 数组） */
  onSend() {
    const text = this.data.input.trim();
    if (!text || this.data.loading) return;
  
    const cid = wx.getStorageSync("conversation_id") || "";
    if (!cid) {
      wx.showToast({ title: "请先在排盘页点击“开始对话”", icon: "none" });
      return;
    }
  
    this.setData({ input: "", loading: true });
    this.appendUser(text);
    this.appendAssistant("思考中…");
  
    const url = `${API_BASE}/chat?stream=0&_ts=${Date.now()}`;
    const payload = { conversation_id: cid, message: text };
  
    // —— 打点，方便你在控制台确认 —— 
    console.log("[chat] POST", url, payload);
  
    wx.request<{ reply: string }>({
      url,
      method: "POST",
      header: { "content-type": "application/json", Accept: "application/json" },
      data: payload,
      timeout: 15000,
      success: (res) => {
        // WeChat 的 success 对 4xx/5xx 也会进来，所以这里要自己判
        const { statusCode } = res;
        if (statusCode >= 200 && statusCode < 300) {
          const reply =
            (res.data && typeof (res.data as any).reply === "string")
              ? (res.data as any).reply
              : "（无响应）";
          this.replaceLastAssistant(reply);
        } else {
          // 显示服务端错误信息，别乱说“网络不稳定”
          const msg =
            (res.data as any)?.detail?.[0]?.msg ||
            (res.data as any)?.detail ||
            `HTTP ${statusCode}`;
          this.replaceLastAssistant(`服务端错误：${msg}`);
        }
      },
      fail: (err) => {
        // 这里才是“网络层失败”
        console.warn("[chat] request fail:", err);
        this.replaceLastAssistant("网络连接失败，请稍后再试。");
      },
      complete: () => this.setData({ loading: false }, this.toBottom),
    });
  }
};

/** ✅ 这里也保持先 Data、后 Custom */
Page<Data, Custom>(options);
