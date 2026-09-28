/**
 * CharFlickerIn.tsx — 「逐字模糊闪入」文字特效(秋芝《Codex全解》右下角「0基础系统教程」实测版)。
 *
 * 出处:内部复刻案例 qz-cx-0003-behind-text(交付 11),工序④ mo_tag_flicker4 逐帧逐字拟合,
 *       ⑦b 第 2 轮在修好的底上重拟合。原片 f043 第一次出现 → f057 落定,闪烁共 14 帧(30fps,约 0.47 秒)。
 *       逐字表 = specs/motion-ext.json 的 tag-0jichu(g/s/dx)+ tag-0jichu-glow(o/sigma),下面 MEASURED 原样搬来。
 *
 * 每个字每帧由三层叠成(从下往上):
 *   白光:同字形高斯模糊 σ,强度 o(>1 = 叠 ceil(o) 份相加 → 过曝),plus-lighter 加到底上
 *   投影:只画投影(黑,外扩→平移→高斯→限幅),不透明度 s —— 它压在光上,所以原片的字看着是「空心发光」
 *   白字:清晰白字,不透明度 g
 *   三层一起水平偏移 dx。落定后回到整行静态字 + 投影,清掉所有逐字 span/滤镜(坑 Z1)。
 *
 * 规律(从 7 字表总结,generated 模式就按它生成):
 *   · 没有从左到右的错开:7 个字同一帧一起开始,「随机感」全靠每个字各自的明暗/糊清。
 *   · 第 0–1 帧:只有淡光团(o 0.05–1.6,σ 8–35),白字几乎不出现,字左右晃(|dx| 平均 9→5 px)。
 *   · 第 2–7 帧:乱闪期。每帧约 1/7–5/7 的字白字亮起(g>0.5),每个字在这 6 帧里亮灭 2–4 次;
 *               白光 o 0.2–2.5 忽强忽弱,σ 多在 6–10,偶尔某字一帧糊成 σ 20–35 的大光团;dx 收到 1–2 px。
 *   · 第 8–13 帧:收拢期。白字基本常亮(g 均值 0.72→0.96),投影线性长回来(s 0.27→0.89),
 *               白光按 1.1→0.06 退掉,dx≈0。第 14 帧(f057)落定。
 *   generated 模式:乱闪期每个字每帧从原片「同一帧」7 个字里随机抽一格(g/s/o/σ/dx 整格一起抽,保留它们之间的关联);
 *   收拢期每个字固定跟随原片某一个字的收拢轨迹(平滑不跳),再加 ±10% 的小扰动免得两个字一模一样。
 *   随机数一律 Remotion random(seed),同一个 seed 永远同一种闪法。
 *
 * 用法:
 *   <Sequence from={x}>
 *     <CharFlickerIn text="0基础系统教程" fontFamily="SmileySansV1" />   // 默认 = 原片位置/字号(1080p 右下角)
 *   </Sequence>
 * 组件铺满父容器;位置用 anchor(字行盒顶边上的一点)+ align(这个点是字行的左端/中点/右端)。
 */
import React from 'react';
import { random, useCurrentFrame, useVideoConfig } from 'remotion';
import { splitGraphemes } from './graphemes';

/** 实测时基:原片 30fps。帧号 = 「字第一次出现(f043)」为 0 的本地帧 */
const MEASURED_FPS = 30;
/** 原片字号(1080p):基→程 5 个步进 476.1px = 5×0.8em → 119px。σ、dx、投影都按它等比缩放 */
const MEASURED_FONT_SIZE = 119;
/** 闪烁帧数:本地 0–13 查表,14 起落定 */
const FLICKER_FRAMES = 14;
/** 第 0–7 帧乱闪(每帧随机抽格),第 8 帧起收拢(每字固定一条轨迹) */
const CHAOS_END = 7;

/** 一格 = [g 白字不透明度, s 投影不透明度, o 白光强度, sigma 白光高斯 px, dx 水平偏移 px] */
type Cell = readonly [number, number, number, number, number];

