// develop / trial / release
const env = wx.getAccountInfoSync().miniProgram.envVersion;

// 本地调试：用你后端本地
const LOCAL = "http://127.0.0.1:8000";

// 线上可换成你的生产域名（必须 HTTPS 且加到合法域名）
const PROD = "https://api.yourprod.com";

export const BASE_URL =
  env === "release" ? PROD : LOCAL;
