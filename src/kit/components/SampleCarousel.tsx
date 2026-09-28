/**
 * SampleCarousel.tsx — 「卷页飞入 + 样片轮播」镜头模板(秋芝《Codex全解》7:08.7–7:23.9 实测版)。
 *
 * 出处:内部复刻案例 qz-cx-0428-sample-carousel(交付 14),specs/motion.json 逐帧拟合。
 * 默认值 = 原片 30fps 实测曲线与 1080p 几何,不是手调;改参数前先看下面每条曲线的来源。
 *
 * 一段戏(本地帧 0 = 原片 f4,纸还在画外):
 *   ① 卷页过门(PageCurlTransition):一张「文件夹页」从右下翻进来盖住旧画面,0.5 秒落定(原片 f5–f19)
 *   ② 硬切(原片 f30):文件夹页变成模糊压暗的背景;选中的几张样片变成白色相纸卡,从页上的原位置
 *      【匀速直线 + 匀速放大】抽出来,排成左侧竖排(10 帧,不加缓动)
 *   ③ 挑出单独展示(原片 f47):选中卡 = 橙色虚线框 + 左侧带红色外发光的橙三角,其余卡 × 0.399 变灰(全部硬切);
 *      右侧视频窗从下方升起(8 帧 bezier,首两帧半透明 0.544)播这条样片
 *   ④ 换下一条(原片 f127 / f219):当前窗往上推出画(ease-in 6 帧)、下一条从下推入(ease-out 6 帧,两条曲线镜像,
 *      = 一条 1080px 纵向推屏被两个窗各用一半);选中框在推屏中途硬切到下一张卡
 *   ⑤ 可选收尾(原片 f332):硬切,视频窗消失、所有卡恢复白色、整列右移让出右侧(后面接公式 / 总结字)
 *
 * 用法:
 *   <Sequence from={x}>
 *     <SampleCarousel
 *       samples={[{ src: staticFile('a.mp4'), thumb: staticFile('a.png'), name: '01_钢琴家.mp4' }, ...]}
 *       picks={[0, 2]} pickAtSec={[1.4, 4.2]} outroAtSec={8}
 *     />
 *   </Sequence>
 * 组件铺满父容器(AbsoluteFill 语义),几何按 1920×1080 画布 px;时间参数单位 = 秒(相对组件起点),方便对口播。
 * 渲染要 WebGL2(卷页),工程 remotion.config.ts 加 Config.setChromiumOpenGlRenderer('angle')。
 */