/** 原片逐字表(f043–f056 × 7 字「0基础系统教程」),来源见文件头 */
const MEASURED: readonly (readonly Cell[])[] = [
  [[0, 0.228, 0.792, 9.99, -0.74], [0.013, 0.034, 0.052, 35, 15], [0.051, 0, 0.307, 35, 15], [0, 0.2, 0.526, 12.6, 14.83], [0, 0, 0.278, 15.82, -0.01], [0.05, 0.035, 0.339, 22.3, 8.58], [0, 0.13, 0.261, 9.9, 6.92]],
  [[0, 0.065, 1.624, 8.22, -1.95], [0.057, 0.28, 0.553, 10.2, 14.82], [0.135, 0.2, 1.282, 6.99, 3.26], [0, 0.286, 2.492, 6.13, -0.62], [0.211, 0, 0.803, 28.06, -8.75], [0.098, 0, 0.483, 21.34, 3.72], [0.098, 0.373, 1.225, 8.52, 3.55]],
  [[0, 0.055, 1.192, 10.73, -2.47], [0.87, 0.058, 2.42, 7.37, 2.92], [0.042, 0.172, 1.693, 6.94, 1.59], [1, 0.093, 2.326, 7.56, 1.12], [1, 0.01, 2.5, 8.26, 0.94], [0.12, 0, 0.37, 27.86, 0.69], [0.376, 0.305, 2.22, 6.25, 2.77]],
  [[0.565, 0.014, 2.028, 8.31, -0.91], [0, 0.25, 1.361, 9.68, 4.59], [0.839, 0.083, 2.222, 8.44, 1.21], [0.553, 0.14, 1.992, 6.61, 1.86], [1, 0.02, 2.498, 7.85, 0.63], [0.847, 0.08, 2.5, 7.04, 0.68], [0.209, 0.269, 1.159, 7.87, 1.74]],
  [[0, 0.261, 1.986, 7.2, -1.71], [1, 0.046, 2.5, 6.75, 1.73], [0.048, 0, 0.346, 30.55, 5.11], [0, 0.1, 0.288, 21.98, 15], [0, 0.231, 1.899, 7.13, 1.95], [0.215, 0.343, 1.429, 7.02, 0.67], [0.011, 0, 0.161, 14.43, -5.25]],
  [[0.619, 0.089, 1.27, 8.48, 0.28], [0.11, 0.199, 1.123, 6.1, 1.1], [0.28, 0, 0.702, 22.33, 1.21], [0.982, 0.005, 2.5, 7.64, 0.89], [0.078, 0.04, 0.541, 9.31, 1.91], [0.615, 0.3, 1.616, 6.75, 0.63], [0.76, 0, 1.36, 7.74, 0.64]],
  [[0, 0.193, 0.584, 10.26, 0.48], [0.756, 0.114, 1.784, 6.78, 2.44], [0.185, 0.282, 1.372, 6.06, 2.12], [0.474, 0.22, 1.688, 6.81, 1.05], [0.918, 0.11, 2.041, 5.46, 0.79], [0.303, 0, 0.475, 34.38, 0.51], [0.635, 0, 1.157, 7.21, 0.57]],
  [[1, 0.261, 1.648, 6.06, 0.53], [0, 0.256, 1.378, 5.64, 0.84], [0.034, 0.309, 0.708, 7.15, 3.3], [0, 0.349, 1.703, 5.45, 1.07], [0.083, 0.267, 1.658, 5.63, 0.77], [0.028, 0.263, 0.427, 8.85, 2.91], [0.874, 0.214, 2.074, 5.78, 0.56]],
  [[1, 0.253, 2.5, 3.81, -0.38], [0.9, 0.357, 0.867, 6.82, 0.02], [0.966, 0.399, 1.328, 6.17, 0.11], [0.387, 0.135, 0.538, 7.41, -0.01], [0.781, 0.317, 1.253, 6.15, 0.08], [0.804, 0.402, 1.003, 7.01, 0.07], [0.18, 0, 0.338, 8.86, -0.05]],
  [[0.978, 0.513, 1.041, 6.03, 0.24], [1, 0.479, 1.16, 5.68, -0.12], [0.825, 0.438, 0.985, 5.93, 0.05], [0.928, 0.313, 0.903, 4.88, -0.05], [0.582, 0.307, 0.862, 6.98, -0.01], [0.75, 0.454, 0.992, 6.1, 0.08], [0.392, 0.264, 0.792, 6.63, -0.05]],
  [[1, 0.605, 0.698, 5.43, -0.07], [1, 0.623, 0.809, 6.01, -0.09], [0.969, 0.51, 0.683, 6.31, 0.03], [0.896, 0.454, 0.608, 5.07, -0.05], [0.621, 0.414, 0.575, 5.87, -0.02], [0.835, 0.528, 1.001, 4.94, 0.03], [0.793, 0.382, 0.914, 5.56, -0.06]],
  [[1, 0.687, 0.381, 5.82, -0.06], [1, 0.716, 0.527, 6.31, -0.07], [0.983, 0.62, 0.285, 6.49, 0.02], [1, 0.623, 0.395, 4.52, -0.07], [0.985, 0.617, 0.472, 3.75, -0.04], [0.605, 0.473, 0.35, 4.22, 0.01], [0.616, 0.4, 0.316, 5.34, -0.07]],
  [[1, 0.792, 0.253, 6.2, -0.07], [1, 0.802, 0.404, 6.87, -0.06], [0.975, 0.723, 0.173, 6.42, 0.01], [0.958, 0.673, 0, 0.97, -0.04], [0.971, 0.678, 0, 1.32, -0.04], [0.719, 0.549, 0, 0.65, 0.03], [0.615, 0.433, 0.349, 3.24, -0.06]],
  [[1, 0.911, 0.125, 7.2, -0.06], [1, 0.909, 0.274, 7.56, -0.06], [0.953, 0.857, 0, 0.95, 0], [0.944, 0.864, 0, 0.68, -0.01], [0.967, 0.851, 0, 0.98, -0.02], [0.97, 0.958, 0, 0.58, 0.01], [0.89, 0.912, 0, 0.52, 0.01]],
];
const MEASURED_CHARS = 7;

