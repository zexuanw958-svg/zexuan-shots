/**
 * TermBurst.tsx — 「术语全称冲入」文字特效 + 可选绿标签滑下(秋芝《Claude Code全解》47:18.9「Command Line Interface」实测版)。
 *
 * 出处:内部复刻案例 qz-cc-2838-term-burst(交付 12),specs/motion.json 的
 *   title-term-burst(大字)与 label-slide-down(标签),specs/motion-ext.json 的 burst 逐帧副本表。
 * 默认值 = 原片 30fps 实测曲线;逐帧表被压成了几条参数曲线(见下),换任何字都能用。
 *
 * 大字构成(全在 isolation 组里 plus-lighter 相加,深底上用):
 *   ① 字距收拢:不是缩放。第 i 个字位移 dx = L·(u + ρ·u³),u = i − (n−1)/2,L 从宽收到 0,整行以中线为不动点
 *   ② 拖影:同一行字 K 份副本,字距在 [L(t−0.7), L(t+0.15)] 等分,每份 1/K 相加(= 快门内运动模糊),整组再模糊一次(先叠后糊)
 *   ③ 辉光:同一组副本按 4 个 σ 各模糊一次相加(核 = 实测 G10/G20/G40/G80),强度曲线先冲到 1.8 再平台再四帧散掉
 *   ④ 入场头 5 帧整行竖向放大(1.17 → 1),头几帧字本体淡入(辉光先亮一帧)
 *   本地 14 帧(0.47 秒)落定成干净字,落定后清掉所有 transform / filter(坑 Z1)
 * 标签:实底色块 + 黑字,右沿对齐大字右沿,从大字下沿一条看不见的裁切线下面往下滑出(12 帧)。
 *
 * 用法:
 *   <Sequence from={x} layout="none">
 *     <TermBurst text="Command Line Interface" label="命令行工具" fontSize={114} fontFamily="SmileySansV1" />
 *   </Sequence>
 * 组件铺满父容器,字默认在画面正中;要换位置给 center(= 字行盒中心)。字多了用 maxWidthPx 自动缩字号。
 */
import React from 'react';
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { splitGraphemes } from './graphemes';

const clampBoth = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 实测时基:原片 30fps。本地帧 0 = 原片 f007(辉光先亮的那一帧),14 = f021 落定 */
const MEASURED_FPS = 30;
/** 原片大字字号(1080p),下面所有 px 常量都按它折算 */
const REF_FONT = 114.208;

// ── 实测曲线(帧号 = 本地帧;-1 是外推点,只给拖影回看用) ──
const T_AXIS = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
/** 主字距 L(px @114.2):mo_letter_x.py 逐字模板匹配,f007 31.2 → f020 0 */
const L_TABLE = [38.6, 31.2, 24.5, 19.8, 15.8, 12.4, 9.47, 7.17, 5.28, 3.76, 2.54, 1.49, 0.49, 0.14, 0, 0];
/** 字本体总权重(淡入):burst 表 copies 权重和,f007 0(只有辉光)→ f011 0.9 → 落定 1 */
const MASS_TABLE = [0, 0, 0.25, 0.5, 0.78, 0.91, 0.95, 0.95, 0.95, 0.97, 0.97, 0.96, 0.97, 0.97, 0.98, 1];
/** 辉光强度:burst 表 glow 强度和,f008–f009 冲到 1.7,f012–f016 平台 ≈0.95,f017–f020 四帧散掉;
 *  f007–f014 按本模板 Chrome 实渲对原片标题带总亮度校过一轮(f007 ×0.63、f008 ×0.86、f012–f014 ×0.9) */
