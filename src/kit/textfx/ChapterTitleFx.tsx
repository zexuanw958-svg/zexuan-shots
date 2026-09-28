/**
 * ChapterTitleFx.tsx — 「章节卡标题」文字特效(秋芝《Codex全解》20:57 章节卡实测版)。
 *
 * 出处:内部复刻案例 qz-cx-1257-chapter-card(交付 04),工序④/⑦b 逐帧拟合。
 * 默认值 = 原片 30fps 实测曲线,不是手调;每条曲线的来源写在旁边(specs/motion.json 同名条目有逐帧数据)。
 * 本组件只画标题文字和它的光,人物卡缩小 / 描边框 / 章节号不归这里管。
 *
 * 三段(都可选):
 *   ① 入场:字距从很宽收拢(字心距 +0.34em → 0)、从糊到清、带一圈白色外发光(两层 SVG 辉光,
 *           第 2 帧冲顶 1.5 倍亮度),约 0.47 秒落定,光再慢慢退掉。  —— motion: title-main-in / title-glow-in / title-glow-out
 *   ② 出场:整行淡出,0.5 秒,easeOutQuad 味。                         —— motion: title-main-out
 *   ③ 换字:下一个标题「闪一下」出现:字心一个暖色火花 → 字 2 帧显形 → 字边偏白亮环 + 橙色贴字晕
 *           + 从字心偏左向两边拉开的橙色横向光丝 + 字芯染暖,第 4 帧最亮,约 0.47 秒收回成纯白字。
 *                                                                       —— motion: title-swap-in / swap-rim-* / swap-streak-* / swap-tint-*
 *
 * 用法(本地帧 0 = 标题第一次出现;exitAt / swapAt 按当前 fps 的帧数,从组件起播算):
 *   <Sequence from={x}>
 *     <ChapterTitleFx text="图片生成" nextText="个人主页开发" exitAt={277} fontFamily="WenYueXinQingNian" />
 *   </Sequence>
 * 组件铺满父容器(不做 isolation:光用 screen 叠在下面的画面上),字默认在画面正中,换位置给 center / nextCenter。
 * text 传空串 = 跳过入场,只做换字。
 */
import React, { useId } from 'react';
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { splitGraphemes } from './graphemes';

const clampBoth = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 实测时基:原片 30fps */
const MEASURED_FPS = 30;
/**
 * 实测几何的参考字号:原片是剪映「文悦新青年体」,按原片 f300「图片生成」、f449「个人主页开发」
 * 字形 IoU 拟合 0.964 / 0.965,再按 Chrome 实渲墨迹宽高校正 → 标题 166px、换字 133px、字距 0
 * (字心距 143.2 / 114.9)。
 * 案例里的光效参数是按屏幕像素量的,换字号时按 fontSize / 参考字号 等比缩放。
 */
const REF_TITLE_PX = 166;
const REF_SWAP_PX = 133;

// ── ① 入场(本地帧 0 = 原片 f125,标题第一帧可见) ──
/** 字本体不透明度:f124 0 → f127 1(f125 0.16) */
const TITLE_OPACITY_EASE = Easing.bezier(0.762, 0.213, 0.338, 0.738);
/** 字本体模糊:f125 10.55px → f130 0(⑦b M1 修正版) */
const TITLE_BLUR_EASE = Easing.bezier(0.356, 1, 0.362, 0.875);
/** 余留软模糊 0.45px 到 f138,f139 归 0(Chrome 字比原片视频锐,⑦a L4 实测补) */
const SOFT_HOLD_PX = 0.45;
/** 字距收拢:字心距 199.9 → 143.2(多出 56.7px @166px = 0.34em),f125→f139,rmse 0.21px */
const SPREAD_EASE = Easing.bezier(0.1, 0.244, 0.181, 1.0);
const SPREAD_EM = 56.7 / REF_TITLE_PX;
/** 辉光层不透明度:f124 0 → f126 1(f125 0.3) */
const GLOW_IN_EASE = Easing.bezier(0.45, 0.4, 0.7, 0.15);
/** 辉光层外扩模糊:f125 32px → f127 0 */
const GLOW_BLUR_EASE = Easing.bezier(0.2, 0, 0.45, 0);
/** 辉光退场:f134 1 → f139 0,rmse 0.0006 */
const GLOW_OUT_EASE = Easing.bezier(0.394, 0.006, 0.781, 0.869);
/** 入场落定(本地帧):f139 起字距/模糊/辉光全部归零 */
const ENTER_SETTLE = 14;

