// utils/request.ts
import { BASE_URL } from "./env";

function getToken(): string {
  try { return wx.getStorageSync<string>("token") || ""; } catch { return ""; }
}
function joinURL(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return b + p;
}

export function request<T>(
  path: string,
  method: WechatMiniprogram.RequestOption["method"] = "GET",
  data?: unknown,
  extraHeaders?: Record<string, string>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const url = joinURL(BASE_URL, path);
    console.log("➡️ request:", method, url);

    wx.request({
      url,
      method,
      data,
      // 明确告诉小程序返回是 JSON；responseType 用 text，避免某些 gzip/分块情况下预览器不展示
      dataType: "json",
      responseType: "text",
      header: {
        "Content-Type": "application/json",
        "Accept": "application/json",               // 强制后端按 JSON 一次性返回
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        ...(extraHeaders || {}),
      },
      timeout: 60000,
      success(res) {
        const { statusCode } = res;
        // 统一打印，方便你在 Console 看到返回（即使 Network 面板预览不了）
        console.log("✅ success:", statusCode, "headers:", res.header, "data:", res.data);

        if (statusCode >= 200 && statusCode < 300) {
          // dataType=json 时，小程序已帮你把 JSON 解析成对象；
          // 但部分服务返回 text/plain+JSON，这里兜底做一下 parse。
          let payload: any = res.data;
          if (typeof payload === "string") {
            try { payload = JSON.parse(payload); } catch { /* 保留字符串 */ }
          }
          resolve(payload as T);
        } else {
          reject(new Error(`HTTP ${statusCode}: ${typeof res.data === "string" ? res.data : JSON.stringify(res.data)}`));
        }
      },
      fail(err) {
        console.error("❌ fail:", err);
        reject(new Error(`Network error: ${err?.errMsg || "unknown"}`));
      },
    } as WechatMiniprogram.RequestOption);
  });
}
