/**
 * MindmapReview.tsx — 「思维导图复习」镜头模板(秋芝《Codex 全解》39:04「我们回顾一下」实测版)。
 *
 * 出处:内部复刻案例 qz-cx-2344-mindmap-review(交付 19),工序④逐帧实测 + 拟合。
 * 默认值 = 原片 30fps 实测曲线与 1080p 几何,不是手调;每条曲线的来源写在常量注释里(案例 specs/motion.json 同名 id)。
 *
 * 画面:黑底 + 淡蓝紫光晕 + 正弦起伏点阵;根卡(可带图标)在上,一级分支横排,T 形连线。
 * 口播说到哪一项 → 从父节点沿折线描一条半透明蓝线(描时粗 1.35 倍、圆线头,描到最后收细)→ 线到头卡片上浮 + 放大 + 淡入(带一次轻过冲)。
 * 叶子项在父卡下面竖着堆(第一张有短线连着,后面的按节拍直接浮上来,原片如此)。
 *
 * 树的排法(自动):
 *   · 根的孩子永远横排(direction='right' 时竖排在根右侧)
 *   · 其余节点:孩子全是叶子 → 竖着堆(chip 小卡);孩子里有带子项的 → 横排(card 中卡,T 形连线)
 *   · 整棵树算完包围盒后按安全区等比缩放 + 居中(分支多自动缩;maxScale 允许放大,竖屏用)
 *   · 字多了卡片自动加宽(按字宽估算,中文 1em、西文约 0.6em)
 *
 * 时间:
 *   · 每个节点的 `at`(当前 fps 的帧,相对组件起点)= 它的线开始描的时刻(没线的堆叠小卡 = 卡开始浮的时刻),对口播用
 *   · 不给 `at` 就按先序(先分支、再它的子项、再下一分支)自动排:带线的一项占 21 帧、堆叠小卡 14 帧(原片节拍,@30fps)
 *   · preshownDepth:这一层及以上开场就在(原片 = 1:根 + 一级分支 + T 形线开场常驻);0 = 连一级分支也逐个长出来
 *   · highlights:逐支高亮「回顾到哪一支」,其余分支压暗(这一项原片没有,是设计值,不是实测)
 *
 * 用法:
 *   <Sequence from={x}>
 *     <MindmapReview root={{ label: 'Codex' }} branches={[{ label: '基础能力', caption: 'BASICS', children: [...] }, ...]} />
 *   </Sequence>
 * 组件铺满父容器,几何按 1080p 画布像素给(其它画布按 useVideoConfig 的宽高自动排)。
 */
import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, random, useCurrentFrame, useVideoConfig } from 'remotion';

const clampBoth = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 实测时基:原片 30fps。下面所有帧数都是原片帧 */
const MEASURED_FPS = 30;

type Bez = [number, number, number, number];
type Curve = { from: number; to: number; bez: Bez };

// ── 实测曲线(相对「卡开始浮」或「线开始描」的原片帧;案例 specs/motion.json) ──
/** 中卡入场 = l2-local(f50–f58):上浮 26.66px→0 带过冲、0.907→1 放大、f50–f55 淡入 */
const CARD_IN = {
  rise: 26.6561,
  scaleFrom: 0.907,
  y: { from: 0, to: 8, bez: [0.3482, 1.2885, 0.4325, 0.9964] as Bez },
  scale: { from: 0, to: 8, bez: [0.3398, 0.9999, 0.1393, 1] as Bez },
  opacity: { from: 0, to: 5, bez: [0.2899, 0.0118, 0.3348, 0.3665] as Bez },
};
/** 小卡入场 = l3-ctx(f84–f92):上浮 17.66px、0.938→1、f84–f88 淡入(堆叠小卡无连线,原片按约 14 帧节拍往下堆) */
const CHIP_IN = {
  rise: 17.6627,
  scaleFrom: 0.9384,
  y: { from: 0, to: 8, bez: [0.2952, 1.3908, 0.3667, 0.9793] as Bez },
  scale: { from: 0, to: 8, bez: [0.2514, 1, 0.0811, 1] as Bez },
  opacity: { from: 0, to: 4, bez: [0.4459, 0.5299, 0.7967, 0.7861] as Bez },
};
/** 长连线描线 = path-local(f41–f49,8 帧 ease-out),子卡在描线开始后第 9 帧起浮(f50) */
const LINE_LONG: Curve = { from: 0, to: 8, bez: [0.1508, 0.256, 0.322, 1] };
const LINE_LONG_CARD_DELAY = 9;
/** 短连线(竖堆第一张的 32px 短线)= path-perm(f62–f70),小卡在第 6 帧就开始浮(f68,线尾藏在卡下) */
const LINE_SHORT: Curve = { from: 0, to: 8, bez: [0, 0.0479, 0.3446, 0.8724] };
const LINE_SHORT_CARD_DELAY = 6;
/** 描线时线宽倍率 = path-local strokeScale(f42–f50):1.3487 → 1,前慢后快(描到最后 4–6 帧同步收细) */
const STROKE_SCALE: Curve & { v0: number } = { from: 1, to: 9, v0: 1.3487, bez: [0.945, 0.3688, 0.2047, 0.6584] };
/** 自动排时的节拍:带线的一项 21 帧(f41→f62)、堆叠小卡 14 帧(f84→f97→f111) */
const BEAT_LINED = 21;
const BEAT_STACK = 14;
/** 高亮切换淡入淡出(设计值,原片无) */
const HILITE_FADE = 8;

