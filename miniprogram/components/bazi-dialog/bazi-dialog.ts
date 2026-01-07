// components/bazi-dialog/bazi-dialog.ts
export interface ElementData {
  name: string;
  chinese: string;
  percent: number;
  color: string;
}

interface Data {
  show: boolean;
  score: number;
  elements: ElementData[];
}

type Custom = {
  onOpen(options?: { score?: number; elements?: ElementData[] }): void;
  onClose(): void;
  onMaskTap(): void;
  onBubbleTap(): void;
  drawProgress(canvasId: string, percent: number, color: string): void;
};

const options: WechatMiniprogram.Component.Options<Data, {}, {}, Custom> = {
  options: {
    styleIsolation: 'shared',
  },

  data: {
    show: false,
    score: 83,
    elements: [
      { name: 'wood', chinese: '木', percent: 18, color: '#5D8A4A' },
      { name: 'fire', chinese: '火', percent: 8, color: '#D4534A' },
      { name: 'earth', chinese: '土', percent: 18, color: '#A67C52' },
      { name: 'metal', chinese: '金', percent: 23, color: '#B8860B' },
      { name: 'water', chinese: '水', percent: 33, color: '#4A7BA7' },
    ] as ElementData[],
  },

  lifetimes: {
    attached() {
      // 组件加载时的初始化
    },
  },

  methods: {
    onOpen(options = {}) {
      const { score = 83, elements } = options as any;

      this.setData({
        show: true,
        score: score || this.data.score,
        elements: elements || this.data.elements,
      }, () => {
        // 绘制所有进度环
        setTimeout(() => {
          this.data.elements.forEach((item) => {
            this.drawProgress(`canvas-${item.name}`, item.percent, item.color);
          });
        }, 100);
      });
    },

    onClose() {
      this.setData({ show: false });
      this.triggerEvent('close');
    },

    onMaskTap() {
      this.onClose();
    },

    onBubbleTap() {
      // 阻止冒泡
    },

    drawProgress(canvasId: string, percent: number, color: string) {
      const query = this.createSelectorQuery();
      query.select(`#${canvasId}`)
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0]) return;

          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');

          const dpr = wx.getSystemInfoSync().pixelRatio;
          canvas.width = res[0].width * dpr;
          canvas.height = res[0].height * dpr;
          ctx.scale(dpr, dpr);

          const centerX = res[0].width / 2;
          const centerY = res[0].height / 2;
          const radius = 54;
          const lineWidth = 8;
          const startAngle = -Math.PI / 2;
          const endAngle = startAngle + (Math.PI * 2 * percent / 100);

          // 绘制背景圆环
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(139, 119, 101, 0.1)';
          ctx.lineWidth = lineWidth;
          ctx.lineCap = 'round';
          ctx.stroke();

          // 绘制进度圆环（带动画效果）
          const animate = (currentPercent: number) => {
            if (currentPercent > percent) return;

            ctx.clearRect(0, 0, res[0].width, res[0].height);

            // 重绘背景
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(139, 119, 101, 0.1)';
            ctx.lineWidth = lineWidth;
            ctx.lineCap = 'round';
            ctx.stroke();

            // 绘制进度
            const currentEndAngle = startAngle + (Math.PI * 2 * currentPercent / 100);
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, startAngle, currentEndAngle);
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.lineCap = 'round';
            ctx.stroke();

            if (currentPercent < percent) {
              setTimeout(() => animate(currentPercent + 2), 16);
            }
          };

          animate(0);
        });
    },
  },
};

Component<Data, {}, {}, Custom>(options);
