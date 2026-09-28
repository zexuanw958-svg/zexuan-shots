/**
 * SplitCompare.tsx — 「分屏对比聚焦」镜头模板(秋芝《40分钟学会Codex》4:02.5「ChatGPT vs Codex」实测版)。
 *
 * 出处:内部复刻案例 qz-cx-0242-split-compare(交付 10),specs/motion.json + layout.json + layout-ext.json。
 * 默认值 = 原片 30fps 实测曲线与 1080p 几何,不是手调;每条曲线注明来源 motion id。
 *
 * 构成(自下而上):
 *   背景:纯色底(默认黑)+ 可选波动点阵;过门时这层从透明线性压到不透明 = 「上一镜被压暗」
 *   卡片:整张分屏卡从下往上滑入(先 3 帧淡入,再匀速 → 减速到位),蓝描边、栏间分隔线、两层投影
 *   栏标题:图标 + 粗体名字,整组由糊变清 + 微上浮 + 微放大
 *   聚焦:当前栏套白色虚线框、其他栏整栏压暗(黑 α0.70),原片是一帧硬切
 *   栏内内容:按钮 / 蓝色小按钮排 / 图片视频 / 文字要点 / 任意节点,各自「模糊 + 上浮 + 放大 + 淡入」入场
 *
 * 三种构图(preset):
 *   original  原片 1:1(连体卡 + 中缝 + 虚线框 + 硬切聚焦)
 *   aligned   整齐版:各栏内容同一起点同一宽度、按钮文字居中、聚焦 0.2 秒柔切 + 实线光圈
 *   versus    对决版:两张独立卡 + 中间 VS 徽章,聚焦栏放大发光、另一栏缩小压暗
 *
 * 用法:
 *   <Sequence from={x}>
 *     <SplitCompare columns={[{ title: 'ChatGPT', items: [...] }, { title: 'Codex', tone: 'blue', items: [...] }]}
 *                   focus={[{ at: 0.5, index: 0 }, { at: 8.9, index: 1 }]} />
 *   </Sequence>
 * 组件铺满父容器,几何按 1920×1080 画布像素给。时间(at)一律用「秒」,相对组件起点;
 * 本地第 0 帧 = 原片 f−5(卡片开始淡入那一帧),卡片 f10(本地 0.5 秒)到位。
 */
import React from 'react';
import { AbsoluteFill, Easing, Img, OffthreadVideo, interpolate, random, useCurrentFrame, useVideoConfig } from 'remotion';

const clampBoth = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 实测时基:原片 30fps。下面帧号都是原片帧号 fNNN(范围起点 242.5s = f0) */
const MEASURED_FPS = 30;
/** 组件本地第 0 帧 = 原片 f−5(卡片第一帧出现前一帧) */
const PREROLL = 5;

type Bez = [number, number, number, number];
type Track = { from: number; to: number; dur: number; bez: Bez };
/** 入场曲线组:y 上浮距离、scale 起点、opacity、blur;时间 0 = 入场起点(原片帧) */
export type EnterCurve = { y: Track; scale: Track; opacity: Track; blur: Track };

// ── 实测曲线(specs/motion.json;时间相对各自起点帧) ──
/** card-slide-up:f−5→f−1 匀速约 55.6px/帧(范围前 4 帧实测 485.7/430.3/374.3/318.3,f−5 线性外推),
 *  f0→f10 bezier[0.384,0.794,0.655,1] 263.645→0(rmse 0.221px)。数组是原片 f−5..f0 的偏移 */
