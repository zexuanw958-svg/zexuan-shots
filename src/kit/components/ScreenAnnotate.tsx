/**
 * ScreenAnnotate.tsx — 「录屏标注」模板:橙色点状虚线框 + 小三角箭头 + 橙底标签 + 荧光笔(秋芝 C1/C2 实测版)。
 *
 * 出处(默认值 = 原片 30fps 实测,不是手调;改参数前先看每条曲线的来源):
 *   虚线框 / 橙底标签:内部复刻案例 qz-cc-0376-screen-annotate(交付 18,《Claude Code 全解》6:16 Cursor 四区)
 *     specs/layout-ext.json 的 dashedRect / textBox,specs/motion.json 的 tag-*-rise
 *   小三角箭头:同一部原片 6:49.97–6:51.2(409.967–411.2s,指「选择文件夹」按钮),本模板制作时逐帧量的
 *     (量法:橙色饱和度 α=(R−B)/246 → 三边直线拟合 → 顶边宽 / 高 / 倾角 / 顶边中点,f210–f246)
 *   荧光笔:内部复刻案例 qz-cx-1182-capsule-list(交付 09,《Codex 全解》19:57 官方截图黄色荧光笔)specs/motion.json highlight-wipe
 *
 * 构成(自下而上):
 *   highlight 荧光笔:#FEDE00 矩形 multiply 叠在录屏上(黑字不变色),硬边、不透明,从左往右擦出 23 帧
 *   box 虚线框:一帧硬出、一帧硬消(原片 7 个框全是硬切,没有描边生长);划线规律见 dashedRectPath
 *   label 橙底标签:整块从自己下沿的遮罩里往上升,15 帧,只平移(无缩放/淡入/模糊)
 *   arrow 小三角:和框同一帧硬出,出现瞬间是扁宽的黄三角,15 帧里左右摆 + 挤压拉伸(体积近似守恒)阻尼晃停,
 *                 同时黄 → 橙;顶边中点当支点;周围一圈很淡的红色柔光
 *
 * 用法(坐标是画布像素;给了 space 就是录屏原始像素):
 *   <ScreenAnnotate
 *     annotations={[
 *       { type: 'box', at: 1.2, rect: { x: 220, y: 66, w: 234, h: 888 }, label: { text: '查看全部文件', at: 2.5 } },
 *       { type: 'box', at: 4.0, rect: {...}, arrow: true },
 *       { type: 'highlight', at: 6.0, rect: { x: 951, y: 534, w: 353, h: 53 } },
 *       { type: 'arrow', at: 7.0, tip: { x: 960, y: 500 }, direction: 'down' },
 *     ]}
 *   />
 * 组件铺满父容器(AbsoluteFill 语义);at / until 是秒,相对组件起点(可以套 <Sequence from>)。
 */