import React from 'react';
import { AbsoluteFill, Easing, Img, OffthreadVideo, Sequence, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { PageCurlTransition, type Rect } from './PageCurlTransition';

const clampBoth = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 实测时基:原片 30fps。下面的帧号 = 本地帧(原片帧号 − 4) */
const MEASURED_FPS = 30;

// ── 实测时间(本地帧 = 原片帧 − 4;证据见案例 specs/motion.json 同名 id)──
/** f30 硬切:背景压暗 + 抽卡开始 */
const PULL_AT = 26;
/** card-0N-pull:逐帧等差,f30→f40 匀速直线 + 匀速缩放(rmse ≤0.1px),起始缩放 0.8206 */
const PULL_DUR = 10;
/** f47 第一次选中(选中态 + 视频窗出现) */
const FIRST_PICK = 43;
/** video-1-rise:f47/f48 窗在 +448.5 处半透明 0.544(f48 是原片重复帧),f48→f56 bezier 升到位,rmse 0.066px */
const RISE = { hold: 1, dur: 8, dy: 448.5, firstOpacity: 0.544, ease: Easing.bezier(0.368, 0.606, 0.561, 0.997) };
/** video-N-exit:上推出画 −540.14,6 帧 ease-in,rmse ≤0.26px */
const EXIT = { dur: 6, dy: -540.14, ease: Easing.bezier(0.514, 0, 0.761, 0) };
/** video-N-enter:自下推入 +539.98 → 0,6 帧 ease-out(与 EXIT 镜像),rmse ≤0.27px */
const ENTER = { dur: 6, dy: 539.98, ease: Easing.bezier(0.239, 1, 0.486, 1) };
/** 推屏比选中框早起步:原片 f127 起推 / f130 选中框跳;f219 起推 / f224 跳。默认取 3 */
const PUSH_LEAD = 3;
/** 原片两次换片间隔(f47→f130 = 83 帧,f130→f224 = 94 帧)取中 ≈ 2.95 秒 */
const DEFAULT_HOLD_SEC = 2.95;

// ── 实测几何(原片 1080p;specs/layout.json + layout-ext.json)──
/** 内容区(录屏框) */
export const SAMPLE_CAROUSEL_RECT: Rect = [233.4, 40.3, 1640.8, 924.4];
/** 卡:原片三张 229×227/236/240,x=312(内容区左 +78.6),上下间隔 ≈11.5,竖排上沿在内容区顶下 92.7 */
const CARD = { w: 229, h: 234, gap: 11.5, left: 78.6, top: 92.7 };
/** 视频窗:x = 卡列右沿 +28,右沿离内容区右 79.2,竖直中心在内容区中心上方 13.9(原片 488.6) */
const WIN = { gapLeft: 28, right: 79.2, cyUp: 13.9 };
/** 选中虚线框:比卡大 1.6px,线宽 5.1,橙 rgb(255,112,0);每边 10.3 实 / 10.7 空,四角 L 形(臂 ≈4.8) */
const SEL = { pad: 1.6, stroke: 5.1, dash: 10.3, period: 21.0, cornerArm: 4.8, color: 'rgb(255, 112, 0)' };
/** 三角:宽 68.1、高 101.9,尖端在卡左 6.4px、竖直对准卡中心;橙 rgb(255,142,0) + 两层红 rgb(255,41,13) 高斯外发光 */
const ARROW = { w: 68.1, h: 101.9, gap: 6.4, fill: 'rgb(255, 142, 0)', glow: 'rgb(255, 41, 13)', glows: [{ sigma: 7.6, opacity: 0.55 }, { sigma: 2.5, opacity: 0.3 }] };
/** 未选中卡 = 白卡 × 0.399 */
const DIM_OPACITY = 0.399;
/** 背景 = 纸模糊 σ10 × 亮度 0.0551 + 白 0.0055(案例 liveBackdrop,对原片 MAE 1.6) */
const BACKDROP = { blurPx: 10, brightness: 0.0551, overlay: 'rgba(255,255,255,0.0055)' };
/** 收尾(f332):整列右移 187、上移 10.3(竖排 B) */
const OUTRO_SHIFT: [number, number] = [187, -10.3];

export type CarouselSample = {
  /** 样片:视频或图片地址(staticFile) */
  src: string;
  /** 'video'(默认按扩展名猜)或 'image' */
  kind?: 'video' | 'image';
  /** 卡片 / 文件夹页上的缩略图(视频必须给一张图;图片样片不给就用 src) */
  thumb?: string;
  /** 卡片下面的文件名 */
  name?: string;
  /** 宽高比(视频窗按它定高),默认 16/9 */
  aspect?: number;
  /** 视频从第几秒开始播 */
  trimBeforeSec?: number;
  /** 视频音量,默认 0(静音;口播片一般不要样片原声) */
  volume?: number;
  /** 直接用一整张卡片图(自己做好的卡),不用模板画的白卡 */
  cardSrc?: string;
};

export type SampleCarouselProps = {
  /** 2–8 条样片,全部会抽成卡片 */
  samples: CarouselSample[];
  /** 挑哪几条单独展示(下标,按顺序);默认全部 */
  picks?: number[];
  /** 每条被挑中的时刻(秒,相对组件起点),对口播用;不给就从 firstPickAtSec 起每 holdSec 换一条 */
  pickAtSec?: number[];
  /** 换片推屏的起步时刻(秒,第 0 条不用);默认 = 被挑中时刻 − 3 帧(原片 f127→f130;第二次是 f219→f224) */
  pushAtSec?: number[];
  /** 每条停多久(秒),默认 2.95(原片) */
  holdSec?: number;
  /** 第一条被挑中的时刻(秒),默认 1.43(原片 f47) */
  firstPickAtSec?: number;
  /** 硬切抽卡的时刻(秒),默认 0.87(原片 f30) */
  pullAtSec?: number;
  /** 收尾硬切时刻(秒):视频窗消失、卡恢复白色、整列右移;不给就一直停在最后一条 */
  outroAtSec?: number;
  /** 收尾后整列平移(px),默认 [187, −10.3] */
  outroShift?: [number, number];
  /** 收尾后叠在上面的内容(公式、总结字…),从 outroAtSec 起出现 */
  outro?: React.ReactNode;
  /** 自己给文件夹页的截图(比如真的 Finder 截图);不给就用代码画一个文件夹页 */
  page?: { src: string; srcRect?: Rect; bleedColor?: string };
  /** 自己给页截图时:每张卡从页上哪里抽出来(画布 px 矩形,和卡同宽高比);不给就从页中心附近散开 */
  pullFrom?: Rect[];
  /** 代码画的文件夹页:标题 / 多画几个灰色占位格让它像一个满满的文件夹 */
  folderTitle?: string;
  extraThumbs?: number;
  /** 内容区(纸落定铺满这块,视频窗也被它裁切),默认原片录屏框 */
  rect?: Rect;
  /** 自定义卡位置(竖排)与视频窗 {x, w, cy};不给按条数自动排(≤4 一列,≥5 两列) */
  cardRects?: Rect[];
  window?: { x: number; w: number; cy: number; maxH?: number };
  /** 强调色(虚线框 / 三角),默认原片橙 */
  accent?: string;
  arrowColor?: string;
  glowColor?: string;
  /** 未选中卡透明度,默认 0.399 */
  dimOpacity?: number;
  /** 背景模糊压暗(false = 不压暗,纸一直清楚) */
  backdrop?: boolean;
  /** 动作速度倍率(卷页 / 抽卡 / 升起 / 推屏),1 = 原片 */
  speed?: number;
  /** 不要卷页过门(页直接在) */
  noCurl?: boolean;
  /** 卡片文字字体 */
  fontFamily?: string;
};

type Layout = { cards: Rect[]; s: number; twoCols: boolean; win: { x: number; w: number; cy: number; maxH: number } };

/** 按条数排卡:≤4 一列(4 条时缩小),≥5 两列;视频窗占右侧剩余 */
export const sampleCarouselLayout = (n: number, rect: Rect = SAMPLE_CAROUSEL_RECT): Layout => {
  const [rx, ry, rw, rh] = rect;
  const twoCols = n >= 5;
  const rows = twoCols ? Math.ceil(n / 2) : n;
  const avail = rh - 2 * Math.min(CARD.top, rh * 0.1);
  const need = rows * CARD.h + (rows - 1) * CARD.gap;
  const s = Math.min(1, avail / need);
  const cw = CARD.w * s;
  const ch = CARD.h * s;
  const gap = CARD.gap * s;
  const colH = rows * ch + (rows - 1) * gap;
  const top = ry + rh / 2 - WIN.cyUp - colH / 2 + (n === 3 ? 0 : 0);
  const left = rx + CARD.left;
  const cards: Rect[] = [];
  for (let i = 0; i < n; i += 1) {
    const col = twoCols ? i % 2 : 0;
    const row = twoCols ? Math.floor(i / 2) : i;
    cards.push([left + col * (cw + gap + (twoCols ? ARROW.w * s + ARROW.gap * s : 0)), top + row * (ch + gap), cw, ch]);
  }
  const blockRight = Math.max(...cards.map((c) => c[0] + c[2]));
  const winX = blockRight + (twoCols ? (ARROW.w + ARROW.gap + 14) * s : WIN.gapLeft);
  const winR = rx + rw - WIN.right;
  return { cards, s, twoCols, win: { x: winX, w: winR - winX, cy: ry + rh / 2 - WIN.cyUp, maxH: rh - 60 } };
};

const isVideo = (smp: CarouselSample) => smp.kind === 'video' || (smp.kind === undefined && /\.(mp4|mov|webm|m4v)(\?|$)/i.test(smp.src));

/** 模板画的白色相纸卡:缩略图(黑底 contain + 淡阴影)+ 文件名两行居中 */
const PaperCard: React.FC<{ smp: CarouselSample; w: number; h: number; s: number; fontFamily: string }> = ({ smp, w, h, s, fontFamily }) => {
  if (smp.cardSrc) return <Img src={smp.cardSrc} style={{ position: 'absolute', inset: 0, width: w, height: h }} />;
  const thumb = smp.thumb ?? smp.src;
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#FFFFFF', borderRadius: 7 * s, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: 24 * s,
          top: 11 * s,
          width: w - 48 * s,
          height: 141 * s,
          background: '#0A0A0A',
          boxShadow: `0 ${2 * s}px ${5 * s}px rgba(0,0,0,0.35)`,
          overflow: 'hidden',
        }}
      >
        <Img src={thumb} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
      {smp.name ? (
        <div
          style={{
            position: 'absolute',
            left: 8 * s,
            right: 8 * s,
            top: 160 * s,
            fontFamily,
            fontWeight: 700,
            fontSize: 15.5 * s,
            lineHeight: 1.3,
            color: '#1E1E1E',
            textAlign: 'center',
            wordBreak: 'break-all',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {smp.name}
        </div>
      ) : null}
    </div>
  );
};