// ── 实测几何(1080p px;案例 specs/layout.json + layout-ext.json) ──
type Rgb = [number, number, number];
type Rgba = [number, number, number, number];
type Tier = 'root' | 'l1' | 'card' | 'chip';
type CardLook = {
  angle: number; c0: Rgb; c1: Rgb; borderTop: Rgba; borderBottom: Rgba; borderWidth: number; hiAdd: Rgb; hiTh: number;
};
/** 尺寸:root 440×148 / 一级 257×107.5 / 中卡 188.5×100.5 / 小卡 195.5×49.5;字号 54.9 / 33.9 / 27.4 / 19.4 */
const TIER = {
  root: { w: 440.4, h: 148, r: 31.689, font: 54.89, spacing: -0.36, pad: 64, hiY: 17.1, hiInset: 21.9 },
  l1: { w: 257.1, h: 107.5, r: 26.443, font: 33.9, spacing: -0.4, pad: 34, hiY: 17.0, hiInset: 21.4, capBase: 36.3, mainBase: 72.3 },
  card: { w: 188.5, h: 100.5, r: 26.294, font: 27.44, spacing: -0.15, pad: 26, hiY: 17.4, hiInset: 21.8, capBase: 35, mainBase: 67 },
  chip: { w: 195.5, h: 49.5, r: 15.939, font: 19.4, spacing: -0.02, pad: 22, hiY: 9.8, hiInset: 17.9, capBase: 0, mainBase: 30.3 },
} as const;
/** 卡面(逐卡拟合、同类取平均):CSS 角度线性渐变 + 竖向渐变 rgba 描边 + 顶部两端渐隐的加色高光线 */
const LOOK: Record<Tier | 'accent', CardLook> = {
  root: { angle: 144.85, c0: [23.49, 39.2, 74.33], c1: [5.08, 11.11, 29.71], borderTop: [49.1, 63.2, 93.4, 0.785], borderBottom: [59.8, 71.8, 103.3, 0.785], borderWidth: 1.56, hiAdd: [13.96, 17.92, 22.72], hiTh: 2.397 },
  l1: { angle: 140.807, c0: [17.647, 27.74, 52.393], c1: [5.317, 10.6, 24.17], borderTop: [54.2, 73, 110.8, 0.623], borderBottom: [77.6, 86.4, 110.3, 0.623], borderWidth: 1.504, hiAdd: [12.82, 18.11, 25.76], hiTh: 2.368 },
  card: { angle: 139.553, c0: [17.867, 27.56, 52.03], c1: [4.687, 9.67, 21.653], borderTop: [107.6, 126.1, 164.3, 0.27], borderBottom: [120.8, 134.9, 166, 0.27], borderWidth: 1.713, hiAdd: [14.33, 18.35, 25.13], hiTh: 2.522 },
  chip: { angle: 140.292, c0: [13.667, 23.937, 47.587], c1: [4.412, 8.242, 18.867], borderTop: [87.7, 102.6, 132.4, 0.305], borderBottom: [99.7, 114.8, 144.8, 0.305], borderWidth: 1.524, hiAdd: [10.76, 12.81, 17.53], hiTh: 1.785 },
  /** 紫卡(「生图」「个人主页开发部署」):蓝→紫高饱和渐变 + 蓝色外辉光 */
  accent: { angle: 145.87, c0: [21.64, 75.445, 228.285], c1: [79.22, 60.08, 218.07], borderTop: [102, 104.1, 109.1, 0.432], borderBottom: [71, 89.2, 175.4, 0.432], borderWidth: 1.466, hiAdd: [12.32, 15.01, 16.11], hiTh: 2.242 },
};
/** 投影:深卡 0 26.1px 43.7px 黑 0.356;紫卡 0 20.2px 75px -26.9px 蓝 0.205(单独一层压在所有卡下面) */
const SHADOW_DARK = '0 26.1px 43.7px 0 rgba(0,0,0,0.356)';
const accentShadow = (rgb: Rgb) => `0 20.2px 75px -26.9px rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.205)`;
/** 间距:根底→一级卡顶 107.46(横梁在根底下 36.85);一级底→中卡顶 138.9(横梁在底下 86.0);竖堆首卡离父卡 28.1,小卡间隙 15.77(步长 65.23) */
const GAP = {
  rootRow: 107.46, rootBeam: 36.85,
  row: 138.9, rowBeam: 86.0,
  stackFirst: 28.1, stackGap: 15.77,
  sibling: 25.5,
  /** 一级分支之间的最大间距(原片 200 左右;分支少时摊开,多时收到 sibling) */
  l1Max: 150,
};
/** 连线:同一个蓝 rgb(108,162,249);根→一级 线宽 5.9 α0.867;其余 4.13(竖堆短线 4.39)α0.637;两端各藏进卡边 2px */
const LINE = { color: 'rgb(108,162,249)', trunkW: 5.9, trunkA: 0.867, w: 4.13, shortW: 4.39, a: 0.637, tuck: 2 };
/** 小标题:9.5px 字距 1.45,灰 rgb(160,166,179);紫卡上是 rgb(171,186,254) */
const CAPTION = { size: 9.5, spacing: 1.45, color: 'rgb(160,166,179)', accentColor: 'rgb(171,186,254)' };
/** 两行字的中卡(「个人主页 / 开发部署」):小标题基线 +21、两行基线 +53 / +82 */
const TWO_LINE = { capBase: 21, line1: 53, line2: 82 };
/**
 * 截图可读下限(泽轩604 09-27 验收要求「方便观众截图保存」;1080p 横屏的画布 px,竖屏按 min(宽/1920, 高/1080) 等比折算)。
 * 只在 fit='auto' 生效(复刻对位 fit='none' 保持原片 1:1)。做法:字号抬到下限,卡高、圆角、内边距、基线跟字号等比放大,
 * 卡宽不跟着放大(只按字宽撑开),这样横向不挤。
 */
export const MINDMAP_MIN_FONT = { root: 64, l1: 44, card: 36, chip: 30, caption: 16 };
type Metrics = {
  fz: number; w: number; h: number; r: number; font: number; spacing: number; pad: number; hiY: number; hiInset: number;
  capBase: number; mainBase: number; cap: number; capSpacing: number; capBase2: number; line1: number; line2: number;
};
const metricsFor = (tier: Tier, fz: number, capMin: number, minW?: number): Metrics => {
  const t = TIER[tier] as (typeof TIER)[Tier] & { capBase?: number; mainBase?: number };
  const cap = Math.max(CAPTION.size * fz, capMin);
  return {
    fz,
    w: minW ?? t.w,
    h: t.h * fz,
    r: t.r * Math.min(fz, 1.25),
    font: t.font * fz,
    spacing: t.spacing * fz,
    pad: t.pad * fz,
    hiY: t.hiY * fz,
    hiInset: t.hiInset,
    capBase: (t.capBase ?? 0) * fz,
    mainBase: (t.mainBase ?? 0) * fz,
    cap,
    capSpacing: (CAPTION.spacing * cap) / CAPTION.size,
    capBase2: TWO_LINE.capBase * fz,
    line1: TWO_LINE.line1 * fz,
    line2: TWO_LINE.line2 * fz,
  };
};
type TierScale = { fz: Record<Tier, number>; capMin: number };
const NO_BOOST: TierScale = { fz: { root: 1, l1: 1, card: 1, chip: 1 }, capMin: 0 };
/** 根卡标题辉光:σ13.8、下移 7.2、rgb(12,40.7,127.5) 斜率 1.2 */
const ROOT_GLOW = { rgb: [12, 40.7, 127.5] as Rgb, alpha: 1.204, sigma: 13.81, dy: 7.24 };
/** 点阵(案例 dotgrid.json 拟合):间距 60.33、正弦起伏振幅 11.2px、周期 150 帧、波长 450.5px */
const DOTS = { x0: 24.438, sx: 60.3274, y0: 26.854, sy: 60.3306, amp: 11.175, period: 150, lambda: 450.5, phi: 1.9019 };