import React from 'react';
import { Easing, Img, OffthreadVideo, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

const clampBoth = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 实测时基:原片 30fps。下面帧号都是「元素第一次出现」为 0 的本地帧 */
const MEASURED_FPS = 30;

// ── 虚线框(案例 18 layout-ext dashedRect,7 个框 28 条边实测) ──
/** 线宽 2.78、线芯色 #FF6A00、圆角 13.35、名义周期 10.667、划:空 = 1:1 */
const BOX = { stroke: 2.78, color: '#FF6A00', radius: 13.35, period: 10.667, dashRatio: 0.5 };

// ── 橙底标签(案例 18 textBox,4 个标签平均;字号 41.875 下的像素,按字号等比) ──
const LABEL = {
  fontSize: 41.875,
  bg: '#FF7100',
  color: '#FFFFFF',
  /** 行高 58.572 / 字号 */
  lineHeightEm: 58.572 / 41.875,
  /** 上留白 0,下留白 2.668 / 字号(4 个标签 2.398–3.078 平均) */
  padBottomEm: 2.668 / 41.875,
  /** 左右留白 6.864 / 字号 */
  padXEm: 6.864 / 41.875,
  radiusEm: 7.6 / 41.875,
  /** 遮罩下沿在标签底下 8.67px(501.62 − 492.95) */
  maskGapEm: 8.67 / 41.875,
  /** 升起起点 = 入场前一帧 77.625px;整块藏住只需 69.64 → 比例 1.1147 */
  riseOvershoot: 77.625 / 69.64,
};
/** tag-*-rise:入场前一帧(k=−1)77.625 → k=14 到 0,4 个标签共用,pooled rmse 0.032px */
const LABEL_RISE_EASE = Easing.bezier(0.338, 0.994, 0.656, 1);
const LABEL_RISE_END = 14;

// ── 小三角箭头(《CC 全解》409.967s 起逐帧量;落定 f230:顶边宽 95.0、高 63.3、尖到框外沿 4.7px) ──
const ARROW = {
  width: 95.0,
  height: 63.3,
  /** 尖到目标(框外沿)的空隙 */
  gap: 4.7,
  /** 落定色 (255,143,0);出现瞬间黄 (255,218,0) */
  color: '#FF8F00',
  flashColor: '#FFDA00',
};
/** 逐帧实测表(k = 出现后第几帧;k=0/1、8/9、11/12 原片就是重复帧):顶边宽比、高比、倾角(度,CSS 顺时针为正)、顶边中点横移(px) */
const ARROW_K = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
const ARROW_SX = [1.502, 1.502, 1.078, 0.826, 0.923, 1.174, 1.187, 1.026, 0.925, 0.927, 0.978, 1.02, 1.02, 1.012, 1.006, 1.002, 1];
const ARROW_SY = [0.758, 0.758, 0.926, 1.248, 1.07, 0.872, 0.859, 0.959, 1.07, 1.063, 1.019, 0.981, 0.981, 0.991, 0.994, 0.997, 1];
const ARROW_ROT = [-3.06, -3.07, -4.89, -0.95, 2.17, 1.93, 1.86, 2.11, 1.22, 1.22, 0, -0.55, -0.55, 0, 0, 0, 0];
const ARROW_DX = [3.4, 3.4, 0.4, -0.7, 0, 0.9, 1.0, -0.1, -0.4, -0.6, -0.3, 0.1, 0.1, 0, 0.1, 0, 0];
/** 黄 → 橙:G 通道 218,218,219,211,199,183,167,153,143(k=0…8)折成 0→1 进度 */
const ARROW_COLOR_K = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const ARROW_COLOR_P = [0, 0, 0, 0.093, 0.253, 0.453, 0.667, 0.867, 1];
const ARROW_SETTLE = 16;
/** 外圈红色柔光:边外 2px 处约 α0.27、20px 外散尽 → drop-shadow 标准差约 7px */
const ARROW_GLOW = { color: 'rgba(255,40,20,0.55)', sigma: 7 };

// ── 荧光笔(案例 09 highlight-wipe,完整 23 帧右沿逐列覆盖投影,rmse 0.35px) ──
const HIGHLIGHT = { color: '#FEDE00', blend: 'multiply' as const, frames: 23, p0: 0.0042 };
const HIGHLIGHT_EASE = Easing.bezier(0.3298, 0.0716, 0.6641, 0.9983);

export type Rect = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };
export type ArrowDirection = 'down' | 'up' | 'left' | 'right';

export type LabelSpec = {
  text: string;
  /** 出现时刻(秒),默认跟框同时 */
  at?: number;
  /** 相对框的位置:center(默认,框正中)/ top-left / top / bottom / above(框外上方)/ below(框外下方) */
  place?: 'center' | 'top-left' | 'top' | 'bottom' | 'above' | 'below';
  /** 直接给标签位置(覆盖 place):x 按 align 解释(left = 底块左沿、center = 中线),y = 底块顶 */
  pos?: Point;
  align?: 'left' | 'center';
  /** 贴框内边距(top-left / top / bottom 用),默认 29 = 原片「编辑文件」离框左沿 */
  inset?: number;
  bg?: string;
  color?: string;
};

export type ArrowSpec = {
  /** 出现时刻(秒),默认跟框同时(原片同一帧) */
  at?: number;
  /** 箭头在框的哪一侧(默认 top:在框上方往下指) */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** 尖到框外沿的空隙,默认 4.7 */
  gap?: number;
  /** 沿边方向偏移(px),默认 0 = 边的中点 */
  offset?: number;
  /** 箭头颜色(#RRGGBB),默认跟框的 color;框没给 color 时用原片 #FF8F00(比框线 #FF6A00 亮一档) */
  color?: string;
};