// ── ② 出场(本地帧 0 = 原片 f402) ──
/** 整行淡出 f402 1 → f417 0,rmse 0.0025 */
const EXIT_EASE = Easing.bezier(0.5, 1, 0.9, 1);
const EXIT_LEN = 15;

// ── ③ 换字(本地帧 0 = 原片 f432,火花帧) ──
/** 新字显形 f432 0 → f434 1(f433 0.68,纯透明度不是模糊) */
const SWAP_OPACITY_EASE = Easing.bezier(0.5, 0.15, 0.1, 0.65);
/** 贴字晕 f432→f436 升、f436→f446 退 */
const RIM_RISE_EASE = Easing.bezier(0.55, 0, 0.556, 0.506);
const RIM_FALL_EASE = Easing.bezier(0.269, 0.006, 0.419, 0.906);
/** 字边亮环(σ2):f434 就到顶,退得最慢 */
const CORE_RISE_EASE = Easing.bezier(0.35, 0, 0.95, 0.1);
const CORE_FALL_EASE = Easing.bezier(0.369, 0.538, 0.419, 0.319);
/** 横向光丝:f433 0.196 → f436 1 升,f436→f444 退;横向比例 f433 0.2 → f436 1 → f443 0.881(线性) */
const STREAK_RISE_EASE = Easing.bezier(0, 1, 0.931, 0.138);
const STREAK_FALL_EASE = Easing.bezier(0.25, 0.175, 0, 0.619);
/** 字芯染暖:f433 0 → f436 1 → f444 0 */
const TINT_RISE_EASE = Easing.bezier(0.95, 0.55, 0.506, 0.256);
const TINT_FALL_EASE = Easing.bezier(0.213, 0.169, 0.094, 0.95);
/** 光效最后一帧(f445);f446 起纯白字 */
const SWAP_SETTLE = 14;
/** 原片旧字开始淡出(f402)到换字火花(f432)= 30 帧 */
const SWAP_AFTER_EXIT = 30;

// ── 光效层参数(案例 specs/layout-ext.json svgFilters,⑦b 按 runtime 前向公式拟合 f135 / f436) ──
type GlowLayer = { sx: number; sy: number; slope: number; color: string; outlinePx?: number; dx?: number };
const TITLE_GLOW: GlowLayer[] = [
  { sx: 45, sy: 45, slope: 0.45, color: '#FFFFFF' },
  { sx: 12, sy: 12, slope: 0.85, color: '#FFFFFF' },
];
/** 横向光:宽柔光 + 字形外轮廓环拉出来的细光丝,整体左偏 45px(原片光心在字心左侧) */
const STREAK_GLOW = (c: SwapPalette): GlowLayer[] => [
  { sx: 160, sy: 48, slope: 1.339, color: c.streak, dx: -45 },
  { sx: 300, sy: 1.5, slope: 0.61, color: c.streakLine, outlinePx: 8, dx: -45 },
];
/** 贴字晕:橙色 + 近处偏白 */
const RIM_GLOW = (c: SwapPalette): GlowLayer[] => [
  { sx: 24, sy: 10, slope: 1.467, color: c.rim, dx: -10 },
  { sx: 8, sy: 6, slope: 0.62, color: c.rimLight },
];
const CORE_GLOW = (c: SwapPalette): GlowLayer[] => [{ sx: 2, sy: 2, slope: 3.683, color: c.core }];

export type SwapPalette = {
  /** 横向宽柔光 */
  streak: string;
  /** 横向细光丝 */
  streakLine: string;
  /** 贴字橙晕 */
  rim: string;
  /** 贴字近处偏白的晕 */
  rimLight: string;
  /** 字边亮环 */
  core: string;
  /** 字芯染色 */
  tint: string;
  /** 火花(径向渐变三档:芯 / 中 / 外) */
  spark: [string, string, string];
};
/** 原片金光配色(实测) */
export const CHAPTER_SWAP_GOLD: SwapPalette = {
  streak: '#FF9241',
  streakLine: '#FF9446',
  rim: '#FF9C4E',
  rimLight: '#FFDFFF',
  core: '#FFC99B',
  tint: '#FFD27A',
  spark: ['rgba(255,226,160,0.34)', 'rgba(210,150,70,0.20)', 'rgba(150,90,30,0.07)'],
};

