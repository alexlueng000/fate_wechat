import { request } from "./utils/request";
import type { TokenResponse } from "../typings/types/api";

App({
  onLaunch() {
    // 本地调试走 DEV_MODE：js_code='dev'
    request<TokenResponse>("/auth/login", "POST", {
      js_code: "dev",
      nickname: "LocalTester"
    })
      .then((res) => {
        wx.setStorageSync("token", res.token);
        console.log("Login ok:", res.mode);
      })
      .catch((e) => {
        console.error("Login failed", e);
        wx.showToast({ title: "登录失败", icon: "none" });
      });
  }
});
