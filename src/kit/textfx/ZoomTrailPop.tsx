/**
 * ZoomTrailPop.tsx — 「放大残影爆出」文字特效(秋芝《Codex全解》3.17s「奶妈级」实测版)。
 *
 * 出处:内部复刻案例 qz-cx-0003-behind-text(交付 11),工序④逐帧拟合。
 * 默认值 = 原片 30fps 实测曲线,不是手调;改参数前先看下面每条曲线的来源。
 *
 * 构成(两层,在 isolation 组里 plus-lighter 相加 → 叠在一起的地方自然发白,不用做变色轨):
 *   主字:0.336 → 1 带过冲缩放(峰值 ≈1.10 @ 本地 5.3 帧,9 帧落定)+ 前 3 帧 9px→0 去模糊
 *   残影:同一字形 N 份副本,缩放在 [s/√r, s·√r] 等分、每份 1/N 相加(= 径向拖影);
 *         前 5 帧贴着主字一起放大(入场发白),之后脱离、继续外冲到 1.636 倍并淡出,本地 16 帧散尽
 *
 * 用法:
 *   <Sequence from={x}>
 *     <ZoomTrailPop text="奶妈级" fontSize={608} color="#FCF7C2" fontFamily="SmileySansV1" />
 *   </Sequence>
 * 组件铺满父容器(AbsoluteFill 语义),字默认在画面正中;要换位置给 center。
 * 字多了用 maxWidthPx 自动缩字号(按字数估宽,中文准、英文偏保守)。
 */
import React from 'react';
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { splitGraphemes } from './graphemes';

const clampBoth = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 实测时基:原片 30fps。所有曲线的帧号都是「字第一次出现」为 0 的本地帧 */
const MEASURED_FPS = 30;

// ── 实测曲线(帧号 = 原片 f005 起算) ──
/** 主字缩放:f005 0.336 → f014 1,bezier 带过冲,rmse 0.004 */
const MAIN_SCALE_EASE = Easing.bezier(0.538, 1.595, 0.519, 1.102);
/** 主字去模糊:局部 9px → 0,f005–f008,rmse 0.24px */
const MAIN_BLUR_EASE = Easing.bezier(0.463, 0.001, 0.666, 0.852);
/** 残影贴主字放大:f005 0.36 → f010 1.099 */
const ECHO_FOLLOW_EASE = Easing.bezier(0.062, 0, 0.534, 0.94);
/** 残影脱离外冲:f010 ×1 → f021 ×1.636 */
const ECHO_BURST_EASE = Easing.bezier(0.035, 0.029, 0, 0.928);
/** 残影淡出:f010 1 → f021 0 */
const ECHO_FADE_EASE = Easing.bezier(0.165, 0.111, 0.52, 0.741);

/** 层数只取 255 的因数:每份 alpha 是整数级,8 位合成不累积舍入偏色(案例 11 实测) */
const LAYER_STEPS = [1, 3, 5, 15, 17, 51, 85];

export type ZoomTrailPopProps = {
  text: string;
  /** 字号 px。原片 1080p 下 608 */
  fontSize: number;
  /** 字色,必须是 #RRGGBB(残影靠它统一染色)。原片 #FCF7C2 米黄 */
  color?: string;
  fontFamily?: string;
  fontWeight?: React.CSSProperties['fontWeight'];
  /** 字距,单位 em。原片 30.86/608 ≈ 0.0507 */
  letterSpacingEm?: number;
  /** 缩放中心(画面像素)。默认父容器正中 */
  center?: { x: number; y: number };
  /** 缩放中心在字行盒中心下方多少 em。中文字形视觉中心偏下,原片得意黑实测 24.1/608 ≈ 0.04 */
  originOffsetEm?: number;
  /** 字行最大宽度 px:估出来超了就等比缩字号(字多了不出画) */
  maxWidthPx?: number;
  /** 速度倍率:1 = 原片节奏(约 0.3 秒爆完、0.53 秒残影散尽);0.7 更沉,1.3 更脆 */
  speed?: number;
  /** 残影强度 0–1:1 = 原片;0 = 只剩主字带过冲弹出 */
  echo?: number;
  /** 起播延迟(帧,按当前 fps)。也可以直接套 <Sequence from> */
  delayFrames?: number;
};

/** 残影是否还可见(本地实测帧) */
const ECHO_END = 16;
/** 主字落定帧 */
const MAIN_SETTLE = 9;

export const zoomTrailPopDurationInFrames = (fps: number, speed = 1): number =>
  Math.ceil(((ECHO_END + 1) / MEASURED_FPS / speed) * fps);

