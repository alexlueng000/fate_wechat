// utils/auth.ts
const BASE_URL = "https://api.fateinsight.site";

const STORAGE_TOKEN  = "token";      // 跟 request.ts 里的 getToken 保持一致
const STORAGE_USER   = "auth_user";
const STORAGE_OPENID = "mp_openid";

/** 简单 UUID，用来生成本地“伪 openid” */
function genUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** 取 / 存 token（只是个封装） */
export function getToken(): string {
  try {
    return (wx.getStorageSync(STORAGE_TOKEN) as string) || "";
  } catch {
    return "";
  }
}

export function setToken(token: string) {
  wx.setStorageSync(STORAGE_TOKEN, token || "");
}

export function clearAuth() {
  wx.removeStorageSync(STORAGE_TOKEN);
  wx.removeStorageSync(STORAGE_USER);
}

/** 本地“openid”——实际上是我们自己生成的一个稳定 ID */
export function getLocalOpenId(): string {
  let oid = (wx.getStorageSync(STORAGE_OPENID) as string) || "";
  if (!oid) {
    oid = "mpdev_" + genUUID();
    wx.setStorageSync(STORAGE_OPENID, oid);
  }
  return oid;
}

/**
 * 确保已经完成 mp_login：
 * - storage 里已有 token：直接返回
 * - 否则：用本地 openid 调 /auth/mp/login
 */
export async function ensureMpLogin(): Promise<void> {
  const existing = getToken();
  if (existing) return;

  const openid = getLocalOpenId();

  // 直接用 wx.request，避免跟 utils/request.ts 相互引用造成循环依赖
  const url = BASE_URL + "/api/auth/mp/login";

  const res = await new Promise<WechatMiniprogram.RequestSuccessCallbackResult>((resolve, reject) => {
    wx.request({
      url,
      method: "POST",
      dataType: "json",
      responseType: "text",
      header: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      data: {
        openid,
        nickname: "",
        avatar_url: "",
      },
      timeout: 15000,
      success(r) {
        resolve(r);
      },
      fail(err) {
        reject(err);
      },
    } as WechatMiniprogram.RequestOption);
  });

  const { statusCode } = res;

  if (statusCode < 200 || statusCode >= 300) {
    throw new Error("mp_login HTTP " + statusCode);
  }

  // data 可能是对象也可能是字符串，这里兜底 parse 一下
  let payload: any = res.data;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      // 保持原样
    }
  }

  const token = payload?.access_token;
  if (!token) {
    throw new Error("mp_login 未返回 access_token");
  }

  setToken(token);
  wx.setStorageSync(STORAGE_USER, payload.user || null);
}