const CARD_PRE_FRAMES = [-5, -4, -3, -2, -1, 0];
const CARD_PRE_Y = [541.3, 485.7, 430.3, 374.3, 318.3, 263.645];
const CARD_EASE: Track = { from: 263.645, to: 0, dur: 10, bez: [0.384, 0.794, 0.655, 1] };
/** 卡片淡入:原片 f−4/f−3/f−2 卡内 α≈0.33/0.65/0.97(本案例⑦补量,卡内区域对底板反解)→ f−5..f−2 线性 0→1 */
const CARD_FADE_FRAMES = [-5, -2];
/** plate-dim-fade:上一镜压暗 α = 1 − (10−f)/15(f−5 起、f10 全黑,rmse 0.001) */
const DIM_FRAMES = [-5, 10];
/** title-in-*:两栏标题整组(相对卡片),f0 起;opacity 起点前另有约 0.7 帧从 0 升到 0.204 */
const TITLE_IN: EnterCurve = {
  y: { from: 17.437, to: 0, dur: 16, bez: [0.1, 0.455, 0.185, 1] },
  scale: { from: 0.988, to: 1, dur: 10, bez: [0.219, 1, 0.864, 0.892] },
  opacity: { from: 0.204, to: 1, dur: 12, bez: [0.183, 0.613, 0.311, 0.893] },
  blur: { from: 4.819, to: 0, dur: 9, bez: [0.204, 1, 0.989, 0.857] },
};
/** 各类内容的入场(fit_layer_blur 逐帧反推,位移/缩放/高斯模糊/透明度四量联合) */
export const ENTER_CURVES = {
  /** btn-copy-in(f25 起):灰描边大按钮 */
  button: {
    y: { from: 37.949, to: 0, dur: 15, bez: [0.223, 0.849, 0.267, 0.984] },
    scale: { from: 0.932, to: 1, dur: 11, bez: [0.202, 1, 0, 0.906] },
    opacity: { from: 0, to: 1, dur: 11, bez: [0.191, 0.74, 0.44, 0.92] },
    blur: { from: 15.702, to: 0, dur: 9, bez: [0.182, 0.602, 0, 0.833] },
  },
  /** btn-upload-in(f208 起):同类按钮第二次实测,位移略大 */
  button2: {
    y: { from: 45.936, to: 0, dur: 15, bez: [0.192, 0.922, 0.352, 0.979] },
    scale: { from: 0.942, to: 1, dur: 11, bez: [0.104, 0.853, 0.203, 0.938] },
    opacity: { from: 0, to: 1, dur: 11, bez: [0.252, 0.41, 0.111, 0.833] },
    blur: { from: 16.821, to: 0, dur: 10, bez: [0.083, 1, 0.679, 0.95] },
  },
  /** btn-ro-in(f364 起):蓝色小按钮 */
  chip: {
    y: { from: 31.856, to: 0, dur: 16, bez: [0.171, 1, 0.325, 0.992] },
    scale: { from: 0.887, to: 1, dur: 10, bez: [0.223, 1, 0, 0.945] },
    opacity: { from: 0, to: 1, dur: 10, bez: [0.203, 0.138, 0.094, 0.913] },
    blur: { from: 12.905, to: 0, dur: 8, bez: [0.097, 1, 0.897, 0.936] },
  },
  /** finder-pop-in(f408 起):截图 / 视频 */
  media: {
    y: { from: 32.09, to: 0, dur: 19, bez: [0.192, 0.906, 0.323, 0.989] },
    scale: { from: 0.964, to: 1, dur: 13, bez: [0.071, 1, 0.639, 0.932] },
    opacity: { from: 0, to: 1, dur: 15, bez: [0.23, 0.998, 0.523, 0.925] },
    blur: { from: 11.81, to: 0, dur: 11, bez: [0.087, 1, 0.921, 0.94] },
  },
} satisfies Record<string, EnterCurve>;
export type EnterName = keyof typeof ENTER_CURVES;

// ── 实测几何(1080p 画布 px;layout.json / layout-ext.json) ──
/** 卡片外框 (143.98,130.68) 1632.02×827.02 */
const ORIGINAL_BOX = { x: 143.98, y: 130.68, width: 1632.02, height: 827.02 };
const G = {
  /** 描边 上 4 / 外侧 5 / 下 5,内侧 0;外角圆角 上 10.3 下 12.3 */
  borderTop: 4,
  borderSide: 5,
  borderBottom: 5,
  radiusTop: 10.3,
  radiusBottom: 12.3,
  borderColor: '#3D8EF2',
  /** 中缝:宽 4.84,上下各内收 3.8 / 5;原片中缝中心 967.3(不在正中,比正中偏右 7.3) */
  dividerWidth: 4.84,
  dividerTop: 3.82,
  dividerBottom: 5.02,
  dividerColor: 'rgb(74,76,78)',
  originalSplit: (967.3 - 143.98) / 1632.02,
  /** 两层投影(⑦b 按上/侧/下三条带逐距离拟合) */
  shadow: '0 92.2px 66.3px 65.8px rgba(0,0,0,0.115), 0 63.5px 39.3px -9.7px rgba(0,0,0,0.176)',
  /** 栏底色(竖向渐变):neutral = 左栏实测,blue = 右栏实测(偏蓝) */
  bg: {
    neutral: 'linear-gradient(180deg, rgb(23.7,25.8,28.0), rgb(20.5,21.5,23.0))',
    blue: 'linear-gradient(180deg, rgb(22.4,29.1,37.2), rgb(20.3,21.6,22.4))',
  },
  /** 标题组:图标 94×94,顶距卡顶 100.3;图标与字间距 37.9;字 64.25px;整组在栏内水平居中 */
  headerTop: 100.32,
  iconSize: 94,
  iconGap: 37.9,
  titleSize: 64.25,
  titleColor: '#F7F7F2',
  /** 压暗:黑 α0.70(原片「另一栏压到 30%」) */
  dimOpacity: 0.7,
  /** 虚线框:线宽 5.2、周期 21.1、实线占 0.501、两端留白 0.367 周期、中线圆角 11;
   *  相对栏:上内收 5.5、下 8.9、外侧 左 4.42 / 右 3.4,靠中缝一侧贴中缝(左栏 −1.5,右栏 +0.3) */
  dash: { strokeWidthPx: 5.2, color: '#FFFFFF', periodPx: 21.1, dashRatio: 0.501, marginRatio: 0.367, cornerRadiusPx: 11 },
  dashInset: { top: 5.5, bottom: 8.9, outerLeft: 4.42, outerRight: 3.4, innerLeft: -1.5, innerRight: 0.3 },
  /** 大按钮:高 139.3、描边 4 rgb(93,95,97)、圆角 13.3;图标中心距左 128.7、字起点距左 214.4、字 60.3 */
  button: {
    height: 139.3,
    border: 4,
    borderColor: 'rgb(93,95,97)',
    radius: 13.3,
    bg: 'linear-gradient(180deg, rgb(32.4,33.6,35.5), rgb(25.7,27.0,28.5))',
    shadow: '0 12px 24px rgba(0,0,0,0.32)',
    iconCenterX: 128.7,
    textLeft: 214.4,
    fontSize: 60.3,
    color: '#F7F7F2',
  },
  /** 蓝色小按钮:高 79.3、描边 3 rgb(55,106,168)、底 rgb(26,43,60)、圆角 12.3、字 43.8 居中;并排间距 23.9 */
  chip: { height: 79.3, border: 3, borderColor: 'rgb(55,106,168)', bg: 'rgb(26,43,60)', radius: 12.3, fontSize: 43.8, color: '#F6F6F2', gap: 23.9 },
  /** 截图:圆角 18.9、投影 0 40.81px 48.44px α0.367;原片 672×403 */
  media: { radius: 18.9, shadow: '0 40.81px 48.44px rgba(0,0,0,0.367)', aspect: 403 / 672 },
};

