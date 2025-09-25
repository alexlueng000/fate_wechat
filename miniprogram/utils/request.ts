import { BASE_URL } from "./env";

function getToken(): string {
  return wx.getStorageSync<string>("token") || "";
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
    console.log("base_url: ", BASE_URL)
    wx.request<T>({
      
      url: joinURL(BASE_URL, path),
      method,
      data,
      header: {
        "Content-Type": "application/json",
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        ...extraHeaders,
      },
      timeout: 10000,
      success(res) {
        const { statusCode, data } = res;
        if (statusCode >= 200 && statusCode < 300) {
          resolve(data as T);
        } else {
          reject(new Error(`HTTP ${statusCode}: ${JSON.stringify(data)}`));
        }
      },
      fail(err) {
        reject(new Error(`Network error: ${err.errMsg || "unknown"}`));
      },
    });
  });
}
