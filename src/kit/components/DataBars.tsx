/**
 * DataBars.tsx — 「数据条」特效模板(秋芝《Claude Code 全解》12:04「93% 的人直接同意」实测版)。
 *
 * 出处:内部复刻案例 qz-cc-0724-data-bar(交付 15),工序④逐帧实测 + 拟合。
 * 默认值 = 原片 30fps 实测曲线与 1080p 几何,不是手调;改参数前先看下面每条曲线的来源。
 *
 * 构成(自下而上):
 *   压暗层:近黑 rgb(3.38,2.11,3.26),f2→f11 近线性压到 α0.9538(f11 过冲一帧 0.9604)=「过渡」
 *   screen 组①:条(每段各自从左往右生长,后一段从切分点接着长)+ 圆角底槽细描边 + 可选图标(横向滑入)
 *               条和描边 f2→f20 线性淡入(剪辑软件加的淡入,不是录屏)
 *   screen 组②:括号描线(圆头圆角折线,首段 └──、末段 └─┘)+ 数字(淡入 + 上移约 20px,同一条进度)
 *   标签:荧光绿圆角底 + 黑字,从一条看不见的遮罩线下往上滑出,不缩放不过冲
 *   副文字:整行从右滑入 + 逐字从 0 弹到 1.12 再落 0.98 → 1(9 字共用一条实测折线表,错峰 1.08 帧/字)
 *
 * 两种布局:
 *   layout='split'(原样):一根条按数值切成 N 段,每段下面一条括号 + 一个数(原片 93% / 7%)
 *   layout='rows' (横向多条):N 根条上下排,每根按 value/max 长到对应长度,左边名字、右边数字
 *
 * 用法:
 *   <Sequence from={x}>
 *     <DataBars segments={[{ value: 93, text: '93%' }, { value: 7, text: '7%' }]} tag={{ text: '直接同意' }} subtext="- 不审核CC的修改" />
 *   </Sequence>
 * 组件铺满父容器(AbsoluteFill 语义),几何按 1920×1080 画布像素给;本地第 0 帧 = 原片 f2(压暗开始那一帧)。
 */
