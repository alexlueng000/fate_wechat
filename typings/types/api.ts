// 登录
export interface LoginRequest {
  js_code: string;
  nickname?: string;
  avatar?: string;
}
export interface TokenResponse {
  token: string;
  expires_in?: number;
  mode?: "dev" | "prod";
}

// 八字
export interface BirthInput {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute?: number;
  tz: string;
  calendar: "solar" | "lunar";
  gender?: string | null;
}
export interface BaziPillars { year: string; month: string; day: string; hour: string; }
export interface DayunItem { start_age: number; stem_branch: string; start_date: string; }
export interface LiunianItem { year: number; stem_branch: string; }

export interface BaziChart {
  pillars: BaziPillars;
  ten_gods: Record<string, string>;
  wuxing_stats: { wood: number; fire: number; earth: number; metal: number; water: number };
  dayun: DayunItem[];
  liunian: LiunianItem[];
}
export interface AnalysisBrief { strength: string; yongshen: string[]; tips: string[]; }

export interface BaziResponse {
  chart: BaziChart;
  analysis: AnalysisBrief;
}