type Common = {
  /** 出现时刻(秒,相对组件起点) */
  at: number;
  /** 硬切消失时刻(秒);不给 = 一直留到组件结束(秋芝的标注是累积的,段落结束一起硬切) */
  until?: number;
  /** 主色(#RRGGBB):框描边 + 标签底 + 箭头落定色 */
  color?: string;
};

export type BoxAnnotation = Common & {
  type: 'box';
  /** 框的外沿(含线宽) */
  rect: Rect;
  label?: string | LabelSpec;
  arrow?: boolean | ArrowSpec;
  /** 圆角,默认 13.35 */
  radius?: number;
};
export type HighlightAnnotation = Common & {
  type: 'highlight';
  /** 一行一个矩形;多行按顺序一行擦完再擦下一行 */
  rect: Rect | Rect[];
  /** 每行擦出时长(原片帧,30fps),默认 23 */
  wipeFrames?: number;
};
export type ArrowAnnotation = Common & {
  type: 'arrow';
  /** 箭头尖的位置 */
  tip: Point;
  direction?: ArrowDirection;
};
/** 独立标签(不挂框):原片「编辑文件」在大框换成两个小框时一直留着,就用这种 */
export type LabelAnnotation = Common & { type: 'label'; text: string; pos: Point; align?: 'left' | 'center'; bg?: string; textColor?: string };
export type Annotation = BoxAnnotation | HighlightAnnotation | ArrowAnnotation | LabelAnnotation;

export type ScreenAnnotateProps = {
  annotations: Annotation[];
  /** 录屏素材(可选):画在标注下面。rect 不给 = 铺满 */
  media?: { src: string; kind: 'video' | 'image'; rect?: Rect; radius?: number; fit?: 'cover' | 'contain' | 'fill' };
  /** 坐标换算:画布 = (x, y) + scale × 标注坐标。标注按录屏原始像素写时用 */
  space?: { x: number; y: number; scale: number };
  /** 框只在这个圆角矩形里显示(画布像素;原片框被裁在录屏窗圆角里) */
  clip?: Rect & { radius?: number };
  /** 尺寸倍率:线宽 / 虚线周期 / 圆角 / 标签字号 / 箭头一起放大缩小。录屏缩得小就调小 */
  size?: number;
  /** 虚线框样式覆盖 */
  boxStyle?: { stroke?: number; period?: number; dashRatio?: number; radius?: number };
  /** 标签字体 / 字号(画布 px,已含 size 之外) */
  labelFontFamily?: string;
  labelFontSize?: number;
  /** 箭头大小倍率(在 size 之上) */
  arrowScale?: number;
  /** 箭头柔光开关 */
  arrowGlow?: boolean;
  /** 荧光笔颜色 / 叠加方式(深底录屏用 screen 或 normal) */
  highlightColor?: string;
  highlightBlend?: React.CSSProperties['mixBlendMode'];
  /** 速度倍率:1 = 原片节奏(标签 0.5 秒升到位、箭头 0.5 秒晃停、荧光笔 0.77 秒擦完) */
  speed?: number;
  children?: React.ReactNode;
};

// ─────────────────────────── 工具 ───────────────────────────

const interpTable = (xs: number[], ys: number[], x: number): number => {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  let i = 1;
  while (xs[i] < x) i += 1;
  const k = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
  return ys[i - 1] + (ys[i] - ys[i - 1]) * k;
};

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
};
const mix = (a: string, b: string, p: number): string => {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  // 整数分量:SVG fill 属性不认带小数的 rgb()(会退成黑色)
  const c = (x: number, y: number) => Math.round(x + (y - x) * p);
  return `rgb(${c(ar, br)},${c(ag, bg)},${c(ab, bb)})`;
};
/** 自定义主色时箭头闪色 = 主色往亮黄方向走 60%(原片橙 → 黄的关系) */
const flashOf = (color: string): string => {
  if (color.toUpperCase() === ARROW.color) return ARROW.flashColor;
  const [r, g, b] = hexToRgb(color);
  const [yr, yg, yb] = hexToRgb('#FFE040');
  const h = (x: number, y: number) => Math.round(x + (y - x) * 0.6).toString(16).padStart(2, '0');
  return `#${h(r, yr)}${h(g, yg)}${h(b, yb)}`;
};

type Pt = [number, number];
type DashSeg =
  | { kind: 'line'; a: Pt; b: Pt; len: number }
  | { kind: 'arc'; c: Pt; t0: number; r: number; len: number };