export type MindmapNode = {
  /** 主文字;'\n' 换行(只有中卡支持两行) */
  label: string;
  /** 卡顶小标题(英文大写,原片 BASICS / LOCAL FILES);小卡不显示 */
  caption?: string;
  children?: MindmapNode[];
  /** 紫卡强调 */
  accent?: boolean;
  /** 卡型:不给按位置自动(一级 l1、横排 card、竖堆 chip) */
  size?: 'l1' | 'card' | 'chip';
  /** 出现时刻(当前 fps 的帧,相对组件起点):有线 = 线开始描,无线 = 卡开始浮 */
  at?: number;
  /** 卡开始浮的时刻(覆盖默认「线开始后 9 帧 / 短线 6 帧」) */
  cardAt?: number;
  /** 这条线描几帧(原片帧,默认 8) */
  lineFrames?: number;
  /** 卡片入场几帧(原片帧,默认 8;原片录屏变速段里有 11–12 帧的) */
  cardFrames?: number;
  /** 手动指定卡中心 x(画布 px,只在 fit='none' 时有意义,复刻对位用) */
  x?: number;
  id?: string;
};

export type MindmapPalette = {
  /** 连线色 */
  line?: string;
  /** 深卡的渐变两端(给了就覆盖四种深卡) */
  cardFrom?: Rgb;
  cardTo?: Rgb;
  /** 强调卡渐变两端 + 外辉光色 */
  accentFrom?: Rgb;
  accentTo?: Rgb;
  accentGlow?: Rgb;
  /** 小标题色 */
  caption?: string;
  /** 根标题辉光色(默认原片深蓝 rgb(12,40.7,127.5)) */
  titleGlow?: Rgb;
  /** 背景:底色 + 两团光晕色 */
  bg?: string;
  glowA?: string;
  glowB?: string;
};

export type MindmapHighlight = {
  /** 第几支(从 0 数)或分支 label */
  branch: number | string;
  from: number;
  /** 不给 = 一直亮到结束 */
  to?: number;
};

export type MindmapReviewProps = {
  root: {
    label: string;
    /** 根图标:图片地址或自绘 ReactNode;width/height = 图标盒(px),原片 Codex 补丁 102×118 */
    icon?: { src?: string; node?: React.ReactNode; width: number; height: number; x?: number; y?: number };
    /** 标题手动位置(相对根卡左上,x = 起笔,y = 基线;复刻对位用) */
    titleX?: number;
    titleBaseline?: number;
    /** 根卡中心 x(画布 px,只在 fit='none' 时用;默认画面中线) */
    x?: number;
  };
  branches: MindmapNode[];
  /** 'down' = 原片自上而下;'right' = 单侧展开(根在左,分支在右竖排,子项往右排成一串) */
  direction?: 'down' | 'right';
  /** 开场就在的层数:1 = 原片(根 + 一级 + T 形线常驻);0 = 只有根,一级也逐个长 */
  preshownDepth?: 0 | 1;
  /** 速度倍率:1 = 原片(描线 8 帧、卡 8 帧);自动排节拍也跟着变 */
  speed?: number;
  /** 自动排的起播延迟(当前 fps 帧) */
  startDelay?: number;
  /** 自动排节拍(原片帧):带线的一项 / 堆叠小卡 */
  beat?: { lined?: number; stacked?: number };
  highlights?: MindmapHighlight[];
  /** 高亮时其余分支压到多暗(0–1,默认 0.3) */
  dimTo?: number;
  palette?: MindmapPalette;
  /** 字体:原片 Avenir Next Heavy + PingFang SC(macOS 系统字);默认 Noto Sans SC 800(工作台自带) */
  fontFamily?: string;
  fontWeight?: number;
  /** 'dots' = 原片黑底光晕点阵;'none' = 透明(叠在自己的底上) */
  background?: 'dots' | 'none';
  /** 'auto' = 按安全区缩放居中;'none' = 按 1080p 原始几何摆(配合节点 x,复刻对位用) */
  fit?: 'auto' | 'none';
  /** 安全区(px):上 / 下(给字幕留)/ 左右 */
  safe?: { top?: number; bottom?: number; side?: number };
  /** 截图可读下限(1080p px):false = 关掉(完全按原片字号);只在 fit='auto' 生效 */
  minFont?: Partial<typeof MINDMAP_MIN_FONT> | false;
  /** 缩放上限:横屏默认 1.3、竖屏 1.8(树小的时候放大填满,截图字更清楚;原片几何是 1);下限默认 0.6,再小字就看不清了 */
  maxScale?: number;
  minScale?: number;
};

// ───────────────────────── 排版 ─────────────────────────
type LNode = {
  key: string;
  node: MindmapNode;
  depth: number;
  branch: number; // 一级分支序号;根 = -1
  parent?: LNode;
  kids: LNode[];
  mode: 'row' | 'stack'; // 孩子怎么排
  tier: Tier;
  m: Metrics;
  accent: boolean;
  w: number;
  h: number;
  // 抽象坐标:u = 深度方向(down=y),v = 横向(down=x);u 是卡「近端」,v 是卡中心
  u: number;
  v: number;
  sub: number; // 子树在 v 方向的宽
  // 定时(当前 fps 帧)
  lineStart: number;
  lineDur: number;
  cardStart: number;
  lineKind: 'none' | 'long' | 'short';
  preshown: boolean;
};

const CJK = /[⺀-鿿豈-﫿＀-￯]/;
const textWidth = (s: string, size: number, spacing: number) => {
  let w = 0;
  for (const ch of s) w += CJK.test(ch) ? size : ch === ' ' ? size * 0.3 : size * 0.62;
  return w + spacing * Math.max(0, [...s].length - 1);
};

