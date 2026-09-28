/**
 * GrowingSequence.tsx — 「逐步生长的时序图 / 流程图」镜头模板(秋芝《Claude Code 全解》02:18「LLM loop」实测版)。
 *
 * 出处:内部复刻案例 qz-cc-0138-seq-diagram(交付 05,复刻相似度 0.90),工序④逐帧实测 + 拟合,
 *       曲线原表在案例 specs/motion.json / motion-ext.json / layout.json / layout-ext.json(下面注释里的 id 就是那里的 id)。
 * 默认值 = 原片 30fps 实测曲线与 1080p 几何,不是手调;改参数前先看每条曲线的来源。
 *
 * 构成(自下而上):
 *   背景点阵(可关):32×18 灰点,每列按正弦上下起伏(周期 150 帧),亮度默认程序生成(Check 里喂原片实测表)
 *   参与方节点:胶囊框 + 圆形图标 + 名字。三层同帧起跳、落差依次变大、f12 同时落地:
 *               名字从一条固定裁切线下面掉出来,图标从画面顶上落下,胶囊从更高处二次缓出落下
 *   生命线:从中点上下对称长出 + 淡入(f7→f22)
 *   步骤(三种):
 *     highlight 消息 = 黄签「荧光闪入」:箭头等比放大 + 签横向拖影(双轴模糊)+ 外晕闪一下 + 字先淡后实
 *     plain 消息     = 白签(可多行)从固定窗下沿升起,箭头同样等比放大(更慢)
 *     process 步骤   = 生命线上的空框缩小淡入,里面 loading 转圈跳格(或一行字)
 *
 * 两种布局:
 *   layout='sequence'(原样):参与方横排在顶上、生命线往下,步骤一行行往下长;2–6 方、3–10 步自动排开,
 *                            排不下就整体按比例收小(maxBottom 以内),不出画
 *   layout='flow'(横向流程图):参与方横排在画面中间,相邻两方直连箭头(去程在上、回程在下),
 *                            隔着的两方走下方 U 形线,process 框挂在节点下面
 *
 * 用法:
 *   <GrowingSequence
 *     participants={[{ name: '用户', icon: 'user' }, { name: 'Agent', icon: 'robot' }, { name: '大模型', icon: 'brain' }]}
 *     steps={[
 *       { from: '用户', to: 'Agent', text: '帮我整理文件夹' },
 *       { from: 'Agent', to: '大模型', text: ['提示词:“帮我整理文件夹”', '我的工具有......'] },
 *       { from: '大模型', kind: 'process' },
 *     ]}
 *   />
 * 组件铺满父容器(AbsoluteFill 语义),几何按 1920×1080 画布像素给;本地第 0 帧 = 原片 138.000s(节点起跳)。
 * 步骤时刻:step.at(当前 fps 的帧)/ step.atSec(秒)对口播;都不给就按 firstStepAt + stepGap 自动排。
 */
import React, { useId, useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, Easing, Img, interpolate, random, useCurrentFrame, useVideoConfig } from 'remotion';

const clampBoth = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 实测时基:原片 30fps。下面曲线帧号都是「该动作起点 = 0」的本地原片帧 */
const MEASURED_FPS = 30;

type Curve = { from: number; to: number; ease: (t: number) => number };
const lin = (t: number) => t;

// ── 实测曲线:节点入场(本地 0 = 原片 f0) ──
/** node-*-text-drop:名字从固定裁切线下掉出,dy −93.928 → 0,f0→f12(Agent 实测 −90.64) */
const NODE_TEXT: Curve & { dy: number } = { from: 0, to: 12, dy: -93.928, ease: Easing.bezier(0.422, 0.763, 0.749, 1) };
/** node-*-icon-drop:图标从画面顶上落下,dy −346.166 → 0,f0→f12,三节点逐帧一致(差 ≤0.05px) */
const NODE_ICON: Curve & { dy: number } = { from: 0, to: 12, dy: -346.166, ease: Easing.bezier(0.312, 0.437, 0.501, 1) };
/** node-*-cap-drop:胶囊框 dy = −7.8·(12−f)² 纯二次缓出,起点 f0 落差 1123.2(画外不可见) */
const NODE_CAP: Curve & { dy: number } = { from: 0, to: 12, dy: -1123.2, ease: Easing.bezier(0.031, 0.001, 0.422, 1) };
/** lifeline-*-grow:以中点为不动点上下对称伸长 0.484 → 1(f7→f22)+ 淡入(f7→f20) */
const LIFE_GROW: Curve & { s0: number } = { from: 7, to: 22, s0: 0.484, ease: Easing.bezier(0.003, 0.029, 0.432, 1) };
const LIFE_FADE: Curve = { from: 7, to: 20, ease: Easing.bezier(0.074, 0, 0.324, 0.51) };

// ── 实测曲线:highlight 消息(黄签闪入;本地 0 = 原片 f104) ──
/** msg1-arrow-grow:整支箭头(线宽一起)等比放大 0.495 → 1,线性 f104→f113;不动点在线心下方 6.8px */
const HL_ARROW: Curve & { s0: number } = { from: 0, to: 9, s0: 0.495, ease: lin };
const HL_ARROW_FADE: Curve = { from: 0, to: 3, ease: Easing.bezier(0.474, 0.634, 0.471, 0.997) };
/** msg1-label-flash:签面不透明度 f104→f108(G 通道 ÷255 反解) */
const HL_LABEL_FADE: Curve = { from: 0, to: 4, ease: Easing.bezier(0.644, 0.564, 0.247, 0.991) };
/** msg1-label-squash:签以中心为不动点横向 1.402 → 1(f104→f119),纵向 1.516 → 1(f104→f110) */
const HL_SX: Curve & { s0: number } = { from: 0, to: 15, s0: 1.402, ease: Easing.bezier(0.168, 0.064, 0, 0.942) };
const HL_SY: Curve & { s0: number } = { from: 0, to: 6, s0: 1.516, ease: Easing.bezier(0.424, 1, 0.19, 0.903) };
/** msg1-text-squash:黑字比签宽,f116 才并拢,横向 1.382 → 1(⑦b 逐字配准回归) */
const HL_TEXT_SX: Curve & { s0: number } = { from: 0, to: 15, s0: 1.382, ease: Easing.bezier(0.163, 0, 0.164, 0.98) };
/** msg1-label-flash effects.brightness:签面过曝 1.15 → 1,f112→f116 */
const HL_BRIGHT: Curve & { b0: number } = { from: 8, to: 12, b0: 1.15, ease: Easing.bezier(0.148, 0, 0.632, 0.932) };
/** msg1-text-emerge × msg1-text-darken:字 f104→f106 线性出现,浓度 0.3 保持到 f112,f112→f116 变实 */
const HL_TEXT_EMERGE: Curve = { from: 0, to: 2, ease: lin };
const HL_TEXT_DARK: Curve & { a0: number } = { from: 8, to: 12, a0: 0.3, ease: Easing.bezier(0.609, 0.451, 0.723, 1) };
/** motion-ext msg1-label / fx-msg1-glow / msg1-text:双轴高斯 σ(局部 px),f104..f111 逐帧 */
const HL_BLUR_FRAMES = [0, 1, 2, 3, 4, 5, 6, 7];
const HL_LABEL_BLUR_X = [10.292, 10.292, 5.475, 6.557, 2.8, 1.623, 0.369, 0];
const HL_LABEL_BLUR_Y = [8.078, 8.078, 3.369, 0.482, 0.353, 0.267, 0.1, 0];
const HL_TEXT_BLUR_X = [4.784, 4.784, 3.083, 2.839, 1.695, 1.318, 0.634, 0];
const HL_TEXT_BLUR_Y = [5.001, 5.001, 3.46, 1.205, 0.588, 0.446, 0.3, 0];
/** fx-msg1-glow-flash:外晕强度(box-shadow 叠层数)f104..f110 逐帧折线;fx-msg1-glow-fade:f114→f119 散去 */
const HL_GLOW_FRAMES = [0, 1, 2, 3, 4, 5, 6];
const HL_GLOW_GAIN = [0, 0.1, 1.07, 1.45, 1.34, 1.04, 1];
const HL_GLOW_FADE: Curve = { from: 10, to: 15, ease: Easing.bezier(0.443, 0, 0.723, 0.859) };
/** 外晕两层高斯(f110–f113 签外剖面拟合 a1=147 σ1=3.69 + a2=190 σ2=24.0),颜色跟签色 */
const HL_GLOW_LAYERS = [
  { blur: 7.4, alpha: 0.576 },
  { blur: 48, alpha: 0.747 },
];
/** motion-ext msg1-text charOpacity:逐字浓淡倍数(原片「帮我」淡、「理/夹」浓),f104..f117;第 8 字起按 i mod 7 循环 */
const HL_CHAR_FRAMES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const HL_CHAR_OPACITY: number[][] = [
  [0.7692, 0.7692, 0.7692, 0.7692, 0.7692, 0.7692, 0.7692, 0.7692, 0.7692, 0.9827, 1.0352, 0.9983, 1, 1],
  [0.7788, 0.7788, 0.7788, 0.7788, 0.7788, 0.7788, 0.7788, 0.7788, 0.7788, 0.8332, 0.9317, 0.9983, 1, 1],
  [1.1795, 1.1795, 1.1795, 1.1795, 1.1795, 1.1795, 1.1795, 1.1795, 1.1795, 0.9186, 0.8873, 0.9549, 1, 1],
  [1.3622, 1.3622, 1.3622, 1.3622, 1.3622, 1.3622, 1.3622, 1.3622, 1.3622, 1.175, 1.0648, 0.9874, 1, 1],
  [1.1186, 1.1186, 1.1186, 1.1186, 1.1186, 1.1186, 1.1186, 1.1186, 1.1186, 1.0895, 0.9761, 0.9657, 1, 1],
  [1.0417, 1.0417, 1.0417, 1.0417, 1.0417, 1.0417, 1.0417, 1.0417, 1.0417, 1.0041, 0.9761, 0.9766, 1, 1],
  [1.3109, 1.3109, 1.3109, 1.3109, 1.3109, 1.3109, 1.3109, 1.3109, 1.3109, 1.0895, 1.0205, 0.9874, 1, 1],
];

