/**
 * WordPopSequence.tsx — 「词语逐个滑入蹦出(带节奏)」文字特效
 * (秋芝《60分钟全面掌握Claude Code》231–245s 词云组装实测版)。
 *
 * 出处:内部复刻案例 qz-cc-0231-concept-assembly(交付 07),工序④逐帧拟合
 *       (specs/motion.json 的 w-*-slide / pop-rise / pop-fall / pop-recover,motion-ext.json 的逐字错峰与锚点)。
 * 默认值 = 原片 30fps 实测,不是手调;改参数前先看下面每条曲线的来源。
 *
 * 一个词的动作(本地帧 0 = 该词缩放从 0 起步那一帧;第 1 帧才看得见):
 *   整词滑入:沿词自己的字行方向,从「后面」(阅读方向那侧)滑回落点,5 帧到位,强 ease-out
 *   逐字蹦  :每个字各自 缩放 = 上冲 × 回落 × 恢复 三段相乘 → 峰值约 1.12(第 3 帧)、低谷约 0.98(第 5 帧)、第 8 帧回到 1
 *            第 i 个字晚 0.727 帧起步(小数帧错峰),锚点在字面下方 ≈ 基线,所以字是「从基线往上长」
 *   不淡入:字一出现就是实心(增益 g≈1.00)
 * 节奏(词与词之间):原片 7 个词起步帧相对首词 = 0,2,2,7,7,12,16(30fps) → 间隔 2,0,5,0,5,4 帧,
 *   有两对是同一帧一起蹦;整组 16 帧 ≈ 0.53 秒蹦完。词数超过 7 个时按这串间隔循环往后排。
 *   跟口播不是逐词对齐(原片这时念的是「那些让 Agent 最终的表现更好的设计」,词云里的词一个都没念),
 *   是一串独立的视觉鼓点;要对口播就给每个词 at(秒)。
 *
 * 用法:
 *   <Sequence from={x}>
 *     <WordPopSequence words={['工具', '审查', '上下文', '权限']} fontFamily="PangMenZhengDao" fontSize={156} squeezeX={0.615} />
 *   </Sequence>
 *   对口播:words={[{ text: '记忆', at: 0 }, { text: '工具', at: 0.42 }, ...]}(at 单位秒,相对组件起点)
 * 组件铺满父容器(AbsoluteFill 语义)。布局:cloud(原片词云落点,默认)/ row(一行居中)/ equation(X = A + B + C)/
 *   cloud 下也可给每个词 x / y / rotationDeg 自己摆;row / equation 用浏览器真实排版,间距准。
 */
import React from 'react';
import { Easing, interpolate, random, useCurrentFrame, useVideoConfig } from 'remotion';
import { splitGraphemes } from './graphemes';

const clampBoth = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 实测时基:原片 30fps。下面所有帧号都是本地帧(该词缩放起步 = 0) */
const MEASURED_FPS = 30;

type PopPreset = {
  /** 逐字错峰(帧,可小数) */
  stagger: number;
  /** 整词滑入:起止帧、起点位移(按字数折算前的「每字」位移,单位 = 字号 em)、曲线 */
  slide: { from: number; to: number; emPerChar: number; ease: (t: number) => number };
  /** 三段缩放:[起帧, 止帧, 起值, 止值, 曲线] */
  rise: [number, number, number, number, (t: number) => number];
  fall: [number, number, number, number, (t: number) => number];
  recover: [number, number, number, number, (t: number) => number];
};

/**
 * 两字词预设(工具/审查/权限/规划/记忆/沙盒 6 个词逐帧一致到 ±0.6px,同一预设)。
 * 滑入:du 160.6px @156px 字号(= 1.0295em,两字 → 每字 0.5147em),f0→f5,bezier rmse 0.10px
 * 上冲:0 → 1.157,f0→f3;回落:×1 → ×0.847,f2→f5;恢复:×1 → ×1.02043,f5→f8(模型 rmse 0.0003)
 */