const GLOW_TABLE = [0.47, 0.47, 1.45, 1.68, 1.33, 1.02, 0.93, 0.92, 0.93, 0.96, 0.95, 0.86, 0.69, 0.47, 0.2, 0];
/** 整组散焦 σ(px @114.2,横 / 竖):f007–f011 取 ⑦b 表的 blur/blurY,之后取 iso 副本的等效 σ */
const BLUR_X_TABLE = [3, 3, 3, 1.5, 1, 0.8, 1, 1, 1, 0.9, 0.9, 1, 0.8, 0.6, 0.2, 0];
const BLUR_Y_TABLE = [4.2, 4.2, 5, 5, 3, 2, 1, 1, 1, 0.9, 0.9, 1, 0.8, 0.6, 0.2, 0];
/** 三次项 ρ(原文 22 字口径,u 最大 10.5):首末字比中间字多外扩;f011 起 0 */
const RHO_T = [0, 1, 2, 3, 4];
const RHO_TABLE = [0.00293, 0.0018, 0.00082, 0.00029, 0];
/** 竖向放大(fix7b2_vscale.py 半高实测):f007 1.17 → f012 1,绕字行盒顶下 65.9px(0.577em) */
const SCALE_Y_T = [0, 1, 2, 3, 4, 5];
const SCALE_Y_TABLE = [1.17, 1.115, 1.0575, 1.029, 1.014, 1];
const SCALE_Y_ORIGIN_EM = 65.908 / REF_FONT;
/** 辉光核 [σ px @114.2, 系数](mo_glow_kernel.py 平台期联合 NNLS) */
const GLOW_KERNEL: Array<[number, number]> = [
  [10, 0.457],
  [20, 0.346],
  [40, 0.462],
  [80, 0.134],
];
/** 拖影:副本字距在 L(t)+0.2 ± √3·sd 内等分(= 标准差 sd 的均匀分布)。sd(px @L 31.2 口径)= burst 表各帧副本字距的加权标准差:
 *  f008–f011 约 1.2(横向拖影;f008 按实渲外沿校到 1.6),f012 起 0.2–0.5(基本是实字 + 轻微双影);f007 取辉光副本的展开 */
const TRAIL_SD_TABLE = [2.0, 2.0, 1.6, 1.24, 1.26, 1.2, 0.2, 0.36, 0.37, 0.48, 0.41, 0.41, 0.23, 0.11, 0.05, 0];
const TRAIL_BIAS = 0.2;
/** 大字落定帧(本地) */
const SETTLE = 14;
/** 副本层数只取 255 的因数:每份 1/K 是整数级 alpha,8 位合成不累积舍入(案例 11 实测) */
const LAYER_STEPS = [1, 3, 5, 15, 17, 51];

// ── 标签(label-slide-down + layout/layout-ext 实测,px @ 大字 114.2) ──
/** 下滑:f062 −84.25px → f074 0,bezier [0.35,0.65,0.70,1.0],rmse 0.12px */
const LABEL_SLIDE_FRAMES = 12;
const LABEL_FROM_PX = -84.25;
const LABEL_EASE = Easing.bezier(0.35, 0.65, 0.7, 1.0);
/** 原片标签在大字开始后 55 帧(1.83 秒)出现 —— 实际跟口播走,用 labelDelaySeconds 改 */
const LABEL_DELAY_DEFAULT_S = 55 / MEASURED_FPS;
const LABEL_GEOM = {
  fontSize: 84.78,
  scaleX: 0.7636,
  letterSpacing: 4.47,
  lineHeightEm: 0.90568,
  padTop: 14.216,
  padLeft: 19.827,
  padRight: 14.777,
  stroke: 0.5,
  /** 绿块右沿比大字字行盒右沿往里 3.9px(原片绿块右沿 1456.5;Chrome 实渲字行盒中心 960 时盒右沿 1460.4) */
  rightInset: 3.9,
  /** 裁切线比大字字行盒下沿高 3.3px(y≈586 对 589.3);绿块落定顶在行盒下沿 +0.4px */
  clipAbove: 3.3,
  restGap: 0.4,
};

/** 字宽估算(em):得意黑实测「Command Line Interface」8.76em;中文/全角按 1em */
const estimateEm = (chars: string[]): number =>
  chars.reduce((sum, ch) => {
    const c = ch.codePointAt(0) ?? 0;
    if (ch === ' ') return sum + 0.19;
    if (c > 0x2e80) return sum + 1;
    if (/[A-Z]/.test(ch)) return sum + 0.55;
    if (/[a-z]/.test(ch)) return sum + 0.4;
    if (/[0-9]/.test(ch)) return sum + 0.45;
    return sum + 0.35;
  }, 0);
/** 起始字距 = SPREAD_K × 行宽 / (n−1):按原文案标定,原文 22 字正好 31.2px */
const REF_CHARS = splitGraphemes('Command Line Interface');
const SPREAD_K = (31.2 * (REF_CHARS.length - 1)) / (estimateEm(REF_CHARS) * REF_FONT);
/** 最外字最大外移相对 L·uMax 的倍数:本地帧 0 拖影最远副本 (31.2+0.2+√3·2.0)/31.2 × 三次项 (1+0.00293·10.5²) */
const MAX_OUT_FACTOR = ((31.2 + 0.2 + Math.sqrt(3) * 2.0) / 31.2) * (1 + 0.00293 * 10.5 * 10.5);
/** maxWidthPx 模式下外扩离画面边的余量 */
const EDGE_MARGIN_PX = 40;