import React, { useId } from 'react';
import { AbsoluteFill, Easing, Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

const clampBoth = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 实测时基:原片 30fps。下面所有帧号都是原片绝对帧号(fNNN) */
const MEASURED_FPS = 30;
/** 组件本地第 0 帧对应原片 f2(压暗第一帧) */
const F0 = 2;

// ── 实测曲线(帧号 = 原片帧号;证据见案例 specs/motion.json 同名 id) ──
/** dim-fade:压暗层绝对 α(f2–f12,静态墙面 64 万像素逐通道回归);f11 比落定高一帧是原片如此 */
const DIM_FRAMES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const DIM_ALPHA = [0, 0.1026, 0.2081, 0.3192, 0.4266, 0.5292, 0.6322, 0.7417, 0.8512, 0.9604, 0.9539];
const DIM_SETTLED = 0.9538;
/** bar-*-fade / trough-fade:条与底槽淡入 a(t)(screen 模型反解,f2–f20 每帧 +0.056 近线性) */
const FADE_FRAMES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const FADE_VALUES = [0, 0.044, 0.121, 0.174, 0.224, 0.278, 0.338, 0.393, 0.447, 0.4903, 0.5497, 0.6062, 0.6644, 0.7198, 0.7757, 0.8327, 0.8835, 0.942, 1];

type Curve = { from: number; to: number; ease: (t: number) => number };
/** 首段(原片绿条 93%)与后续段(原片灰段 7%)各有一套实测曲线 */
const GROW: [Curve, Curve] = [
  /** bar-green-grow:右端亚像素逐帧,f2→f26,rmse <1px */
  { from: 2, to: 26, ease: Easing.bezier(0.1323, 0.8858, 0.3129, 0.9952) },
  /** bar-gray-grow:从切分点起长,f20→f43(和首段有 3 帧暗缝,是两条独立生长) */
  { from: 20, to: 43, ease: Easing.bezier(0.275, 0.9557, 0.3627, 0.9747) },
];
const BRACKET: [Curve, Curve] = [
  /** bracket-green-draw:线头弧长逐帧,f27→f37 */
  { from: 27, to: 37, ease: Easing.bezier(0.2685, 0.8511, 0.3904, 0.9221) },
  /** bracket-gray-draw:一笔三段,f31→f47,rmse 0.14px */
  { from: 31, to: 47, ease: Easing.bezier(0.1827, 0.7968, 0.2414, 0.9775) },
];
const NUMBER: [Curve & { rise: number }, Curve & { rise: number }] = [
  /** pct-93-in:淡入与上移是同一条进度((1−g)/dy 恒 ≈0.05),f38→f49 */
  { from: 38, to: 49, rise: 20.4221, ease: Easing.bezier(0.1952, 1, 0.3381, 0.9848) },
  /** pct-7-in:f41→f52 */
  { from: 41, to: 52, rise: 19.7828, ease: Easing.bezier(0.2771, 0.9761, 0.3057, 0.9878) },
];
/** icon-slide:图标横移 −185.5px → 0,f12→f17(不跟条一起淡入,单独一层) */
const ICON: Curve & { dx: number } = { from: 12, to: 17, dx: -185.5188, ease: Easing.bezier(0.099, 0.0013, 0.3757, 0.9982) };
/** tag-bg-rise / tag-text-rise:标签从遮罩线下上滑 152.6px → 0,f93→f107,无过冲 */
const TAG: Curve & { dy: number } = { from: 93, to: 107, dy: 152.6174, ease: Easing.bezier(0.3069, 0.8336, 0.5838, 1) };
/** subtext-slide:整行横移 +175.3px → 0,f123→f137 */
const SUB_SLIDE: Curve & { dx: number } = { from: 123, to: 137, dx: 175.2923, ease: Easing.bezier(0.3869, 0.0185, 0.0144, 0.9741) };
/** subtext-pop:逐字缩放共用折线表 Sc(u)(0.25 帧精度,9 字联合拟合 rmse 0.005);u = t − t0 − k·错峰 */
const POP = { t0: 123.1105, stagger: 1.0779, windowEnd: 144 };
const POP_U = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75, 4, 4.25, 4.5, 4.75, 5, 5.25, 5.5, 5.75, 6, 6.25, 6.5, 6.75, 7, 7.25, 7.5, 7.75, 8, 8.25, 8.5, 8.75, 9, 9.25, 9.5, 9.75, 10, 10.25, 10.5, 10.75, 11, 12];
const POP_S = [0, 0.0101, 0.0183, 0.1485, 0.3389, 0.5386, 0.6943, 0.8249, 0.9164, 0.9878, 1.0389, 1.0755, 1.1003, 1.1143, 1.123, 1.1238, 1.1235, 1.1132, 1.105, 1.0947, 1.0836, 1.0677, 1.0531, 1.0394, 1.0239, 1.0111, 1.0004, 0.9915, 0.9851, 0.981, 0.98, 0.9798, 0.9786, 0.9809, 0.9825, 0.9833, 0.9847, 0.9861, 0.9875, 0.9891, 0.9902, 0.9925, 0.994, 0.9947, 0.9981, 1];