/** 投影(原片 f057–f092 拟合):黑,s = min(0.85, Blur_σ3.5(平移(4.5,4.5)(外扩 3px 字形))) @119px */
const SHADOW = { dilatePx: 3, dx: 4.5, dy: 4.5, sigmaPx: 3.5, maxAlpha: 0.85, gain: 1, color: '#000000' } as const;

export type CharFlickerMode = 'auto' | 'exact' | 'generated';

export type CharFlickerInProps = {
  text: string;
  /** 字号 px。原片 1080p 下 119 */
  fontSize?: number;
  /** 字色(白光同色)。原片纯白 */
  color?: string;
  fontFamily?: string;
  fontWeight?: React.CSSProperties['fontWeight'];
  /** 字行盒顶边上的定位点(画面像素)。默认 = 原片右下角:右端 x 1895.3、顶 y 834.07 */
  anchor?: { x: number; y: number };
  /** anchor 是字行的哪一端。原片右对齐(字多往左长) */
  align?: 'left' | 'center' | 'right';
  /** 字行最大宽度 px:估出来超了就等比缩字号(中文按 1em、西文按 0.55em 估) */
  maxWidthPx?: number;
  /** 'exact' = 原片 7 字实测表(字数不是 7 时自动退回 generated);'generated' = 按规律随机生成;'auto' = 7 字用 exact,否则 generated */
  mode?: CharFlickerMode;
  /** 随机种子:换一个就换一种闪法,同一个永远一样 */
  seed?: string | number;
  /** 速度倍率:1 = 原片(约 0.47 秒闪完);0.6 更慢更看得清,1.5 更急 */
  speed?: number;
  /** 白光强度倍率:1 = 原片;0 = 不发光只闪字 */
  glow?: number;
  /** 左右晃动倍率:1 = 原片;0 = 不晃 */
  jitter?: number;
  /** 是否带投影(原片有) */
  shadow?: boolean;
  /** 起播延迟(帧,按当前 fps)。也可以直接套 <Sequence from> */
  delayFrames?: number;
};