export type IconSpec = string | { src: string; width: number; height: number } | React.ReactNode;

type ItemBase = {
  /** 入场时刻(秒,相对组件起点) */
  at: number;
  /** 入场曲线,默认按内容类型:button / chip / media;text、node 用 button */
  enter?: EnterName;
};
export type SplitItem =
  | (ItemBase & { kind: 'button'; text: string; icon?: IconSpec })
  | (ItemBase & { kind: 'chips'; chips: Array<{ text: string; icon?: IconSpec }> })
  | (ItemBase & { kind: 'media'; src: string; type?: 'image' | 'video'; height?: number; fit?: 'cover' | 'contain'; startFromSec?: number })
  | (ItemBase & { kind: 'text'; text: string; bullet?: boolean; fontSize?: number; color?: string })
  | (ItemBase & { kind: 'node'; node: React.ReactNode; height: number });

export type SplitColumn = {
  /** 栏标题(英文走粗体标题字体,中文自动回退) */
  title: string;
  /** 栏标题图标:图片路径 / {src,width,height} / 任意节点;不给就只有字 */
  icon?: IconSpec;
  /** 栏底色:neutral 灰(原片左栏)/ blue 偏蓝(原片右栏) */
  tone?: 'neutral' | 'blue';
  items?: SplitItem[];
  /** 内容起点(距卡顶 px)、内容宽度、行间距、内容横向偏移 —— 不给按 preset 自动排 */
  contentTop?: number;
  contentWidth?: number;
  gap?: number;
  contentOffsetX?: number;
  /** 标题组横向偏移(px);原片两栏标题组都没在栏内正中,左 −19、右 −14 */
  headerOffsetX?: number;
};

export type FocusStep = { at: number; index: number | null };
export type SplitComparePreset = 'original' | 'aligned' | 'versus';

export type SplitCompareProps = {
  columns?: SplitColumn[];
  /** 聚焦时间表(秒):index = 聚焦第几栏,null = 不聚焦。原片 [{0.5,0},{8.87,1}] */
  focus?: FocusStep[];
  /** 构图预设(见文件头);下面各项单独给会覆盖预设 */
  preset?: SplitComparePreset;
  /** 卡片外框(画布 px),默认原片位置 */
  box?: { x: number; y: number; width: number; height: number };
  /** 栏宽分配:中缝位置(0–1,n−1 个);2 栏默认原片 0.5045,其余等分 */
  splits?: number[];
  /** 独立卡之间的间距(px);0 = 连体卡 + 中缝(原片) */
  columnGap?: number;
  /** 中间徽章字(versus 默认「VS」) */
  badge?: string | null;
  /** 入场:true = 卡片从下滑入(原片);false = 一开始就在 */
  entry?: boolean;
  /** 背景:颜色 / null(透明,叠在别的画面上);过门时这层从透明压到不透明 */
  background?: string | null;
  /** 过门压暗:true = 背景 0.5 秒线性压上来(压暗上一镜,原片);false = 背景一开始就满 */
  entryDim?: boolean;
  /** 波动点阵:true = 默认点阵;false 关;对象 = 自定参数(Check 喂原片每点亮度) */
  dots?: boolean | Partial<DotWaveSpec>;
  /** 聚焦时其他栏压暗程度(0–1,原片 0.7) */
  focusDim?: number;
  /** 聚焦切换过渡(秒);0 = 一帧硬切(原片) */
  focusFadeSec?: number;
  /** 聚焦框:dash 白虚线(原片)/ ring 实线光圈 / none */
  focusFrame?: 'dash' | 'ring' | 'none';
  /** 聚焦栏放大、其他栏缩小(只对独立卡生效) */
  focusScale?: number;
  unfocusScale?: number;
  /** 大按钮内容对齐:left = 原片(图标/字固定左距);center = 居中 */
  buttonAlign?: 'left' | 'center';
  /** 强调色:描边 / 光圈 / 徽章 */
  accentColor?: string;
  titleFontFamily?: string;
  textFontFamily?: string;
  /** 入场速度倍率(只影响卡片和各元素入场的快慢,不改 at 时刻) */
  speed?: number;
};

// ── 波动点阵(motion-ext dotWave:沿列传播的正弦波,振幅 11.03px、周期 150.3 帧、每列相位差 0.8416rad) ──
export type DotWaveSpec = {
  cols: number;
  rows: number;
  pitchPx: number;
  x0Px: number;
  y0Px: number;
  amplitudePx: number;
  periodFrames: number;
  phase0Rad: number;
  phasePerColRad: number;
  offsetYPx: number;
  sigmaXPx: number;
  sigmaYPx: number;
  color: string;
  /** 每点亮度(行优先);不给就按 seed 随机(均值同原片 0.17) */
  alphas?: number[];
  seed?: string;
};
const DEFAULT_DOTS: DotWaveSpec = {
  cols: 32,
  rows: 18,
  pitchPx: 60.34,
  x0Px: 24.239,
  y0Px: 26.6,
  amplitudePx: 11.027,
  periodFrames: 150.31,
  phase0Rad: 2.126,
  phasePerColRad: 0.84161,
  offsetYPx: 0.237,
  sigmaXPx: 0.929,
  sigmaYPx: 1.409,
  color: '#FFFFFF',
};

