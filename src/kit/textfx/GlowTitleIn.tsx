/**
 * GlowTitleIn.tsx — 「发光标题入场」文字特效(秋芝《Claude Code 全解》6:53「安装CC」实测版)。
 *
 * 出处:内部复刻案例 qz-cc-0413-title-toc-dive(交付 20),工序④逐帧拟合 + ⑦b 第 2 轮修正。
 * 默认值 = 原片 30fps 实测曲线(specs/motion.json 的 c-title-* / fx-title-glow-*,
 * specs/layout-ext.json / motion-ext.json 的 c-title / fx-title-glow),不是手调。
 * 本地帧 0 = 原片 f017(黑 1 帧 f016 之后标题第一次出现)。
 *
 * 构成(两层,都在黑底上 normal 叠放,和案例 runtime 同款):
 *   主字:整体 1.10→1 缩小(7 帧)+ 去模糊(6 帧,逐帧关键帧)+ 淡入(5 帧)+ 字距从 +0.26em 收拢到 0(14 帧)
 *   光晕:同字副本两层高斯模糊(σ 8px α0.75 + σ 32px α0.65 @163.2px 字号),跟主字同缩放/同字距,
 *         自身再叠一层入场模糊;2 帧淡入、第 1–4 帧增益 >1(比平台更亮)、第 9–14 帧淡出散尽
 * 横向压扁 0.875 与拉丁字母纵拉 1.077 是替身字体(阿里巴巴普惠体 3.0 Heavy)对原片字形的补偿,静态常量不算动效。
 *
 * 用法:
 *   <Sequence from={x}>
 *     <GlowTitleIn text="安装CC" fontSize={163.2} fontFamily="AlibabaPuHuiTi" />
 *   </Sequence>
 * 组件铺满父容器,字默认在画面正中;要换位置给 center。黑底/深底由调用方铺(坑 Z7:白光只上深底)。
 * 原片是硬切出场:标题停多久由外面的 <Sequence durationInFrames> 决定。
 */
import React from 'react';
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { splitGraphemes } from './graphemes';

const clampBoth = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 实测时基:原片 30fps。下面帧号都是本地帧(0 = 原片 f017) */
const MEASURED_FPS = 30;
/** 实测字号:原片 1080p 替身字体 163.2px。模糊半径 / 字距 / 光晕半径都按「字号 ÷ 163.2」等比缩放 */
const REF_FONT_PX = 163.2;

// ── 实测曲线(帧号已从原片 f017 起算) ──
/** 整体缩小 1.1008 → 1:f017–f024,bezier rmse 0.0015(主字与光晕共用) */
const SHRINK_FROM = 1.1008;
const SHRINK_END = 7;
const SHRINK_EASE = Easing.bezier(0.3375, 0.1795, 0.3208, 0.9516);
/** 字距收拢进度 0 → 1:f017–f031,bezier rmse 0.0051;起始额外字距 42.663px(CSS 值,已扣缩放与横压) */
const TRACK_END = 14;
const TRACK_EASE = Easing.bezier(0.0315, 0.2909, 0.462, 1);
const TRACK_FROM_EM = 42.663 / REF_FONT_PX;
/** 主字淡入:f016 0 → f021 1,bezier rmse 0.003(本地 −1 → 4) */
const MAIN_FADE_EASE = Easing.bezier(0.7707, 0.1645, 0, 1.1027);
/** 主字模糊 σ(px @163.2):逐帧关键帧线性相连(单条 bezier 残差 0.43px 太大);⑦b M4 修正后「字芯先清楚」版 */
const MAIN_BLUR_KEYS = [9.88, 4.5, 1.8, 1.05, 0.55, 0.341, 0];
/** 光晕层整层模糊 σ:保持 ④ 原拟合(光晕 f017–f019 本身发虚) */
const GLOW_BLUR_KEYS = [9.88, 6.277, 5.319, 2.377, 1.012, 0.341, 0];
const BLUR_FRAMES = [0, 1, 2, 3, 4, 5, 6];
/** 光晕淡入:f016 0 → f019 1,bezier rmse 0.000(本地 −1 → 2) */
const GLOW_IN_EASE = Easing.bezier(0.3183, -0.3985, 0.3588, 1.1854);
/** 光晕淡出:f026 1 → f031 0,bezier rmse 0.000(本地 9 → 14) */
const GLOW_OUT_START = 9;
const GLOW_OUT_END = 14;
const GLOW_OUT_EASE = Easing.bezier(0.3426, -0.1158, 1, 1.1057);
/** 光晕增益(⑦b M4):原片 f018–f021 光晕比平台更亮,每层 opacity × gain(封顶 1) */
const GLOW_GAIN_FRAMES = [0, 1, 2, 3, 4, 5];
const GLOW_GAIN_KEYS = [1, 1.1, 1.5, 1.25, 1.05, 1];
/** 光晕两层:同字副本 + 高斯模糊(案例 layout-ext glowLayers) */
const GLOW_LAYERS = [
  { blurPx: 8, opacity: 0.75 },
  { blurPx: 32, opacity: 0.65 },
];
/** 光晕层比主字高 1px(案例 layout 实测 bounds 差) */
const GLOW_DY_EM = -1 / REF_FONT_PX;
/** 拉丁字母/数字纵拉:替身字体 CC 偏矮 7.7%,锚点 = 大写字面中心 83.97px,再下移 1px(案例 layout-ext glyphClasses) */
const LATIN_ORIGIN_EM = 83.97 / REF_FONT_PX;
const LATIN_DY_EM = 1 / REF_FONT_PX;
const LATIN_RE = /^[A-Za-z0-9]$/;
/** 全部落定帧(字距收拢完 = 光晕散尽) */
const SETTLE = 14;

