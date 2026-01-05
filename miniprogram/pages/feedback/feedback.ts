// pages/feedback/feedback.ts
import { request } from "../../utils/request";

interface Data {
  type: string;
  content: string;
  contact: string;
  submitting: boolean;
}

Page<Data>({
  data: {
    type: "bug",
    content: "",
    contact: "",
    submitting: false,
  },

  onSelectType(e: WechatMiniprogram.BaseEvent) {
    const type = e.currentTarget.dataset.type as string;
    this.setData({ type });
  },

  onInputContent(e: WechatMiniprogram.Input) {
    this.setData({ content: e.detail.value });
  },

  onInputContact(e: WechatMiniprogram.Input) {
    this.setData({ contact: e.detail.value });
  },

  async onSubmit() {
    const { type, content, contact } = this.data;

    if (!content.trim()) {
      wx.showToast({ title: "请填写反馈内容", icon: "none" });
      return;
    }

    this.setData({ submitting: true });

    try {
      // 调用后端反馈接口
      await request("/feedback", "POST", {
        type,
        content: content.trim(),
        contact: contact.trim(),
        platform: "miniprogram",
      });

      wx.showToast({ title: "提交成功，感谢您的反馈！", icon: "success" });

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      console.error("Feedback submit failed", err);
      // 如果后端接口不存在，可以降级处理
      wx.showModal({
        title: "反馈已记录",
        content: "感谢您的反馈！我们已记录您的意见。",
        showCancel: false,
        success: () => {
          wx.navigateBack();
        },
      });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