export const ZoomTrailPop: React.FC<ZoomTrailPopProps> = ({
  text,
  fontSize: fontSizeIn,
  color = '#FCF7C2',
  fontFamily,
  fontWeight = 400,
  letterSpacingEm = 0.0507,
  center,
  originOffsetEm = 0.04,
  maxWidthPx,
  speed = 1,
  echo = 1,
  delayFrames = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  // 本地实测帧(可带小数):换 fps / 调速都在这里折算
  const t = ((frame - delayFrames) / fps) * MEASURED_FPS * speed;
  if (t < 0) return null;

  const n = Math.max(1, splitGraphemes(text).length);
  const advanceEm = 1 + letterSpacingEm;
  const fontSize = maxWidthPx ? Math.min(fontSizeIn, maxWidthPx / (n * advanceEm)) : fontSizeIn;
  const cx = center?.x ?? width / 2;
  const cy = center?.y ?? height / 2;
  const originOffset = originOffsetEm * fontSize;
  const origin = `50% calc(50% + ${originOffset.toFixed(2)}px)`;

  const settled = t >= MAIN_SETTLE;
  const mainScale = interpolate(t, [0, MAIN_SETTLE], [0.336, 1], { ...clampBoth, easing: MAIN_SCALE_EASE });
  const mainBlur = interpolate(t, [0, 3], [9, 0], { ...clampBoth, easing: MAIN_BLUR_EASE });

  // 字行盒子:letter-spacing 会在末字后多留一格,用等量 padding-left 抵掉,保证视觉居中
  const lineStyle: React.CSSProperties = {
    position: 'absolute',
    left: cx,
    top: cy - originOffset,
    translate: '-50% -50%',
    whiteSpace: 'nowrap',
    fontFamily,
    fontWeight,
    fontSize,
    lineHeight: 1,
    letterSpacing: `${letterSpacingEm}em`,
    paddingLeft: `${letterSpacingEm}em`,
  };

  const echoVisible = echo > 0 && t <= ECHO_END;
  let echoNode: React.ReactNode = null;
  if (echoVisible) {
    const follow = interpolate(t, [0, 5], [0.36, 1.099], { ...clampBoth, easing: ECHO_FOLLOW_EASE });
    const burst = interpolate(t, [5, ECHO_END], [1, 1.636], { ...clampBoth, easing: ECHO_BURST_EASE });
    const fade = interpolate(t, [5, ECHO_END], [1, 0], { ...clampBoth, easing: ECHO_FADE_EASE });
    // 拖影展开比 r:贴主字段 1.06,脱离瞬间 1.31,之后线性收到 1.03(原片 f010–f020 实测)
    const spread = t < 4 ? 1.06 : interpolate(t, [4, 5, ECHO_END], [1.06, 1.31, 1.03], clampBoth);
    const s = follow * burst;
    const lo = 1 / Math.sqrt(spread);
    const hi = Math.sqrt(spread);
    // 层数按「最外圈展开像素 / 4px」自适应,半宽用字数估
    const radiusPx = (n * advanceEm * fontSize) / 2;
    const need = Math.ceil(((hi - lo) * radiusPx * s) / 4) + 1;
    const layers = LAYER_STEPS.find((k) => k >= need) ?? 85;
    const hex = color.replace('#', '');
    const [cr, cg, cb] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const filterId = `ztp-${hex}-${Math.round(fontSize)}`;
    echoNode = (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: fade * echo,
          mixBlendMode: 'plus-lighter',
          // 副本画白色、相加后统一染色:直接画彩色 1/N 副本三通道舍入不同会偏色
          filter: `url(#${filterId}) blur(${(1.8 * s).toFixed(2)}px)`,
        }}
      >
        <svg width={0} height={0} aria-hidden style={{ position: 'absolute' }}>
          <filter id={filterId} x="-150%" y="-250%" width="400%" height="600%" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values={`0 0 0 0 ${cr.toFixed(5)} 0 0 0 0 ${cg.toFixed(5)} 0 0 0 0 ${cb.toFixed(5)} 0 0 0 1 0`}
            />
          </filter>
        </svg>
        {Array.from({ length: layers }, (_, i) => {
          const q = layers === 1 ? 1 : lo + ((hi - lo) * i) / (layers - 1);
          return (
            <div
              key={i}
              style={{
                ...lineStyle,
                color: '#FFFFFF',
                opacity: 1 / layers,
                mixBlendMode: 'plus-lighter',
                scale: `${s * q}`,
                transformOrigin: origin,
              }}
            >
              {text}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0, isolation: 'isolate' }}>
      {echoNode}
      <div
        style={{
          ...lineStyle,
          color,
          mixBlendMode: echoVisible ? 'plus-lighter' : undefined,
          // 落定后清掉恒等 scale / filter(坑 Z1:残留变换会让字「呼吸」)
          scale: settled ? undefined : `${mainScale}`,
          filter: mainBlur > 0.01 ? `blur(${mainBlur.toFixed(2)}px)` : undefined,
          transformOrigin: origin,
        }}
      >
        {text}
      </div>
    </div>
  );
};