// ── 实测曲线:plain 消息(白签升起;本地 0 = 原片 f150) ──
/** msg2-arrow-grow:同一手法但更慢,0.493 → 1 线性 f150→f165 */
const PL_ARROW: Curve & { s0: number } = { from: 0, to: 15, s0: 0.493, ease: lin };
const PL_ARROW_FADE: Curve = { from: 0, to: 3, ease: Easing.bezier(0, 0.187, 0, 0.226) };
/** msg2-label-rise:签和字一体在固定窗里从下往上升 116.144 → 0,f150→f164,不糊不缩不淡 */
const PL_RISE: Curve & { dy: number } = { from: 0, to: 14, dy: 116.144, ease: Easing.bezier(0.325, 0.899, 0.637, 0.999) };

// ── 实测曲线:process 步骤(空框 + 转圈;本地 0 = 原片 f392) ──
/** llm-box-pop:框以中心等比缩小 1.498 → 1(f392→f407)并淡入(f392→f406) */
const PR_BOX: Curve & { s0: number } = { from: 0, to: 15, s0: 1.498, ease: Easing.bezier(0.33, 0.655, 0.66, 0.999) };
const PR_BOX_FADE: Curve = { from: 0, to: 14, ease: Easing.bezier(0.044, 0, 0.478, 0.977) };
/** llm-spinner-pop:转圈放大 0.504 → 0.9441 + 淡入 0 → 0.8867(f409→f419);范围外 post001–005 补到 f424 = 1 */
const PR_SPIN: Curve & { s0: number; s1: number } = { from: 17, to: 27, s0: 0.504, s1: 0.9441, ease: Easing.bezier(0.0309, 0, 0.416, 0.7053) };
const PR_SPIN_FADE: Curve & { a1: number } = { from: 17, to: 27, a1: 0.8867, ease: Easing.bezier(0.0534, 0, 0.4235, 0.7047) };
const PR_SPIN_TAIL: Curve = { from: 27, to: 32, ease: Easing.bezier(0, 0, 0.58, 1) };
/** spinner.json:8 辐条跳格,d(f) = (5 + floor((f − 421)/2.4)) mod 8 → 本地相位起点 = 421 − 392 = 29 */
const SPIN = { r1: 25.25, r2: 35.19, stroke: 10, opacities: [0.4286, 0.5714, 0.7143, 0.8571, 1, 1, 1, 1], phaseOffset: 5, phaseFrame0: 29, framesPerStep: 2.4 };

// ── 实测几何(1080p 画布 px;layout.json / layout-ext.json) ──
const G = {
  /** 胶囊 327.65×101.7,顶 59.3,圆角 41.5,描边 2.02;黑色不透明填充 */
  capW: 327.65,
  capH: 101.7,
  capTop: 59.3,
  capRadius: 41.5,
  capStroke: 2.02,
  /** 图标 96×96,距胶囊左 7.4、顶 3.2(三节点 7.0–11.6 / 2.7–3.7) */
  iconSize: 96,
  iconDx: 7.4,
  iconDy: 3.2,
  /** 名字:得意黑 72.5px,字中心约在胶囊左 +203、行盒中心在胶囊顶 +49.3(三节点实测平均) */
  nameFont: 72.5,
  nameLetterSpacing: 0.4,
  nameCx: 203,
  nameCy: 49.3,
  /** 名字裁切线 = 胶囊顶上方 8.4(用户 50.87 / 大模型 50.81) */
  nameClipAbove: 8.4,
  /** 生命线宽 2.54,上端藏在胶囊底下 2.4,下端 1025.4 */
  lifeWidth: 2.54,
  lifeTopInset: 2.4,
  lifeBottom: 1025.4,
  /** 箭头:线宽 4.6,头长 28.59,半高 17.88,凹口 6.64;尖离目标生命线 3.14;第一支线心在胶囊底下 57.6 */
  arrowWidth: 4.6,
  headLength: 28.59,
  headHalf: 17.88,
  notch: 6.64,
  tipGap: 3.14,
  firstArrowBelowCap: 57.6,
  /** 箭头缩放不动点在线心下方 6.8px */
  arrowPivotBelow: 6.8,
  /** 相邻两步箭头最小行距 48(msg1 218.58 → msg2 266.58),与上方元素竖向间隙 37.1(白签底 → 空框顶) */
  minStepGap: 48,
  blockGap: 37.1,
  /** 黄签:高 82.7,圆角 10.45,中心在线心下 4.86,字 53.4px 字距 0.3,字行中心比签心高 1.7;宽按原字「帮我整理文件夹」反解留白 */
  hlH: 82.7,
  hlRadius: 10.45,
  hlDy: 4.86,
  hlFont: 53.4,
  hlLetterSpacing: 0.3,
  hlTextDy: -1.7,
  hlRefText: '帮我整理文件夹',
  hlRefW: 335.81,
  /** 白签:字 38.65px,行距 41.55,上留 9.2 下留 11.1 左留 12.45,圆角 10.47,中心在线心下 2.77;窗下沿 = 签底 + 7.9 */
  plFont: 38.65,
  plLine: 41.55,
  plPadTop: 9.2,
  plPadBottom: 11.1,
  plPadLeft: 12.45,
  plRadius: 10.47,
  plDy: 2.77,
  plWindowBelow: 7.9,
  plRefText: '提示词：“帮我整理文件夹”',
  plRefW: 393.11,
  /** 空框 283.44×103.47,圆角 23.06,描边 2.4 */
  boxW: 283.44,
  boxH: 103.47,
  boxRadius: 23.06,
  boxStroke: 2.4,
};