/**
 * 秋芝点状虚线圆角框路径(照搬案例 18 runtime dashedRectPath,实测规律):
 * 框中心线分 8 段(4 直边 + 4 段 1/4 弧),每段各自均分:份数 n = ceil(段长 / 名义周期),周期 = 段长 / n;
 * 划线中心落在每段两端(切点)和段内 k·周期处,划长 = dashRatio·周期,每一划单独一条子路径(跨切点连着画)。
 * CSS border dashed 和单条 dasharray 都做不出「每段各自均分、切点居中」。
 */
export const dashedRectPath = (x: number, y: number, w: number, h: number, stroke: number, radius: number, period: number, dashRatio: number): string => {
  const half = stroke / 2;
  const x0 = x + half;
  const y0 = y + half;
  const x1 = x + w - half;
  const y1 = y + h - half;
  const r = Math.max(0, Math.min(radius, (x1 - x0) / 2, (y1 - y0) / 2));
  const arcLen = (Math.PI * r) / 2;
  const segs = ([
    { kind: 'line', a: [x0 + r, y0], b: [x1 - r, y0], len: x1 - x0 - 2 * r },
    { kind: 'arc', c: [x1 - r, y0 + r], t0: -Math.PI / 2, r, len: arcLen },
    { kind: 'line', a: [x1, y0 + r], b: [x1, y1 - r], len: y1 - y0 - 2 * r },
    { kind: 'arc', c: [x1 - r, y1 - r], t0: 0, r, len: arcLen },
    { kind: 'line', a: [x1 - r, y1], b: [x0 + r, y1], len: x1 - x0 - 2 * r },
    { kind: 'arc', c: [x0 + r, y1 - r], t0: Math.PI / 2, r, len: arcLen },
    { kind: 'line', a: [x0, y1 - r], b: [x0, y0 + r], len: y1 - y0 - 2 * r },
    { kind: 'arc', c: [x0 + r, y0 + r], t0: Math.PI, r, len: arcLen },
  ] as DashSeg[]).filter((s) => s.len > 1e-6);
  if (segs.length === 0) return '';
  const starts: number[] = [];
  let total = 0;
  for (const s of segs) {
    starts.push(total);
    total += s.len;
  }
  const wrap = (s: number) => ((s % total) + total) % total;
  const indexAt = (sn: number) => {
    for (let i = segs.length - 1; i >= 0; i -= 1) if (sn >= starts[i] - 1e-9) return i;
    return 0;
  };
  const pointAt = (s: number): Pt => {
    const sn = wrap(s);
    const i = indexAt(sn);
    const seg = segs[i];
    const u = Math.min(seg.len, Math.max(0, sn - starts[i]));
    if (seg.kind === 'line') {
      const f = u / seg.len;
      return [seg.a[0] + (seg.b[0] - seg.a[0]) * f, seg.a[1] + (seg.b[1] - seg.a[1]) * f];
    }
    const t = seg.t0 + u / seg.r;
    return [seg.c[0] + seg.r * Math.cos(t), seg.c[1] + seg.r * Math.sin(t)];
  };
  const fmt = (p: Pt) => `${p[0].toFixed(3)} ${p[1].toFixed(3)}`;
  const piece = (sa: number, sb: number) => {
    let out = `M ${fmt(pointAt(sa))}`;
    let s = sa;
    for (let guard = 0; s < sb - 1e-9 && guard < 16; guard += 1) {
      const sn = wrap(s);
      let i = indexAt(sn);
      let rem = starts[i] + segs[i].len - sn;
      if (rem < 1e-9) {
        i = (i + 1) % segs.length;
        rem = segs[i].len;
      }
      const next = Math.min(sb, s + rem);
      const seg = segs[i];
      out += seg.kind === 'line' ? ` L ${fmt(pointAt(next))}` : ` A ${seg.r.toFixed(3)} ${seg.r.toFixed(3)} 0 0 1 ${fmt(pointAt(next))}`;
      s = next;
    }
    return out;
  };
  const periods = segs.map((seg) => {
    const n = Math.max(1, Math.ceil(seg.len / period - 1e-6));
    return { n, p: seg.len / n };
  });
  const parts: string[] = [];
  segs.forEach((seg, i) => {
    const { n, p } = periods[i];
    const prev = periods[(i - 1 + segs.length) % segs.length];
    const s0 = starts[i];
    parts.push(piece(s0 - (dashRatio * prev.p) / 2, s0 + (dashRatio * p) / 2));
    for (let k = 1; k < n; k += 1) {
      const c = s0 + k * p;
      parts.push(piece(c - (dashRatio * p) / 2, c + (dashRatio * p) / 2));
    }
  });
  return parts.join(' ');
};