export const charFlickerInDurationInFrames = (fps: number, speed = 1): number =>
  Math.ceil((FLICKER_FRAMES / MEASURED_FPS / speed) * fps);

const isNarrow = (g: string) => /^[\x20-\x7E]$/.test(g);

/** 取第 i 个字在本地第 k 帧的一格参数 */
const cellAt = (useExact: boolean, seed: string | number, i: number, k: number): Cell => {
  const row = MEASURED[k];
  if (useExact) return row[i];
  if (k <= CHAOS_END) {
    const src = Math.min(MEASURED_CHARS - 1, Math.floor(random(`cfi|${seed}|a|${i}|${k}`) * MEASURED_CHARS));
    return row[src];
  }
  const src = Math.min(MEASURED_CHARS - 1, Math.floor(random(`cfi|${seed}|b|${i}`) * MEASURED_CHARS));
  const [g, s, o, sigma, dx] = row[src];
  const wob = 0.9 + 0.2 * random(`cfi|${seed}|w|${i}|${k}`);
  return [Math.min(1, g * wob), Math.min(1, s * wob), o * wob, sigma, dx];
};

const shadowTable = () =>
  Array.from({ length: 41 }, (_, i) => Math.min(SHADOW.maxAlpha, SHADOW.gain * (i / 40)))
    .map((v) => v.toFixed(4))
    .join(' ');

/** 投影滤镜两份:整行静态(投影+原字)/ 逐字(只投影) */
const ShadowDefs: React.FC<{ id: string; k: number }> = ({ id, k }) => {
  const body = (
    <>
      <feMorphology in="SourceAlpha" operator="dilate" radius={SHADOW.dilatePx * k} result="dilated" />
      <feOffset in="dilated" dx={SHADOW.dx * k} dy={SHADOW.dy * k} result="shifted" />
      <feGaussianBlur in="shifted" stdDeviation={SHADOW.sigmaPx * k} result="blurred" />
      <feComponentTransfer in="blurred" result="alpha">
        <feFuncA type="table" tableValues={shadowTable()} />
      </feComponentTransfer>
      <feFlood floodColor={SHADOW.color} result="ink" />
      <feComposite in="ink" in2="alpha" operator="in" result="shadow" />
    </>
  );
  return (
    <svg width={0} height={0} aria-hidden style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
      <defs>
        <filter id={id} x="-15%" y="-60%" width="130%" height="220%" colorInterpolationFilters="sRGB">
          {body}
          <feMerge>
            <feMergeNode in="shadow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${id}-only`} x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
          {body}
        </filter>
      </defs>
    </svg>
  );
};