/** 秋芝配色(黑底白线、黄签、白签) */
export const GROWING_SEQUENCE_COLORS = {
  background: '#000000',
  line: '#FFFFFF',
  capsuleFill: '#000000',
  nodeText: '#FFFFFF',
  iconBg: '#FFFFFF',
  iconInk: '#141414',
  highlight: '#FFDF01',
  highlightText: '#000000',
  plain: '#FFFFFF',
  plainText: '#000000',
  boxFill: '#000000',
  spinner: '#EFEFEF',
  processText: '#FFFFFF',
  dot: '#FFFFFF',
};
export type GrowingSequenceColors = typeof GROWING_SEQUENCE_COLORS;

/** 内置线稿图标(代码画的,白圆底 + 深色线) */
export type SeqBuiltinIcon = 'user' | 'robot' | 'brain' | 'tool' | 'file' | 'web' | 'db' | 'code' | 'phone' | 'cloud';

export type SeqParticipant = {
  name: string;
  /** 内置图标名 / 图片地址(staticFile(...),自带圆形 alpha 最好)/ 任意 React 节点;null = 不要图标(名字居中) */
  icon?: SeqBuiltinIcon | string | React.ReactNode | null;
  /** 校准用(一般不填):胶囊中心 x、生命线 x、图标/名字偏移、名字字号/字距、裁切线、名字落差 */
  x?: number;
  lifelineX?: number;
  iconDx?: number;
  iconDy?: number;
  /** 给了就左对齐在胶囊左 + nameLeft;不给就按实测中心 203 居中 */
  nameLeft?: number;
  nameCy?: number;
  nameFont?: number;
  nameLetterSpacing?: number;
  nameClipAbove?: number;
  nameDrop?: number;
};

export type SeqStep = {
  /** 从谁(参与方序号或名字) */
  from: number | string;
  /** 到谁;kind='process' 时不用填 */
  to?: number | string;
  /** 签上的字;数组 = 多行(白签);process 步骤给字就框里显示字、不给就转圈 */
  text?: string | string[];
  kind?: 'message' | 'process';
  /** highlight = 黄签荧光闪入;plain = 白签升起。默认第一条消息 highlight、其余 plain */
  style?: 'highlight' | 'plain';
  /** 出现时刻(当前 fps 的帧,相对组件起点)/ 秒;都不给就自动排 */
  at?: number;
  atSec?: number;
  /** 签底色 / 字色(覆盖 colors) */
  color?: string;
  textColor?: string;
  /** process:强制转圈(给了字也转) */
  spinner?: boolean;
  /** 校准用(一般不填):线心 y、箭头起止 x、签中心 x、空框中心 */
  geometry?: { y?: number; x0?: number; x1?: number; labelX?: number; boxX?: number; boxY?: number };
};