// ─────────────────────────── 子组件 ───────────────────────────

/** 小三角:尖在 (0,0),朝下;外层按方向转。t = 出现后的实测本地帧 */
const Arrow: React.FC<{ tip: Point; direction: ArrowDirection; t: number; scale: number; color: string; glow: boolean }> = ({ tip, direction, t, scale, color, glow }) => {
  const w = ARROW.width * scale;
  const h = ARROW.height * scale;
  const settled = t >= ARROW_SETTLE;
  const sx = interpTable(ARROW_K, ARROW_SX, t);
  const sy = interpTable(ARROW_K, ARROW_SY, t);
  const rot = interpTable(ARROW_K, ARROW_ROT, t);
  const dx = interpTable(ARROW_K, ARROW_DX, t) * scale;
  const cp = interpTable(ARROW_COLOR_K, ARROW_COLOR_P, t);
  const fill = cp >= 1 ? color : mix(flashOf(color), color, cp);
  const dirDeg = { down: 0, up: 180, left: 90, right: -90 }[direction];
  const pad = ARROW_GLOW.sigma * 3 * scale;
  return (
    <div style={{ position: 'absolute', left: tip.x, top: tip.y, width: 0, height: 0, rotate: dirDeg ? `${dirDeg}deg` : undefined, transformOrigin: '0 0' }}>
      <svg
        width={w + 2 * pad}
        height={h + 2 * pad}
        viewBox={`${-w / 2 - pad} ${-h - pad} ${w + 2 * pad} ${h + 2 * pad}`}
        style={{
          position: 'absolute',
          left: -w / 2 - pad,
          top: -h - pad,
          overflow: 'visible',
          // 支点 = 顶边中点(原片顶边 y 全程恒 762)
          transformOrigin: `${w / 2 + pad}px ${pad}px`,
          // 落定后清掉恒等变换(坑 Z1)
          translate: settled ? undefined : `${dx.toFixed(2)}px 0px`,
          rotate: settled ? undefined : `${rot.toFixed(3)}deg`,
          scale: settled ? undefined : `${sx.toFixed(4)} ${sy.toFixed(4)}`,
          filter: glow ? `drop-shadow(0px 0px ${(ARROW_GLOW.sigma * 2 * scale).toFixed(1)}px ${ARROW_GLOW.color})` : undefined,
        }}
      >
        <polygon points={`${-w / 2},${-h} ${w / 2},${-h} 0,0`} fill={fill} />
      </svg>
    </div>
  );
};

