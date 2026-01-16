type PillarPair = [string, string];
type Mingpan = any;

type DayunItemUI = {
  ganzhi: string;
  startAge?: number;
  endAge?: number;
  startYear?: number;
  endYear?: number;
  range: string; // "26–35岁 / 2014–2023" or fallback
};

type Summary = {
  keywords: string[];
  oneLiner: string;
};

const DAYMASTER_STYLE: Record<string, { k: string[]; line: string }> = {
  "甲": { k: ["主动", "成长", "担当"], line: "你更偏主动推进与自我成长的结构，越投入越能形成优势。" },
  "乙": { k: ["适应", "积累", "韧性"], line: "你更偏循序渐进与长期积累的结构，稳住节奏后劲更强。" },
  "丙": { k: ["行动", "表达", "热能"], line: "你更偏行动与表达驱动的结构，关键在于把热情落到执行。" },
  "丁": { k: ["洞察", "感受", "审美"], line: "你更偏感受与洞察驱动的结构，优势在于细腻与专注。" },
  "戊": { k: ["稳定", "抗压", "扛事"], line: "你更偏稳定与抗压的结构，越到中后期越能把经验转成成果。" },
  "己": { k: ["执行", "耐久", "踏实"], line: "你更偏执行与耐久的结构，重在长期投入与持续兑现。" },
  "庚": { k: ["果断", "效率", "突破"], line: "你更偏果断与效率驱动的结构，注意避免过硬导致摩擦。" },
  "辛": { k: ["精细", "标准", "品质"], line: "你更偏精细与标准导向的结构，优势在于把事情做“对且美”。" },
  "壬": { k: ["变化", "视野", "灵活"], line: "你更偏变化与视野型结构，关键在于聚焦与持续输出。" },
  "癸": { k: ["思考", "敏感", "策略"], line: "你更偏思考与策略型结构，优势在于洞察与长期规划。" },
};

function joinPair(p: any): PillarPair {
  if (Array.isArray(p) && p.length >= 2) return [String(p[0] ?? ""), String(p[1] ?? "")];
  if (typeof p === "string" && p.length >= 2) return [p[0], p[1]];
  return ["", ""];
}

function safeGanzhiFromPillar(p: any): string {
  if (Array.isArray(p) && p.length) return p.map((x: any) => String(x ?? "")).join("");
  if (typeof p === "string") return p;
  return "—";
}

function buildDayunUI(dayunRaw: any[]): DayunItemUI[] {
  const list = Array.isArray(dayunRaw) ? dayunRaw : [];
  return list.map((item) => {
    const ganzhi = safeGanzhiFromPillar(item?.pillar);
    const startAge = Number(item?.age);
    const startYear = Number(item?.start_year);

    // 如果后端没有 endAge/endYear，就按 10 年推；没有 age/year 则降级展示
    const hasAge = Number.isFinite(startAge);
    const hasYear = Number.isFinite(startYear);

    const endAge = hasAge ? startAge + 9 : undefined;
    const endYear = hasYear ? startYear + 9 : undefined;

    const range =
      hasAge && hasYear
        ? `${startAge}–${endAge}岁 / ${startYear}–${endYear}`
        : hasAge
          ? `${startAge}岁起`
          : hasYear
            ? `${startYear}起`
            : "—";

    return { ganzhi, startAge, endAge, startYear, endYear, range };
  });
}

function buildSummary(dayMaster: string, currentAge?: number): Summary {
  const base = DAYMASTER_STYLE[dayMaster] || { k: ["稳", "节奏", "积累"], line: "你的结构更偏稳步推进，关键在于节奏与长期选择。" };

  // “阶段”只做时间感，不做吉凶
  let stageHint = "";
  if (typeof currentAge === "number") {
    if (currentAge < 30) stageHint = "前期以积累为主，别急着求快。";
    else if (currentAge < 45) stageHint = "中期更适合做方向性选择与持续放大优势。";
    else stageHint = "后期更看重稳定兑现与影响力沉淀。";
  }

  const oneLiner = stageHint ? `${base.line}${stageHint}` : base.line;
  return { keywords: base.k.slice(0, 3), oneLiner };
}