const buildTree = (props: MindmapReviewProps, dir: 'down' | 'right', ts: TierScale, narrow: boolean) => {
  const all: LNode[] = [];
  const make = (node: MindmapNode, depth: number, branch: number, parent: LNode | undefined, inStack: boolean): LNode => {
    const tier: Tier = depth === 0 ? 'root' : node.size ?? (depth === 1 ? 'l1' : inStack ? 'chip' : 'card');
    // 单侧展开时,往右排成一串的小卡按字宽收窄(最小 140),不然一行塞不下
    // 竖画布(宽不够、高富余):卡宽按字宽收,最小取原宽的 0.7,让整棵树能放得更大
    const t = metricsFor(tier, ts.fz[tier], ts.capMin, dir === 'right' && inStack && tier === 'chip' ? 140 : narrow && tier !== 'root' ? TIER[tier].w * 0.7 : undefined);
    const lines = node.label.split('\n');
    const tw = Math.max(...lines.map((l) => textWidth(l, t.font, t.spacing)));
    const iconW = depth === 0 && props.root.icon ? (props.root.icon.width + 8) * t.fz : 0;
    const w = Math.max(t.w, tw + iconW + 2 * t.pad);
    const h = tier === 'chip' && lines.length > 1 ? t.h + (lines.length - 1) * t.font * 1.1 : t.h;
    const me: LNode = {
      key: node.id ?? `${parent ? parent.key : 'n'}-${parent ? parent.kids.length : 0}`,
      node, depth, branch, parent, kids: [], mode: 'row', tier, m: t, accent: !!node.accent, w, h,
      u: 0, v: 0, sub: 0, lineStart: 0, lineDur: 0, cardStart: 0, lineKind: 'none', preshown: false,
    };
    all.push(me);
    const kids = node.children ?? [];
    // 根:孩子永远横排;其余:孩子全是叶子 → 竖堆
    me.mode = depth === 0 ? 'row' : kids.every((k) => !(k.children && k.children.length)) ? 'stack' : 'row';
    kids.forEach((k, i) => me.kids.push(make(k, depth + 1, depth === 0 ? i : branch, me, me.mode === 'stack')));
    return me;
  };
  const root = make({ label: props.root.label, children: props.branches }, 0, -1, undefined, false);
  // 'right' 方向:卡在 u 方向的尺寸 = 宽,v 方向 = 高
  const du = (n: LNode) => (dir === 'down' ? n.h : n.w);
  const dv = (n: LNode) => (dir === 'down' ? n.w : n.h);
  // 子树宽(v 方向)
  const measure = (n: LNode): number => {
    n.kids.forEach(measure);
    if (!n.kids.length) return (n.sub = dv(n));
    if (n.mode === 'stack') {
      // down:竖堆在父卡正下方,宽 = max;right:往右排成一串,v 宽 = max 高
      return (n.sub = Math.max(dv(n), ...n.kids.map((k) => k.sub)));
    }
    const gap = n.depth === 0 ? GAP.sibling : GAP.sibling;
    return (n.sub = Math.max(dv(n), n.kids.reduce((a, k) => a + k.sub, 0) + gap * (n.kids.length - 1)));
  };
  measure(root);
  // 摆位
  const place = (n: LNode, u: number, v: number, l1Gap: number) => {
    n.u = u;
    n.v = v;
    if (!n.kids.length) return;
    if (n.mode === 'stack') {
      let cu = u + du(n) + GAP.stackFirst;
      n.kids.forEach((k) => {
        if (dir === 'down') place(k, cu, v, l1Gap);
        else place(k, cu, v, l1Gap);
        cu += du(k) + GAP.stackGap;
      });
      return;
    }
    const gap = n.depth === 0 ? l1Gap : GAP.sibling;
    const total = n.kids.reduce((a, k) => a + k.sub, 0) + gap * (n.kids.length - 1);
    let cv = v - total / 2;
    const cu = u + du(n) + (n.depth === 0 ? GAP.rootRow : GAP.row);
    n.kids.forEach((k) => {
      place(k, cu, cv + k.sub / 2, l1Gap);
      cv += k.sub + gap;
    });
  };
  return { root, all, du, dv, place, dir };
};

type Seg = [number, number, number, number]; // 画布坐标 x0,y0,x1,y1
type LinePiece = { owner: LNode; group: number; segs: Seg[]; w: number; alpha: number; start: number; dur: number; curve: Curve };