/** 选中虚线框:每边从角外 15.5px 起按周期排短划,四角 L 形 */
const DashedFrame: React.FC<{ r: Rect; color: string; s: number }> = ({ r, color, s }) => {
  const pad = SEL.pad * s;
  const [x, y, w, h] = [r[0] - pad, r[1] - pad, r[2] + 2 * pad, r[3] + 2 * pad];
  const sw = SEL.stroke * Math.max(0.6, s);
  const arm = SEL.cornerArm * Math.max(0.6, s);
  const paths: string[] = [];
  const corners: Array<[number, number]> = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  for (let i = 0; i < 4; i += 1) {
    const [ax, ay] = corners[i];
    const [bx, by] = corners[(i + 1) % 4];
    const L = Math.hypot(bx - ax, by - ay);
    const ux = (bx - ax) / L;
    const uy = (by - ay) / L;
    // 中间的短划:在 [arm+gap, L−arm−gap] 里均匀排
    const inner0 = arm + (SEL.period - SEL.dash);
    const usable = L - 2 * inner0;
    const count = Math.max(1, Math.round((usable + (SEL.period - SEL.dash)) / SEL.period));
    const period = (usable + (SEL.period - SEL.dash)) / count;
    const dash = period * (SEL.dash / SEL.period);
    for (let k = 0; k < count; k += 1) {
      const a = inner0 + k * period;
      paths.push(`M${ax + ux * a},${ay + uy * a}L${ax + ux * (a + dash)},${ay + uy * (a + dash)}`);
    }
    // 终点角:本边最后 arm + 下一边开头 arm
    const [cx2, cy2] = corners[(i + 2) % 4];
    const L2 = Math.hypot(cx2 - bx, cy2 - by);
    const vx = (cx2 - bx) / L2;
    const vy = (cy2 - by) / L2;
    paths.push(`M${bx - ux * arm},${by - uy * arm}L${bx},${by}L${bx + vx * arm},${by + vy * arm}`);
  }
  return (
    <svg style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, overflow: 'visible' }} width={1920} height={1080}>
      <path d={paths.join('')} stroke={color} strokeWidth={sw} fill="none" strokeLinejoin="miter" strokeLinecap="butt" />
    </svg>
  );
};