export const CharFlickerIn: React.FC<CharFlickerInProps> = ({
  text,
  fontSize: fontSizeIn = MEASURED_FONT_SIZE,
  color = '#FFFFFF',
  fontFamily,
  fontWeight = 400,
  anchor = { x: 1895.31, y: 834.07 },
  align = 'right',
  maxWidthPx,
  mode = 'auto',
  seed = 0,
  speed = 1,
  glow = 1,
  jitter = 1,
  shadow = true,
  delayFrames = 0,
}) => {
  // hooks 全在顶层、早退之前(坑 Z6)
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = ((frame - delayFrames) / fps) * MEASURED_FPS * speed;
  if (t < 0) return null;
  // 闪烁是逐帧离散的(原片每帧一张新表),本地帧取整;调速/换 fps 时一格会停留多帧或跳格
  const k = Math.floor(t + 1e-6);
  const settled = k >= FLICKER_FRAMES;

  const chars = splitGraphemes(text);
  const n = chars.length;
  const estWidthEm = chars.reduce((w, g) => w + (isNarrow(g) ? 0.55 : 1), 0);
  const fontSize = maxWidthPx ? Math.min(fontSizeIn, maxWidthPx / Math.max(estWidthEm, 1)) : fontSizeIn;
  const scaleK = fontSize / MEASURED_FONT_SIZE;
  const useExact = (mode === 'exact' || mode === 'auto') && n === MEASURED_CHARS;
  const filterId = `cfi-shadow-${Math.round(fontSize * 100)}`;

  const lineStyle: React.CSSProperties = {
    position: 'absolute',
    top: anchor.y,
    left: anchor.x,
    // 定位用的恒定平移(不随帧变),不会让字「呼吸」
    translate: align === 'right' ? '-100% 0' : align === 'center' ? '-50% 0' : undefined,
    whiteSpace: 'nowrap',
    fontFamily,
    fontWeight,
    fontSize,
    lineHeight: 1,
    letterSpacing: 0,
    color,
    // 原片剪映不做字偶距;macOS Chrome 默认 CoreText 会把字形外扩约 0.35px(案例 11 静帧门实测)
    fontKerning: 'none',
    WebkitFontSmoothing: 'antialiased',
  };
  const glyphOf = (g: string) => (g === ' ' ? ' ' : g);

  if (settled) {
    return (
      <div style={{ position: 'absolute', inset: 0 }}>
        {shadow ? <ShadowDefs id={filterId} k={scaleK} /> : null}
        <div style={{ ...lineStyle, filter: shadow ? `url(#${filterId})` : undefined }}>{text}</div>
      </div>
    );
  }

  const cells = chars.map((_, i) => cellAt(useExact, seed, i, k));
  const shiftOf = (dx: number) => {
    const px = dx * jitter * scaleK;
    return Math.abs(px) > 0.005 ? `${px.toFixed(2)}px 0px` : undefined;
  };

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {shadow ? <ShadowDefs id={filterId} k={scaleK} /> : null}
      {/* 白光层:整层 plus-lighter 加到底上(不能给父级加 isolation/opacity/filter,否则就不是加在画面上了) */}
      {glow > 0 ? (
        <div style={{ ...lineStyle, mixBlendMode: 'plus-lighter', isolation: 'isolate' }}>
          {chars.map((g, i) => {
            const [, , o, sigma, dx] = cells[i];
            const strength = Math.max(0, o * glow);
            const draw = g !== ' ' && strength > 0.001 && sigma >= 1.5;
            const reps = Math.max(1, Math.ceil(strength - 1e-6));
            return (
              <span key={i} style={{ display: 'inline-block', position: 'relative', whiteSpace: 'pre', translate: shiftOf(dx) }}>
                {Array.from({ length: reps }, (__, r) => (
                  <span
                    key={r}
                    style={{
                      display: 'inline-block',
                      position: r === 0 ? 'relative' : 'absolute',
                      left: 0,
                      top: 0,
                      opacity: draw ? strength / reps : 0,
                      filter: draw ? `blur(${(sigma * scaleK).toFixed(2)}px)` : undefined,
                      mixBlendMode: 'plus-lighter',
                    }}
                  >
                    {glyphOf(g)}
                  </span>
                ))}
              </span>
            );
          })}
        </div>
      ) : null}
      {/* 清晰层:每字「只投影」副本(s)+ 白字(g);元素级投影这时关掉 */}
      <div style={lineStyle}>
        {chars.map((g, i) => {
          const [gv, sv, , , dx] = cells[i];
          return (
            <span key={i} style={{ display: 'inline-block', position: 'relative', whiteSpace: 'pre', translate: shiftOf(dx) }}>
              <span
                style={{
                  display: 'inline-block',
                  opacity: shadow ? Math.max(0, Math.min(1, sv)) : 0,
                  filter: shadow ? `url(#${filterId}-only)` : undefined,
                }}
              >
                {glyphOf(g)}
              </span>
              <span style={{ display: 'inline-block', position: 'absolute', left: 0, top: 0, opacity: Math.max(0, Math.min(1, gv)) }}>
                {glyphOf(g)}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
};