export type ChapterTitleFxProps = {
  /** 入场标题。传空串 = 不做入场,只做换字 */
  text: string;
  /** 换上来的下一个标题;不给就只有入场(+ 可选出场) */
  nextText?: string;
  /** 标题字号 px。原片 1080p 新青年体 166 */
  fontSize?: number;
  /** 换字标题字号,默认 = fontSize × 133/166(原片比例) */
  nextFontSize?: number;
  color?: string;
  /** 默认剪映「文悦新青年体」(本地注册名 WenYueXinQingNian) */
  fontFamily?: string;
  fontWeight?: React.CSSProperties['fontWeight'];
  /** 落定字距 em,原片 0 */
  letterSpacingEm?: number;
  /** 入场时额外张开的字距 em,原片 0.34(字心距多 57px);0 = 不做收拢 */
  spreadEm?: number;
  /** 字的墨迹中心(画面像素)。默认父容器正中。原片标题 (1293.6, 548.8) */
  center?: { x: number; y: number };
  /** 换字标题中心,默认同 center。原片 (1333.9, 476.6) */
  nextCenter?: { x: number; y: number };
  /** 字行最大宽度 px:按字数估宽,超了等比缩字号(两行标题各自算);入场张开的字距也跟着收,整行不超过它的 1.12 倍 */
  maxWidthPx?: number;
  /** 单字前进宽度 em(估宽用)。新青年体中文 127/148 ≈ 0.86;拉丁字母按一半算 */
  advanceEm?: number;
  /** 速度倍率:1 = 原片节奏;0.7 更沉,1.3 更脆(只缩放动画本身,exitAt/swapAt 不变) */
  speed?: number;
  /** 入场白光强度 0–1(1 = 原片) */
  glow?: number;
  /** 入场白光颜色 */
  glowColor?: string;
  /** 换字金光强度 0–1(1 = 原片) */
  swapGlow?: number;
  /** 换字金光配色,默认原片金橙 */
  swapPalette?: Partial<SwapPalette>;
  /** 旧标题开始淡出的帧(当前 fps,从组件起播算)。不给 = 一直留着(有 nextText 时按 swapAt − 1 秒推) */
  exitAt?: number;
  /** 换字火花帧(当前 fps)。不给 = exitAt + 1 秒(原片 30 帧) */
  swapAt?: number;
  /** 起播延迟(帧,按当前 fps)。也可以直接套 <Sequence from> */
  delayFrames?: number;
};

/** 排片助手:各段时长(当前 fps 帧数) */
export const chapterTitleFxTiming = (fps: number, speed = 1) => {
  const f = (n: number) => Math.ceil((n / MEASURED_FPS / speed) * fps);
  return {
    /** 入场到完全落定(字清、光退净) */
    enter: f(ENTER_SETTLE + 1),
    /** 出场淡出 */
    exit: f(EXIT_LEN),
    /** 原片:开始淡出 → 换字火花的间隔 */
    swapAfterExit: Math.round((SWAP_AFTER_EXIT / MEASURED_FPS) * fps),
    /** 换字光效到收干净 */
    swap: f(SWAP_SETTLE),
  };
};

const estimateWidthEm = (text: string, advanceEm: number, spacingEm: number) =>
  splitGraphemes(text).reduce((sum, g) => sum + (/^[\x20-\x7E]$/.test(g) ? advanceEm * 0.55 : advanceEm) + spacingEm, 0);

/** 两段曲线相乘(升 × 降),与案例 runtime 多条 motion 的合成方式一致 */
const riseFall = (
  t: number,
  rise: [number, number, number, number, (x: number) => number],
  fall: [number, number, number, number, (x: number) => number],
) =>
  interpolate(t, [rise[0], rise[1]], [rise[2], rise[3]], { ...clampBoth, easing: rise[4] }) *
  interpolate(t, [fall[0], fall[1]], [fall[2], fall[3]], { ...clampBoth, easing: fall[4] });