export type TermBurstProps = {
  /** 术语大字(单行) */
  text: string;
  /** 大字字号 px。原片 1080p 下 114.2 */
  fontSize?: number;
  /** 大字颜色 #RRGGBB。原片纯白 */
  color?: string;
  fontFamily?: string;
  fontWeight?: React.CSSProperties['fontWeight'];
  /** 字行盒中心(画面像素)。默认父容器正中;原片 (959.5, 532.2) */
  center?: { x: number; y: number };
  /** 字行最大宽度 px:估出来超了就等比缩字号;传了它还会自动收小 spread,保证冲入时两端不出画(左右留 40px) */
  maxWidthPx?: number;
  /** 速度倍率:1 = 原片(0.47 秒落定);0.7 更沉,1.3 更脆 */
  speed?: number;
  /** 收拢幅度:1 = 原片(起始行宽约 1.87 倍);0.5 冲得近一点,1.5 从更远冲进来 */
  spread?: number;
  /** 辉光强度 0–1.5:1 = 原片;0 = 不发光 */
  glow?: number;
  /** 起播延迟(帧,按当前 fps)。也可以直接套 <Sequence from> */
  delayFrames?: number;
  /** 标签文字;不给 / 空字符串 = 不要标签 */
  label?: string;
  /** 标签在大字开始后多少秒滑出。原片 1.83 秒 */
  labelDelaySeconds?: number;
  /** 标签底色。原片荧光绿 #9CFE00 */
  labelBg?: string;
  /** 标签字色。原片黑 */
  labelColor?: string;
  labelFontFamily?: string;
  labelFontWeight?: React.CSSProperties['fontWeight'];
  /** 标签横向压缩(原片 0.7636,配 IBM Plex Sans JP 的量法);换宽窄不同的字体可调 */
  labelScaleX?: number;
  /** 标签整体大小倍率(相对原片比例) */
  labelScale?: number;
  /** 标签额外下移(em,按大字字号)。原片 0;大字带 g/p/y 这类下伸字母压到标签时给 0.12 左右 */
  labelGapEm?: number;
};

/** 排片助手:大字 + (可选)标签全部落定需要的帧数 */
export const termBurstDurationInFrames = (
  fps: number,
  opts: { speed?: number; label?: boolean; labelDelaySeconds?: number } = {},
): number => {
  const speed = opts.speed ?? 1;
  const title = ((SETTLE + 1) / MEASURED_FPS / speed) * fps;
  const label = opts.label
    ? ((opts.labelDelaySeconds ?? LABEL_DELAY_DEFAULT_S) + (LABEL_SLIDE_FRAMES + 1) / MEASURED_FPS / speed) * fps
    : 0;
  return Math.ceil(Math.max(title, label));
};