const PRESET_2: PopPreset = {
  stagger: 0.7273,
  slide: { from: 0, to: 5, emPerChar: 160.6 / 156 / 2, ease: Easing.bezier(0.2316, 0.8213, 0.2166, 1) },
  rise: [0, 3, 0, 1.157, Easing.bezier(0.4239, 0.0071, 0.0889, 1)],
  fall: [2, 5, 1, 0.847, Easing.bezier(0.5518, 0.3458, 0.7419, 1)],
  recover: [5, 8, 1, 1.02043, Easing.bezier(0.3433, 0, 0.7251, 0.8961)],
};

/**
 * 三字词预设(上下文):滑入更早起步(本地 −2 帧,看不见的那两帧也在走)、位移按字数放大 315.1px,
 * 上冲峰更高(1.1768)、回落更深(0.832);错峰 0.6423 帧。四字及以上沿用本预设、位移按字数折算。
 */
const PRESET_3: PopPreset = {
  stagger: 0.6423,
  slide: { from: -2, to: 5, emPerChar: 315.07 / 156 / 3, ease: Easing.bezier(0.6698, 0.4366, 0.0868, 0.9983) },
  rise: [0, 3, 0, 1.1768, Easing.bezier(0.4217, 0, 0.0286, 0.9749)],
  fall: [2, 5, 1, 0.832, Easing.bezier(0.8084, 1, 0.709, 0.9893)],
  recover: [5, 8, 1, 1.021349, Easing.bezier(0.7229, 1, 0.7334, 1)],
};

/** 字的缩放锚点:字行盒(行高 1)里横向居中、竖向 75.58% 处 ≈ 基线(实测 dv≈0 反推) */
const CHAR_ORIGIN = '50% 75.58%';
/** 一个字蹦完的本地帧(8 帧恢复到 1) */
const POP_SETTLE = 8;

/** 原片节奏:7 个词的起步帧相对首词(30fps),顺序 工具 / 审查 / 上下文 / 权限 / 规划 / 记忆 / 沙盒 */
export const MEASURED_WORD_OFFSETS = [0, 2, 2, 7, 7, 12, 16];
/** 相邻词间隔(帧,30fps),超过 7 个词时循环使用 */
const MEASURED_GAPS = [2, 0, 5, 0, 5, 4];

/**
 * 原片词云落点(1080p 画布,出现顺序):中心点 + 倾角(度,CSS 正 = 顺时针)。
 * 来自 specs/layout.json 元素框中心 + layout-ext.json rotationDeg(质心误差 ≤0.71px)。
 */
export const MEASURED_CLOUD_SLOTS: Array<{ x: number; y: number; rotationDeg: number }> = [
  { x: 619.2, y: 549.2, rotationDeg: -14.6 }, // 工具
  { x: 1282.6, y: 540.8, rotationDeg: 35.6 }, // 审查
  { x: 874.5, y: 770.1, rotationDeg: 0 }, // 上下文
  { x: 1465.3, y: 351.7, rotationDeg: 22.1 }, // 权限
  { x: 1399.3, y: 785.7, rotationDeg: -9.5 }, // 规划
  { x: 448.0, y: 358.0, rotationDeg: -19.2 }, // 记忆
  { x: 437.0, y: 754.7, rotationDeg: 12.6 }, // 沙盒
];

/** 第 8–12 个词:原片卡片里没被占的空位(手挑,不是实测) */
const EXTRA_CLOUD_SLOTS: Array<{ x: number; y: number; rotationDeg: number }> = [
  { x: 960, y: 250, rotationDeg: -6 }, // 大模型框正上方
  { x: 1640, y: 590, rotationDeg: -12 }, // 右中
  { x: 300, y: 560, rotationDeg: 10 }, // 左中
  { x: 1150, y: 885, rotationDeg: 6 }, // 下方偏右
  { x: 690, y: 235, rotationDeg: 8 }, // 上方偏左
];