const layoutCore = (props: MindmapReviewProps, width: number, height: number, fps: number, dirIn: 'down' | 'right', ts: TierScale) => {
  const t = buildTree(props, dirIn, ts, ts !== NO_BOOST && height > width);
  const { root, all, du, dir } = t;
  // 默认用满画布:四周各留 5%(树最多占 90% 宽 / 高);要给字幕 / 平台 UI 让位就传 safe
  const safeTop = props.safe?.top ?? height * 0.05;
  const safeBottom = props.safe?.bottom ?? height * 0.05;
  const side = props.safe?.side ?? width * 0.05;
  const availW = width - 2 * side;
  const availH = height - safeTop - safeBottom;
  // 一级分支间距:在可用宽里摊开,上限 l1Max,下限 sibling
  const l1n = root.kids.length;
  const l1Sum = root.kids.reduce((a, k) => a + k.sub, 0);
  const availV = dir === 'down' ? availW : availH;
  // 一级分支间距:先按最小间距算出缩放 s0,再按 s0 把一级分支摊满可用宽(不会因为摊开反而缩小)
  const bboxOf = () => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    all.forEach((n) => {
      const cxx = dir === 'down' ? n.v : n.u + n.w / 2;
      const top = dir === 'down' ? n.u : n.v - n.h / 2;
      x0 = Math.min(x0, cxx - n.w / 2); y0 = Math.min(y0, top);
      x1 = Math.max(x1, cxx + n.w / 2); y1 = Math.max(y1, top + n.h);
    });
    return { w: x1 - x0, h: y1 - y0 };
  };
  t.place(root, 0, 0, GAP.sibling);
  const b0 = bboxOf();
  const s0 = (props.fit ?? 'auto') === 'auto' ? Math.max(props.minScale ?? 0.3, Math.min(props.maxScale ?? (height > width ? 1.8 : 1.3), availW / b0.w, availH / b0.h)) : 1;
  const l1Gap = l1n > 1 ? Math.max(GAP.sibling, Math.min(GAP.l1Max, (availV / s0 - l1Sum) / (l1n - 1))) : 0;
  t.place(root, 0, 0, l1Gap);
  // 画布坐标(未缩放):down: x=v, y=u;right: x=u, y=v
  const box = (n: LNode) => {
    const cx = dir === 'down' ? n.v : n.u + n.w / 2;
    const top = dir === 'down' ? n.u : n.v - n.h / 2;
    return { x: cx - n.w / 2, y: top, w: n.w, h: n.h };
  };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  all.forEach((n) => {
    const b = box(n);
    minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
  });
  const fitMode = props.fit ?? 'auto';
  let s = 1;
  let ox = 0;
  let oy = 0;
  if (fitMode === 'auto') {
    const bw = maxX - minX;
    const bh = maxY - minY;
    s = Math.min(props.maxScale ?? (height > width ? 1.8 : 1.3), availW / bw, availH / bh);
    s = Math.max(props.minScale ?? 0.3, s);
    ox = side + (availW - bw * s) / 2 - minX * s;
    oy = safeTop + (availH - bh * s) / 2 - minY * s;
  } else {
    // 原始几何:根卡中心在画面中线(或给定 x),根顶 = safe.top
    ox = props.root.x ?? width / 2;
    oy = safeTop - minY;
  }
  const rect = new Map<LNode, { x: number; y: number; w: number; h: number }>();
  all.forEach((n) => {
    const b = box(n);
    let x = ox + b.x * s;
    if (fitMode === 'none' && n.node.x !== undefined) x = n.node.x - (b.w * s) / 2;
    rect.set(n, { x, y: oy + b.y * s, w: b.w * s, h: b.h * s });
  });
  if (fitMode === 'none') {
    // 手动 x 的节点:竖堆里的孩子跟着父卡中心走(没单独给 x 时)
    all.forEach((n) => {
      if (n.parent && n.parent.mode === 'stack' && n.node.x === undefined && dir === 'down') {
        const p = rect.get(n.parent)!;
        const r = rect.get(n)!;
        r.x = p.x + p.w / 2 - r.w / 2;
      }
    });
  }

  // ── 定时 ──
  const k = fps / MEASURED_FPS / (props.speed ?? 1);
  const preDepth = props.preshownDepth ?? 1;
  const beatLined = (props.beat?.lined ?? BEAT_LINED) * k;
  const beatStack = (props.beat?.stacked ?? BEAT_STACK) * k;
  let clock = props.startDelay ?? Math.round(6 * k);
  const order: LNode[] = [];
  const walk = (n: LNode) => {
    order.push(n);
    n.kids.forEach(walk);
  };
  walk(root);
  order.forEach((n) => {
    n.preshown = n.depth <= preDepth;
    if (n.preshown) {
      n.lineStart = -1e6; n.cardStart = -1e6; n.lineDur = 1; n.lineKind = n.depth === 0 ? 'none' : 'long';
      return;
    }
    const p = n.parent!;
    const idxInParent = p.kids.indexOf(n);
    n.lineKind = p.mode === 'row' ? 'long' : idxInParent === 0 ? 'short' : 'none';
    const at = n.node.at ?? clock;
    n.lineStart = at;
    n.lineDur = (n.node.lineFrames ?? 8) * k;
    n.cardStart = n.node.cardAt ?? (n.lineKind === 'long' ? at + LINE_LONG_CARD_DELAY * k * (n.lineDur / (8 * k)) : n.lineKind === 'short' ? at + LINE_SHORT_CARD_DELAY * k : at);
    clock = Math.max(clock, at) + (n.lineKind === 'none' ? beatStack : beatLined);
  });

  // ── 连线(画布坐标) ──
  const pieces: LinePiece[] = [];
  const cx = (n: LNode) => { const r = rect.get(n)!; return r.x + r.w / 2; };
  const cy = (n: LNode) => { const r = rect.get(n)!; return r.y + r.h / 2; };
  const tuck = LINE.tuck * s;
  all.forEach((p) => {
    if (!p.kids.length) return;
    const pr = rect.get(p)!;
    if (p.mode === 'stack') {
      const c = p.kids[0];
      const r = rect.get(c)!;
      const segs: Seg[] = dir === 'down'
        ? [[cx(p), pr.y + pr.h - tuck, cx(p), r.y + tuck]]
        : [[pr.x + pr.w - tuck, cy(p), r.x + tuck, cy(p)]];
      pieces.push({ owner: c, group: p.depth === 0 ? -1 : c.branch, segs, w: LINE.shortW * s, alpha: LINE.a, start: c.lineStart, dur: c.lineDur, curve: LINE_SHORT });
      return;
    }
    // 横排:父卡 → 横梁 → 子卡;按出现顺序,后出现的从已描到的最远点接着描(原片「命令行从交叉点起描」)
    const beamOff = (p.depth === 0 ? GAP.rootBeam : GAP.rowBeam) * s;
    const trunkW = (p.depth === 0 ? LINE.trunkW : LINE.w) * s;
    const alpha = p.depth === 0 ? LINE.trunkA : LINE.a;
    const px = dir === 'down' ? cx(p) : cy(p);
    const p0 = dir === 'down' ? pr.y + pr.h - tuck : pr.x + pr.w - tuck;
    const beam = dir === 'down' ? pr.y + pr.h + beamOff : pr.x + pr.w + beamOff;
    const sorted = [...p.kids].sort((a, b) => a.lineStart - b.lineStart);
    let trunkDone = false;
    let reachNeg = px; // 横梁已描到的最远点(负方向)
    let reachPos = px;
    sorted.forEach((c) => {
      const r = rect.get(c)!;
      const cv = dir === 'down' ? r.x + r.w / 2 : r.y + r.h / 2;
      const cNear = dir === 'down' ? r.y + tuck : r.x + tuck;
      const P = (u: number, v: number): [number, number] => (dir === 'down' ? [v, u] : [u, v]);
      const pts: [number, number][] = [];
      if (!trunkDone) pts.push(P(p0, px));
      let startV = px;
      if (cv < px) { startV = Math.min(px, Math.max(cv, reachNeg)); reachNeg = Math.min(reachNeg, cv); }
      else if (cv > px) { startV = Math.max(px, Math.min(cv, reachPos)); reachPos = Math.max(reachPos, cv); }
      if (trunkDone) pts.push(P(beam, startV));
      else pts.push(P(beam, px));
      if (Math.abs(cv - (trunkDone ? startV : px)) > 1e-3) pts.push(P(beam, cv));
      pts.push(P(cNear, cv));
      trunkDone = true;
      const segs: Seg[] = [];
      for (let i = 0; i + 1 < pts.length; i += 1) {
        if (Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) > 1e-3) segs.push([pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]]);
      }
      pieces.push({ owner: c, group: p.depth === 0 ? -1 : c.branch, segs, w: trunkW, alpha, start: c.lineStart, dur: c.lineDur, curve: LINE_LONG });
    });
  });

  const end = Math.max(0, ...order.filter((n) => !n.preshown).map((n) => n.cardStart + (12 * k * (n.node.cardFrames ?? 8)) / 8));
  // 实际上屏字号 / 下限 的最小比值(<1 = 有字低于下限)
  const tiersUsed = new Set(all.map((n) => n.tier));
  let readable = Infinity;
  if (ts !== NO_BOOST) {
    const u = Math.min(width / 1920, height / 1080);
    const mins = { ...MINDMAP_MIN_FONT, ...(props.minFont || {}) };
    tiersUsed.forEach((tr) => { readable = Math.min(readable, (TIER[tr].font * ts.fz[tr] * s) / (mins[tr] * u)); });
    if (all.some((n) => n.node.caption && n.tier !== 'chip' && n.tier !== 'root')) {
      readable = Math.min(readable, (Math.max(...all.map((n) => n.m.cap)) * s) / (mins.caption * u));
    }
  }
  return { all: order, rect, pieces, scale: s, endFrame: Math.ceil(end), k, dir, readable };
};