export type GrowingSequenceProps = {
  participants: SeqParticipant[];
  steps: SeqStep[];
  layout?: 'sequence' | 'flow';
  /** 自动排时第一步时刻(当前 fps 的帧),默认 1.33 秒(节点落定 + 一拍) */
  firstStepAt?: number;
  /** 自动排时相邻两步间隔(帧),默认 = 原片 msg1 → msg2 的 46 帧(按 fps 折算) */
  stepGap?: number;
  /** 动作速度倍率(只改每个动作本身快慢,不改步骤时刻):1 = 原片 */
  speed?: number;
  /** 起播延迟(帧) */
  delayFrames?: number;
  fontFamily?: string;
  colors?: Partial<GrowingSequenceColors>;
  /** dots = 原片动态点阵;solid = 纯色底;none = 透明(叠在别的画面上) */
  background?: 'dots' | 'solid' | 'none';
  /** 点阵亮度(0–255 × 576 点,k = 列·18 + 行);不给就程序生成 */
  dotBrightness?: (frame: number) => ArrayLike<number>;
  /** sequence 布局:内容最低不超过这条线(画布 y),排不下整体收小;默认 900(给字幕留位) */
  maxBottom?: number;
  /** sequence 布局:生命线下端,默认原片 1025.4 */
  lifelineBottom?: number;
  /** flow 布局:节点行中心 y(不给就按内容上下居中) */
  flowCenterY?: number;
  /** 高亮签闪入时是否用原片逐字浓淡节奏(默认 true) */
  charFlicker?: boolean;
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

const prog = (t: number, c: Curve) => interpolate(t, [c.from, c.to], [0, 1], { ...clampBoth, easing: c.ease });

/** 文字宽度:和官方 @remotion/layout-utils measureText 同一原理(canvas 2D measureText),字体须先加载 */
let measureCtx: CanvasRenderingContext2D | null = null;
const widthCache = new Map<string, number>();
const measureWidth = (text: string, fontFamily: string, fontSize: number, letterSpacing: number): number => {
  const key = `${fontFamily}|${text}`;
  let w100 = widthCache.get(key);
  if (w100 === undefined) {
    if (typeof document === 'undefined') {
      w100 = [...text].reduce((a, ch) => a + (/[\u0000-ÿ]/.test(ch) ? 52 : 92), 0);
    } else {
      measureCtx = measureCtx ?? document.createElement('canvas').getContext('2d');
      if (measureCtx) {
        measureCtx.font = `100px "${fontFamily}"`;
        w100 = measureCtx.measureText(text).width;
      } else {
        w100 = text.length * 90;
      }
    }
    widthCache.set(key, w100);
  }
  return (w100 * fontSize) / 100 + letterSpacing * [...text].length;
};

const hexToRgb = (color: string): [number, number, number] | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

const glowShadow = (color: string, gain: number, scale: number): string | undefined => {
  if (gain < 1e-4) return undefined;
  const rgb = hexToRgb(color) ?? [255, 250, 0];
  // 原片外晕 R≈G、B≈0 的纯黄(比签面 #FFDF01 更黄);其它签色直接用签色
  const [r, g, b] = color.toUpperCase() === '#FFDF01' ? [255, 250, 0] : rgb;
  const whole = Math.floor(gain + 1e-9);
  const frac = gain - whole;
  const out: string[] = [];
  const layer = (a: number) => HL_GLOW_LAYERS.map((l) => `0 0 ${l.blur * scale}px 0 rgba(${r},${g},${b},${(l.alpha * a).toFixed(4)})`);
  for (let i = 0; i < whole; i += 1) out.push(...layer(1));
  if (frac > 1e-4) out.push(...layer(frac));
  return out.join(', ');
};

const AnisoBlur: React.FC<{ id: string; sx: number; sy: number }> = ({ id, sx, sy }) => (
  <svg aria-hidden width={0} height={0} style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
    <defs>
      <filter id={id} x="-100%" y="-400%" width="300%" height="900%" filterUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation={`${Math.max(0, sx)} ${Math.max(0, sy)}`} />
      </filter>
    </defs>
  </svg>
);

// ─────────────────────────── 内置图标 ───────────────────────────

const ICON_PATHS: Record<SeqBuiltinIcon, (ink: string) => React.ReactNode> = {
  user: (ink) => (
    <g fill="none" stroke={ink} strokeWidth={5} strokeLinecap="round">
      <circle cx={48} cy={37} r={12} />
      <path d="M25 73 C25 58 36 52 48 52 C60 52 71 58 71 73" />
    </g>
  ),
  robot: (ink) => (
    <g fill="none" stroke={ink} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round">
      <rect x={27} y={37} width={42} height={31} rx={9} />
      <path d="M48 37 V27 M20 50 V58 M76 50 V58" />
      <circle cx={48} cy={24} r={3} fill={ink} />
      <circle cx={39} cy={51} r={4} fill={ink} stroke="none" />
      <circle cx={57} cy={51} r={4} fill={ink} stroke="none" />
      <path d="M41 60 H55" />
    </g>
  ),
  brain: (ink) => (
    <g fill="none" stroke={ink} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M48 26 C40 19 27 25 29 37 C21 41 22 55 30 58 C30 69 42 73 48 66 C54 73 66 69 66 58 C74 55 75 41 67 37 C69 25 56 19 48 26 Z" />
      <path d="M48 27 V66 M48 40 H39 L35 35 M48 52 H58 L62 47 M48 60 H40" />
    </g>
  ),
  tool: (ink) => (
    <g fill="none" stroke={ink} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M31 67 L53 45" strokeWidth={9} />
      <path d="M53 45 C49 36 55 26 65 27 L58 35 L61 41 L67 43 L74 36 C75 46 65 51 56 48" />
    </g>
  ),
  file: (ink) => (
    <g fill="none" stroke={ink} strokeWidth={4.5} strokeLinejoin="round" strokeLinecap="round">
      <path d="M33 23 H55 L66 34 V73 H33 Z" />
      <path d="M55 23 V34 H66 M40 47 H59 M40 56 H59 M40 65 H52" />
    </g>
  ),
  web: (ink) => (
    <g fill="none" stroke={ink} strokeWidth={4.5}>
      <circle cx={48} cy={48} r={22} />
      <ellipse cx={48} cy={48} rx={9.5} ry={22} />
      <path d="M26 48 H70 M30 37 H66 M30 59 H66" />
    </g>
  ),
  db: (ink) => (
    <g fill="none" stroke={ink} strokeWidth={4.5}>
      <ellipse cx={48} cy={31} rx={19} ry={7} />
      <path d="M29 31 V65 C29 69 37 72 48 72 C59 72 67 69 67 65 V31 M29 48 C29 52 37 55 48 55 C59 55 67 52 67 48" />
    </g>
  ),
  code: (ink) => (
    <g fill="none" stroke={ink} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M37 35 L24 48 L37 61 M59 35 L72 48 L59 61 M52 30 L44 66" />
    </g>
  ),
  phone: (ink) => (
    <g fill="none" stroke={ink} strokeWidth={4.5} strokeLinejoin="round">
      <rect x={34} y={21} width={28} height={54} rx={6} />
      <path d="M44 66 H52" strokeLinecap="round" />
    </g>
  ),
  cloud: (ink) => (
    <g fill="none" stroke={ink} strokeWidth={4.5} strokeLinejoin="round">
      <path d="M31 64 C21 64 20 50 30 48 C29 37 43 32 49 40 C54 31 70 35 67 48 C77 49 76 64 66 64 Z" />
    </g>
  ),
};

const NodeIcon: React.FC<{ icon: SeqParticipant['icon']; size: number; bg: string; ink: string }> = ({ icon, size, bg, ink }) => {
  if (typeof icon === 'string' && icon in ICON_PATHS) {
    return (
      <svg width={size} height={size} viewBox="0 0 96 96" style={{ display: 'block' }}>
        <circle cx={48} cy={48} r={47.5} fill={bg} />
        {ICON_PATHS[icon as SeqBuiltinIcon](ink)}
      </svg>
    );
  }
  if (typeof icon === 'string') return <Img src={icon} style={{ width: size, height: size, display: 'block' }} />;
  return <div style={{ width: size, height: size }}>{icon as React.ReactNode}</div>;
};

// ─────────────────────────── 背景点阵 ───────────────────────────

/** dotgrid.json:x_i = 24.438 + 60.3274·i;y_ij = 26.854 + 60.3306·j + 11.236·sin(2πt/150 − 2πx/450 − 0.3588);σ 0.85 高斯点 */
const DOT = { cols: 32, rows: 18, X0: 24.438, SX: 60.3274, Y0: 26.854, SY: 60.3306, AMP: 11.236, PERIOD: 150, LAMBDA: 450, PHI: -0.3588, sigma: 0.85 };

/** 程序亮度:原片实测表均值 47.7、标准差 31、峰 133,主周期 ≈153.5 帧 + ≈38 帧次周期,邻点相关 → 两个正弦叠加、相位随位置缓变 + 随机 */
const proceduralBrightness = (frame: number, k: number): number => {
  const i = Math.floor(k / DOT.rows);
  const j = k % DOT.rows;
  const p1 = 2 * Math.PI * (0.11 * i + 0.17 * j + 0.8 * random(`gs-dot-a-${k}`));
  const p2 = 2 * Math.PI * random(`gs-dot-b-${k}`);
  const v = 48 + 38 * Math.sin((2 * Math.PI * frame) / 153.5 + p1) + 16 * Math.sin((2 * Math.PI * frame) / 38 + p2);
  return Math.max(0, Math.min(133, v));
};

const DotGrid: React.FC<{ frame: number; color: string; brightness?: (frame: number) => ArrayLike<number>; width: number; height: number }> = ({
  frame,
  color,
  brightness,
  width,
  height,
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  // useLayoutEffect:React 提交 DOM 后同步画完,截图前 canvas 已就绪(案例 runtime 同写法,不走异步)
  useLayoutEffect(() => {
    const el = ref.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const image = ctx.createImageData(width, height);
    const data = image.data;
    const rgb = hexToRgb(color) ?? [255, 255, 255];
    const table = brightness?.(frame);
    const two = 2 * DOT.sigma * DOT.sigma;
    for (let i = 0; i < DOT.cols; i += 1) {
      const x = DOT.X0 + DOT.SX * i;
      if (x > width + 4) break;
      const wave = DOT.AMP * Math.sin((2 * Math.PI * frame) / DOT.PERIOD - (2 * Math.PI * x) / DOT.LAMBDA + DOT.PHI);
      for (let j = 0; j < DOT.rows; j += 1) {
        const y = DOT.Y0 + DOT.SY * j + wave;
        const k = i * DOT.rows + j;
        const a = table ? table[k] : proceduralBrightness(frame, k);
        if (!a) continue;
        const xi = Math.round(x);
        const yi = Math.round(y);
        for (let py = yi - 3; py <= yi + 3; py += 1) {
          if (py < 0 || py >= height) continue;
          for (let px = xi - 3; px <= xi + 3; px += 1) {
            if (px < 0 || px >= width) continue;
            const o = (py * width + px) * 4;
            data[o] = rgb[0];
            data[o + 1] = rgb[1];
            data[o + 2] = rgb[2];
            data[o + 3] += a * Math.exp(-((px - x) ** 2 + (py - y) ** 2) / two);
          }
        }
      }
    }
    ctx.putImageData(image, 0, 0);
  }, [frame, color, brightness, width, height]);
  return <canvas ref={ref} width={width} height={height} style={{ position: 'absolute', left: 0, top: 0, width, height }} />;
};

// ─────────────────────────── 排版 ───────────────────────────

type Rect = { l: number; r: number; t: number; b: number };
type NodeGeo = { cx: number; capL: number; capT: number; capW: number; capH: number; s: number; lifeX: number; p: SeqParticipant };
type StepGeo = {
  kind: 'message' | 'process';
  style: 'highlight' | 'plain';
  lines: string[];
  /** 箭头折线(画布 px),最后一点是箭尖 */
  points: Array<[number, number]>;
  /** 签/框矩形 */
  label: Rect;
  fontSize: number;
  f: number;
  at: number;
  spinner: boolean;
  color: string;
  textColor: string;
};

const resolveIndex = (ref: number | string | undefined, participants: SeqParticipant[], fallback: number): number => {
  if (ref === undefined) return fallback;
  if (typeof ref === 'number') return Math.max(0, Math.min(participants.length - 1, Math.round(ref)));
  const i = participants.findIndex((p) => p.name === ref);
  return i < 0 ? fallback : i;
};

const labelSize = (style: 'highlight' | 'plain', lines: string[], fontFamily: string, f: number, maxW: number) => {
  if (style === 'highlight') {
    const text = lines.join(' ');
    const padX = (G.hlRefW - measureWidth(G.hlRefText, fontFamily, G.hlFont, G.hlLetterSpacing)) / 2;
    let font = G.hlFont * f;
    let w = measureWidth(text, fontFamily, font, G.hlLetterSpacing * f) + 2 * padX * f;
    if (w > maxW) {
      const k = maxW / w;
      font *= k;
      w = maxW;
    }
    return { w, h: G.hlH * f * (font / (G.hlFont * f)), font, fs: font / G.hlFont };
  }
  const padR = G.plRefW - G.plPadLeft - measureWidth(G.plRefText, fontFamily, G.plFont, 0);
  let font = G.plFont * f;
  const textW = Math.max(...lines.map((l) => measureWidth(l, fontFamily, font, 0)));
  let w = textW + (G.plPadLeft + padR) * f;
  let k = 1;
  if (w > maxW) {
    k = maxW / w;
    font *= k;
    w = maxW;
  }
  const s = f * k;
  const h = (G.plPadTop + G.plFont + (lines.length - 1) * G.plLine + G.plPadBottom) * s;
  return { w, h, font, fs: s };
};

const layoutNodes = (participants: SeqParticipant[], W: number, flow: boolean, rowTop: number): NodeGeo[] => {
  const n = participants.length;
  const pitch = flow ? Math.min(480, (W - 160) / n) : Math.min(636.16, (W - 80) / n);
  const capW = flow ? Math.min(G.capW, pitch - 120) : Math.min(G.capW, pitch - 28);
  const s = capW / G.capW;
  return participants.map((p, i) => {
    const cx = p.x ?? W / 2 + (i - (n - 1) / 2) * pitch;
    const capH = G.capH * s;
    return { cx, capL: cx - capW / 2, capT: rowTop, capW, capH, s, lifeX: p.lifelineX ?? cx, p };
  });
};

const overlapX = (a: Rect, b: Rect, m = 14) => a.l < b.r + m && b.l < a.r + m;

const layoutSequence = (
  nodes: NodeGeo[],
  steps: SeqStep[],
  participants: SeqParticipant[],
  fontFamily: string,
  W: number,
  maxBottom: number,
  times: number[],
  colors: GrowingSequenceColors,
): { steps: StepGeo[]; f: number } => {
  const capBottom = Math.max(...nodes.map((n) => n.capT + n.capH));
  let out: StepGeo[] = [];
  let f = 1;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    // 排不下时先压间隙(按 f² 收)、再收字(按 f):字尽量保持可读
    const gf = Math.max(0.35, f * f);
    out = [];
    let prevY = -Infinity;
    let msgCount = 0;
    steps.forEach((st, idx) => {
      const from = resolveIndex(st.from, participants, 0);
      const kind = st.kind ?? (st.to === undefined || resolveIndex(st.to, participants, from) === from ? 'process' : 'message');
      const lines = st.text === undefined ? [] : Array.isArray(st.text) ? st.text : [st.text];
      const style = st.style ?? (kind === 'message' && msgCount === 0 ? 'highlight' : 'plain');
      const color = st.color ?? (style === 'highlight' ? colors.highlight : colors.plain);
      const textColor = st.textColor ?? (style === 'highlight' ? colors.highlightText : colors.plainText);
      const g = st.geometry ?? {};
      if (kind === 'message') {
        msgCount += 1;
        const to = resolveIndex(st.to, participants, from);
        const dir = nodes[to].lifeX >= nodes[from].lifeX ? 1 : -1;
        const x0 = g.x0 ?? nodes[from].lifeX;
        const x1 = g.x1 ?? nodes[to].lifeX - dir * G.tipGap;
        const size = labelSize(style, lines.length ? lines : [' '], fontFamily, f, W - 60);
        const cx = Math.max(30 + size.w / 2, Math.min(W - 30 - size.w / 2, g.labelX ?? (x0 + x1) / 2));
        const dy = (style === 'highlight' ? G.hlDy : G.plDy) * f;
        const topOff = size.h / 2 - dy; // 线心到签顶
        const extent: Rect = { l: Math.min(x0, x1, cx - size.w / 2), r: Math.max(x0, x1, cx + size.w / 2), t: 0, b: 0 };
        let y = idx === 0 ? capBottom + G.firstArrowBelowCap * f : prevY + G.minStepGap * gf;
        for (const o of out) if (overlapX(extent, { ...o.label, l: Math.min(o.label.l, ...o.points.map((p) => p[0])), r: Math.max(o.label.r, ...o.points.map((p) => p[0])) })) y = Math.max(y, o.label.b + G.blockGap * gf + topOff);
        y = g.y ?? y;
        const hasLabel = lines.length > 0;
        const label: Rect = hasLabel
          ? { l: cx - size.w / 2, r: cx + size.w / 2, t: y - topOff, b: y - topOff + size.h }
          : { l: Math.min(x0, x1), r: Math.max(x0, x1), t: y - G.headHalf * f, b: y + G.headHalf * f };
        out.push({ kind, style, lines, points: [[x0, y], [x1, y]], label, fontSize: size.font, f: size.fs, at: times[idx], spinner: false, color, textColor });
        prevY = y;
      } else {
        const hasText = lines.length > 0;
        const font = G.plFont * f;
        const tw = hasText ? Math.max(...lines.map((l) => measureWidth(l, fontFamily, font, 0))) : 0;
        const w = Math.max(G.boxW * f, tw + 56 * f);
        const h = hasText ? Math.max(G.boxH * f, (lines.length * G.plLine + 44) * f) : G.boxH * f;
        const cx = g.boxX ?? nodes[from].lifeX;
        const ext: Rect = { l: cx - w / 2, r: cx + w / 2, t: 0, b: 0 };
        let top = idx === 0 ? capBottom + G.firstArrowBelowCap * f : prevY + G.minStepGap * gf - h / 2;
        for (const o of out) if (overlapX(ext, { ...o.label, l: Math.min(o.label.l, ...o.points.map((p) => p[0])), r: Math.max(o.label.r, ...o.points.map((p) => p[0])) })) top = Math.max(top, o.label.b + G.blockGap * gf);
        const cy = g.boxY ?? top + h / 2;
        out.push({
          kind,
          style,
          lines,
          points: [],
          label: { l: cx - w / 2, r: cx + w / 2, t: cy - h / 2, b: cy + h / 2 },
          fontSize: font,
          f,
          at: times[idx],
          spinner: st.spinner ?? !hasText,
          color,
          textColor: st.textColor ?? colors.processText,
        });
        prevY = cy;
      }
    });
    const bottom = Math.max(...out.map((o) => o.label.b));
    if (bottom <= maxBottom || f <= 0.45) break;
    f = Math.max(0.45, f * Math.min(0.97, Math.pow((maxBottom - capBottom) / (bottom - capBottom), 0.35)));
  }
  return { steps: out, f };
};

const layoutFlow = (
  participants: SeqParticipant[],
  steps: SeqStep[],
  fontFamily: string,
  W: number,
  H: number,
  times: number[],
  colors: GrowingSequenceColors,
  centerY?: number,
): { nodes: NodeGeo[]; steps: StepGeo[] } => {
  const build = (rowTop: number) => {
    const nodes = layoutNodes(participants, W, true, rowTop);
    const s = nodes[0].s;
    const cy = rowTop + nodes[0].capH / 2;
    const capB = rowTop + nodes[0].capH;
    const f = Math.max(0.7, s);
    const pairs = new Set<string>();
    steps.forEach((st) => {
      const a = resolveIndex(st.from, participants, 0);
      const b = resolveIndex(st.to, participants, a);
      pairs.add(`${a}>${b}`);
    });
    const above: Rect[] = [];
    const below: Rect[] = [];
    let msgCount = 0;
    const place = (list: Rect[], l: number, r: number, h: number, start: number, dirSign: 1 | -1): Rect => {
      // dirSign −1 往上堆(签底 ≤ start),+1 往下堆(签顶 ≥ start)
      let edge = start;
      for (let guard = 0; guard < 30; guard += 1) {
        const cand: Rect = dirSign < 0 ? { l, r, t: edge - h, b: edge } : { l, r, t: edge, b: edge + h };
        const hit = list.find((o) => overlapX(cand, o, 16) && cand.t < o.b + 16 && o.t < cand.b + 16);
        if (!hit) {
          list.push(cand);
          return cand;
        }
        edge = dirSign < 0 ? hit.t - 16 : hit.b + 16;
      }
      const cand: Rect = dirSign < 0 ? { l, r, t: edge - h, b: edge } : { l, r, t: edge, b: edge + h };
      list.push(cand);
      return cand;
    };
    const out: StepGeo[] = steps.map((st, idx) => {
      const from = resolveIndex(st.from, participants, 0);
      const to = resolveIndex(st.to, participants, from);
      const kind = st.kind ?? (from === to ? 'process' : 'message');
      const lines = st.text === undefined ? [] : Array.isArray(st.text) ? st.text : [st.text];
      const style = st.style ?? (kind === 'message' && msgCount === 0 ? 'highlight' : 'plain');
      const color = st.color ?? (style === 'highlight' ? colors.highlight : colors.plain);
      const textColor = st.textColor ?? (style === 'highlight' ? colors.highlightText : colors.plainText);
      if (kind === 'process') {
        const font = G.plFont * f;
        const hasText = lines.length > 0;
        const tw = hasText ? Math.max(...lines.map((l) => measureWidth(l, fontFamily, font, 0))) : 0;
        const w = Math.max(G.boxW * f * 0.8, tw + 56 * f);
        const h = hasText ? Math.max(G.boxH * f * 0.8, (lines.length * G.plLine + 40) * f) : G.boxH * f;
        const rect = place(below, nodes[from].cx - w / 2, nodes[from].cx + w / 2, h, capB + 40 * f, 1);
        return { kind, style, lines, points: [], label: rect, fontSize: font, f, at: times[idx], spinner: st.spinner ?? !hasText, color, textColor: st.textColor ?? colors.processText };
      }
      msgCount += 1;
      const dir = to > from ? 1 : -1;
      const size = labelSize(style, lines.length ? lines : [' '], fontFamily, f, W - 60);
      const hasLabel = lines.length > 0;
      if (Math.abs(to - from) === 1) {
        const both = pairs.has(`${to}>${from}`);
        const y = cy + (both ? (dir > 0 ? -16 : 16) * f : 0);
        const x0 = dir > 0 ? nodes[from].capL + nodes[from].capW + 8 : nodes[from].capL - 8;
        const x1 = dir > 0 ? nodes[to].capL - 8 : nodes[to].capL + nodes[to].capW + 8;
        const mid = (x0 + x1) / 2;
        const l = Math.max(30, Math.min(W - 30 - size.w, mid - size.w / 2));
        const rect = hasLabel
          ? dir > 0
            ? place(above, l, l + size.w, size.h, rowTop - 26 * f, -1)
            : place(below, l, l + size.w, size.h, capB + 26 * f, 1)
          : { l: Math.min(x0, x1), r: Math.max(x0, x1), t: y - 18, b: y + 18 };
        return { kind, style, lines, points: [[x0, y], [x1, y]], label: rect, fontSize: size.font, f: size.fs, at: times[idx], spinner: false, color, textColor };
      }
      // 隔着的两方:下方 U 形线,签压在横段上
      const xa = nodes[from].cx + dir * 24 * f;
      const xb = nodes[to].cx - dir * 24 * f;
      const mid = (xa + xb) / 2;
      const l = Math.max(30, Math.min(W - 30 - size.w, mid - size.w / 2));
      const rect = place(below, Math.min(l, xa, xb), Math.max(l + size.w, xa, xb), Math.max(size.h, 40), capB + 44 * f, 1);
      const laneY = (rect.t + rect.b) / 2;
      const label: Rect = hasLabel ? { l, r: l + size.w, t: laneY - size.h / 2, b: laneY + size.h / 2 } : { l: Math.min(xa, xb), r: Math.max(xa, xb), t: laneY - 18, b: laneY + 18 };
      return {
        kind,
        style,
        lines,
        points: [[xa, capB + 6], [xa, laneY], [xb, laneY], [xb, capB + 8]],
        label,
        fontSize: size.font,
        f: size.fs,
        at: times[idx],
        spinner: false,
        color,
        textColor,
      };
    });
    const top = Math.min(rowTop, ...out.map((o) => o.label.t));
    const bottom = Math.max(capB, ...out.map((o) => o.label.b), ...out.flatMap((o) => o.points.map((p) => p[1])));
    return { nodes, steps: out, top, bottom };
  };
  const capH0 = layoutNodes(participants, W, true, 0)[0].capH;
  if (centerY !== undefined) {
    const r = build(centerY - capH0 / 2);
    return { nodes: r.nodes, steps: r.steps };
  }
  const probe = build(0);
  const shift = (H - (probe.bottom - probe.top)) / 2 - probe.top;
  const r = build(Math.max(60, shift));
  return { nodes: r.nodes, steps: r.steps };
};

// ─────────────────────────── 渲染 ───────────────────────────

const arrowPath = (pts: Array<[number, number]>, lw: number, headLen: number, half: number, notch: number) => {
  const [tx, ty] = pts[pts.length - 1];
  const [px, py] = pts[pts.length - 2];
  const len = Math.hypot(tx - px, ty - py) || 1;
  const ux = (tx - px) / len;
  const uy = (ty - py) / len;
  const nx = -uy;
  const ny = ux;
  const bx = tx - ux * headLen;
  const by = ty - uy * headLen;
  const kx = bx + ux * notch;
  const ky = by + uy * notch;
  const shaft = pts.slice(0, -1).map((p) => `${p[0]},${p[1]}`);
  shaft.push(`${kx + ux},${ky + uy}`);
  return {
    shaft: `M${shaft.join(' L')}`,
    head: `${tx},${ty} ${bx + nx * half},${by + ny * half} ${kx},${ky} ${bx - nx * half},${by - ny * half}`,
    lw,
  };
};

export const growingSequenceDurationInFrames = (props: Pick<GrowingSequenceProps, 'steps' | 'firstStepAt' | 'stepGap' | 'delayFrames'>, fps: number): number => {
  const times = stepTimes(props.steps, fps, props.firstStepAt, props.stepGap);
  return Math.ceil((props.delayFrames ?? 0) + Math.max(Math.round(1.2 * fps), ...times) + 1.6 * fps);
};

const stepTimes = (steps: SeqStep[], fps: number, firstStepAt?: number, stepGap?: number): number[] => {
  const first = firstStepAt ?? Math.round(1.33 * fps);
  const gap = stepGap ?? (46 / MEASURED_FPS) * fps;
  const out: number[] = [];
  steps.forEach((s, i) => {
    const auto = i === 0 ? first : out[i - 1] + gap;
    out.push(s.at ?? (s.atSec !== undefined ? s.atSec * fps : auto));
  });
  return out;
};

export const GrowingSequence: React.FC<GrowingSequenceProps> = ({
  participants,
  steps,
  layout = 'sequence',
  firstStepAt,
  stepGap,
  speed = 1,
  delayFrames = 0,
  fontFamily = 'SmileySans',
  colors: colorsIn,
  background = 'dots',
  dotBrightness,
  maxBottom = 900,
  lifelineBottom = G.lifeBottom,
  flowCenterY,
  charFlicker = true,
}) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const colors = { ...GROWING_SEQUENCE_COLORS, ...colorsIn };
  const local = frame - delayFrames;
  /** 当前 fps 的本地帧 → 原片帧(调速在这里) */
  const toM = (localFrames: number) => (localFrames / fps) * MEASURED_FPS * speed;
  const tNodes = toM(local);
  const times = stepTimes(steps, fps, firstStepAt, stepGap);
  const flow = layout === 'flow';

  let nodes: NodeGeo[];
  let geos: StepGeo[];
  if (flow) {
    const r = layoutFlow(participants, steps, fontFamily, W, H, times, colors, flowCenterY);
    nodes = r.nodes;
    geos = r.steps;
  } else {
    nodes = layoutNodes(participants, W, false, G.capTop);
    geos = layoutSequence(nodes, steps, participants, fontFamily, W, maxBottom, times, colors).steps;
  }

  const bgFrame = Math.max(0, frame);
  const bg =
    background === 'none' ? null : (
      <AbsoluteFill style={{ backgroundColor: colors.background }}>
        {background === 'dots' ? <DotGrid frame={bgFrame} color={colors.dot} brightness={dotBrightness} width={W} height={H} /> : null}
      </AbsoluteFill>
    );
  if (local < 0) return <AbsoluteFill>{bg}</AbsoluteFill>;

  // ── 节点 + 生命线 ──
  const capP = prog(tNodes, NODE_CAP);
  const iconP = prog(tNodes, NODE_ICON);
  const textP = prog(tNodes, NODE_TEXT);
  const lifeP = prog(tNodes, LIFE_GROW);
  const lifeA = prog(tNodes, LIFE_FADE);
  const lifeS = LIFE_GROW.s0 + (1 - LIFE_GROW.s0) * lifeP;

  const lifelines = flow
    ? null
    : nodes.map((n, i) => {
        const top = n.capT + n.capH - G.lifeTopInset;
        const mid = (top + lifelineBottom) / 2;
        const half = ((lifelineBottom - top) / 2) * lifeS;
        if (lifeA <= 0) return null;
        return <rect key={`l${i}`} x={n.lifeX - G.lifeWidth / 2} y={mid - half} width={G.lifeWidth} height={half * 2} fill={colors.line} opacity={lifeA >= 1 ? undefined : lifeA} />;
      });

  const capDy = NODE_CAP.dy * (1 - capP);
  const caps = nodes.map((n, i) => {
    const bw = G.capStroke;
    const r = G.capRadius * n.s;
    return (
      <g key={`c${i}`} transform={capP >= 1 ? undefined : `translate(0 ${capDy})`}>
        <rect x={n.capL} y={n.capT} width={n.capW} height={n.capH} rx={r} ry={r} fill={colors.capsuleFill} />
        <rect x={n.capL + bw / 2} y={n.capT + bw / 2} width={n.capW - bw} height={n.capH - bw} rx={r - bw / 2} ry={r - bw / 2} fill="none" stroke={colors.line} strokeWidth={bw} />
      </g>
    );
  });

  const nodeHtml = nodes.map((n, i) => {
    const p = n.p;
    const hasIcon = p.icon !== null;
    const iconSize = G.iconSize * n.s;
    const iconL = n.capL + (p.iconDx ?? G.iconDx) * n.s;
    const iconT = n.capT + (p.iconDy ?? G.iconDy) * n.s;
    let font = (p.nameFont ?? G.nameFont) * n.s;
    const ls = (p.nameLetterSpacing ?? G.nameLetterSpacing) * n.s;
    const leftBound = hasIcon ? iconL + iconSize + 10 * n.s : n.capL + 26 * n.s;
    const rightBound = n.capL + n.capW - 24 * n.s;
    let tw = measureWidth(p.name, fontFamily, font, ls);
    if (tw > rightBound - leftBound) {
      font *= (rightBound - leftBound) / tw;
      tw = rightBound - leftBound;
    }
    const nameL =
      p.nameLeft !== undefined
        ? n.capL + p.nameLeft
        : hasIcon
          ? Math.max(leftBound, Math.min(rightBound - tw, n.capL + G.nameCx * n.s - tw / 2))
          : n.cx - tw / 2;
    const nameCy = n.capT + (p.nameCy ?? G.nameCy) * n.s;
    const clipY = n.capT - (p.nameClipAbove ?? G.nameClipAbove) * n.s;
    const drop = (p.nameDrop ?? NODE_TEXT.dy) * n.s * (1 - textP);
    return (
      <React.Fragment key={`n${i}`}>
        {hasIcon ? (
          <div
            style={{
              position: 'absolute',
              left: iconL,
              top: iconT,
              width: iconSize,
              height: iconSize,
              translate: iconP >= 1 ? undefined : `0px ${NODE_ICON.dy * (1 - iconP)}px`,
            }}
          >
            <NodeIcon icon={p.icon ?? 'user'} size={iconSize} bg={colors.iconBg} ink={colors.iconInk} />
          </div>
        ) : null}
        {/* 名字从固定裁切线下面掉出来:窗口顶 = 裁切线,名字在窗里平移 */}
        <div style={{ position: 'absolute', left: n.capL - 40, top: clipY, width: n.capW + 80, height: H - clipY, overflow: 'hidden' }}>
          <div
            style={{
              position: 'absolute',
              left: nameL - (n.capL - 40),
              top: nameCy - clipY - font / 2,
              height: font,
              lineHeight: 1,
              fontFamily,
              fontSize: font,
              letterSpacing: ls,
              whiteSpace: 'pre',
              color: colors.nodeText,
              translate: textP >= 1 ? undefined : `0px ${drop}px`,
            }}
          >
            {p.name}
          </div>
        </div>
      </React.Fragment>
    );
  });

  // ── 步骤 ──
  const stepLayers = geos.map((g, idx) => {
    const t = toM(local - g.at);
    if (t < 0) return null;
    const key = `s${idx}`;
    if (g.kind === 'process') {
      const boxP = prog(t, PR_BOX);
      const boxA = prog(t, PR_BOX_FADE);
      const sc = PR_BOX.s0 + (1 - PR_BOX.s0) * boxP;
      const w = g.label.r - g.label.l;
      const h = g.label.b - g.label.t;
      const cx = (g.label.l + g.label.r) / 2;
      const cy = (g.label.t + g.label.b) / 2;
      const bw = G.boxStroke * g.f;
      const rad = G.boxRadius * g.f;
      const spP = prog(t, PR_SPIN);
      const spTail = prog(t, PR_SPIN_TAIL);
      const spS = (PR_SPIN.s0 + (PR_SPIN.s1 - PR_SPIN.s0) * spP) * (1 + (1 / PR_SPIN.s1 - 1) * spTail);
      const spA = Math.min(1, PR_SPIN_FADE.a1 * prog(t, PR_SPIN_FADE) + (1 - PR_SPIN_FADE.a1) * spTail);
      const steps8 = SPIN.opacities.length;
      const raw = SPIN.phaseOffset + Math.floor((t - SPIN.phaseFrame0) / SPIN.framesPerStep);
      const darkest = ((raw % steps8) + steps8) % steps8;
      const r1 = SPIN.r1 * g.f;
      const r2 = SPIN.r2 * g.f;
      return (
        <React.Fragment key={key}>
          <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
            <g opacity={boxA >= 1 ? undefined : boxA} transform={boxP >= 1 ? undefined : `translate(${cx} ${cy}) scale(${sc}) translate(${-cx} ${-cy})`}>
              <rect x={g.label.l} y={g.label.t} width={w} height={h} rx={rad} ry={rad} fill={colors.boxFill} />
              <rect x={g.label.l + bw / 2} y={g.label.t + bw / 2} width={w - bw} height={h - bw} rx={rad - bw / 2} ry={rad - bw / 2} fill="none" stroke={colors.line} strokeWidth={bw} />
            </g>
            {g.spinner && spA > 0 ? (
              <g
                opacity={spA >= 1 ? undefined : spA}
                transform={spS >= 1 - 1e-4 ? undefined : `translate(${cx} ${cy}) scale(${spS}) translate(${-cx} ${-cy})`}
                stroke={colors.spinner}
                strokeWidth={SPIN.stroke * g.f}
                strokeLinecap="round"
                fill="none"
              >
                {SPIN.opacities.map((_, k) => {
                  const ang = (k * 2 * Math.PI) / steps8;
                  const sx = Math.sin(ang);
                  const sy = -Math.cos(ang);
                  return (
                    <line key={k} x1={cx + sx * r1} y1={cy + sy * r1} x2={cx + sx * r2} y2={cy + sy * r2} strokeOpacity={SPIN.opacities[(((k - darkest) % steps8) + steps8) % steps8]} />
                  );
                })}
              </g>
            ) : null}
          </svg>
          {!g.spinner && g.lines.length ? (
            <div
              style={{
                position: 'absolute',
                left: g.label.l,
                top: g.label.t,
                width: w,
                height: h,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily,
                fontSize: g.fontSize,
                lineHeight: `${G.plLine * g.f}px`,
                color: g.textColor,
                whiteSpace: 'pre',
                opacity: spA >= 1 ? undefined : spA,
              }}
            >
              {g.lines.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          ) : null}
        </React.Fragment>
      );
    }

    // message:箭头
    const hl = g.style === 'highlight';
    const aCurve = hl ? HL_ARROW : PL_ARROW;
    const aP = prog(t, aCurve);
    const aS = aCurve.s0 + (1 - aCurve.s0) * aP;
    const aA = prog(t, hl ? HL_ARROW_FADE : PL_ARROW_FADE);
    const xs = g.points.map((p) => p[0]);
    const ys = g.points.map((p) => p[1]);
    const pcx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const pcy = (g.points.length === 2 ? g.points[0][1] : (Math.min(...ys) + Math.max(...ys)) / 2) + G.arrowPivotBelow * g.f;
    const lw = G.arrowWidth * Math.max(0.75, g.f);
    const ap = arrowPath(g.points, lw, G.headLength * Math.max(0.75, g.f), G.headHalf * Math.max(0.75, g.f), G.notch * Math.max(0.75, g.f));
    const arrow = (
      <svg key={`${key}a`} width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        <g opacity={aA >= 1 ? undefined : aA} transform={aP >= 1 ? undefined : `translate(${pcx} ${pcy}) scale(${aS}) translate(${-pcx} ${-pcy})`}>
          <path d={ap.shaft} fill="none" stroke={colors.line} strokeWidth={lw} strokeLinejoin="round" />
          <polygon points={ap.head} fill={colors.line} />
        </g>
      </svg>
    );
    if (!g.lines.length) return arrow;
    const w = g.label.r - g.label.l;
    const h = g.label.b - g.label.t;

    if (!hl) {
      // plain:签和字一体在固定窗里升起,窗下沿 = 签底 + 7.9
      const rP = prog(t, PL_RISE);
      const dy = PL_RISE.dy * g.f * (1 - rP);
      const winTop = g.label.t - 60;
      const winBottom = g.label.b + G.plWindowBelow * g.f;
      return (
        <React.Fragment key={key}>
          {arrow}
          <div style={{ position: 'absolute', left: g.label.l - 20, top: winTop, width: w + 40, height: winBottom - winTop, overflow: 'hidden' }}>
            <div
              style={{
                position: 'absolute',
                left: 20,
                top: g.label.t - winTop,
                width: w,
                height: h,
                borderRadius: G.plRadius * g.f,
                backgroundColor: g.color,
                translate: rP >= 1 ? undefined : `0px ${dy}px`,
              }}
            >
              {g.lines.map((l, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: G.plPadLeft * g.f,
                    top: (G.plPadTop + i * G.plLine) * g.f,
                    height: g.fontSize,
                    lineHeight: 1,
                    fontFamily,
                    fontSize: g.fontSize,
                    whiteSpace: 'pre',
                    color: g.textColor,
                  }}
                >
                  {l}
                </div>
              ))}
            </div>
          </div>
        </React.Fragment>
      );
    }

    // highlight:黄签荧光闪入
    const sx = HL_SX.s0 + (1 - HL_SX.s0) * prog(t, HL_SX);
    const sy = HL_SY.s0 + (1 - HL_SY.s0) * prog(t, HL_SY);
    const tsx = HL_TEXT_SX.s0 + (1 - HL_TEXT_SX.s0) * prog(t, HL_TEXT_SX);
    const labelA = prog(t, HL_LABEL_FADE);
    const bright = HL_BRIGHT.b0 + (1 - HL_BRIGHT.b0) * prog(t, HL_BRIGHT);
    const lbx = interpTable(HL_BLUR_FRAMES, HL_LABEL_BLUR_X, t) * g.f;
    const lby = interpTable(HL_BLUR_FRAMES, HL_LABEL_BLUR_Y, t) * g.f;
    const tbx = interpTable(HL_BLUR_FRAMES, HL_TEXT_BLUR_X, t) * g.f;
    const tby = interpTable(HL_BLUR_FRAMES, HL_TEXT_BLUR_Y, t) * g.f;
    const gain = interpTable(HL_GLOW_FRAMES, HL_GLOW_GAIN, t) * (1 - prog(t, HL_GLOW_FADE));
    const textA = prog(t, HL_TEXT_EMERGE) * (HL_TEXT_DARK.a0 + (1 - HL_TEXT_DARK.a0) * prog(t, HL_TEXT_DARK));
    const settled = t >= HL_SX.to;
    const labelBlurId = `gs-${uid}-${idx}-lb`;
    const textBlurId = `gs-${uid}-${idx}-tb`;
    const lBlur = lbx > 1e-3 || lby > 1e-3;
    const tBlur = tbx > 1e-3 || tby > 1e-3;
    const squash = settled ? undefined : `${sx} ${sy}`;
    const filters: string[] = [];
    if (lBlur) filters.push(`url(#${labelBlurId})`);
    if (Math.abs(bright - 1) > 1e-4) filters.push(`brightness(${bright})`);
    const chars = [...g.lines.join(' ')];
    const glow = gain > 1e-4 ? glowShadow(g.color, gain, g.f) : undefined;
    return (
      <React.Fragment key={key}>
        {lBlur ? <AnisoBlur id={labelBlurId} sx={lbx} sy={lby} /> : null}
        {tBlur ? <AnisoBlur id={textBlurId} sx={tbx} sy={tby} /> : null}
        {glow ? (
          <div
            style={{
              position: 'absolute',
              left: g.label.l,
              top: g.label.t,
              width: w,
              height: h,
              borderRadius: G.hlRadius * g.f,
              boxShadow: glow,
              scale: squash,
              filter: lBlur ? `url(#${labelBlurId})` : undefined,
            }}
          />
        ) : null}
        {arrow}
        <div
          style={{
            position: 'absolute',
            left: g.label.l,
            top: g.label.t,
            width: w,
            height: h,
            borderRadius: G.hlRadius * g.f,
            backgroundColor: g.color,
            opacity: labelA >= 1 ? undefined : labelA,
            scale: squash,
            filter: filters.length ? filters.join(' ') : undefined,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: g.label.l,
            top: g.label.t + G.hlTextDy * g.f,
            width: w,
            height: h,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily,
            fontSize: g.fontSize,
            letterSpacing: G.hlLetterSpacing * g.f,
            lineHeight: 1,
            whiteSpace: 'pre',
            color: g.textColor,
            scale: settled ? undefined : `${tsx} ${sy}`,
            filter: tBlur ? `url(#${textBlurId})` : undefined,
          }}
        >
          <span>
            {chars.map((ch, ci) => {
              const k = charFlicker ? interpTable(HL_CHAR_FRAMES, HL_CHAR_OPACITY[ci % 7], t) : 1;
              const a = Math.min(1, textA * k);
              return (
                <span key={ci} style={{ opacity: a >= 1 ? undefined : a }}>
                  {ch}
                </span>
              );
            })}
          </span>
        </div>
      </React.Fragment>
    );
  });

  return (
    <AbsoluteFill>
      {bg}
      <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        {lifelines}
        {caps}
      </svg>
      {nodeHtml}
      {stepLayers}
    </AbsoluteFill>
  );
};