export type GlowTitleInProps = {
  text: string;
  /** 字号 px。原片 1080p 下 163.2(替身普惠体 Heavy) */
  fontSize: number;
  /** 字色。原片 #FFFFFF */
  color?: string;
  /** 光晕颜色。原片白光;彩色光自己换(深底才好看,坑 Z7) */
  glowColor?: string;
  /** 光晕强度倍率 0–2:1 = 原片;0 = 不发光只做缩小去模糊收字距 */
  glow?: number;
  fontFamily?: string;
  fontWeight?: React.CSSProperties['fontWeight'];
  /** 横向压扁。原片替身字体实测 0.875;换了原生就窄的字体给 1 */
  scaleX?: number;
  /** 拉丁字母/数字纵向拉高。原片替身字体实测 1.077;全中文或换字体给 1 */
  latinScaleY?: number;
  /** 字距收拢的起始额外字距,单位 em(按原字号)。原片 0.2614;0 = 不做收字距 */
  trackingFromEm?: number;
  /** 画面中心(像素)。默认父容器正中;原片 (962.27, 512.21) */
  center?: { x: number; y: number };
  /** 字行最大宽度 px:估出来超了就等比缩字号(中文按 1em、字母数字按 0.6em 估) */
  maxWidthPx?: number;
  /** 速度倍率:1 = 原片节奏(约 0.23 秒清楚、0.47 秒光晕散尽);0.7 更缓,1.3 更脆 */
  speed?: number;
  /** 逐字水平微调 px(按原字号),字数对不上自动失效。只在逐像素对原片时用 */
  glyphDxPx?: readonly number[];
  /** 起播延迟(帧,按当前 fps)。也可以直接套 <Sequence from> */
  delayFrames?: number;
};

export const glowTitleInDurationInFrames = (fps: number, speed = 1): number =>
  Math.ceil(((SETTLE + 1) / MEASURED_FPS / speed) * fps);

const estimateWidthEm = (graphemes: string[]): number =>
  graphemes.reduce((sum, g) => sum + (g === ' ' ? 0.3 : LATIN_RE.test(g) ? 0.6 : 1), 0);