/**
 * 排版入口。fit='auto' 时按截图可读下限抬字号;放不下的处理顺序:
 *   ① 用满画布(默认四周只留 5%)② 一级分支间距在剩余空间里摊开 ③ 没指定 direction 时自动试单侧展开,取字更大的那种
 *   ④ 还不够才允许低于下限,返回 readable < 1(说明里提示「这么多内容建议拆两屏」)
 */
export const layoutMindmap = (props: MindmapReviewProps, width: number, height: number, fps: number) => {
  if ((props.fit ?? 'auto') !== 'auto' || props.minFont === false) return layoutCore(props, width, height, fps, props.direction ?? 'down', NO_BOOST);
  const u = Math.min(width / 1920, height / 1080);
  const mins = { ...MINDMAP_MIN_FONT, ...(props.minFont || {}) };
  const ts: TierScale = {
    fz: {
      root: Math.max(1, (mins.root * u) / TIER.root.font),
      l1: Math.max(1, (mins.l1 * u) / TIER.l1.font),
      card: Math.max(1, (mins.card * u) / TIER.card.font),
      chip: Math.max(1, (mins.chip * u) / TIER.chip.font),
    },
    capMin: mins.caption * u,
  };
  const first = layoutCore(props, width, height, fps, props.direction ?? 'down', ts);
  if (first.readable >= 0.99 || props.direction) return first;
  const alt = layoutCore(props, width, height, fps, 'right', ts);
  return alt.readable > first.readable + 0.03 ? alt : first;
};

/** 算整段动画长多少帧(最后一张卡落定),方便外面定 Sequence 时长 */
export const mindmapDuration = (props: MindmapReviewProps, fps: number, width = 1920, height = 1080) =>
  layoutMindmap(props, width, height, fps).endFrame;

// ───────────────────────── 画 ─────────────────────────
const prog = (t: number, c: Curve, k: number) =>
  interpolate(t, [c.from * k, c.to * k], [0, 1], { ...clampBoth, easing: Easing.bezier(...c.bez) });

const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;

const cssGradientLine = (x: number, y: number, w: number, h: number, angleDeg: number) => {
  const a = (angleDeg * Math.PI) / 180;
  const sn = Math.sin(a);
  const cs = Math.cos(a);
  const len = Math.abs(w * sn) + Math.abs(h * cs);
  const mx = x + w / 2;
  const my = y + h / 2;
  return { x1: mx - (sn * len) / 2, y1: my + (cs * len) / 2, x2: mx + (sn * len) / 2, y2: my - (cs * len) / 2 };
};