/** 橙三角 + 两层高斯外发光;mirror = 放在卡右侧朝左指(两列布局的右列) */
const Arrow: React.FC<{ r: Rect; s: number; fill: string; glow: string; mirror?: boolean; id: string }> = ({ r, s, fill, glow, mirror, id }) => {
  const w = ARROW.w * s;
  const h = ARROW.h * s;
  const cy = r[1] + r[3] / 2;
  const tipX = mirror ? r[0] + r[2] + ARROW.gap * s : r[0] - ARROW.gap * s;
  const backX = mirror ? tipX + w : tipX - w;
  const pts = `${backX},${cy - h / 2} ${tipX},${cy} ${backX},${cy + h / 2}`;
  return (
    <svg style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, overflow: 'visible' }} width={1920} height={1080}>
      <defs>
        {ARROW.glows.map((g, i) => (
          <filter key={i} id={`${id}-g${i}`} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation={g.sigma * s} />
          </filter>
        ))}
      </defs>
      {ARROW.glows.map((g, i) => (
        <polygon key={i} points={pts} fill={glow} opacity={g.opacity} filter={`url(#${id}-g${i})`} />
      ))}
      <polygon points={pts} fill={fill} />
    </svg>
  );
};

/** 代码画的文件夹页:浅灰窗口 + 标题栏 + 缩略图网格(样片排在最前面,后面是灰色占位格) */
const folderGrid = (rect: Rect, total: number) => {
  const [rx, ry, rw, rh] = rect;
  const pad = 0.06 * rw;
  const top = ry + 0.12 * rh;
  const cols = 6;
  const cellW = (rw - 2 * pad) / cols;
  const cellH = cellW * (CARD.h / CARD.w);
  const cells: Rect[] = [];
  const sc = 0.8206; // 原片抽卡起始缩放 = 页上缩略格 / 卡
  for (let i = 0; i < total; i += 1) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const w = Math.min(cellW * 0.9, CARD.w * sc * (rw / 1640.8));
    const h = w * (CARD.h / CARD.w);
    cells.push([rx + pad + c * cellW + (cellW - w) / 2, top + r * cellH * 1.02 + (cellH - h) / 2, w, h]);
  }
  return cells;
};