// ── 实测几何(1080p 画布 px;layout.json / layout-ext.json) ──
/** 条容器 (114.88,254.3)–(1804.72,373.78),圆角 10 */
const ORIGINAL_BOX = { x: 114.88, y: 254.3, width: 1689.84, height: 119.48 };
const G = {
  radius: 10,
  outlineWidth: 1.5,
  outlineColor: 'rgba(255,255,255,0.093)',
  /** 括号:钩顶在条底下 34.72,横线在条底下 72.01,线宽 8.8 */
  hookTop: 34.72,
  lineY: 72.01,
  stroke: 8.8,
  /** 数字底边在括号横线下 71.75(首段 67.1px)/ 71.18(后续 55.55px):两数底对齐 */
  numberBottom: 71.75,
  /** 标签:顶在括号横线下 92.19,高 119.65,圆角 14.5,左右留白 13.35;中心比首段括号中点偏左 3.2 */
  tagTop: 92.19,
  tagHeight: 119.65,
  tagRadius: 14.5,
  tagPadX: 13.353,
  tagShiftX: -3.2,
  /** 遮罩线在标签底下 16.97(f94–f100 可见下沿恒 674.6) */
  tagClipBelow: 16.97,
  /** 标签字比底块中心高 3.2 */
  tagTextDy: -3.2,
  /** 副文字:顶在标签顶下 148.05,中心比标签中心偏右 252.85 */
  subTop: 148.05,
  subShiftX: 252.85,
  /** 逐字缩放原点:纵向距字顶 59.5px(75.8px 字 → 0.785em,字底附近) */
  subOriginYEm: 59.5 / 75.8,
};

/** 秋芝配色(去 screen 后的图层色):荧光绿 = 正面/结论,灰 = 对照 */
export const DATA_BAR_TONES = {
  positive: { bar: 'rgb(32.8,161.1,102.2)', bracket: 'rgb(32.9,160.7,101.3)', number: 'rgb(30.8,160.3,101.3)' },
  neutral: { bar: 'rgb(106,111.7,127.1)', bracket: 'rgb(155.8,160.1,171.1)', number: 'rgb(213.1,213.5,217.5)' },
} as const;
export type DataBarTone = keyof typeof DATA_BAR_TONES;

export type DataBarSegment = {
  /** 数值(任意正数):split 布局按占总和的比例切;rows 布局按 value/max 定长度 */
  value: number;
  /** 显示的数字文本,任意格式:「93%」「3 倍」「¥2000」;不给就按占比写百分数 */
  text?: string;
  /** rows 布局左侧的名字 */
  name?: string;
  /** 预设色调;默认第一段 positive、其余 neutral */
  tone?: DataBarTone;
  /** 自定义颜色(覆盖 tone):条色;括号 / 数字不给就跟条色 */
  color?: string;
  bracketColor?: string;
  numberColor?: string;
};

export type DataBarsProps = {
  segments?: DataBarSegment[];
  /** split = 一根条切 N 段 + 括号(原样);rows = N 根条上下排 */
  layout?: 'split' | 'rows';
  /** 条容器(画布 px)。split 默认原片位置;rows 默认 x420 宽 1080,第一根条顶 y300 */
  box?: { x: number; y: number; width: number; height?: number };
  /** rows 布局:条的最大值(默认取各段最大) */
  max?: number;
  /** split 布局:总量(默认各段之和;给 100 而段加起来 <100 → 剩下是空槽) */
  total?: number;
  /** rows 布局:两根条的间距(条底到下一根条顶),默认 110 */
  rowGap?: number;
  /** 结论标签;segmentIndex = 挂在哪一段的括号下(默认 0) */
  tag?: { text: string; color?: string; textColor?: string; segmentIndex?: number };
  /** 副文字(逐字弹出);offsetX = 相对标签中心的横向偏移(原片 252.85) */
  subtext?: string;
  subtextOffsetX?: number;
  /** 左上角图标(screen 叠加,横向滑入);原片是人形图标 */
  icon?: { src: string; x: number; y: number; width: number; height: number };
  /** 压暗过渡:dim=false 不压暗(底子本来就暗时用) */
  dim?: boolean;
  /** 压暗落定不透明度,原片 0.9538 */
  dimOpacity?: number;
  dimColor?: string;
  /** 压暗时顺带模糊背景(px,backdrop-filter);原片底片自带模糊,默认 0 */
  backdropBlurPx?: number;
  /** 条/括号/数字的叠加方式:screen = 原片(暗底上发光感、透出底下人影);normal = 实色 */
  blend?: 'screen' | 'normal';
  /** 字体 */
  numberFontFamily?: string;
  numberFontWeight?: React.CSSProperties['fontWeight'];
  textFontFamily?: string;
  /** 速度倍率:1 = 原片(条 0.8 秒长满、数字 1.7 秒到位);0.7 更稳,1.3 更利落 */
  speed?: number;
  /** 后续段相对前一段的错峰(原片帧),默认 18 = 原片灰段比绿条晚 18 帧 */
  segmentStagger?: number;
  /** 标签 / 副文字出现时刻(当前 fps 的帧,相对组件起点)。默认 = 原片节奏(约 3.0 秒 / 4.0 秒,跟口播对齐时改它) */
  tagDelayFrames?: number;
  subtextDelayFrames?: number;
  /** 起播延迟(帧,按当前 fps)。也可以直接套 <Sequence from> */
  delayFrames?: number;
  /** 录屏取帧表(原片帧号 → 实际取样时刻):复刻原片「一顿一顿」用,默认不给 = 平滑 */
  timeWarp?: Record<number, number>;
  /** 塞进 screen 组①的额外内容(比如背景点阵),画在条上面 */
  screenChildren?: React.ReactNode;
};