const CardFace: React.FC<{ id: string; w: number; h: number; s: number; t: Metrics; look: CardLook; hilite: number; hiliteColor: string }> = ({
  id, w, h, s, t, look, hilite, hiliteColor,
}) => {
  const r = t.r * s;
  const bw = look.borderWidth * s;
  const g = cssGradientLine(0, 0, w, h, look.angle);
  const hiX0 = t.hiInset * s;
  const hiLen = Math.max(1, w - 2 * hiX0);
  const fade = Math.min(0.5, (3 * s) / hiLen);
  const m = 24;
  return (
    <svg width={w + 2 * m} height={h + 2 * m} viewBox={`${-m} ${-m} ${w + 2 * m} ${h + 2 * m}`} style={{ position: 'absolute', left: -m, top: -m, overflow: 'visible' }}>
      <defs>
        <linearGradient id={`f-${id}`} gradientUnits="userSpaceOnUse" x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2}>
          <stop offset="0" stopColor={rgb(look.c0)} />
          <stop offset="1" stopColor={rgb(look.c1)} />
        </linearGradient>
        <linearGradient id={`b-${id}`} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={0} y2={h}>
          <stop offset="0" stopColor={rgb(look.borderTop)} stopOpacity={look.borderTop[3]} />
          <stop offset="1" stopColor={rgb(look.borderBottom)} stopOpacity={look.borderBottom[3]} />
        </linearGradient>
        <linearGradient id={`h-${id}`} gradientUnits="userSpaceOnUse" x1={hiX0} y1={0} x2={hiX0 + hiLen} y2={0}>
          <stop offset="0" stopColor={rgb(look.hiAdd)} stopOpacity={0} />
          <stop offset={fade} stopColor={rgb(look.hiAdd)} stopOpacity={1} />
          <stop offset={1 - fade} stopColor={rgb(look.hiAdd)} stopOpacity={1} />
          <stop offset="1" stopColor={rgb(look.hiAdd)} stopOpacity={0} />
        </linearGradient>
        {hilite > 0 ? (
          <filter id={`g-${id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={9 * s} />
          </filter>
        ) : null}
      </defs>
      {hilite > 0 ? (
        <rect x={0} y={0} width={w} height={h} rx={r} ry={r} fill="none" stroke={hiliteColor} strokeWidth={6 * s} opacity={0.85 * hilite} filter={`url(#g-${id})`} />
      ) : null}
      <rect x={0} y={0} width={w} height={h} rx={r} ry={r} fill={`url(#f-${id})`} />
      <rect x={hiX0} y={t.hiY * s - (look.hiTh * s) / 2} width={hiLen} height={look.hiTh * s} fill={`url(#h-${id})`} style={{ mixBlendMode: 'plus-lighter' }} />
      {bw > 0 ? (
        <rect x={bw / 2} y={bw / 2} width={Math.max(0, w - bw)} height={Math.max(0, h - bw)} rx={Math.max(0, r - bw / 2)} ry={Math.max(0, r - bw / 2)} fill="none" stroke={`url(#b-${id})`} strokeWidth={bw} />
      ) : null}
      {hilite > 0 ? (
        <rect x={bw / 2} y={bw / 2} width={Math.max(0, w - bw)} height={Math.max(0, h - bw)} rx={Math.max(0, r - bw / 2)} ry={Math.max(0, r - bw / 2)} fill="none" stroke={hiliteColor} strokeWidth={2 * s} opacity={hilite} />
      ) : null}
    </svg>
  );
};

const Background: React.FC<{ frame: number; width: number; height: number; fps: number; palette: MindmapPalette }> = ({ frame, width, height, fps, palette }) => {
  const cols = Math.ceil(width / DOTS.sx) + 1;
  const rows = Math.ceil(height / DOTS.sy) + 1;
  const tt = (frame * MEASURED_FPS) / fps; // 按原片帧算起伏相位(周期 5 秒,不随 speed 变)
  const dots: React.ReactNode[] = [];
  for (let i = 0; i < cols; i += 1) {
    const x = DOTS.x0 + DOTS.sx * i;
    const wave = DOTS.amp * Math.sin((2 * Math.PI * tt) / DOTS.period - (2 * Math.PI * x) / DOTS.lambda + DOTS.phi);
    for (let j = 0; j < rows; j += 1) {
      // 原片约 12% 的点看不见,其余亮度不一(random(seed) 定值,逐帧稳定)
      const a = random(`mm-dot-${i}-${j}`);
      if (a < 0.12) continue;
      dots.push(<circle key={`${i}-${j}`} cx={x} cy={DOTS.y0 + DOTS.sy * j + wave} r={1.25} fill="#fff" opacity={0.06 + 0.3 * random(`mm-dotb-${i}-${j}`)} />);
    }
  }
  return (
    <AbsoluteFill style={{ background: palette.bg ?? '#000' }}>
      {/* 光晕板(案例 bg-glow-plate 拟合成两团椭圆):中上偏右一团蓝、右下角一团紫,都极淡 */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse ${width * 0.28}px ${height * 0.3}px at ${width * 0.53}px ${height * 0.33}px, ${palette.glowA ?? 'rgba(10,40,150,0.075)'} 0%, rgba(0,0,0,0) 100%), radial-gradient(ellipse ${width * 0.2}px ${height * 0.3}px at ${width}px ${height}px, ${palette.glowB ?? 'rgba(90,40,160,0.05)'} 0%, rgba(0,0,0,0) 100%)`,
        }}
      />
      <svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>
        {dots}
      </svg>
    </AbsoluteFill>
  );
};

export const MindmapReview: React.FC<MindmapReviewProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const L = layoutMindmap(props, width, height, fps);
  const { rect, pieces, scale: s, k } = L;
  const pal = props.palette ?? {};
  const font = props.fontFamily ?? "'Noto Sans SC', sans-serif";
  const weight = props.fontWeight ?? 800;
  const lineColor = pal.line ?? LINE.color;
  const dimTo = props.dimTo ?? 0.3;

  // ── 高亮权重(设计值:8 帧淡入淡出) ──
  const branchIndex = (b: number | string) => (typeof b === 'number' ? b : props.branches.findIndex((x) => x.label === b));
  const hiW = (branch: number) => {
    let w = 0;
    for (const h of props.highlights ?? []) {
      if (branchIndex(h.branch) !== branch) continue;
      const on = interpolate(frame, [h.from, h.from + HILITE_FADE * k], [0, 1], { ...clampBoth, easing: Easing.inOut(Easing.cubic) });
      const off = h.to === undefined ? 1 : interpolate(frame, [h.to, h.to + HILITE_FADE * k], [1, 0], { ...clampBoth, easing: Easing.inOut(Easing.cubic) });
      w = Math.max(w, Math.min(on, off));
    }
    return w;
  };
  const anyHi = Math.max(0, ...props.branches.map((_, i) => hiW(i)));
  const branchAlpha = (b: number) => (b < 0 ? 1 : 1 - (1 - dimTo) * anyHi * (1 - hiW(b)));
  const hiliteColor = pal.line ?? 'rgb(120,175,255)';

  const lookFor = (tier: Tier, accent: boolean): CardLook => {
    if (accent) {
      return { ...LOOK.accent, c0: pal.accentFrom ?? LOOK.accent.c0, c1: pal.accentTo ?? LOOK.accent.c1 };
    }
    const base = LOOK[tier];
    return { ...base, c0: pal.cardFrom ?? base.c0, c1: pal.cardTo ?? base.c1 };
  };

  // ── 连线:同组(根 / 各分支)画进同一个 <g opacity>,重叠处不叠亮 ──
  const groups = new Map<string, { branch: number; alpha: number; els: React.ReactNode[] }>();
  pieces.forEach((pc, i) => {
    const t = frame - pc.start;
    if (t <= 0) return;
    const segLen = pc.segs.map(([x0, y0, x1, y1]) => Math.hypot(x1 - x0, y1 - y0));
    const total = segLen.reduce((a, b) => a + b, 0);
    const curve = { ...pc.curve, to: pc.curve.from + (pc.dur / k) };
    const p = prog(t, curve, k);
    if (p <= 0) return;
    const drawing = p < 1;
    const sc = interpolate(t, [STROKE_SCALE.from * k, (STROKE_SCALE.to * k * pc.dur) / (8 * k)], [STROKE_SCALE.v0, 1], {
      ...clampBoth,
      easing: Easing.bezier(...STROKE_SCALE.bez),
    });
    const w = pc.w * (drawing ? sc : 1);
    // 圆线头:线头最远点正好在 L·p(实测 50% 点口径)→ dash 长 = L·p − r
    const dash = Math.max(0.01, total * p - (drawing ? w / 2 : 0));
    const d = pc.segs.map(([x0, y0, x1, y1], j) => (j === 0 ? `M${x0},${y0} L${x1},${y1}` : `L${x1},${y1}`)).join(' ');
    const el = (
      <path
        key={i}
        d={d}
        fill="none"
        stroke={lineColor}
        strokeWidth={w}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={p >= 1 ? undefined : `${dash} ${total + 10}`}
      />
    );
    const key = `${pc.group}|${pc.alpha}`;
    if (!groups.has(key)) groups.set(key, { branch: pc.group, alpha: pc.alpha, els: [] });
    groups.get(key)!.els.push(el);
  });

  // ── 卡片 ──
  const cards = L.all.map((n) => {
    const r = rect.get(n)!;
    const IN = n.tier === 'chip' ? CHIP_IN : CARD_IN;
    // cardFrames:按比例拉长入场曲线(折算回 8 帧的时基)
    const t = ((frame - n.cardStart) * 8) / (n.node.cardFrames ?? 8);
    const visible = n.preshown || t > 0;
    const settled = n.preshown || t >= 12 * k;
    const op = settled ? 1 : prog(t, IN.opacity, k);
    const dy = settled ? 0 : interpolate(prog(t, IN.y, k), [0, 1], [IN.rise * s, 0], { extrapolateLeft: 'clamp' });
    const sc = settled ? 1 : interpolate(prog(t, IN.scale, k), [0, 1], [IN.scaleFrom, 1], { extrapolateLeft: 'clamp' });
    return { n, r, visible, settled, op, dy, sc };
  });

  /** 根卡内容(图标 + 8px + 标题)整体居中;给了 titleX / icon.x 就按给的摆(未缩放单位) */
  const rootIcon = props.root.icon;
  const rootM = L.all[0].m;
  const rootTextW = textWidth(props.root.label, rootM.font, rootM.spacing);
  const rootIconW = rootIcon ? (rootIcon.width + 8) * rootM.fz : 0;
  const rootContentX = (cardW: number) => (cardW - (rootIconW + rootTextW)) / 2;
  const rootTitleX = (cardW: number) => props.root.titleX ?? rootContentX(cardW) + rootIconW;
  const renderText = (n: LNode, w: number, h: number) => {
    const t = n.m;
    const lines = n.node.label.split('\n');
    const capColor = n.accent ? CAPTION.accentColor : pal.caption ?? CAPTION.color;
    const showCap = n.tier !== 'chip' && n.tier !== 'root' && !!n.node.caption;
    // 主字用系统默认平滑(macOS 上比 antialiased 实,案例 19 实测主字墨量要这样才对得上);小标题用 antialiased
    const base = { fontFamily: font, fontWeight: weight, whiteSpace: 'pre', fontKerning: 'normal', WebkitFontSmoothing: 'auto' } as React.CSSProperties;
    const cx = w / 2;
    const nodes: React.ReactNode[] = [];
    if (n.tier === 'root') {
      const x0 = rootTitleX(w / s) * s;
      const yb = (props.root.titleBaseline ?? 90.7 * t.fz) * s;
      nodes.push(
        <text key="t" x={x0} y={yb} fill="#fff" filter="url(#mm-root-glow)" style={{ ...base, fontSize: t.font * s, letterSpacing: t.spacing * s }}>
          {n.node.label}
        </text>,
      );
      return nodes;
    }
    const twoLine = lines.length > 1;
    if (showCap) {
      nodes.push(
        <text key="c" x={cx} y={(twoLine ? t.capBase2 : t.capBase) * s} textAnchor="middle" fill={capColor}
          style={{ ...base, fontSize: t.cap * s, letterSpacing: t.capSpacing * s, WebkitFontSmoothing: 'antialiased' } as React.CSSProperties}>
          {n.node.caption!.toUpperCase()}
        </text>,
      );
    }
    const mainBase = t.mainBase;
    lines.forEach((ln, i) => {
      let y: number;
      if (twoLine && n.tier !== 'chip') y = (i === 0 ? t.line1 : t.line2) * s;
      else if (twoLine) y = (mainBase + i * t.font * 1.1) * s;
      else if (!showCap && n.tier !== 'chip') y = h / 2 + 0.36 * t.font * s; // 没小标题:字垂直居中
      else y = mainBase * s;
      nodes.push(
        <text key={`m${i}`} x={cx} y={y} textAnchor="middle" fill="#fff" style={{ ...base, fontSize: t.font * s, letterSpacing: t.spacing * s }}>
          {ln}
        </text>,
      );
    });
    return nodes;
  };

  return (
    <AbsoluteFill>
      {props.background === 'none' ? null : <Background frame={frame} width={width} height={height} fps={fps} palette={pal} />}
      {/* 根标题辉光滤镜 */}
      <svg width={0} height={0} style={{ position: 'absolute' }}>
        <defs>
          <filter id="mm-root-glow" x="-50%" y="-100%" width="200%" height="300%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceAlpha" stdDeviation={ROOT_GLOW.sigma * s} result="b" />
            <feOffset in="b" dx={0} dy={ROOT_GLOW.dy * s} result="o" />
            <feComponentTransfer in="o" result="k"><feFuncA type="linear" slope={ROOT_GLOW.alpha} intercept={0} /></feComponentTransfer>
            <feFlood floodColor={rgb(pal.titleGlow ?? ROOT_GLOW.rgb)} floodOpacity={1} />
            <feComposite in2="k" operator="in" result="g" />
            <feMerge><feMergeNode in="g" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
      </svg>
      {/* 连线层 */}
      <svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>
        {[...groups.entries()].map(([key, g]) => (
          <g key={key} opacity={g.alpha * branchAlpha(g.branch)}>
            {g.els}
          </g>
        ))}
      </svg>
      {/* 投影层:压在所有卡下面(原片后出现的卡,投影不压先出现的卡) */}
      {cards.map(({ n, r, visible, settled, op, dy, sc }) =>
        visible ? (
          <div
            key={`sh-${n.key}`}
            style={{
              position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, borderRadius: n.m.r * s,
              boxShadow: n.accent ? accentShadow(pal.accentGlow ?? [26.6, 74.3, 255]) : SHADOW_DARK,
              opacity: op * branchAlpha(n.branch),
              transform: settled ? undefined : `translateY(${dy}px) scale(${sc})`,
            }}
          />
        ) : null,
      )}
      {cards.map(({ n, r, visible, settled, op, dy, sc }) => {
        if (!visible) return null;
        const hl = n.depth >= 1 ? hiW(n.branch) : 0;
        const icon = n.tier === 'root' ? props.root.icon : undefined;
        return (
          <div
            key={n.key}
            style={{
              position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h,
              opacity: op * branchAlpha(n.branch),
              // Z1:落定后清掉 transform
              transform: settled ? undefined : `translateY(${dy}px) scale(${sc})`,
            }}
          >
            <CardFace id={`mm-${n.key}`} w={r.w} h={r.h} s={s} t={n.m} look={lookFor(n.tier, n.accent)} hilite={n.depth === 1 ? hl : 0} hiliteColor={hiliteColor} />
            {icon ? (
              <div style={{ position: 'absolute', left: (icon.x ?? rootContentX(r.w / s)) * s, top: (icon.y ?? (n.m.h - icon.height * n.m.fz) / 2) * s, width: icon.width * n.m.fz * s, height: icon.height * n.m.fz * s }}>
                {icon.src ? <Img src={icon.src} style={{ width: '100%', height: '100%' }} /> : icon.node}
              </div>
            ) : null}
            <svg width={r.w} height={r.h} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
              {renderText(n, r.w, r.h)}
            </svg>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