/** 点阵:1px 方点 + feGaussianBlur(sRGB),t = 原片帧号时刻 */
export const SplitCompareDots: React.FC<{ spec?: Partial<DotWaveSpec>; t: number }> = ({ spec, t }) => {
  const w = { ...DEFAULT_DOTS, ...spec };
  const extra = 1 / 12;
  const sx = Math.sqrt(Math.max(0.01, w.sigmaXPx ** 2 - extra));
  const sy = Math.sqrt(Math.max(0.01, w.sigmaYPx ** 2 - extra));
  const seed = w.seed ?? 'split-dots';
  const dots: React.ReactNode[] = [];
  for (let j = 0; j < w.rows; j += 1) {
    for (let k = 0; k < w.cols; k += 1) {
      const a = w.alphas ? (w.alphas[j * w.cols + k] ?? 0) : random(`${seed}-${j}-${k}`) * 0.34;
      if (a <= 0) continue;
      const x = w.x0Px + w.pitchPx * k;
      const y = w.y0Px + w.pitchPx * j + w.offsetYPx + w.amplitudePx * Math.sin((2 * Math.PI * t) / w.periodFrames + w.phase0Rad - w.phasePerColRad * k);
      dots.push(<rect key={`${j}-${k}`} x={x} y={y} width={1} height={1} fill={w.color} fillOpacity={Math.min(1, a)} />);
    }
  }
  return (
    <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', left: 0, top: 0 }}>
      <defs>
        <filter id="split-dots-blur" x={0} y={0} width={1920} height={1080} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation={`${sx} ${sy}`} />
        </filter>
      </defs>
      <g filter="url(#split-dots-blur)">{dots}</g>
    </svg>
  );
};

// ── 虚线框(案例 runtime DashFrameSvg 原样搬:每条边按边长独立等分,挨角段画成直线+圆弧、端头斜切) ──
type DashSpec = typeof G.dash;
const dashLayout = (f: DashSpec, length: number) => {
  const c = 2 * f.marginRatio + f.dashRatio - 1;
  const count = Math.max(1, Math.round(length / f.periodPx - c));
  const period = length / (count + c);
  return { count, period, dash: f.dashRatio * period, margin: f.marginRatio * period };
};
const DashFrame: React.FC<{ spec: DashSpec; widthPx: number; heightPx: number }> = ({ spec, widthPx, heightPx }) => {
  const half = spec.strokeWidthPx / 2;
  const [l, t, r, b] = [half, half, widthPx - half, heightPx - half];
  const rc = Math.max(0, Math.min(spec.cornerRadiusPx, (r - l) / 2, (b - t) / 2));
  const stroke = { stroke: spec.color, strokeWidth: spec.strokeWidthPx, strokeLinecap: 'butt' as const, fill: 'none' };
  const edges: Array<{ key: string; A: [number, number]; B: [number, number]; u: [number, number]; n: [number, number] }> = [
    { key: 'top', A: [l, t], B: [r, t], u: [1, 0], n: [0, 1] },
    { key: 'right', A: [r, t], B: [r, b], u: [0, 1], n: [-1, 0] },
    { key: 'bottom', A: [r, b], B: [l, b], u: [-1, 0], n: [0, -1] },
    { key: 'left', A: [l, b], B: [l, t], u: [0, -1], n: [1, 0] },
  ];
  const nodes: React.ReactNode[] = [];
  const fmt = (q: [number, number]) => `${q[0]} ${q[1]}`;
  for (const { key, A, B, u, n } of edges) {
    const length = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const { count, period, dash, margin } = dashLayout(spec, length);
    const at = (p: number): [number, number] => [A[0] + u[0] * p, A[1] + u[1] * p];
    const inArc = (i: number) => rc > 0 && (margin + i * period < rc || margin + i * period + dash > length - rc);
    const pattern: number[] = [];
    let cursor = 0;
    for (let i = 0; i < count; i += 1) {
      const p0 = margin + i * period;
      const p1 = p0 + dash;
      if (inArc(i)) {
        const startArc = p0 < rc;
        const phi = (q: number) => Math.min(Math.PI / 4, Math.asin(Math.min(1, startArc ? (rc - q) / rc : (q - (length - rc)) / rc)));
        const C: [number, number] = startArc
          ? [A[0] + (u[0] + n[0]) * rc, A[1] + (u[1] + n[1]) * rc]
          : [B[0] + (-u[0] + n[0]) * rc, B[1] + (-u[1] + n[1]) * rc];
        const arcPt = (f: number): [number, number] =>
          startArc
            ? [C[0] - rc * Math.sin(f) * u[0] - rc * Math.cos(f) * n[0], C[1] - rc * Math.sin(f) * u[1] - rc * Math.cos(f) * n[1]]
            : [C[0] + rc * Math.sin(f) * u[0] - rc * Math.cos(f) * n[0], C[1] + rc * Math.sin(f) * u[1] - rc * Math.cos(f) * n[1]];
        const d = startArc
          ? `M ${fmt(arcPt(phi(p0)))} A ${rc} ${rc} 0 0 1 ${fmt(at(rc))}${p1 > rc ? ` L ${fmt(at(p1))}` : ''}`
          : `M ${fmt(at(Math.min(p0, length - rc)))}${p0 < length - rc ? ` L ${fmt(at(length - rc))}` : ''} A ${rc} ${rc} 0 0 1 ${fmt(arcPt(phi(p1)))}`;
        nodes.push(<path key={`${key}-${i}`} d={d} {...stroke} />);
        continue;
      }
      pattern.push(p0 - cursor, dash);
      cursor = p1;
    }
    if (pattern.length) {
      pattern.push(length - cursor + 1);
      nodes.push(<line key={key} x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} {...stroke} strokeDasharray={[0, ...pattern].join(' ')} />);
    }
  }
  return (
    <svg width={widthPx} height={heightPx} viewBox={`0 0 ${widthPx} ${heightPx}`} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
      {nodes}
    </svg>
  );
};

