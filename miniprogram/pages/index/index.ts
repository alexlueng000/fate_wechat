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
  },

  onPickDate(e: any) { this.setData({ birth_date: e.detail.value || this.data.birth_date }); },
  onPickTime(e: any) { this.setData({ birth_time: e.detail.value || this.data.birth_time }); },
  onInputPlace(e: any) { this.setData({ birthplace: e.detail.value }); },
  setMale()   { this.setData({ gender: "男" }); },
  setFemale() { this.setData({ gender: "女" }); },
  setSolar()  { this.setData({ calendar: "公历" }); },
  setLunar()  { this.setData({ calendar: "农历" }); },

  async onStart() {
    if (this.data.submitting) return;

    // 简单校验
    if (!this.data.birth_date) { wx.showToast({ title: "请选择出生日期", icon: "none" }); return; }
    if (!this.data.birth_time) { wx.showToast({ title: "请选择出生时间", icon: "none" }); return; }

    this.setData({ submitting: true });
    try {
      const payload = {
        gender: this.data.gender,                                   // "男" / "女"
        calendar: this.data.calendar === "公历" ? "gregorian" : "lunar",
        birth_date: this.data.birth_date,                           // "YYYY-MM-DD"
        birth_time: this.data.birth_time,                           // "HH:mm"
        birthplace: (this.data.birthplace || "深圳").trim(),
      };

      const resp = await request("/bazi/calc_paipan", "POST", payload);

      // 存排盘结果 + 表单，给 result & chat/start 用
      wx.setStorageSync("last_paipan", resp);
      wx.setStorageSync("last_form", payload);

      // 跳转结果页
      wx.navigateTo({ url: "/pages/result/index" });
    } catch (err: any) {
      wx.showToast({ title: err?.message || "请求失败", icon: "none" });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