export const GlowTitleIn: React.FC<GlowTitleInProps> = ({
  text,
  fontSize: fontSizeIn,
  color = '#FFFFFF',
  glowColor = '#FFFFFF',
  glow = 1,
  fontFamily,
  fontWeight = 400,
  scaleX = 0.875,
  latinScaleY = 1.077,
  trackingFromEm = TRACK_FROM_EM,
  center,
  maxWidthPx,
  speed = 1,
  glyphDxPx,
  delayFrames = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  // 本地实测帧(可带小数):换 fps / 调速都在这里折算
  const t = ((frame - delayFrames) / fps) * MEASURED_FPS * speed;
  // 淡入从本地 −1 帧起,−1 帧时透明度仍是 0:t<0 不画
  if (t < 0) return null;

  const graphemes = splitGraphemes(text);
  const fontSize = maxWidthPx
    ? Math.min(fontSizeIn, maxWidthPx / Math.max(0.5, estimateWidthEm(graphemes) * scaleX))
    : fontSizeIn;
  const k = fontSize / REF_FONT_PX;
  const cx = center?.x ?? width / 2;
  const cy = center?.y ?? height / 2;

  const shrink = interpolate(t, [0, SHRINK_END], [SHRINK_FROM, 1], { ...clampBoth, easing: SHRINK_EASE });
  const trackProgress = interpolate(t, [0, TRACK_END], [0, 1], { ...clampBoth, easing: TRACK_EASE });
  const trackPx = trackingFromEm * fontSize * (1 - trackProgress);
  const mainOpacity = interpolate(t, [-1, 4], [0, 1], { ...clampBoth, easing: MAIN_FADE_EASE });
  const mainBlur = interpolate(t, BLUR_FRAMES, MAIN_BLUR_KEYS, clampBoth) * k;
  const settled = t >= SETTLE;

  // 逐字 span:拉丁字母纵拉 + 可选逐字微调;都不需要时直接给纯文本
  const dx = glyphDxPx && glyphDxPx.length === graphemes.length ? glyphDxPx : null;
  const needSpans = dx || (latinScaleY !== 1 && graphemes.some((g) => LATIN_RE.test(g)));
  const run = (key: string): React.ReactNode =>
    needSpans
      ? graphemes.map((g, i) => {
          const s: React.CSSProperties = { position: 'relative', left: (dx?.[i] ?? 0) * k };
          if (latinScaleY !== 1 && LATIN_RE.test(g)) {
            s.display = 'inline-block';
            s.top = LATIN_DY_EM * fontSize;
            s.scale = `1 ${latinScaleY}`;
            s.transformOrigin = `50% ${(LATIN_ORIGIN_EM * fontSize).toFixed(2)}px`;
          }
          return (
            <span key={`${key}-${i}`} style={s}>
              {g}
            </span>
          );
        })
      : text;

  // 行盒:以 (cx, cy) 为中心的宽盒子,flex 居中;缩放锚点 = 盒心。
  // 字距收拢时 Chrome 会在末字后多留一格字距,内层右移一半抵掉,保证视觉居中(同案例 runtime)
  const boxW = width * 4;
  const box = (dy: number): React.CSSProperties => ({
    position: 'absolute',
    left: cx - boxW / 2,
    top: cy - fontSize / 2 + dy,
    width: boxW,
    height: fontSize,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily,
    fontWeight,
    fontSize,
    lineHeight: 1,
    whiteSpace: 'pre',
    fontKerning: 'none',
    letterSpacing: trackPx > 0.001 ? trackPx : undefined,
    transformOrigin: '50% 50%',
  });
  const inner: React.CSSProperties = {
    position: 'relative',
    display: 'inline-block',
    whiteSpace: 'pre',
    left: trackPx > 0.001 ? trackPx / 2 : undefined,
  };

  let glowNode: React.ReactNode = null;
  if (glow > 0 && t < GLOW_OUT_END) {
    const glowIn = interpolate(t, [-1, 2], [0, 1], { ...clampBoth, easing: GLOW_IN_EASE });
    const glowOut = interpolate(t, [GLOW_OUT_START, GLOW_OUT_END], [1, 0], { ...clampBoth, easing: GLOW_OUT_EASE });
    const gain = interpolate(t, GLOW_GAIN_FRAMES, GLOW_GAIN_KEYS, clampBoth);
    const glowBlur = interpolate(t, BLUR_FRAMES, GLOW_BLUR_KEYS, clampBoth) * k;
    glowNode = (
      <div
        aria-hidden
        style={{
          ...box(GLOW_DY_EM * fontSize),
          opacity: Math.max(0, glowIn * glowOut),
          scale: `${shrink * scaleX} ${shrink}`,
          filter: glowBlur > 0.01 ? `blur(${glowBlur.toFixed(3)}px)` : undefined,
        }}
      >
        <span style={inner}>
          {GLOW_LAYERS.map((layer, i) => (
            <span
              key={`glow-${i}`}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                whiteSpace: 'pre',
                color: glowColor,
                filter: `blur(${(layer.blurPx * k).toFixed(2)}px)`,
                opacity: Math.min(1, layer.opacity * gain * glow),
              }}
            >
              {run(`glow-${i}`)}
            </span>
          ))}
          {/* 透明主字占位:撑出和主字同样的排版盒 */}
          <span style={{ position: 'relative', color: 'transparent' }}>{run('glow-ph')}</span>
        </span>
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {glowNode}
      <div
        style={{
          ...box(0),
          color,
          opacity: settled ? undefined : Math.min(1, Math.max(0, mainOpacity)),
          // 落定后只留静态横压(常量,不会「呼吸」);入场缩放 / 模糊清掉(坑 Z1)
          scale: settled ? (scaleX === 1 ? undefined : `${scaleX} 1`) : `${shrink * scaleX} ${shrink}`,
          filter: mainBlur > 0.01 ? `blur(${mainBlur.toFixed(3)}px)` : undefined,
        }}
      >
        <span style={inner}>{run('main')}</span>
      </div>
    </div>
  );
};