// ── 小工具 ──
const track = (u: number, tr: Track) =>
  interpolate(u, [0, tr.dur], [tr.from, tr.to], { ...clampBoth, easing: Easing.bezier(...tr.bez) });
const curveEnd = (c: EnterCurve) => Math.max(c.y.dur, c.scale.dur, c.opacity.dur, c.blur.dur);

/** 入场样式;u = 距入场起点的原片帧数。落定后不留 transform / filter(坑 Z1) */
const enterStyle = (u: number, c: EnterCurve, preOpacity?: number): React.CSSProperties | null => {
  if (u < 0 && preOpacity === undefined) return null;
  if (u >= curveEnd(c)) return {};
  const opacity = u < 0 ? interpolate(u, [-0.7, 0], [0, preOpacity ?? 0], clampBoth) : track(u, c.opacity);
  const blur = track(u, c.blur);
  return {
    translate: `0px ${track(u, c.y).toFixed(3)}px`,
    scale: `${track(u, c.scale).toFixed(5)}`,
    opacity,
    filter: blur > 0.01 ? `blur(${blur.toFixed(3)}px)` : undefined,
  };
};

const renderIcon = (icon: IconSpec | undefined, box: number): React.ReactNode => {
  if (icon === undefined || icon === null) return null;
  if (typeof icon === 'string') return <Img src={icon} style={{ width: box, height: box, objectFit: 'contain', display: 'block' }} />;
  if (typeof icon === 'object' && 'src' in (icon as object) && !React.isValidElement(icon)) {
    const s = icon as { src: string; width: number; height: number };
    return <Img src={s.src} style={{ width: s.width, height: s.height, display: 'block' }} />;
  }
  return icon as React.ReactNode;
};

/** 粗估字宽(不测 DOM):CJK 1em、拉丁 0.64em(Avenir Heavy)/ 0.55em(得意黑) */
const estWidth = (text: string, size: number, latin = 0.64) =>
  [...text].reduce((a, ch) => a + (/[⺀-￿]/.test(ch) ? 1 : ch === ' ' ? 0.3 : latin), 0) * size;

const itemHeight = (it: SplitItem, width: number) => {
  switch (it.kind) {
    case 'button':
      return G.button.height;
    case 'chips':
      return G.chip.height;
    case 'media':
      return it.height ?? width * G.media.aspect;
    case 'text':
      return (it.fontSize ?? 52) * 1.35;
    case 'node':
      return it.height;
  }
};

const DEFAULT_COLUMNS: SplitColumn[] = [
  {
    title: 'ChatGPT',
    tone: 'neutral',
    contentTop: 342.12,
    contentWidth: 552.06,
    gap: 47.9,
    contentOffsetX: 2.45,
    headerOffsetX: -19,
    items: [
      { kind: 'button', text: '复制', at: 1.0 },
      { kind: 'button', text: '上传', at: 7.1, enter: 'button2' },
    ],
  },
  {
    title: 'Codex',
    tone: 'blue',
    contentTop: 270.1,
    contentWidth: 672.1,
    gap: 42.9,
    headerOffsetX: -14,
    items: [
      { kind: 'chips', chips: [{ text: '读取' }, { text: '操作' }], at: 12.3 },
      { kind: 'media', src: '', at: 13.7667 },
    ],
  },
];
/** 原片聚焦时刻:f10 聚焦左栏、f261 聚焦右栏(本地秒 = (f+5)/30) */
export const SPLIT_ORIGINAL_FOCUS: FocusStep[] = [
  { at: 15 / 30, index: 0 },
  { at: 266 / 30, index: 1 },
];

const PRESETS: Record<SplitComparePreset, Required<Pick<SplitCompareProps, 'columnGap' | 'focusDim' | 'focusFadeSec' | 'focusFrame' | 'focusScale' | 'unfocusScale' | 'buttonAlign'>> & { uniform: boolean; badge: string | null }> = {
  original: { columnGap: 0, focusDim: G.dimOpacity, focusFadeSec: 0, focusFrame: 'dash', focusScale: 1, unfocusScale: 1, buttonAlign: 'left', uniform: false, badge: null },
  aligned: { columnGap: 0, focusDim: 0.58, focusFadeSec: 0.2, focusFrame: 'ring', focusScale: 1, unfocusScale: 1, buttonAlign: 'center', uniform: true, badge: null },
  versus: { columnGap: 72, focusDim: 0.5, focusFadeSec: 0.27, focusFrame: 'ring', focusScale: 1.03, unfocusScale: 0.96, buttonAlign: 'center', uniform: true, badge: 'VS' },
};

