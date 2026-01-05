// pages/history/history.ts
interface PaipanRecord {
  id: string;
  form: {
    gender: string;
    calendar: string;
    birth_date: string;
    birth_time: string;
    birthplace: string;
  };
  paipan: any;
  createdAt: string;
}

interface Data {
  currentPaipan: PaipanRecord | null;
  historyList: PaipanRecord[];
}

Page<Data>({
  data: {
    currentPaipan: null,
    historyList: [],
  },

  onLoad() {
    this.loadHistory();
  },

  onShow() {
    this.loadHistory();
  },

  loadHistory() {
    try {
      // 获取当前命盘
      const lastPaipan: any = wx.getStorageSync("last_paipan") || null;
      const lastForm: any = wx.getStorageSync("last_form") || null;

      let current: PaipanRecord | null = null;
      if (lastPaipan && lastForm) {
        current = {
          id: "current",
          form: lastForm,
          paipan: lastPaipan,
          createdAt: "",
        };
      }

      // 获取历史记录
      const history: PaipanRecord[] = wx.getStorageSync("paipan_history") || [];

      this.setData({
        currentPaipan: current,
        historyList: history,
      });
    } catch (e) {
      console.error("Load history failed", e);
    }
  },

  /** 查看当前命盘 */
  onViewCurrent() {
    if (this.data.currentPaipan) {
      this.saveToHistory(this.data.currentPaipan);
      wx.navigateTo({ url: "/pages/result/index" });
    }
  },

  /** 查看历史记录 */
  onViewItem(e: WechatMiniprogram.BaseEvent) {
    const item = e.currentTarget.dataset.item as PaipanRecord;

    // 恢复到当前存储
    try {
      wx.setStorageSync("last_paipan", item.paipan);
      wx.setStorageSync("last_form", item.form);
    } catch (e) {}

    wx.navigateTo({ url: "/pages/result/index" });
  },

  /** 保存到历史记录（如果还没有） */
  saveToHistory(item: PaipanRecord) {
    try {
      let history: PaipanRecord[] = wx.getStorageSync("paipan_history") || [];

      // 检查是否已存在
      const exists = history.some(
        (h) =>
          h.form.birth_date === item.form.birth_date &&
          h.form.birth_time === item.form.birth_time &&
          h.form.birthplace === item.form.birthplace
      );

      if (!exists) {
        // 添加创建时间
        item.createdAt = this.formatDate(new Date());

        // 最多保存20条记录
        history.unshift(item);
        if (history.length > 20) {
          history = history.slice(0, 20);
        }

        wx.setStorageSync("paipan_history", history);
      }
    } catch (e) {
      console.error("Save history failed", e);
    }
  },

  formatDate(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return "今天";
    } else if (days === 1) {
      return "昨天";
    } else if (days < 7) {
      return `${days}天前`;
    } else {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${month}月${day}日`;
    }
  },

  onGoToIndex() {
    wx.switchTab({ url: "/pages/index/index" });
  },

  onShareAppMessage() {
    return {
      title: "命理八字 - 探索你的命盘",
      path: "/pages/index/index",
    };
  },
});
