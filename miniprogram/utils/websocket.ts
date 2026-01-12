// utils/websocket.ts
// WebSocket 管理器，用于处理流式聊天响应

type MessageHandler = (data: { text?: string; meta?: { conversation_id: string } }) => void;
type DoneHandler = () => void;
type ErrorHandler = (err: any) => void;

class ChatWebSocket {
  private socket: WechatMiniprogram.SocketTask | null = null;
  private onMessage: MessageHandler;
  private onDone: DoneHandler;
  private onError: ErrorHandler;
  private url: string;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;

  constructor(
    url: string,
    onMessage: MessageHandler,
    onDone: DoneHandler,
    onError: ErrorHandler
  ) {
    this.url = url;
    this.onMessage = onMessage;
    this.onDone = onDone;
    this.onError = onError;
  }

  connect(data: any) {
    console.log('[WebSocket] Connecting to', this.url);

    this.socket = wx.connectSocket({
      url: this.url,
      header: this.getHeaders(),
    });

    this.socket.onOpen(() => {
      console.log('[WebSocket] Connected, sending data');
      // 连接建立后发送数据
      this.socket!.send({ data: JSON.stringify(data) });
    });

    this.socket.onMessage((res) => {
      const msg = res.data as string;
      console.log('[WebSocket] Received:', msg);

      if (msg === '[DONE]') {
        this.onDone();
        this.close();
        return;
      }

      // 检查是否是错误消息
      if (msg.startsWith('[ERROR]')) {
        const errorMsg = msg.substring(7);
        this.onError(new Error(errorMsg));
        this.close();
        return;
      }

      try {
        const data = JSON.parse(msg);
        this.onMessage(data);
      } catch (e) {
        console.error('[WebSocket] Parse error:', e, 'raw msg:', msg);
      }
    });

    this.socket.onError((err) => {
      console.error('[WebSocket] Error:', err);
      this.reconnectAttempts++;
      if (this.reconnectAttempts <= this.maxReconnectAttempts) {
        console.log(`[WebSocket] Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        // 延迟重连
        setTimeout(() => {
          this.connect(data);
        }, 1000 * this.reconnectAttempts);
      } else {
        this.onError(err);
      }
    });

    this.socket.onClose(() => {
      console.log('[WebSocket] Closed');
    });
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  private getToken(): string {
    try {
      return wx.getStorageSync<string>("token") || "";
    } catch {
      return "";
    }
  }

  close() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.reconnectAttempts = 0;
  }
}

export { ChatWebSocket };
