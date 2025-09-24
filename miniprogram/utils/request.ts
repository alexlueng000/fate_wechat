import { BASE_URL } from "./env";

function getToken(): string {
  return wx.getStorageSync<string>("token") || "";
}

export function request<T>(path: string, method: WechatMiniprogram.RequestOption["method"] = "GET", data?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    wx.request<T>({
      url: BASE_URL + path,
      method,
      data,
      header: {
        "Content-Type": "application/json",
        Authorization: getToken() ? `Bearer ${getToken()}` : ""
      },
      timeout: 10000,
      success(res) {
        const { statusCode, data } = res;
        if (statusCode >= 200 && statusCode < 300) resolve(data);
        else reject({ status: statusCode, data });
      },
      fail(err) {
        reject(err);
      }
    });
  });
}