/** 橙底标签:整块在 overflow 遮罩里上升。t = 出现后的实测本地帧 */
const Label: React.FC<{ spec: LabelSpec; box?: Rect; t: number; fontSize: number; fontFamily: string; color: string; canvasW: number }> = ({ spec, box, t, fontSize, fontFamily, color, canvasW }) => {
  const lh = LABEL.lineHeightEm * fontSize;
  const padB = LABEL.padBottomEm * fontSize;
  const height = lh + padB;
  const gap = LABEL.maskGapEm * fontSize;
  const inset = spec.inset ?? 29;
  let align: 'left' | 'center' = spec.align ?? 'center';
  let x = 0;
  let top = 0;
  if (spec.pos) {
    x = spec.pos.x;
    top = spec.pos.y;
  } else if (box) {
    const cx = box.x + box.w / 2;
    const place = spec.place ?? 'center';
    if (place === 'top-left') {
      align = 'left';
      x = box.x + inset;
      top = box.y + inset;
    } else {
      align = 'center';
      x = cx;
      top =
        place === 'top' ? box.y + inset
          : place === 'bottom' ? box.y + box.h - inset - height
            : place === 'above' ? box.y - height - 12
              : place === 'below' ? box.y + box.h + 12
                : box.y + box.h / 2 - height / 2;
    }
  }
  const rise = (height + gap) * LABEL.riseOvershoot;
  const dy = interpolate(t, [-1, LABEL_RISE_END], [rise, 0], { ...clampBoth, easing: LABEL_RISE_EASE });
  const settled = t >= LABEL_RISE_END;
  const maskTop = top - 40;
  const maskBottom = top + height + gap;
  return (
    <div style={{ position: 'absolute', left: 0, top: maskTop, width: canvasW, height: maskBottom - maskTop, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: x,
          top: top - maskTop,
          translate: align === 'center' ? (settled ? '-50% 0px' : `-50% ${dy.toFixed(3)}px`) : settled ? undefined : `0px ${dy.toFixed(3)}px`,
          whiteSpace: 'pre',
          display: 'inline-block',
          fontFamily,
          fontSize,
          fontWeight: 400,
          lineHeight: `${lh}px`,
          padding: `0px ${LABEL.padXEm * fontSize}px ${padB}px`,
          borderRadius: LABEL.radiusEm * fontSize,
          background: spec.bg ?? color,
          color: spec.color ?? LABEL.color,
          fontKerning: 'none',
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        {spec.text}
      </div>
    </div>
  );
};

// ─────────────────────────── 主组件 ───────────────────────────

export const ScreenAnnotate: React.FC<ScreenAnnotateProps> = ({
  annotations,
  media,
  space,
  clip,
  size = 1,
  boxStyle,
  labelFontFamily = 'SmileySansV1',
  labelFontSize,
  arrowScale = 1,
  arrowGlow = true,
  highlightColor = HIGHLIGHT.color,
  highlightBlend = HIGHLIGHT.blend,
  speed = 1,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const sp = space ?? { x: 0, y: 0, scale: 1 };
  const mapRect = (r: Rect): Rect => ({ x: sp.x + sp.scale * r.x, y: sp.y + sp.scale * r.y, w: sp.scale * r.w, h: sp.scale * r.h });
  const mapPt = (p: Point): Point => ({ x: sp.x + sp.scale * p.x, y: sp.y + sp.scale * p.y });
  /** 秒 → 当前 fps 的帧(取整,和剪辑软件一样按帧卡点) */
  const f = (sec: number) => Math.round(sec * fps);
  /** 当前帧离某时刻多少「实测本地帧」;<0 = 还没出现 */
  const local = (sec: number) => ((frame - f(sec)) / fps) * MEASURED_FPS * speed;
  const alive = (a: Common) => frame >= f(a.at) && (a.until === undefined || frame < f(a.until));

  const stroke = (boxStyle?.stroke ?? BOX.stroke) * size;
  const period = (boxStyle?.period ?? BOX.period) * size;
  const dashRatio = boxStyle?.dashRatio ?? BOX.dashRatio;
  const fontSize = labelFontSize ?? LABEL.fontSize * size;
  const clipId = 'sa-clip';

  const highlights: React.ReactNode[] = [];
  const boxPaths: React.ReactNode[] = [];
  const labels: React.ReactNode[] = [];
  const arrows: React.ReactNode[] = [];

  annotations.forEach((a, i) => {
    if (!alive(a)) return;
    if (a.type === 'highlight') {
      const rects = (Array.isArray(a.rect) ? a.rect : [a.rect]).map(mapRect);
      const wf = a.wipeFrames ?? HIGHLIGHT.frames;
      const t = local(a.at);
      rects.forEach((r, j) => {
        const tj = t - j * wf;
        if (tj < 0) return;
        const p = interpolate(tj, [0, wf], [HIGHLIGHT.p0, 1], { ...clampBoth, easing: HIGHLIGHT_EASE });
        highlights.push(
          <div
            key={`h${i}-${j}`}
            style={{
              position: 'absolute',
              left: r.x,
              top: r.y,
              width: r.w,
              height: r.h,
              background: a.color ?? highlightColor,
              mixBlendMode: highlightBlend,
              // 擦完清掉 clipPath
              clipPath: p >= 1 ? undefined : `inset(0px ${((1 - p) * 100).toFixed(3)}% 0px 0px)`,
            }}
          />,
        );
      });
      return;
    }
    if (a.type === 'label') {
      labels.push(
        <Label key={`l${i}`} spec={{ text: a.text, align: a.align, bg: a.bg, color: a.textColor, pos: mapPt(a.pos) }} t={local(a.at)} fontSize={fontSize} fontFamily={labelFontFamily} color={a.color ?? LABEL.bg} canvasW={width} />,
      );
      return;
    }
    if (a.type === 'arrow') {
      arrows.push(
        <Arrow key={`a${i}`} tip={mapPt(a.tip)} direction={a.direction ?? 'down'} t={local(a.at)} scale={arrowScale * size} color={a.color ?? ARROW.color} glow={arrowGlow} />,
      );
      return;
    }
    // box
    const r = mapRect(a.rect);
    const color = a.color ?? BOX.color;
    boxPaths.push(
      <path
        key={`b${i}`}
        d={dashedRectPath(r.x, r.y, r.w, r.h, stroke, (a.radius ?? boxStyle?.radius ?? BOX.radius) * size, period, dashRatio)}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="butt"
      />,
    );
    if (a.label) {
      const spec: LabelSpec = typeof a.label === 'string' ? { text: a.label } : a.label;
      const at = spec.at ?? a.at;
      if (frame >= f(at)) {
        const pos = spec.pos ? { ...spec, pos: mapPt(spec.pos) } : spec;
        labels.push(
          <Label key={`l${i}`} spec={pos} box={r} t={local(at)} fontSize={fontSize} fontFamily={labelFontFamily} color={a.color ?? LABEL.bg} canvasW={width} />,
        );
      }
    }
    if (a.arrow) {
      const spec: ArrowSpec = a.arrow === true ? {} : a.arrow;
      const at = spec.at ?? a.at;
      if (frame >= f(at)) {
        const side = spec.side ?? 'top';
        const gap = (spec.gap ?? ARROW.gap) * size;
        const off = spec.offset ?? 0;
        const cx = r.x + r.w / 2 + (side === 'top' || side === 'bottom' ? off : 0);
        const cy = r.y + r.h / 2 + (side === 'left' || side === 'right' ? off : 0);
        const tip: Point =
          side === 'top' ? { x: cx, y: r.y - gap }
            : side === 'bottom' ? { x: cx, y: r.y + r.h + gap }
              : side === 'left' ? { x: r.x - gap, y: cy }
                : { x: r.x + r.w + gap, y: cy };
        const direction: ArrowDirection = { top: 'down', bottom: 'up', left: 'right', right: 'left' }[side] as ArrowDirection;
        arrows.push(
          <Arrow key={`ba${i}`} tip={tip} direction={direction} t={local(at)} scale={arrowScale * size} color={spec.color ?? a.color ?? ARROW.color} glow={arrowGlow} />,
        );
      }
    }
  });

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {media ? (
        <div
          style={{
            position: 'absolute',
            left: media.rect?.x ?? 0,
            top: media.rect?.y ?? 0,
            width: media.rect?.w ?? width,
            height: media.rect?.h ?? height,
            borderRadius: media.radius,
            overflow: 'hidden',
          }}
        >
          {media.kind === 'video' ? (
            <OffthreadVideo src={media.src} muted style={{ width: '100%', height: '100%', objectFit: media.fit ?? 'cover' }} />
          ) : (
            <Img src={media.src} style={{ width: '100%', height: '100%', objectFit: media.fit ?? 'cover' }} />
          )}
        </div>
      ) : null}
      {children}
      {highlights}
      {boxPaths.length > 0 ? (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', left: 0, top: 0 }}>
          {clip ? (
            <defs>
              <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
                <rect x={clip.x} y={clip.y} width={clip.w} height={clip.h} rx={clip.radius ?? 0} ry={clip.radius ?? 0} />
              </clipPath>
            </defs>
          ) : null}
          <g clipPath={clip ? `url(#${clipId})` : undefined}>{boxPaths}</g>
        </svg>
      ) : null}
      {labels}
      {arrows}
    </div>
  );
};

/** 一组标注最后一个元素动作做完所需的秒数(方便排 Sequence 时长) */
export const screenAnnotateEndSec = (annotations: Annotation[], speed = 1): number =>
  annotations.reduce((m, a) => {
    const tail = a.type === 'label' ? (LABEL_RISE_END + 1) / MEASURED_FPS / speed : a.type === 'highlight' ? ((Array.isArray(a.rect) ? a.rect.length : 1) * (a.wipeFrames ?? HIGHLIGHT.frames)) / MEASURED_FPS / speed : ARROW_SETTLE / MEASURED_FPS / speed;
    return Math.max(m, a.until ?? a.at + tail);
  }, 0);