export type WordPopItem = {
  text: string;
  /** 这个词起蹦的时刻(秒,相对组件起点)。不给 = 接上一个词按节奏排 */
  at?: number;
  /** 自定落点(画布像素,词中心,只在 cloud 布局生效)。不给 = 按 layout 算 */
  x?: number;
  y?: number;
  rotationDeg?: number;
  color?: string;
};

export type WordPopSequenceProps = {
  /** 词表(任意个数)。字符串或带 at / 落点的对象 */
  words: Array<string | WordPopItem>;
  /** 字号 px。原片 1080p 下 156 */
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: React.CSSProperties['fontWeight'];
  color?: string;
  /** 字距,单位 em。原片 12.5/156 ≈ 0.080 */
  letterSpacingEm?: number;
  /** 横向压扁(1 = 不压)。原片词云字形是窄字,替身庞门正道要压到 0.615 才对得上字宽 */
  squeezeX?: number;
  /** 布局:cloud = 原片词云落点(第 8–12 个用卡片空位,再多外圈补位)/ row = 一行居中 / equation = X = A + B + C(首个词当 X) */
  layout?: 'cloud' | 'row' | 'equation';
  /** cloud / row / equation 的中心点。cloud 以原片卡片中心 (960,540) 为基准整体平移 */
  center?: { x: number; y: number };
  /** row / equation 模式词与词(含符号)之间的空隙,单位 em */
  gapEm?: number;
  /** equation 模式符号颜色 */
  symbolColor?: string;
  /** 节奏:measured = 原片间隔 2,0,5,0,5,4 帧循环;even = 每个词等距 evenGapSeconds */
  rhythm?: 'measured' | 'even';
  /** even 模式间隔(秒)。默认 4/30 ≈ 0.133(原片「有间隔的那几拍」平均 4 帧) */
  evenGapSeconds?: number;
  /** 节奏快慢:词与词的间隔 ÷ tempo。1 = 原片;0.5 = 间隔拉长一倍(更松);2 = 更密 */
  tempo?: number;
  /** 单个词动作的速度:1 = 原片(约 0.27 秒蹦完);0.7 更软,1.3 更脆 */
  speed?: number;
  /** 滑入距离倍率:1 = 原片;0 = 原地蹦 */
  slide?: number;
  /** 蹦的力度倍率:1 = 原片(峰值约 1.12);0 = 只从 0 长到 1 不过冲 */
  bounce?: number;
  /** cloud 超过 12 个词时外圈补位的随机种子 */
  seed?: string;
  /** 起播延迟(帧,按当前 fps)。也可以直接套 <Sequence from> */
  delayFrames?: number;
};


/** 把实测三段缩放在本地帧 t 上取值(相乘) */
const popScale = (p: PopPreset, t: number, bounce: number) => {
  const seg = ([a, b, v0, v1, ease]: PopPreset['rise'], x: number) =>
    interpolate(x, [a, b], [v0, v1], { ...clampBoth, easing: ease });
  const rise = seg(p.rise, t);
  const fall = seg(p.fall, t);
  const recover = seg(p.recover, t);
  const full = rise * fall * recover;
  if (bounce === 1) return full;
  // 力度倍率:只缩放「偏离单调长大」的部分;0 = 纯 0→1(用上冲曲线归一)
  const plain = rise / p.rise[3];
  return plain + (full - plain) * bounce;
};

type Resolved = {
  chars: string[];
  preset: PopPreset;
  startSec: number;
  x: number;
  y: number;
  rotationDeg: number;
  color?: string;
};