export const TermBurst: React.FC<TermBurstProps> = ({
  text,
  fontSize: fontSizeIn = REF_FONT,
  color = '#FFFFFF',
  fontFamily,
  fontWeight = 400,
  center,
  maxWidthPx,
  speed = 1,
  spread = 1,
  glow = 1,
  delayFrames = 0,
  label,
  labelDelaySeconds = LABEL_DELAY_DEFAULT_S,
  labelBg = '#9CFE00',
  labelColor = '#000000',
  labelFontFamily,
  labelFontWeight = 500,
  labelScaleX = LABEL_GEOM.scaleX,
  labelScale = 1,
  labelGapEm = 0,
}) => {
  // hooks 全部放顶层,早退之前(坑 Z6)
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, '');

  const local = frame - delayFrames;
  if (local < 0) return null;
  // 本地实测帧(可带小数):换 fps / 调速都在这里折算
  const t = (local / fps) * MEASURED_FPS * speed;

  const chars = splitGraphemes(text);
  const n = Math.max(1, chars.length);
  const estEm = estimateEm(chars);
  const fontSize = maxWidthPx ? Math.min(fontSizeIn, maxWidthPx / Math.max(estEm, 0.01)) : fontSizeIn;
  const k = fontSize / REF_FONT;
  const cx = center?.x ?? width / 2;
  const cy = center?.y ?? height / 2;
  const settled = t >= SETTLE;

  // 起始字距按行宽归一:原文 31.2px;短词不至于只挪几像素、长词不至于飞出太远
  // 传了 maxWidthPx 时限制外扩:落定行宽 + 两端最大外扩 ≤ 画面(左右各留 40px),spread 自动收;不传则保持原片行为
  let spreadEff = spread;
  if (maxWidthPx && n > 1) {
    const W = estEm * fontSize;
    const halfRoom = Math.min(cx, width - cx) - EDGE_MARGIN_PX;
    // 最外字最大外移 = spread·SPREAD_K·W/2 · 拖影最远副本系数 · (1 + 三次项)
    const perSpread = (SPREAD_K * W * MAX_OUT_FACTOR) / 2;
    spreadEff = Math.max(0, Math.min(spread, (halfRoom - W / 2) / perSpread));
  }
  const Lstart = n > 1 ? (SPREAD_K * estEm * fontSize * spreadEff) / (n - 1) : 0;
  const Lat = (tt: number) => (interpolate(tt, T_AXIS, L_TABLE, clampBoth) / L_TABLE[1]) * Lstart;
  const uMax = (n - 1) / 2;
  const rho = uMax > 0 ? interpolate(t, RHO_T, RHO_TABLE, clampBoth) * (10.5 / uMax) ** 2 : 0;

  const hex = color.replace('#', '');
  const [cr, cg, cb] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

  const textStyle: React.CSSProperties = {
    fontFamily,
    fontWeight,
    fontSize,
    lineHeight: 1,
    whiteSpace: 'pre',
    fontKerning: 'none',
    fontVariantLigatures: 'none',
    WebkitFontSmoothing: 'antialiased',
  };
  // 字行盒:中心钉在 (cx, cy)。translate 不影响排版,副本和落定字共用同一个盒
  const boxStyle: React.CSSProperties = {
    ...textStyle,
    position: 'absolute',
    left: cx,
    top: cy,
    translate: '-50% -50%',
  };

  // 一行字(字距 L、三次项 rho):逐字 inline-block + translate,落定时与整行排版逐像素同位
  const line = (L: number, key: string, opacity: number) => (
    <div key={key} style={{ position: 'absolute', inset: 0, opacity, mixBlendMode: 'plus-lighter', color: '#FFFFFF' }}>
      <div style={boxStyle}>
        {chars.map((ch, i) => {
          const u = i - uMax;
          const dx = L * (u + rho * u * u * u);
          return (
            <span key={i} style={{ display: 'inline-block', whiteSpace: 'pre', translate: dx ? `${dx.toFixed(2)}px 0px` : undefined }}>
              {ch}
            </span>
          );
        })}
      </div>
    </div>
  );

  let titleNode: React.ReactNode;
  if (settled) {
    // 落定:纯字,不留 scale / filter / blend(坑 Z1)
    titleNode = <div style={{ ...boxStyle, color }}>{text}</div>;
  } else {
    const unit = Lstart / L_TABLE[1];
    const half = Math.sqrt(3) * interpolate(t, T_AXIS, TRAIL_SD_TABLE, clampBoth) * unit;
    const mid = Lat(t) + (t < 13 ? TRAIL_BIAS * unit : 0);
    const lo = Math.max(0, mid - half);
    const hi = mid + half;
    // 层数:最外字的拖影长度 / 3px(原片 f008 首末字约 60px 长)
    const need = Math.ceil(((hi - lo) * uMax * (1 + rho * uMax * uMax)) / 3) + 1;
    const layers = LAYER_STEPS.find((s) => s >= need) ?? 51;
    const stack = (prefix: string) =>
      Array.from({ length: layers }, (_, i) => {
        const L = layers === 1 ? (lo + hi) / 2 : lo + ((hi - lo) * i) / (layers - 1);
        return line(L, `${prefix}${i}`, 1 / layers);
      });
    const mass = interpolate(t, T_AXIS, MASS_TABLE, clampBoth);
    const glowAmt = interpolate(t, T_AXIS, GLOW_TABLE, clampBoth) * glow;
    const bx = interpolate(t, T_AXIS, BLUR_X_TABLE, clampBoth) * k;
    const by = interpolate(t, T_AXIS, BLUR_Y_TABLE, clampBoth) * k;
    const sy = interpolate(t, SCALE_Y_T, SCALE_Y_TABLE, clampBoth);
    const tint = `tb-tint-${uid}`;
    const fillF = `tb-fill-${uid}`;
    const tintMatrix = `0 0 0 0 ${cr.toFixed(5)} 0 0 0 0 ${cg.toFixed(5)} 0 0 0 0 ${cb.toFixed(5)} 0 0 0 1 0`;
    titleNode = (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          // 竖向放大绕字行盒里 0.577em 处(原片 y=541)
          scale: Math.abs(sy - 1) > 1e-4 ? `1 ${sy}` : undefined,
          transformOrigin: `50% ${(cy - fontSize / 2 + SCALE_Y_ORIGIN_EM * fontSize).toFixed(2)}px`,
          isolation: 'isolate',
        }}
      >
        <svg width={0} height={0} aria-hidden style={{ position: 'absolute' }}>
          <filter id={tint} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values={tintMatrix} />
          </filter>
          <filter id={fillF} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation={`${bx.toFixed(3)} ${by.toFixed(3)}`} />
            <feColorMatrix type="matrix" values={tintMatrix} />
          </filter>
        </svg>
        {/* 辉光:每个 σ 一个容器,K 份副本先叠再整体模糊一次(8 位合成不丢淡尾,案例 12 ⑦b 教训) */}
        {glowAmt > 0.002 &&
          GLOW_KERNEL.map(([s, w]) => (
            <div
              key={`g${s}`}
              style={{
                position: 'absolute',
                inset: 0,
                opacity: Math.min(1, glowAmt * w),
                mixBlendMode: 'plus-lighter',
                filter: `url(#${tint}) blur(${(s * k).toFixed(2)}px)`,
              }}
            >
              {stack(`g${s}-`)}
            </div>
          ))}
        {/* 字本体:K 份副本相加 = 横向拖影,整组再散焦一次 */}
        {mass > 0.002 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: mass,
              mixBlendMode: 'plus-lighter',
              filter: bx + by > 0.02 ? `url(#${fillF})` : `url(#${tint})`,
            }}
          >
            {stack('f')}
          </div>
        )}
      </div>
    );
  }

  // ── 标签 ──
  let labelNode: React.ReactNode = null;
  const labelT = ((local / fps - labelDelaySeconds) * MEASURED_FPS) * speed;
  if (label && labelT >= 0) {
    const g = k * labelScale;
    const labelSettled = labelT >= LABEL_SLIDE_FRAMES;
    const dy = interpolate(labelT, [0, LABEL_SLIDE_FRAMES], [LABEL_FROM_PX * g, 0], { ...clampBoth, easing: LABEL_EASE });
    const boxH = (LABEL_GEOM.padTop + LABEL_GEOM.lineHeightEm * LABEL_GEOM.fontSize) * g;
    labelNode = (
      // 锚:一个隐形的落定字行盒,只用来拿到大字的宽度,标签右沿贴它
      <div style={{ ...boxStyle, visibility: 'hidden' }}>
        {text}
        <div
          style={{
            visibility: 'visible',
            position: 'absolute',
            right: LABEL_GEOM.rightInset * k,
            top: `calc(100% - ${(LABEL_GEOM.clipAbove * k - labelGapEm * fontSize).toFixed(3)}px)`,
            height: boxH + (LABEL_GEOM.clipAbove + LABEL_GEOM.restGap + 4) * g,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              marginTop: (LABEL_GEOM.clipAbove * k + LABEL_GEOM.restGap * g).toFixed(3) + 'px',
              translate: labelSettled ? undefined : `0px ${dy.toFixed(3)}px`,
            }}
          >
            <div
              style={{
                scale: `${labelScaleX} 1`,
                transformOrigin: '100% 50%',
                background: labelBg,
                color: labelColor,
                fontFamily: labelFontFamily,
                fontWeight: labelFontWeight,
                fontSize: LABEL_GEOM.fontSize * g,
                lineHeight: LABEL_GEOM.lineHeightEm,
                letterSpacing: LABEL_GEOM.letterSpacing * g,
                paddingTop: LABEL_GEOM.padTop * g,
                paddingLeft: LABEL_GEOM.padLeft * g,
                paddingRight: LABEL_GEOM.padRight * g,
                whiteSpace: 'nowrap',
                fontKerning: 'none',
                WebkitFontSmoothing: 'antialiased',
                // 同底色细描边:把 Plex 的笔画收细到原片粗细
                WebkitTextStroke: `${(LABEL_GEOM.stroke * g).toFixed(3)}px ${labelBg}`,
              }}
            >
              {label}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {titleNode}
      {labelNode}
    </div>
  );
};
