import { API_BASE } from "../../utils/config";
import type { ChatMessage } from "../../../typings/types/message";

interface Data {
  messages: ChatMessage[];
  input: string;
  loading: boolean;
  toView: string;
}

/** 自定义方法类型（注意：不包含 data） */
type Custom = {
  onInput(e: WechatMiniprogram.Input): void;
  onSend(): void;
  appendUser(text: string): void;
  appendAssistant(text: string): void;
  replaceLastAssistant(text: string): void;
};

/** ✅ 注意这里的泛型顺序：Options<Data, Custom> */
const options: WechatMiniprogram.Page.Options<Data, Custom> = {
  data: {
    /** ✅ 避免 never[] —— 显式断言类型 */
    messages: [] as ChatMessage[],
    input: "",
    loading: false,
    toView: "end",
  },

  onLoad() {
    // 现在 this 的类型是 Instance<Data, Custom>，包含自定义方法
    this.appendAssistant(
      "你好呀～（微笑）\n" +
      "我不是来剧透你人生的编剧，只是帮你找找藏在命盘里的小彩蛋——可能是你还没发现的潜力，或是未来路上悄悄亮起的路灯（✨）\n" +
      "毕竟你才是人生的主角，我嘛…只是个带地图的导游～（轻松摊手）\n" +
      "准备好一起逛逛你的‘人生剧本杀’了吗？放心，不用怕泄露天机，我今天的‘仙气’储备充足！"
    );
  },

  onInput(e) {
    const val = (e.detail as any).value as string;
    this.setData({ input: val });
  },

  appendUser(text) {
    const msgs = this.data.messages.concat([{ role: "user", content: text }]);
    this.setData({ messages: msgs, toView: "end" });
  },

  appendAssistant(text) {
    const msgs = this.data.messages.concat([{ role: "assistant", content: text }]);
    this.setData({ messages: msgs, toView: "end" });
  },

  replaceLastAssistant(text) {
    const msgs = this.data.messages.slice();
    if (msgs.length && msgs[msgs.length - 1].role === "assistant") {
      msgs[msgs.length - 1].content = text;
    } else {
      msgs.push({ role: "assistant", content: text });
    }
    this.setData({ messages: msgs, toView: "end" });
  },

  onSend() {
    const text = this.data.input.trim();
    if (!text || this.data.loading) return;
    this.setData({ input: "", loading: true });
    this.appendUser(text);
    this.appendAssistant("思考中…");

    wx.request<{ reply: string }>({
      url: `${API_BASE}/chat`,
      method: "POST",
      header: { "content-type": "application/json" },
      data: { messages: this.data.messages },
      timeout: 15000,
      success: (res) => {
        const data = res.data as any;
        const reply = (data && typeof data.reply === "string") ? data.reply : "抱歉，我刚刚走神了。";
        this.replaceLastAssistant(reply);
      },
      fail: () => {
        this.replaceLastAssistant("网络似乎不太稳定，稍后再试一下～");
      },
      complete: () => this.setData({ loading: false, toView: "end" }),
    });
  },
};

/** ✅ 这里也保持先 Data、后 Custom */
Page<Data, Custom>(options);