const loadImg = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`SampleCarousel: 缩略图加载失败 ${url}`));
    img.src = url;
  });

export const SampleCarousel: React.FC<SampleCarouselProps> = ({
  samples,
  picks,
  pickAtSec,
  pushAtSec,
  holdSec = DEFAULT_HOLD_SEC,
  firstPickAtSec = FIRST_PICK / MEASURED_FPS,
  pullAtSec = PULL_AT / MEASURED_FPS,
  outroAtSec,
  outroShift = OUTRO_SHIFT,
  outro,
  page,
  pullFrom,
  folderTitle = '样片',
  extraThumbs = 12,
  rect = SAMPLE_CAROUSEL_RECT,
  cardRects,
  window: winOverride,
  accent = SEL.color,
  arrowColor = ARROW.fill,
  glowColor = ARROW.glow,
  dimOpacity = DIM_OPACITY,
  backdrop = true,
  speed = 1,
  noCurl = false,
  fontFamily = "'Noto Sans SC', 'PingFang SC', sans-serif",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = samples.length;
  const auto = sampleCarouselLayout(n, rect);
  const cards = cardRects ?? auto.cards;
  const s = cardRects ? cardRects[0][2] / CARD.w : auto.s;
  const win = winOverride ? { maxH: rect[3] - 60, ...winOverride } : auto.win;
  const pickList = picks ?? samples.map((_, i) => i);
  /** 秒 → 本地帧(当前 fps) */
  const F = (sec: number) => sec * fps;
  /** 原片帧长 → 当前 fps 帧长(按 speed 缩放) */
  const D = (measured: number) => (measured * fps) / MEASURED_FPS / speed;
  const pickAt = pickList.map((_, i) => F(pickAtSec?.[i] ?? firstPickAtSec + i * holdSec));
  const pullAt = F(pullAtSec);
  const pushAt = pickAt.map((t, i) => (pushAtSec?.[i] !== undefined ? F(pushAtSec[i]) : t - D(PUSH_LEAD)));
  const outroAt = outroAtSec === undefined ? Infinity : F(outroAtSec);
  const inOutro = frame >= outroAt;

  // 页上的缩略格:代码页按网格,自给截图用 pullFrom
  const gridCells = folderGrid(rect, n + extraThumbs);
  const fromRects: Rect[] = cards.map((c, i) => {
    if (pullFrom?.[i]) return pullFrom[i];
    if (!page) return gridCells[i];
    const sc = 0.8206;
    return [rect[0] + rect[2] * (0.2 + 0.12 * i), rect[1] + rect[3] * 0.15, c[2] * sc, c[3] * sc];
  });

  // 代码画文件夹页(给 PageCurlTransition 当纸)
  const paintFolder = async (ctx: CanvasRenderingContext2D, box: { x: number; y: number; width: number; height: number }) => {
    const { width: W, height: H } = box;
    const ox = box.x;
    const oy = box.y;
    // 桌面出血:深蓝灰渐变(翻页时露在纸边)
    const g = ctx.createLinearGradient(-400, -300, W, H);
    g.addColorStop(0, '#5B6B8C');
    g.addColorStop(1, '#2C3448');
    ctx.fillStyle = g;
    ctx.fillRect(-400, -300, W + 800, H + 600);
    ctx.fillStyle = '#F4F4F6';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#E6E6EA';
    ctx.fillRect(0, 0, W, 0.07 * H);
    ['#FF5F57', '#FEBC2E', '#28C840'].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(28 + i * 26, 0.035 * H, 8, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#333';
    ctx.font = `700 ${Math.round(0.024 * H)}px ${fontFamily}`;
    ctx.fillText(folderTitle, 120, 0.035 * H + 0.009 * H);
    const imgs = await Promise.all(samples.map((smp) => loadImg(smp.thumb ?? smp.src).catch(() => null)));
    gridCells.forEach((cell, i) => {
      const [cx, cy, cw, ch] = [cell[0] - ox, cell[1] - oy, cell[2], cell[3]];
      if (cy + ch > H - 10) return;
      const k = cw / CARD.w;
      if (i < n) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(cx, cy, cw, ch);
        const tx = cx + 24 * k;
        const ty = cy + 11 * k;
        const tw = cw - 48 * k;
        const th = 141 * k;
        ctx.fillStyle = '#0A0A0A';
        ctx.fillRect(tx, ty, tw, th);
        const img = imgs[i];
        if (img) {
          const a = img.width / img.height;
          let dw = tw;
          let dh = tw / a;
          if (dh > th) {
            dh = th;
            dw = th * a;
          }
          ctx.drawImage(img, tx + (tw - dw) / 2, ty + (th - dh) / 2, dw, dh);
        }
        ctx.fillStyle = '#1E1E1E';
        ctx.font = `700 ${Math.round(15.5 * k)}px ${fontFamily}`;
        ctx.textAlign = 'center';
        const name = samples[i].name ?? '';
        ctx.fillText(name.length > 14 ? `${name.slice(0, 13)}…` : name, cx + cw / 2, cy + 175 * k, cw - 12 * k);
        ctx.textAlign = 'left';
      } else {
        ctx.fillStyle = '#DADAE0';
        ctx.fillRect(cx + 24 * k, cy + 11 * k, cw - 48 * k, 141 * k);
        ctx.fillStyle = '#C8C8CE';
        ctx.fillRect(cx + 40 * k, cy + 168 * k, cw - 80 * k, 10 * k);
      }
    });
  };

  const pageMode = page !== undefined;
  const dimmed = backdrop && frame >= pullAt;
  const pageFilter = dimmed ? `blur(${BACKDROP.blurPx}px) brightness(${BACKDROP.brightness})` : undefined;
  // 纸(卷页 + 之后当背景):noCurl 时从落定帧开始
  const curlFrom = noCurl ? -Math.ceil(D(20)) : 0;

  // 当前选中的是 pickList 里第几条
  let sel = -1;
  for (let i = 0; i < pickAt.length; i += 1) if (frame >= pickAt[i]) sel = i;
  if (inOutro) sel = -1;

  // 卡片:抽出 + 选中态
  const cardEls = cards.map((c, i) => {
    const p = interpolate(frame, [pullAt, pullAt + D(PULL_DUR)], [0, 1], clampBoth);
    const fr = fromRects[i];
    const sc = interpolate(p, [0, 1], [fr[2] / c[2], 1], clampBoth);
    const x = interpolate(p, [0, 1], [fr[0], c[0]], clampBoth) + (inOutro ? outroShift[0] * s : 0);
    const y = interpolate(p, [0, 1], [fr[1], c[1]], clampBoth) + (inOutro ? outroShift[1] * s : 0);
    const selectedIdx = sel >= 0 ? pickList[sel] : -1;
    const opacity = selectedIdx >= 0 && selectedIdx !== i ? dimOpacity : 1;
    const moving = p < 1; // 抽卡首帧就是 0.82 倍;p=1 落定后清 transform(Z1)
    return (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: c[2],
          height: c[3],
          opacity,
          // Z1:落定后清 transform
          transform: moving ? `scale(${sc})` : undefined,
          transformOrigin: '0 0',
        }}
      >
        <PaperCard smp={samples[i]} w={c[2]} h={c[3]} s={s} fontFamily={fontFamily} />
      </div>
    );
  });

  const selIdx = sel >= 0 ? pickList[sel] : -1;
  const selRect = selIdx >= 0 ? cards[selIdx] : null;
  const mirror = auto.twoCols && !cardRects && selIdx % 2 === 1;

  // 视频窗:第一条升起,之后推屏
  const windows = pickList.map((smpIdx, i) => {
    const smp = samples[smpIdx];
    const aspect = smp.aspect ?? 16 / 9;
    let h = win.w / aspect;
    let w = win.w;
    if (h > win.maxH) {
      h = win.maxH;
      w = h * aspect;
    }
    const x = win.x + (win.w - w) / 2;
    const top = win.cy - h / 2;
    const pushStart = i === 0 ? pickAt[0] : pushAt[i];
    // 入场
    const enterStart = i === 0 ? pickAt[0] : pushStart + D(EXIT.dur);
    // 出场 = 下一条的推屏起点
    const exitStart = i + 1 < pickAt.length ? pushAt[i + 1] : Infinity;
    const visibleFrom = i === 0 ? pickAt[0] : enterStart;
    // 出画末帧(原片 f133 / f225 还露一截窗底)也要画,所以再多留 1 个原片帧
    const visibleTo = Math.min(exitStart + D(EXIT.dur + 1), outroAt);
    return { smp, x, top, w, h, i, enterStart, exitStart, visibleFrom, visibleTo };
  });

  const clip = `polygon(${rect[0]}px ${rect[1]}px, ${rect[0] + rect[2]}px ${rect[1]}px, ${rect[0] + rect[2]}px ${rect[1] + rect[3]}px, ${rect[0]}px ${rect[1] + rect[3]}px)`;

  return (
    <AbsoluteFill>
      {/* ① 纸:卷页飞入 → f30 起模糊压暗当背景 */}
      <Sequence from={curlFrom} layout="none">
        <PageCurlTransition
          src={page?.src}
          srcRect={page?.srcRect}
          bleedColor={page?.bleedColor}
          paint={pageMode ? undefined : paintFolder}
          paintKey={pageMode ? undefined : `${folderTitle}|${samples.map((x) => x.thumb ?? x.src).join(',')}|${extraThumbs}`}
          rect={rect}
          speed={speed}
          canvasStyle={{ filter: pageFilter }}
        />
      </Sequence>
      {dimmed ? <div style={{ position: 'absolute', left: rect[0], top: rect[1], width: rect[2], height: rect[3], background: BACKDROP.overlay }} /> : null}
      {/* ② 卡片(抽出后常驻) */}
      {frame >= pullAt ? <AbsoluteFill style={{ clipPath: clip }}>{cardEls}</AbsoluteFill> : null}
      {/* ③ 选中态:虚线框 + 三角(硬切) */}
      {selRect ? (
        <AbsoluteFill style={{ clipPath: clip }}>
          <Arrow r={selRect} s={s} fill={arrowColor} glow={glowColor} mirror={mirror} id={`sc-arrow-${selIdx}`} />
          <DashedFrame r={selRect} color={accent} s={s} />
        </AbsoluteFill>
      ) : null}
      {/* ④ 视频窗(被内容区裁切) */}
      <AbsoluteFill style={{ clipPath: clip }}>
        {windows.map((wd) => {
          if (!(frame >= wd.visibleFrom && frame < wd.visibleTo)) return null;
          let dy = 0;
          let opacity = 1;
          if (wd.i === 0) {
            const r0 = wd.enterStart + D(RISE.hold);
            dy = interpolate(frame, [r0, r0 + D(RISE.dur)], [RISE.dy, 0], { ...clampBoth, easing: RISE.ease });
            opacity = frame < r0 + D(1) ? RISE.firstOpacity : 1;
          } else {
            dy = interpolate(frame, [wd.enterStart, wd.enterStart + D(ENTER.dur)], [ENTER.dy, 0], { ...clampBoth, easing: ENTER.ease });
          }
          if (frame >= wd.exitStart) {
            dy = interpolate(frame, [wd.exitStart, wd.exitStart + D(EXIT.dur)], [0, EXIT.dy], { ...clampBoth, easing: EXIT.ease });
          }
          const sy = rect[3] / 924.4;
          const settledNow = Math.abs(dy) < 0.01 && opacity === 1;
          const smp = wd.smp;
          return (
            <div
              key={wd.i}
              style={{
                position: 'absolute',
                left: wd.x,
                top: wd.top,
                width: wd.w,
                height: wd.h,
                opacity: opacity === 1 ? undefined : opacity,
                transform: settledNow ? undefined : `translateY(${dy * sy}px)`,
                background: '#000',
              }}
            >
              {isVideo(smp) ? (
                <Sequence from={Math.floor(wd.visibleFrom)} layout="none">
                  <OffthreadVideo
                    src={smp.src}
                    trimBefore={smp.trimBeforeSec ? Math.round(smp.trimBeforeSec * fps) : undefined}
                    volume={smp.volume ?? 0}
                    muted={!smp.volume}
                    style={{ width: '100%', height: '100%', objectFit: 'fill' }}
                  />
                </Sequence>
              ) : (
                <Img src={smp.src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
            </div>
          );
        })}
      </AbsoluteFill>
      {/* ⑤ 收尾叠加 */}
      {outro && outroAt !== Infinity ? (
        <Sequence from={Math.floor(outroAt)} layout="none">
          {outro}
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};