/** SVG 光滤镜:每层 = 字形 alpha(或外轮廓环)→ 高斯(X/Y 可不同)→ 平移 → 斜率增益 → 纯色,多层合并;只出光不出字 */
const GlowFilterDef: React.FC<{
  id: string;
  layers: GlowLayer[];
  k: number;
  gain: number;
  boxW: number;
  boxH: number;
}> = ({ id, layers, k, gain, boxW, boxH }) => {
  const padX = Math.max(...layers.map((l) => 3 * l.sx * k + Math.abs(l.dx ?? 0) * k + (l.outlinePx ?? 0) * k)) + 8;
  const padY = Math.max(...layers.map((l) => 3 * l.sy * k + (l.outlinePx ?? 0) * k)) + 8;
  return (
    <filter
      id={id}
      x={-padX / boxW}
      y={-padY / boxH}
      width={1 + (2 * padX) / boxW}
      height={1 + (2 * padY) / boxH}
      filterUnits="objectBoundingBox"
      colorInterpolationFilters="sRGB"
    >
      {layers.map((l, i) => (
        <React.Fragment key={i}>
          {l.outlinePx ? (
            <>
              <feMorphology in="SourceAlpha" operator="dilate" radius={l.outlinePx * k} result={`m${i}`} />
              <feComposite in={`m${i}`} in2="SourceAlpha" operator="out" result={`o${i}`} />
            </>
          ) : null}
          <feGaussianBlur in={l.outlinePx ? `o${i}` : 'SourceAlpha'} stdDeviation={`${l.sx * k} ${l.sy * k}`} result={`b${i}`} />
          <feOffset in={`b${i}`} dx={(l.dx ?? 0) * k} dy={0} result={`d${i}`} />
          <feComponentTransfer in={`d${i}`} result={`a${i}`}>
            <feFuncA type="linear" slope={l.slope * gain} />
          </feComponentTransfer>
          <feFlood floodColor={l.color} result={`t${i}`} />
          <feComposite in={`t${i}`} in2={`a${i}`} operator="in" result={`l${i}`} />
        </React.Fragment>
      ))}
      <feMerge>
        {layers.map((_, i) => (
          <feMergeNode key={i} in={`l${i}`} />
        ))}
      </feMerge>
    </filter>
  );
};