/** 整个默认片长(原片 450 帧 + 预卷 5 帧)对应的帧数 */
export const splitCompareDurationInFrames = (fps: number) => Math.ceil(((450 + PREROLL) / MEASURED_FPS) * fps);

export const SplitCompare: React.FC<SplitCompareProps> = ({
  columns = DEFAULT_COLUMNS,
  focus = SPLIT_ORIGINAL_FOCUS,
  preset = 'original',
  box = ORIGINAL_BOX,
  splits,
  columnGap,
  badge,
  entry = true,
  background = '#000000',
  entryDim = true,
  dots = true,
  focusDim,
  focusFadeSec,
  focusFrame,
  focusScale,
  unfocusScale,
  buttonAlign,
  accentColor = G.borderColor,
  titleFontFamily = "AvenirNextHeavy, 'Avenir Next', 'Noto Sans SC', sans-serif",
  textFontFamily = "SmileySans, 'Noto Sans SC', sans-serif",
  speed = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const P = PRESETS[preset];
  const gap = columnGap ?? P.columnGap;
  const dimMax = focusDim ?? P.focusDim;
  const fadeSec = focusFadeSec ?? P.focusFadeSec;
  const frameKind = focusFrame ?? P.focusFrame;
  const sFocus = focusScale ?? P.focusScale;
  const sOther = unfocusScale ?? P.unfocusScale;
  const bAlign = buttonAlign ?? P.buttonAlign;
  const badgeText = badge === undefined ? P.badge : badge;
  const joined = gap <= 0;

  const sec = frame / fps;
  /** 入场用的原片帧号时刻(带速度) */
  const t = entry ? sec * MEASURED_FPS * speed - PREROLL : 1e6;
  const n = Math.max(1, columns.length);

  // ── 栏几何(画布 px) ──
  const cols: Array<{ x0: number; x1: number }> = [];
  if (joined) {
    const cuts = splits ?? (n === 2 ? [G.originalSplit] : Array.from({ length: n - 1 }, (_, k) => (k + 1) / n));
    const centers = cuts.map((c) => box.x + box.width * c);
    for (let i = 0; i < n; i += 1) {
      cols.push({
        x0: i === 0 ? box.x : centers[i - 1] + G.dividerWidth / 2,
        x1: i === n - 1 ? box.x + box.width : centers[i] - G.dividerWidth / 2,
      });
    }
  } else {
    const w = (box.width - gap * (n - 1)) / n;
    for (let i = 0; i < n; i += 1) cols.push({ x0: box.x + i * (w + gap), x1: box.x + i * (w + gap) + w });
  }
  const minColW = Math.min(...cols.map((c) => c.x1 - c.x0));

  // ── 入场:卡片位移 / 淡入,背景压暗 ──
  const cardY = t < 0 ? interpolate(t, CARD_PRE_FRAMES, CARD_PRE_Y, clampBoth) : track(t, CARD_EASE);
  const cardOpacity = interpolate(t, CARD_FADE_FRAMES, [0, 1], clampBoth);
  const bgAlpha = entryDim ? interpolate(t, DIM_FRAMES, [0, 1], clampBoth) : 1;
  const cardSettled = t >= CARD_EASE.dur;
  const titleStyle = enterStyle(t, TITLE_IN, TITLE_IN.opacity.from);

  // ── 聚焦:每栏压暗量 0..1、聚焦框量 0..1 ──
  const steps = [...focus].sort((a, b) => a.at - b.at);
  let cur = -1;
  steps.forEach((s, i) => {
    if (sec >= s.at) cur = i;
  });
  const idxAt = (i: number) => (i < 0 ? null : steps[i].index);
  const mix = cur < 0 || fadeSec <= 0 ? 1 : interpolate(sec - steps[cur].at, [0, fadeSec], [0, 1], { ...clampBoth, easing: Easing.inOut(Easing.cubic) });
  const lvl = (idx: number | null, i: number) => ({ dim: idx !== null && idx !== i ? 1 : 0, on: idx === i ? 1 : 0 });
  const colState = (i: number) => {
    const a = lvl(idxAt(cur - 1), i);
    const b = lvl(idxAt(cur), i);
    return { dim: a.dim + (b.dim - a.dim) * mix, on: a.on + (b.on - a.on) * mix };
  };

  const titleFont = (text: string, avail: number) => {
    const w = estWidth(text, G.titleSize);
    return G.titleSize * Math.min(1, avail / Math.max(1, w));
  };

  const renderItem = (it: SplitItem, key: string, width: number, height: number) => {
    const u = (sec - it.at) * MEASURED_FPS * speed;
    const curve = ENTER_CURVES[it.enter ?? (it.kind === 'chips' ? 'chip' : it.kind === 'media' ? 'media' : 'button')];
    const wrap = (child: React.ReactNode, k: string, w: number, x: number) => {
      const st = enterStyle(u, curve);
      if (st === null) return null;
      return (
        <div key={k} style={{ position: 'absolute', left: x, top: 0, width: w, height, transformOrigin: '50% 50%', ...st }}>
          {child}
        </div>
      );
    };
    if (it.kind === 'button') {
      const fs = Math.min(G.button.fontSize, (width - (bAlign === 'left' ? G.button.textLeft + 30 : 170)) / Math.max(1, estWidth(it.text, 1, 0.55)));
      const icon = renderIcon(it.icon, 56);
      return wrap(
        <div
          style={{
            position: 'absolute',
            inset: 0,
            boxSizing: 'border-box',
            border: `${G.button.border}px solid ${G.button.borderColor}`,
            borderRadius: G.button.radius,
            backgroundImage: G.button.bg,
            boxShadow: G.button.shadow,
            color: G.button.color,
            fontFamily: textFontFamily,
            fontSize: fs,
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          {bAlign === 'left' ? (
            <>
              {icon ? (
                <div style={{ position: 'absolute', left: G.button.iconCenterX - G.button.border, top: '50%', translate: '-50% -50%' }}>{icon}</div>
              ) : null}
              <div style={{ position: 'absolute', left: G.button.textLeft - G.button.border, top: 0, bottom: 0, display: 'flex', alignItems: 'center' }}>{it.text}</div>
            </>
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 36 }}>
              {icon}
              <span>{it.text}</span>
            </div>
          )}
        </div>,
        key,
        width,
        0,
      );
    }
    if (it.kind === 'chips') {
      const m = Math.max(1, it.chips.length);
      const cw = (width - G.chip.gap * (m - 1)) / m;
      return (
        <React.Fragment key={key}>
          {it.chips.map((c, ci) => {
            const fs = Math.min(G.chip.fontSize, (cw - 40) / Math.max(1, estWidth(c.text, 1, 0.55) + (c.icon ? 1.3 : 0)));
            return wrap(
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  boxSizing: 'border-box',
                  border: `${G.chip.border}px solid ${G.chip.borderColor}`,
                  borderRadius: G.chip.radius,
                  background: G.chip.bg,
                  color: G.chip.color,
                  fontFamily: textFontFamily,
                  fontSize: fs,
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 14,
                }}
              >
                {renderIcon(c.icon, fs)}
                <span>{c.text}</span>
              </div>,
              `${key}-${ci}`,
              cw,
              ci * (cw + G.chip.gap),
            );
          })}
        </React.Fragment>
      );
    }
    if (it.kind === 'media') {
      const mediaStyle: React.CSSProperties = { width: '100%', height: '100%', objectFit: it.fit ?? 'cover', display: 'block' };
      return wrap(
        <div style={{ position: 'absolute', inset: 0, borderRadius: G.media.radius, overflow: 'hidden', boxShadow: G.media.shadow, background: '#111' }}>
          {it.src ? (
            it.type === 'video' ? (
              <OffthreadVideo src={it.src} muted trimBefore={Math.round((it.startFromSec ?? 0) * fps)} style={mediaStyle} />
            ) : (
              <Img src={it.src} style={mediaStyle} />
            )
          ) : null}
        </div>,
        key,
        width,
        0,
      );
    }
    if (it.kind === 'text') {
      const fs = it.fontSize ?? 52;
      return wrap(
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            gap: fs * 0.45,
            color: it.color ?? G.titleColor,
            fontFamily: textFontFamily,
            fontSize: fs,
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          {it.bullet === false ? null : <div style={{ width: fs * 0.26, height: fs * 0.26, borderRadius: '50%', background: accentColor, flex: 'none' }} />}
          <span>{it.text}</span>
        </div>,
        key,
        width,
        0,
      );
    }
    return wrap(<div style={{ position: 'absolute', inset: 0 }}>{it.node}</div>, key, width, 0);
  };

  // 统一排版(aligned / versus):所有栏同一内容起点、同一宽度
  const uniformTop = G.headerTop + G.iconSize + 92;
  const uniformWidth = Math.min(640, minColW - (joined ? 150 : 110));

  const columnNodes = columns.map((col, i) => {
    const { x0, x1 } = cols[i];
    const w = x1 - x0;
    const first = i === 0;
    const last = i === n - 1;
    const outerL = joined ? first : true;
    const outerR = joined ? last : true;
    const radius = joined
      ? `${first ? G.radiusTop : 0}px ${last ? G.radiusTop : 0}px ${last ? G.radiusBottom : 0}px ${first ? G.radiusBottom : 0}px`
      : '22px';
    const st = colState(i);
    const scale = joined ? 1 : 1 + (sFocus - 1) * st.on + (sOther - 1) * st.dim;
    const contentTop = P.uniform ? uniformTop : col.contentTop ?? uniformTop;
    const contentW = P.uniform ? uniformWidth : col.contentWidth ?? Math.min(672, w - 134);
    const rowGap = P.uniform ? 40 : col.gap ?? 44;
    const cx = w / 2 + (P.uniform ? 0 : col.contentOffsetX ?? 0);
    let y = contentTop;
    const items = (col.items ?? []).map((it, k) => {
      const h = itemHeight(it, contentW);
      const node = (
        <div key={k} style={{ position: 'absolute', left: cx - contentW / 2, top: y, width: contentW, height: h }}>
          {renderItem(it, `${i}-${k}`, contentW, h)}
        </div>
      );
      y += h + rowGap;
      return node;
    });
    // 标题组:图标 + 名字,整组在栏内居中
    const iconNode = renderIcon(col.icon, G.iconSize);
    const availTitle = w - 70 - (iconNode ? G.iconSize + G.iconGap : 0);
    const fs = titleFont(col.title, availTitle);
    const ringColor = col.tone === 'blue' ? accentColor : accentColor;
    // 聚焦框(相对栏):dash 按原片内收;ring 贴栏内沿
    const di = G.dashInset;
    const dashL = outerL ? di.outerLeft : di.innerRight;
    const dashR = outerR ? di.outerRight : -di.innerLeft;
    return (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: x0 - box.x,
          top: 0,
          width: w,
          height: box.height,
          scale: scale === 1 ? undefined : scale.toFixed(5),
          transformOrigin: '50% 50%',
          zIndex: st.on > 0 ? 2 : 1,
        }}
      >
        {/* 底色 + 描边(连体卡:内侧不描边) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            boxSizing: 'border-box',
            backgroundImage: G.bg[col.tone ?? (last && n > 1 ? 'blue' : 'neutral')],
            borderStyle: 'solid',
            borderColor: accentColor,
            borderWidth: `${G.borderTop}px ${outerR ? G.borderSide : 0}px ${G.borderBottom}px ${outerL ? G.borderSide : 0}px`,
            borderRadius: radius,
            boxShadow: joined ? undefined : G.shadow,
          }}
        />
        {/* 标题组 */}
        <div
          style={{
            position: 'absolute',
            left: P.uniform ? 0 : col.headerOffsetX ?? 0,
            width: w,
            top: G.headerTop,
            height: G.iconSize,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: G.iconGap,
            transformOrigin: '50% 50%',
            ...(titleStyle ?? { opacity: 0 }),
          }}
        >
          {iconNode}
          <div style={{ fontFamily: titleFontFamily, fontWeight: 800, fontSize: fs, letterSpacing: 0.25 * (fs / G.titleSize), lineHeight: 1, color: G.titleColor, whiteSpace: 'nowrap' }}>
            {col.title}
          </div>
        </div>
        {/* 内容(裁在栏内,原片 finder-clip) */}
        <div style={{ position: 'absolute', inset: `${G.dividerTop}px 0 ${G.dividerBottom}px 0`, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, top: -G.dividerTop, width: w, height: box.height }}>{items}</div>
        </div>
        {/* 压暗 */}
        {st.dim > 0 ? (
          <div style={{ position: 'absolute', inset: 0, borderRadius: radius, background: `rgba(0,0,0,${(dimMax * st.dim).toFixed(4)})` }} />
        ) : null}
        {/* 聚焦框 */}
        {st.on > 0 && frameKind === 'dash' ? (
          <div
            style={{
              position: 'absolute',
              left: dashL,
              top: di.top,
              width: w - dashL - dashR,
              height: box.height - di.top - di.bottom,
              opacity: st.on < 1 ? st.on : undefined,
            }}
          >
            <DashFrame spec={G.dash} widthPx={w - dashL - dashR} heightPx={box.height - di.top - di.bottom} />
          </div>
        ) : null}
        {st.on > 0 && frameKind === 'ring' ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: radius,
              boxSizing: 'border-box',
              border: `5px solid ${ringColor}`,
              boxShadow: `0 0 34px ${ringColor}66, inset 0 0 40px ${ringColor}26`,
              opacity: st.on < 1 ? st.on : undefined,
            }}
          />
        ) : null}
      </div>
    );
  });

  // 中缝(连体卡)
  const dividers = joined
    ? cols.slice(0, -1).map((c, i) => (
        <div
          key={`d${i}`}
          style={{
            position: 'absolute',
            left: c.x1 - box.x,
            top: G.dividerTop,
            width: G.dividerWidth,
            height: box.height - G.dividerTop - G.dividerBottom,
            background: G.dividerColor,
            zIndex: 3,
          }}
        />
      ))
    : null;

  // 徽章(独立卡之间)
  const badgeNodes =
    !joined && badgeText
      ? cols.slice(0, -1).map((c, i) => {
          const bst = enterStyle(t - 2, ENTER_CURVES.chip);
          if (bst === null) return null;
          const cx = (c.x1 + cols[i + 1].x0) / 2 - box.x;
          return (
            <div
              key={`b${i}`}
              style={{
                position: 'absolute',
                left: cx - 62,
                top: box.height / 2 - 62,
                width: 124,
                height: 124,
                borderRadius: '50%',
                background: 'rgb(14,16,19)',
                border: `5px solid ${accentColor}`,
                boxSizing: 'border-box',
                boxShadow: `0 0 36px ${accentColor}55`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontFamily: titleFontFamily,
                fontWeight: 800,
                fontSize: 50,
                fontStyle: 'italic',
                zIndex: 5,
                transformOrigin: '50% 50%',
                ...bst,
              }}
            >
              {badgeText}
            </div>
          );
        })
      : null;

  return (
    <AbsoluteFill>
      {background ? (
        <AbsoluteFill style={{ opacity: bgAlpha < 1 ? bgAlpha : undefined }}>
          <AbsoluteFill style={{ background }} />
          {dots && bgAlpha >= 1 ? <SplitCompareDots spec={dots === true ? undefined : dots} t={(frame / fps) * MEASURED_FPS - PREROLL} /> : null}
        </AbsoluteFill>
      ) : null}
      <div
        style={{
          position: 'absolute',
          left: box.x,
          top: box.y,
          width: box.width,
          height: box.height,
          translate: cardSettled ? undefined : `0px ${cardY.toFixed(3)}px`,
          opacity: cardOpacity < 1 ? cardOpacity : undefined,
        }}
      >
        {joined ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: `${G.radiusTop}px ${G.radiusTop}px ${G.radiusBottom}px ${G.radiusBottom}px`,
              boxShadow: G.shadow,
            }}
          />
        ) : null}
        {columnNodes}
        {dividers}
        {badgeNodes}
      </div>
    </AbsoluteFill>
  );
};
