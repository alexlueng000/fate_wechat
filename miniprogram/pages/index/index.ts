import { request } from "../../utils/request";

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function todayStr() {
  const d = new Date();
  const Y = d.getFullYear();
  const M = pad(d.getMonth() + 1);
  const D = pad(d.getDate());
  const h = pad(d.getHours());
  const m = pad(d.getMinutes());
  return { date: `${Y}-${M}-${D}`, time: `${h}:${m}` };
}

interface PageData {
  nickname: string;
  gender: "男" | "女";
  calendar: "公历" | "农历";
  birth_date: string;     // YYYY-MM-DD
  birth_time: string;     // HH:mm
  birthplace: string;
  greet: string;
  submitting: boolean;
}

const DEFAULT_GREET =
  "你好呀～（微笑）\n" +
  "我不是来剧透你人生的编剧，只是帮你找找藏在命盘里的小彩蛋——可能是你还没发现的潜力，或是未来路上悄悄亮起的路灯（✨）\n" +
  "毕竟你才是人生的主角，我嘛…只是个带地图的导游～（轻松摊手）\n" +
  "准备好一起逛逛你的‘人生剧本杀’了吗？放心，不用怕泄露天机，我今天的‘仙气’储备充足！";

Page<Record<string, any>, PageData>({
  data: {
    nickname: "",
    gender: "男",
    calendar: "公历",
    birth_date: todayStr().date,
    birth_time: todayStr().time,
    birthplace: "",
    greet: DEFAULT_GREET,
    submitting: false,
  },

  onLoad() {
    const t = todayStr();
    this.setData({ birth_date: t.date, birth_time: t.time });
    // this.testPing();
  },

  onPickDate(e: any) { this.setData({ birth_date: e.detail.value || this.data.birth_date }); },
  onPickTime(e: any) { this.setData({ birth_time: e.detail.value || this.data.birth_time }); },
  onInputPlace(e: any) { this.setData({ birthplace: e.detail.value }); },
  setMale()   { this.setData({ gender: "男" }); },
  setFemale() { this.setData({ gender: "女" }); },
  setSolar()  { this.setData({ calendar: "公历" }); },
  setLunar()  { this.setData({ calendar: "农历" }); },

  testPing() {
    request('', 'GET')
      .then((res) => {
        // 你的后端可能返回 {status:"ok"} 或字符串
        this.setData({ ping: JSON.stringify(res) });
      })
      .catch((e) => {
        console.error('ping失败', e);
        wx.showToast({ title: 'ping 失败', icon: 'none' });
      });
  },

  async onStart() {
    if (this.data.submitting) return;

    // 简单校验
    if (!this.data.birth_date) { wx.showToast({ title: "请选择出生日期", icon: "none" }); return; }
    if (!this.data.birth_time) { wx.showToast({ title: "请选择出生时间", icon: "none" }); return; }
    if (!this.data.birthplace.trim()) { wx.showToast({ title: "请输入出生地点", icon: "none" }); return; }

    this.setData({ submitting: true });
    try {
      // 检查用户是否输入了出生地
      const birthplaceProvided = !!this.data.birthplace.trim();

      const payload = {
        gender: this.data.gender,                                   // "男" / "女"
        calendar: this.data.calendar === "公历" ? "gregorian" : "lunar",
        birth_date: this.data.birth_date,                           // "YYYY-MM-DD"
        birth_time: this.data.birth_time,                           // "HH:mm"
        birthplace: (this.data.birthplace || "深圳").trim(),
        birthplace_provided: birthplaceProvided,                    // 标志：用户是否输入了出生地
      };

      // 清除之前的对话记录（新命盘需要重新解读）
      try {
        wx.removeStorageSync("conversation_id");
        wx.removeStorageSync("start_reply");
        // 标记有新命盘需要解读
        wx.setStorageSync("new_paipan_pending", true);
      } catch (e) {}

      const resp = await request("bazi/calc_paipan", "POST", payload);

      // 存排盘结果 + 表单，给 result & chat/start 用
      wx.setStorageSync("last_paipan", resp);
      wx.setStorageSync("last_form", payload);

      // 保存到历史记录
      this.saveToHistory(payload, resp);

      // 跳转结果页
      wx.navigateTo({ url: "/pages/result/index" });
    } catch (err: any) {
      wx.showToast({
        icon: "none",
        title: (err && err.message) ? err.message : "请求失败",
      });
    } finally {
      this.setData({ submitting: false });
    }
  },

  /** 保存到历史记录 */
  saveToHistory(form: any, paipan: any) {
    try {
      let history: any[] = wx.getStorageSync("paipan_history") || [];

      // 检查是否已存在（相同日期、时间、地点）
      const exists = history.some(
        (h) =>
          h.form.birth_date === form.birth_date &&
          h.form.birth_time === form.birth_time &&
          h.form.birthplace === form.birthplace
      );

      if (!exists) {
        const record = {
          id: Date.now().toString(),
          form,
          paipan,
          createdAt: this.formatDate(new Date()),
        };

        // 最多保存20条记录
        history.unshift(record);
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
});