Page({
  data: {
    pillars: { year: "", month: "", day: "", hour: "" },
    table: { tiangan: [] as string[], dizhi: [] as string[], changsheng: ["—", "—", "—", "—"] },
    dayun: [] as DayunItemUI[],

    // 新增：首屏内容
    summary: { keywords: [] as string[], oneLiner: "" } as Summary,
    currentDayun: { ganzhi: "—", range: "—" } as DayunItemUI,
    nextDayun: null as DayunItemUI | null,

    summaryOpen: false, // 默认收起
  },

  onLoad() {
    try {
      const cached = wx.getStorageSync("last_paipan");
      if (!cached || !cached.mingpan) {
        wx.showToast({ title: "没有结果数据", icon: "none" });
        return;
      }
      this.applyMingpan(cached.mingpan);
    } catch (e) {
      console.error(e);
      wx.showToast({ title: "页面初始化失败", icon: "none" });
    }
  },

  applyMingpan(m: Mingpan) {
    const fp = m?.four_pillars ?? { year: ["", ""], month: ["", ""], day: ["", ""], hour: ["", ""] };

    const y = joinPair(fp.year);
    const mo = joinPair(fp.month);
    const d = joinPair(fp.day);
    const h = joinPair(fp.hour);

    const pillars = { year: y.join(""), month: mo.join(""), day: d.join(""), hour: h.join("") };
    const table = { tiangan: [y[0], mo[0], d[0], h[0]], dizhi: [y[1], mo[1], d[1], h[1]], changsheng: this.data.table.changsheng };

    const dayun = buildDayunUI(m?.dayun);
    const currentDayun = dayun[0] || { ganzhi: "—", range: "—" };
    const nextDayun = dayun[1] || null;

    const dayMaster = d[0] || ""; // 日主天干
    const currentAge = typeof m?.current_age === "number" ? m.current_age : undefined; // 如果后端给，最好；不给也没关系
    const summary = buildSummary(dayMaster, currentAge);

    this.setData({ pillars, table, dayun, currentDayun, nextDayun, summary });
  },

  toggleSummary() {
    this.setData({ summaryOpen: !this.data.summaryOpen });
  },

  onStartChat() {
    const cached: any = wx.getStorageSync("last_paipan");
    if (!cached || !cached.mingpan) {
      wx.showToast({ title: "没有命盘数据", icon: "none" });
      return;
    }

    // 直接跳转到聊天页面
    wx.switchTab({ url: "/pages/chat/chat" });
  },

  /** 返回上一页 */
  onGoBack() {
    wx.navigateBack({ delta: 1 });
  },

  /** 保存命盘 */
  onSaveChart() {
    const token = wx.getStorageSync("token");
    if (!token) {
      wx.showModal({
        title: "提示",
        content: "请先登录后再保存命盘",
        confirmText: "去登录",
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: "/pages/profile/profile" });
          }
        }
      });
      return;
    }

    const cached: any = wx.getStorageSync("last_paipan");
    if (!cached || !cached.mingpan) {
      wx.showToast({ title: "没有命盘数据", icon: "none" });
      return;
    }

    // 弹窗输入命盘名称
    wx.showModal({
      title: "保存命盘",
      editable: true,
      placeholderText: "请输入命盘名称（如：我的命盘）",
      success: (res) => {
        if (res.confirm && res.content) {
          this.doSaveChart(res.content.trim(), cached);
        } else if (res.confirm && !res.content) {
          wx.showToast({ title: "请输入名称", icon: "none" });
        }
      }
    });
  },

  /** 执行保存命盘 API 调用 */
  doSaveChart(name: string, cached: any) {
    const { request } = require("../../utils/request");

    wx.showLoading({ title: "保存中..." });

    request("/charts", "POST", {
      name,
      birth_info: cached.birth_info || {},
      chart_data: cached.mingpan
    })
      .then(() => {
        wx.hideLoading();
        wx.showToast({ title: "保存成功", icon: "success" });
      })
      .catch((err: Error) => {
        wx.hideLoading();
        console.error("保存命盘失败:", err);
        wx.showToast({ title: "保存失败", icon: "none" });
      });
  },

  /** 重新排盘 */
  onRePaipan() {
    wx.switchTab({ url: "/pages/index/index" });
  },

  /** 分享给好友 */
  onShareAppMessage() {
    const { summary, pillars } = this.data;
    return {
      title: `我的八字命盘：${pillars.day}日主 ${summary.keywords.join("、")}`,
      path: "/pages/index/index",
      imageUrl: "",
    };
  },

  /** 分享到朋友圈 */
  onShareTimeline() {
    const { summary, pillars } = this.data;
    return {
      title: `命理八字 - 探索你的命盘，${summary.keywords.join("、")}性格特质`,
      query: "",
      imageUrl: "",
    };
  },
});