const interpTable = (xs: number[], ys: number[], x: number): number => {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  let i = 1;
  while (xs[i] < x) i += 1;
  const k = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
  return ys[i - 1] + (ys[i] - ys[i - 1]) * k;
};

/** 取帧表在整数帧之间线性插值;表外原样返回 */
const applyWarp = (t: number, warp?: Record<number, number>): number => {
  if (!warp) return t;
  const lo = Math.floor(t);
  const a = warp[lo];
  const b = warp[lo + 1];
  if (a === undefined || b === undefined) return a ?? t;
  return a + (b - a) * (t - lo);
};

const progress = (t: number, c: Curve, offset = 0) =>
  interpolate(t, [c.from + offset, c.to + offset], [0, 1], { ...clampBoth, easing: c.ease });

const roundRectPath = (x0: number, y0: number, x1: number, y1: number, r: number) => {
  const rr = Math.max(0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2));
  return `M${x0 + rr},${y0} H${x1 - rr} A${rr},${rr} 0 0 1 ${x1},${y0 + rr} V${y1 - rr} A${rr},${rr} 0 0 1 ${x1 - rr},${y1} H${x0 + rr} A${rr},${rr} 0 0 1 ${x0},${y1 - rr} V${y0 + rr} A${rr},${rr} 0 0 1 ${x0 + rr},${y0} Z`;
};

const DEFAULT_SEGMENTS: DataBarSegment[] = [
  { value: 93, text: '93%' },
  { value: 7, text: '7%' },
];

/** 整个特效(到副文字弹完)需要多少帧(当前 fps) */
export const dataBarsDurationInFrames = (fps: number, speed = 1): number =>
  Math.ceil(((POP.windowEnd - F0 + 1) / MEASURED_FPS / speed) * fps);