export const ChapterTitleFx: React.FC<ChapterTitleFxProps> = ({
  text,
  nextText,
  fontSize: fontSizeIn = REF_TITLE_PX,
  nextFontSize: nextFontSizeIn,
  color = '#FFFFFF',
  fontFamily = 'WenYueXinQingNian',
  fontWeight = 400,
  letterSpacingEm = 0,
  spreadEm = SPREAD_EM,
  center,
  nextCenter,
  maxWidthPx,
  advanceEm = 0.86,
  speed = 1,
  glow = 1,
  glowColor = '#FFFFFF',
  swapGlow = 1,
  swapPalette,
  exitAt: exitAtIn,
  swapAt: swapAtIn,
  delayFrames = 0,
}) => {
  // hooks 全在顶层、早退之前(坑 Z6)
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');

  const toMeasured = (localFrames: number) => (localFrames / fps) * MEASURED_FPS * speed;
  const local = frame - delayFrames;
  if (local < 0) return null;

  const gap = Math.round((SWAP_AFTER_EXIT / MEASURED_FPS) * fps);
  const swapAt = nextText ? (swapAtIn ?? (exitAtIn !== undefined ? exitAtIn + gap : undefined)) : undefined;
  const exitAt = exitAtIn ?? (swapAt !== undefined ? swapAt - gap : undefined);

  const fit = (s: string, size: number) => {
    if (!maxWidthPx) return size;
    const em = estimateWidthEm(s, advanceEm, letterSpacingEm);
    return em > 0 ? Math.min(size, maxWidthPx / em) : size;
  };
  const fontSize = fit(text, fontSizeIn);
  const nextFontSize = fit(nextText ?? '', nextFontSizeIn ?? fontSizeIn * (REF_SWAP_PX / REF_TITLE_PX));
  const c1 = center ?? { x: width / 2, y: height / 2 };
  const c2 = nextCenter ?? c1;
  const pal: SwapPalette = { ...CHAPTER_SWAP_GOLD, ...swapPalette };

  /** 文字层盒子:固定宽的横条(光滤镜区域按它算,跟字数无关),字在盒里居中;末字后的字距用等量左内边距抵掉 */
  const lineBox = (s: string, size: number, c: { x: number; y: number }, lsPx: number): React.CSSProperties => {
    const boxW = Math.max(600, estimateWidthEm(s, 1, 0) * size + Math.abs(lsPx) * splitGraphemes(s).length + 200);
    return {
      position: 'absolute',
      left: c.x - boxW / 2,
      top: c.y - size / 2,
      width: boxW,
      height: size,
      boxSizing: 'border-box',
      paddingLeft: lsPx,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      whiteSpace: 'pre',
      fontFamily,
      fontWeight,
      fontSize: size,
      lineHeight: 1,
      letterSpacing: lsPx,
      color,
    };
  };
  const boxWidth = (s: string, size: number, lsPx: number) =>
    Math.max(600, estimateWidthEm(s, 1, 0) * size + Math.abs(lsPx) * splitGraphemes(s).length + 200);

  const defs: React.ReactNode[] = [];
  const nodes: React.ReactNode[] = [];

  // ── ① 入场 + ② 出场 ──
  const tE = toMeasured(local);
  const tX = exitAt !== undefined ? toMeasured(local - exitAt) : -1;
  const titleGone = tX >= EXIT_LEN;
  if (text && !titleGone) {
    const k = fontSize / REF_TITLE_PX;
    const settled = tE >= ENTER_SETTLE;
    const exitOpacity = tX >= 0 ? interpolate(tX, [0, EXIT_LEN], [1, 0], { ...clampBoth, easing: EXIT_EASE }) : 1;
    // 长标题:入场张开的字距不许把整行撑出 maxWidthPx 的 1.12 倍(否则两头出画)
    const gaps = Math.max(1, splitGraphemes(text).length - 1);
    const spread = maxWidthPx
      ? Math.min(spreadEm, Math.max(0, (maxWidthPx * 1.12 - estimateWidthEm(text, advanceEm, letterSpacingEm) * fontSize) / (gaps * fontSize)))
      : spreadEm;
    const ls = settled
      ? letterSpacingEm * fontSize
      : (letterSpacingEm + interpolate(tE, [0, ENTER_SETTLE], [spread, 0], { ...clampBoth, easing: SPREAD_EASE })) * fontSize;
    const base = lineBox(text, fontSize, c1, ls);
    const boxW = boxWidth(text, fontSize, ls);

    if (!settled && glow > 0) {
      const glowOpacity =
        interpolate(tE, [-1, 1], [0, 1], { ...clampBoth, easing: GLOW_IN_EASE }) *
        interpolate(tE, [9, ENTER_SETTLE], [1, 0], { ...clampBoth, easing: GLOW_OUT_EASE });
      const glowBlur = interpolate(tE, [0, 2], [32, 0], { ...clampBoth, easing: GLOW_BLUR_EASE }) * k;
      // 冲顶增益:f126 1.0 → f127 1.5 → f129 1.0(线性,元素 opacity 不能 >1 所以乘在滤镜斜率上)
      const gain = interpolate(tE, [1, 2, 4], [1, 1.5, 1], clampBoth);
      const id = `ctf-g-${uid}`;
      defs.push(
        <GlowFilterDef key={id} id={id} layers={TITLE_GLOW.map((l) => ({ ...l, color: glowColor }))} k={k} gain={gain} boxW={boxW} boxH={fontSize} />,
      );
      nodes.push(
        <div
          key="glow"
          style={{
            ...base,
            opacity: glowOpacity * glow * exitOpacity,
            filter: `url(#${id})${glowBlur > 0.01 ? ` blur(${glowBlur.toFixed(2)}px)` : ''}`,
          }}
        >
          {text}
        </div>,
      );
    }

    const opacity = interpolate(tE, [-1, 2], [0, 1], { ...clampBoth, easing: TITLE_OPACITY_EASE }) * exitOpacity;
    const blur = settled
      ? 0
      : (interpolate(tE, [0, 5], [10.55, 0], { ...clampBoth, easing: TITLE_BLUR_EASE }) +
          interpolate(tE, [ENTER_SETTLE - 1, ENTER_SETTLE], [SOFT_HOLD_PX, 0], clampBoth)) *
        k;
    nodes.push(
      <div
        key="title"
        style={{
          ...base,
          // 落定后不留恒等 filter / opacity(坑 Z1)
          opacity: opacity < 0.999 ? opacity : undefined,
          filter: blur > 0.01 ? `blur(${blur.toFixed(2)}px)` : undefined,
        }}
      >
        {text}
      </div>,
    );
  }

  // ── ③ 换字 ──
  if (nextText && swapAt !== undefined) {
    const tS = toMeasured(local - swapAt);
    if (tS >= 0) {
      const k = nextFontSize / REF_SWAP_PX;
      const ls = letterSpacingEm * nextFontSize;
      const base = lineBox(nextText, nextFontSize, c2, ls);
      const boxW = boxWidth(nextText, nextFontSize, ls);
      const fx = tS < SWAP_SETTLE && swapGlow > 0;

      // 火花:只在火花帧(原片 f432 一帧),字心一个竖长暖色亮点
      if (tS < 1 && swapGlow > 0) {
        const w = 48 * k;
        const h = 72 * k;
        nodes.push(
          <div
            key="spark"
            style={{
              position: 'absolute',
              left: c2.x - w / 2,
              top: c2.y - h / 2,
              width: w,
              height: h,
              borderRadius: '50%',
              opacity: swapGlow,
              mixBlendMode: 'screen',
              backgroundImage: `radial-gradient(ellipse at 50% 50%, ${pal.spark[0]} 0%, ${pal.spark[1]} 18%, ${pal.spark[2]} 45%, rgba(0,0,0,0) 72%)`,
            }}
          />,
        );
      }

      const textOpacity = interpolate(tS, [0, 2], [0, 1], { ...clampBoth, easing: SWAP_OPACITY_EASE });
      nodes.push(
        <div key="next" style={{ ...base, opacity: textOpacity < 0.999 ? textOpacity : undefined }}>
          {nextText}
        </div>,
      );

      if (fx && tS >= 1) {
        const tint = riseFall(tS, [1, 4, 0, 1, TINT_RISE_EASE], [4, 12, 1, 0, TINT_FALL_EASE]);
        const rim = riseFall(tS, [0, 4, 0, 1, RIM_RISE_EASE], [4, 14, 1, 0, RIM_FALL_EASE]);
        const core = riseFall(tS, [0, 2, 0, 1, CORE_RISE_EASE], [4, 14, 1, 0, CORE_FALL_EASE]);
        const streak = riseFall(tS, [1, 4, 0.196, 1, STREAK_RISE_EASE], [4, 12, 1, 0, STREAK_FALL_EASE]);
        const streakScaleX =
          tS < 4 ? interpolate(tS, [1, 4], [0.2, 1], clampBoth) : interpolate(tS, [4, 11], [1, 0.881], clampBoth);
        const ids = { streak: `ctf-s-${uid}`, rim: `ctf-r-${uid}`, core: `ctf-c-${uid}` };
        defs.push(
          <GlowFilterDef key={ids.streak} id={ids.streak} layers={STREAK_GLOW(pal)} k={k} gain={1} boxW={boxW} boxH={nextFontSize} />,
          <GlowFilterDef key={ids.rim} id={ids.rim} layers={RIM_GLOW(pal)} k={k} gain={1} boxW={boxW} boxH={nextFontSize} />,
          <GlowFilterDef key={ids.core} id={ids.core} layers={CORE_GLOW(pal)} k={k} gain={1} boxW={boxW} boxH={nextFontSize} />,
        );
        // 层级照原片:字 < 染色 < 横向光 / 贴字晕 / 亮环(screen) < 火花
        nodes.push(
          <div key="tint" style={{ ...base, color: pal.tint, opacity: tint * swapGlow }}>
            {nextText}
          </div>,
          <div
            key="streak"
            style={{
              ...base,
              opacity: streak * swapGlow,
              mixBlendMode: 'screen',
              filter: `url(#${ids.streak})`,
              scale: `${streakScaleX} 1`,
              transformOrigin: '50% 50%',
            }}
          >
            {nextText}
          </div>,
          <div key="rim" style={{ ...base, opacity: rim * swapGlow, mixBlendMode: 'screen', filter: `url(#${ids.rim})` }}>
            {nextText}
          </div>,
          <div key="core" style={{ ...base, opacity: core * swapGlow, mixBlendMode: 'screen', filter: `url(#${ids.core})` }}>
            {nextText}
          </div>,
        );
      }
    }
  }

  if (nodes.length === 0) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {defs.length ? (
        <svg width={0} height={0} aria-hidden style={{ position: 'absolute' }}>
          <defs>{defs}</defs>
        </svg>
      ) : null}
      {nodes}
    </div>
  );
};