/** 算每个词的起蹦时刻(秒)。纯函数,可在出片层排时长用 */
export const wordPopStartTimes = (
  words: Array<string | WordPopItem>,
  opts: { rhythm?: 'measured' | 'even'; evenGapSeconds?: number; tempo?: number } = {},
): number[] => {
  const { rhythm = 'measured', evenGapSeconds = 4 / MEASURED_FPS, tempo = 1 } = opts;
  const out: number[] = [];
  words.forEach((w, i) => {
    const at = typeof w === 'string' ? undefined : w.at;
    if (at !== undefined) out.push(at);
    else if (i === 0) out.push(0);
    else {
      const gap = rhythm === 'even' ? evenGapSeconds : MEASURED_GAPS[(i - 1) % MEASURED_GAPS.length] / MEASURED_FPS;
      out.push(out[i - 1] + gap / tempo);
    }
  });
  return out;
};

/** 整组蹦完需要多少帧(最后一个词起蹦 + 逐字错峰 + 8 帧恢复) */
export const wordPopSequenceDurationInFrames = (
  words: Array<string | WordPopItem>,
  fps: number,
  opts: { rhythm?: 'measured' | 'even'; evenGapSeconds?: number; tempo?: number; speed?: number } = {},
): number => {
  const starts = wordPopStartTimes(words, opts);
  const speed = opts.speed ?? 1;
  let end = 0;
  words.forEach((w, i) => {
    const n = splitGraphemes(typeof w === 'string' ? w : w.text).length;
    const p = n >= 3 ? PRESET_3 : PRESET_2;
    end = Math.max(end, starts[i] + (POP_SETTLE + p.stagger * Math.max(0, n - 1)) / MEASURED_FPS / speed);
  });
  return Math.ceil(end * fps) + 1;
};