export const DataBars: React.FC<DataBarsProps> = ({
  segments = DEFAULT_SEGMENTS,
  layout = 'split',
  box: boxIn,
  max,
  total,
  rowGap = 110,
  tag,
  subtext,
  subtextOffsetX = G.subShiftX,
  icon,
  dim = true,
  dimOpacity = DIM_SETTLED,
  dimColor = 'rgb(3.38,2.11,3.26)',
  backdropBlurPx = 0,
  blend = 'screen',
  numberFontFamily = "SFPro770, 'SF Pro Display', 'PingFang SC', system-ui, sans-serif",
  numberFontWeight = 700,
  textFontFamily = 'SmileySans',
  speed = 1,
  segmentStagger = 18,
  tagDelayFrames,
  subtextDelayFrames,
  delayFrames = 0,
  timeWarp,
  screenChildren,
}) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  // 原片帧号时刻(可带小数):换 fps / 调速都在这里折算
  const toMeasured = (localFrames: number) => (localFrames / fps) * MEASURED_FPS * speed;
  const tRaw = toMeasured(frame - delayFrames) + F0;
  if (tRaw < F0) return null;
  // 录屏段(条 / 括号 / 数字)按取帧表取样
  const t = applyWarp(tRaw, timeWarp);
  // 标签、副文字:给了出现时刻就按它,否则原片节奏
  const tTag = tagDelayFrames === undefined ? tRaw : toMeasured(frame - delayFrames - tagDelayFrames) + TAG.from;
  const tSub = subtextDelayFrames === undefined ? tRaw : toMeasured(frame - delayFrames - subtextDelayFrames) + SUB_SLIDE.from;

  const rows = layout === 'rows';
  const box = boxIn
    ? { ...boxIn, height: boxIn.height ?? (rows ? 72 : ORIGINAL_BOX.height) }
    : rows
      ? { x: 400, y: 260, width: 1100, height: 80 }
      : ORIGINAL_BOX;
  const x0 = box.x;
  const x1 = box.x + box.width;
  /** 尺寸随条高等比(原片条高 119.48) */
  const u = box.height / ORIGINAL_BOX.height;
  /** 文字尺寸倍率:rows 的条细,字不跟着缩太小 */
  const tu = rows ? 0.9 : u;
  const n = segments.length;

  // ── 每段的时间偏移:第 0 段用首段曲线,第 i 段用后续曲线再晚 (i−1)·错峰 ──
  const curveIdx = (i: number) => (i === 0 ? 0 : 1) as 0 | 1;
  const offsetOf = (i: number) => (rows ? i * 10 : i === 0 ? 0 : (i - 1) * segmentStagger);

  // 默认色调:split 首段绿、其余灰;rows 数值最大的那根绿、其余灰(结论 = 荧光绿)
  const maxIdx = segments.reduce((b, s, i) => (s.value > segments[b].value ? i : b), 0);
  const tone = (s: DataBarSegment, i: number) =>
    DATA_BAR_TONES[s.tone ?? ((rows ? i === maxIdx : i === 0) ? 'positive' : 'neutral')];
  const colorsOf = (s: DataBarSegment, i: number) => ({
    bar: s.color ?? tone(s, i).bar,
    bracket: s.bracketColor ?? (s.color ?? tone(s, i).bracket),
    number: s.numberColor ?? (s.color ?? tone(s, i).number),
  });

  const fadeA = interpTable(FADE_FRAMES, FADE_VALUES, tRaw);
  const dimA = Math.min(1, interpTable(DIM_FRAMES, DIM_ALPHA, tRaw) * (dimOpacity / DIM_SETTLED));

  // ── 几何:split 切分点 / rows 每根条 ──
  const sum = segments.reduce((a, s) => a + Math.max(0, s.value), 0);
  const splitTotal = Math.max(total ?? sum, 1e-9);
  const rowMax = Math.max(max ?? Math.max(...segments.map((s) => s.value)), 1e-9);
  const edges: number[] = [x0];
  segments.forEach((s) => edges.push(edges[edges.length - 1] + (box.width * Math.max(0, s.value)) / splitTotal));
  const rowTop = (i: number) => box.y + i * (box.height + rowGap);

  const bars: React.ReactNode[] = [];
  const outlines: React.ReactNode[] = [];
  const brackets: React.ReactNode[] = [];
  const numbers: React.ReactNode[] = [];
  const names: React.ReactNode[] = [];
  const clipId = `db-clip-${uid}`;
  const clipDefs: React.ReactNode[] = [];

  segments.forEach((s, i) => {
    const c = colorsOf(s, i);
    const ci = curveIdx(i);
    const off = offsetOf(i);
    const grow = progress(t, GROW[rows ? 0 : ci], off);
    const nc = NUMBER[rows ? 0 : ci];
    const np = progress(t, nc, off);
    const pct = rows ? s.value / rowMax : Math.max(0, s.value) / splitTotal;
    const text = s.text ?? `${Math.round(pct * 1000) / 10}%`;
    const major = rows || i === 0;
    const fontSize = (major ? 67.1 : 55.55) * tu;
    const letterSpacing = (major ? 0.25 : -0.95) * tu;
    const settledNum = np >= 1;
    const numStyle: React.CSSProperties = {
      position: 'absolute',
      whiteSpace: 'pre',
      lineHeight: 1,
      fontFamily: numberFontFamily,
      fontWeight: numberFontWeight,
      fontSize,
      letterSpacing,
      color: c.number,
      opacity: settledNum ? undefined : np,
    };

    if (rows) {
      const y0 = rowTop(i);
      const y1 = y0 + box.height;
      const rc = `${clipId}-${i}`;
      clipDefs.push(
        <clipPath key={rc} id={rc}>
          <path d={roundRectPath(x0, y0, x1, y1, G.radius * u)} />
        </clipPath>,
      );
      const to = x0 + box.width * Math.min(1, pct) * grow;
      if (to > x0) bars.push(<rect key={`b${i}`} x={x0} y={y0} width={to - x0} height={y1 - y0} fill={c.bar} clipPath={`url(#${rc})`} />);
      outlines.push(
        <path key={`o${i}`} d={roundRectPath(x0, y0, x1, y1, G.radius * u)} fill="rgba(255,255,255,0.05)" stroke={G.outlineColor} strokeWidth={G.outlineWidth} />,
      );
      // 数字:条右边外侧,垂直居中;淡入 + 上移同原片数字曲线
      numbers.push(
        <div
          key={`n${i}`}
          style={{
            ...numStyle,
            left: x1 + 32 * u,
            top: y0 + box.height / 2 - fontSize / 2,
            translate: settledNum ? undefined : `0px ${(nc.rise * u * (1 - np)).toFixed(3)}px`,
          }}
        >
          {text}
        </div>,
      );
      if (s.name) {
        const nameP = progress(t, NUMBER[0], off - 11); // 名字比数字早 11 帧(= 条开始长时)出现
        names.push(
          <div
            key={`m${i}`}
            style={{
              position: 'absolute',
              right: W - (x0 - 32 * u),
              top: y0 + box.height / 2 - (56 * tu) / 2,
              fontFamily: textFontFamily,
              fontSize: 56 * tu,
              lineHeight: 1,
              whiteSpace: 'pre',
              color: '#FFFFFF',
              opacity: nameP >= 1 ? undefined : nameP,
            }}
          >
            {s.name}
          </div>,
        );
      }
      return;
    }

    // split:第 i 段从 edges[i] 起长到 edges[i+1]
    const from = edges[i];
    const end = edges[i + 1];
    const to = from + (end - from) * grow;
    if (to > from) bars.push(<rect key={`b${i}`} x={from} y={box.y} width={to - from} height={box.height} fill={c.bar} clipPath={`url(#${clipId})`} />);

    // 括号:左钩(上→下)+ 横线(左→右),最后一段再加右钩(下→上);首段左钩中心比容器左缘内收 0.29
    const bp = progress(t, BRACKET[ci], off);
    if (bp > 0 && end - from > 0.5) {
      const bottom = box.y + box.height;
      const top = bottom + G.hookTop * u;
      const lineY = bottom + G.lineY * u;
      const left = i === 0 ? from + 0.29 * u : from;
      const right = i === n - 1 ? Math.min(end, x1) - 0.035 * u : end;
      const d = i === n - 1 ? `M${left},${top} V${lineY} H${right} V${top}` : `M${left},${top} V${lineY} H${right}`;
      brackets.push(
        <path
          key={`k${i}`}
          d={d}
          fill="none"
          stroke={c.bracket}
          strokeWidth={G.stroke * u}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={bp < 1 ? `${bp} ${1 - bp + 1e-6}` : undefined}
        />,
      );
    }
    // 数字:居中在括号中点,底边对齐在横线下 71.75(首段)/ 71.18(后续)
    if (np > 0) {
      const mid = ((i === 0 ? from + 0.29 * u : from) + (i === n - 1 ? end - 0.035 * u : end)) / 2;
      const bottomY = box.y + box.height + (G.lineY + G.numberBottom - (67.1 - fontSize / u) * 0.05) * u;
      numbers.push(
        <div
          key={`n${i}`}
          style={{
            ...numStyle,
            left: mid,
            top: bottomY - fontSize,
            translate: `-50% ${settledNum ? 0 : (nc.rise * u * (1 - np)).toFixed(3)}px`,
          }}
        >
          {text}
        </div>,
      );
    }
  });

  if (!rows) {
    clipDefs.push(
      <clipPath key="c" id={clipId}>
        <path d={roundRectPath(x0, box.y, x1, box.y + box.height, G.radius * u)} />
      </clipPath>,
    );
    outlines.push(
      <path
        key="o"
        d={roundRectPath(x0, box.y, x1, box.y + box.height, G.radius * u)}
        fill="none"
        stroke={G.outlineColor}
        strokeWidth={G.outlineWidth}
      />,
    );
  }

  // ── 标签 / 副文字的锚点 ──
  const tagSeg = Math.min(n - 1, Math.max(0, tag?.segmentIndex ?? 0));
  const bracketMid = (i: number) =>
    ((i === 0 ? edges[i] + 0.29 * u : edges[i]) + (i === n - 1 ? edges[i + 1] - 0.035 * u : edges[i + 1])) / 2;
  const tagCenterX = rows ? (x0 + x1) / 2 : bracketMid(tagSeg) + G.tagShiftX * u;
  const lastBottom = rows ? rowTop(n - 1) + box.height : box.y + box.height;
  const tagTopY = rows ? lastBottom + 70 : lastBottom + (G.lineY + G.tagTop) * u;
  const tagH = G.tagHeight * tu;

  let tagNode: React.ReactNode = null;
  if (tag && tTag >= TAG.from) {
    const p = interpolate(tTag, [TAG.from, TAG.to], [0, 1], { ...clampBoth, easing: TAG.ease });
    const settled = p >= 1;
    const clipY = tagTopY + tagH + G.tagClipBelow * tu;
    tagNode = (
      // 遮罩窗:下沿是固定线(标签从线下滑上来),上/左右放宽
      <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: clipY, overflow: 'hidden' }}>
        <div
          style={{
            position: 'absolute',
            left: tagCenterX,
            top: tagTopY,
            height: tagH,
            padding: `0 ${G.tagPadX * tu}px`,
            borderRadius: G.tagRadius * tu,
            background: tag.color ?? 'rgb(23,210,112)',
            color: tag.textColor ?? '#000000',
            fontFamily: textFontFamily,
            fontSize: 83.12 * tu,
            lineHeight: `${tagH}px`,
            whiteSpace: 'pre',
            translate: settled ? '-50% 0px' : `-50% ${(TAG.dy * tu * (1 - p)).toFixed(3)}px`,
          }}
        >
          <span style={{ position: 'relative', top: G.tagTextDy * tu }}>{tag.text}</span>
        </div>
      </div>
    );
  }

  let subNode: React.ReactNode = null;
  if (subtext && tSub >= SUB_SLIDE.from) {
    const slide = interpolate(tSub, [SUB_SLIDE.from, SUB_SLIDE.to], [1, 0], { ...clampBoth, easing: SUB_SLIDE.ease });
    const glyphs = Array.from(new Intl.Segmenter('zh', { granularity: 'grapheme' }).segment(subtext), (g) => g.segment);
    const count = glyphs.filter((g) => !/\s/.test(g)).length;
    const uEnd = POP_U[POP_U.length - 1];
    // 字多了压错峰,保证 f144 前弹完(同案例 runtime)
    const stagger = count <= 1 ? POP.stagger : Math.max(0, Math.min(POP.stagger, (POP.windowEnd - POP.t0 - uEnd) / (count - 1)));
    const popDone = tSub >= POP.t0 + (count - 1) * stagger + uEnd;
    let k = 0;
    const shadowId = `db-sh-${uid}`;
    subNode = (
      <>
        <svg aria-hidden width={0} height={0} style={{ position: 'absolute' }}>
          <filter id={shadowId} x="-20%" y="-80%" width="140%" height="260%" colorInterpolationFilters="sRGB">
            {/* 副文字右下黑投影(原片实测:外扩 4 → 高斯 σ3.09 → 偏移 (2.27,2.45) → ×0.8) */}
            <feMorphology in="SourceAlpha" operator="dilate" radius={4 * tu} result="spread" />
            <feGaussianBlur in="spread" stdDeviation={3.09 * tu} result="soft" />
            <feOffset in="soft" dx={2.27 * tu} dy={2.45 * tu} result="moved" />
            <feFlood floodColor="#000000" floodOpacity={0.8} result="tint" />
            <feComposite in="tint" in2="moved" operator="in" result="shade" />
            <feMerge>
              <feMergeNode in="shade" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </svg>
        <div
          style={{
            position: 'absolute',
            left: tagCenterX + subtextOffsetX * tu,
            top: tagTopY + G.subTop * tu,
            translate: slide > 0 ? `calc(-50% + ${(SUB_SLIDE.dx * tu * slide).toFixed(3)}px) 0px` : '-50% 0px',
            whiteSpace: 'pre',
            fontFamily: textFontFamily,
            fontSize: 75.8 * tu,
            lineHeight: 1,
            color: '#FFFFFF',
            filter: `url(#${shadowId})`,
          }}
        >
          {glyphs.map((g, gi) => {
            if (/\s/.test(g)) return <span key={gi}>{g}</span>;
            const uu = tSub - POP.t0 - k * stagger;
            k += 1;
            const sc = uu <= 0 ? 0 : interpTable(POP_U, POP_S, uu);
            return (
              <span
                key={gi}
                style={{
                  display: 'inline-block',
                  // 弹完清掉 scale(坑 Z1)
                  scale: popDone ? undefined : `${Math.max(0, sc)}`,
                  transformOrigin: `50% ${G.subOriginYEm}em`,
                }}
              >
                {g}
              </span>
            );
          })}
        </div>
      </>
    );
  }

  let iconNode: React.ReactNode = null;
  if (icon) {
    const ip = progress(tRaw, ICON);
    iconNode = (
      <Img
        src={icon.src}
        style={{
          position: 'absolute',
          left: icon.x,
          top: icon.y,
          width: icon.width,
          height: icon.height,
          translate: ip >= 1 ? undefined : `${(ICON.dx * (1 - ip)).toFixed(3)}px 0px`,
        }}
      />
    );
  }

  const blendMode = blend === 'screen' ? 'screen' : undefined;
  const svgBox = { position: 'absolute', left: 0, top: 0, width: W, height: H, overflow: 'visible' } as const;
  return (
    <AbsoluteFill>
      {dim ? (
        <AbsoluteFill
          style={{
            background: dimColor,
            opacity: dimA,
            backdropFilter: backdropBlurPx > 0 ? `blur(${backdropBlurPx}px)` : undefined,
          }}
        />
      ) : null}
      {/* screen 组①:条 + 底槽描边(各自淡入)+ 图标 + 额外内容 */}
      <AbsoluteFill style={{ mixBlendMode: blendMode }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={svgBox}>
          <defs>{clipDefs}</defs>
          <g opacity={fadeA}>{bars}</g>
          <g opacity={fadeA}>{outlines}</g>
        </svg>
        {iconNode}
        {screenChildren}
      </AbsoluteFill>
      {/* screen 组②:括号 + 数字 */}
      <AbsoluteFill style={{ mixBlendMode: blendMode }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={svgBox}>
          {brackets}
        </svg>
        {numbers}
      </AbsoluteFill>
      {names}
      {tagNode}
      {subNode}
    </AbsoluteFill>
  );
};