export const WordPopSequence: React.FC<WordPopSequenceProps> = ({
  words,
  fontSize = 156,
  fontFamily,
  fontWeight = 400,
  color = '#FFFFFF',
  letterSpacingEm = 12.5 / 156,
  squeezeX = 1,
  layout = 'cloud',
  center,
  gapEm = 0.35,
  symbolColor,
  rhythm = 'measured',
  evenGapSeconds,
  tempo = 1,
  speed = 1,
  slide = 1,
  bounce = 1,
  seed = 'word-pop',
  delayFrames = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const cx = center?.x ?? width / 2;
  const cy = center?.y ?? height / 2;

  const items = words.map((w) => (typeof w === 'string' ? { text: w } : w));
  const starts = wordPopStartTimes(items, { rhythm, evenGapSeconds, tempo });

  // ── 单个词(或符号)的画法:整词滑入 + 逐字蹦。本地帧 t ≤ 0 时字缩放为 0(占位不可见) ──
  const renderWord = (r: Resolved, key: React.Key, mode: 'free' | 'flex') => {
    // 本地实测帧(可带小数):换 fps / 调速都在这里折算
    const t = ((frame - delayFrames) / fps - r.startSec) * MEASURED_FPS * speed;
    if (t <= 0 && mode === 'free') return null;
    const n = r.chars.length;
    const p = r.preset;
    const settleAll = POP_SETTLE + p.stagger * (n - 1);
    const du =
      t >= p.slide.to || t <= 0
        ? 0
        : interpolate(t, [p.slide.from, p.slide.to], [p.slide.emPerChar * n * fontSize * slide, 0], {
            ...clampBoth,
            easing: p.slide.ease,
          });
    const spans = r.chars.map((ch, i) => {
      const ti = t - i * p.stagger;
      // 落定后不挂变换(坑 Z1:残留恒等 scale 会让字「呼吸」)
      const sc = t >= settleAll ? 1 : popScale(p, ti, bounce);
      return (
        <span
          key={i}
          style={{
            display: 'inline-block',
            marginRight: i < n - 1 ? `${letterSpacingEm}em` : 0,
            scale: Math.abs(sc - 1) > 1e-4 ? `${Math.max(0, sc)}` : undefined,
            transformOrigin: CHAR_ORIGIN,
          }}
        >
          {ch}
        </span>
      );
    });
    const textStyle: React.CSSProperties = { whiteSpace: 'pre', fontFamily, fontWeight, lineHeight: 1, color: r.color ?? color };
    if (mode === 'flex') {
      // 一行排版:按压扁后的字号排(占位宽 = 实际看到的宽),再竖向拉回 1/squeezeX → 字形与横压完全等价、间距真实
      return (
        <div key={key} style={{ rotate: r.rotationDeg ? `${r.rotationDeg}deg` : undefined, translate: du ? `${du.toFixed(3)}px 0px` : undefined }}>
          <div style={{ ...textStyle, fontSize: fontSize * squeezeX, scale: squeezeX !== 1 ? `1 ${1 / squeezeX}` : undefined }}>{spans}</div>
        </div>
      );
    }
    return (
      <div
        key={key}
        style={{
          position: 'absolute',
          left: r.x,
          top: r.y,
          width: 0,
          height: 0,
          // 倾角静态;滑入沿词自己的字行方向(先转后移 = 局部 u 轴)
          rotate: r.rotationDeg ? `${r.rotationDeg}deg` : undefined,
        }}
      >
        <div
          style={{
            ...textStyle,
            position: 'absolute',
            left: 0,
            top: 0,
            fontSize,
            translate: du ? `calc(-50% + ${du.toFixed(3)}px) -50%` : '-50% -50%',
            scale: squeezeX !== 1 ? `${squeezeX} 1` : undefined,
          }}
        >
          {spans}
        </div>
      </div>
    );
  };

  const presetOf = (n: number) => (n >= 3 ? PRESET_3 : PRESET_2);

  if (layout === 'row' || layout === 'equation') {
    // 一行排开(浏览器真实排版,中英混排间距准):equation 在首词后插「=」,其余词之间插「+」;符号跟右边那个词一起蹦
    const toks: Resolved[] = [];
    items.forEach((w, i) => {
      if (layout === 'equation' && i >= 1) {
        toks.push({ chars: [i === 1 ? '=' : '+'], preset: PRESET_2, startSec: starts[i], x: 0, y: 0, rotationDeg: 0, color: symbolColor ?? color });
      }
      const chars = splitGraphemes(w.text);
      toks.push({ chars, preset: presetOf(chars.length), startSec: starts[i], x: 0, y: 0, rotationDeg: w.rotationDeg ?? 0, color: w.color });
    });
    return (
      <div style={{ position: 'absolute', inset: 0 }}>
        <div
          style={{
            position: 'absolute',
            left: cx,
            top: cy,
            translate: '-50% -50%',
            display: 'flex',
            alignItems: 'center',
            gap: gapEm * fontSize,
          }}
        >
          {toks.map((r, k) => renderWord(r, k, 'flex'))}
        </div>
      </div>
    );
  }

  // cloud:前 7 个用原片落点,8–12 个用原片卡片里的空位,再多在外圈椭圆补位;整体按原片卡片中心 (960,540) 平移到 center
  const resolved: Resolved[] = items.map((w, i) => {
    const chars = splitGraphemes(w.text);
    let slot = MEASURED_CLOUD_SLOTS[i] ?? EXTRA_CLOUD_SLOTS[i - MEASURED_CLOUD_SLOTS.length];
    if (!slot) {
      const k = i - MEASURED_CLOUD_SLOTS.length - EXTRA_CLOUD_SLOTS.length;
      const ang = (k * 137.5 * Math.PI) / 180 + (random(`${seed}-a-${k}`) - 0.5) * 0.3;
      slot = { x: 960 + Math.cos(ang) * 820, y: 540 + Math.sin(ang) * 400, rotationDeg: Math.round((random(`${seed}-r-${k}`) - 0.5) * 40) };
    }
    return {
      chars,
      preset: presetOf(chars.length),
      startSec: starts[i],
      x: w.x ?? slot.x - 960 + cx,
      y: w.y ?? slot.y - 540 + cy,
      rotationDeg: w.rotationDeg ?? slot.rotationDeg,
      color: w.color,
    };
  });

  return <div style={{ position: 'absolute', inset: 0 }}>{resolved.map((r, idx) => renderWord(r, idx, 'free'))}</div>;
};
