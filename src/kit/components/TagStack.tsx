/**
 * TagStack.tsx — 「关键词色块标签逐个堆叠」镜头模板(秋芝《Claude Code 全解》4:56「写文案 / 查资料 / … / 写报告」实测版)。
 *
 * 出处:内部复刻案例 qz-cc-0296-tag-stack(交付 21),工序④逐帧实测 + 拟合;普查类别 B3。
 * 默认值 = 原片 30fps 实测曲线与 1080p 几何,不是手调;改参数前先看下面每条常量的来源。
 *
 * 结构 = 「主体槽位 + 标签堆」:
 *   主体槽位 subject:任意 React 节点(OffthreadVideo / Img / 假界面 / 人像),
 *     subjectLayout='full' 铺满全屏(原片:AI 视频全屏,标签压在右侧暗渐变上);
 *     subjectLayout='panel' 放进一侧的圆角面板(人物 / 截图 / AI 视频在左,标签在右)。
 *     subjectSide 选主体在左还是右,标签自动站到另一侧。
 *   暗渐变 shade:标签那一侧的黑色横向渐变,从外侧滑入 + 前 3 帧淡入(原片烘焙在底片里,实测可选轨)。
 *   标签堆:每个标签是「色块底 + 字」整块从自己下沿的看不见的遮罩线下往上升,
 *     x 不动、不缩放、不淡入、无运动模糊,15 帧到位(共用一条实测曲线),逐个往下堆。
 *
 * 用法:
 *   <Sequence from={x} durationInFrames={n}>   // 原片是一帧硬切收尾,用 Sequence 的时长切掉即可
 *     <TagStack subject={<OffthreadVideo src={...} muted />} tags={['写文案', { text: '别乱装', tone: 'warn', at: 40 }]} />
 *   </Sequence>
 * 组件铺满父容器(AbsoluteFill 语义),几何按 1920×1080 画布像素给。
 */
import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

const clampBoth = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 实测时基:原片 30fps。下面带「帧」的常量都是原片帧 */
const MEASURED_FPS = 30;

// ── 实测曲线(案例 specs/motion.json) ──
/**
 * tag-N-rise:六个标签共用一条曲线(两把尺互证,极差 ≤0.55px,pooled rmse 0.075px)。
 * 出现帧前一帧位移 148.25px(整块藏在遮罩下)→ 出现后第 14 帧到 0;
 * 逐帧 120.4 → 96.4 → 75.9 → 58.6 → 44 → 32 → 22.6 → 15.1 → 9.5 → 5.5 → 3 → 1.2 → 0.4 → 0.1 → 0。
 */
const RISE = { before: 1, after: 14, dy: 148.25, ease: Easing.bezier(0.331, 0.994, 0.662, 1) };
/** 原片 6 个标签出现帧 52 / 79 / 101 / 125 / 147 / 167 → 平均间隔 23 帧(0.77 秒) */
const MEASURED_STAGGER = 23;
/**
 * side-shade-slide / side-shade-fade(置信度中,AI 视频背景 ±10% 亮度起伏):
 * 比第一个标签晚 6 帧起步,从外侧 +205px 滑入 8 帧 + 前 3 帧淡入。
 */
const SHADE_SLIDE = { from: 0, to: 8, dx: 205, ease: Easing.bezier(0.594, 0.006, 0.281, 0.894) };
const SHADE_FADE = { from: 0, to: 3, ease: Easing.bezier(0.356, 0.356, 0.2, 0.75) };
const SHADE_AFTER_FIRST_TAG = 6;

// ── 实测几何(1080p 画布 px;案例 specs/layout.json + layout-ext.json) ──
const G = {
  /** 标签左沿 x=1462.03;第一个标签顶 100.95;行距 140.6(实测 101/241/382/522/664/804,等距误差 ≤0.3px) */
  tagX: 1462.03,
  firstTop: 100.95,
  pitch: 140.6,
  /** 得意黑 96.15px(3 字宽与 4 字宽之差反推),黑字 + 0.2px 同色细描边补字墨 */
  fontSize: 96.15,
  stroke: 0.2,
  /** 色块:上留白 0.779、行高 107.391(=盒高 108.17)、左右留白 15.455、圆角 16.85(四角缺失面积反解) */
  padTop: 0.779,
  lineHeight: 107.391,
  padX: 15.455,
  radius: 16.85,
  /** 遮罩:顶在标签顶上 16.95,高 150(下沿 = 标签顶 + 133.05);左沿在标签左 22 */
  maskAbove: 16.95,
  maskHeight: 150,
  maskLeftPad: 22.03,
  /** 暗渐变:x 1000 起、宽 920,色标照 layout side-shade(x≥1780 纯黑) */
  shadeX: 1000,
  shadeWidth: 920,
  /** 6 个标签的堆底 912(再往下是字幕带 933 起),自动缩放以此为底 */
  stackBottom: 912,
  /** 原片 6 标签堆的竖直中心(center 对齐用) */
  stackCenterY: 506.5,
};
const SHADE_STOPS =
  'rgba(0,0,0,0) 0%, rgba(0,0,0,0.12) 16.30%, rgba(0,0,0,0.24) 43.48%, rgba(0,0,0,0.45) 47.83%, rgba(0,0,0,0.58) 52.17%, rgba(0,0,0,0.68) 56.52%, rgba(0,0,0,0.77) 63.04%, rgba(0,0,0,0.85) 69.57%, rgba(0,0,0,0.94) 76.09%, rgba(0,0,0,0.98) 80.43%, rgba(0,0,0,1) 84.78%';

/**
 * 秋芝标签颜色语义。positive(荧光绿 #9CFE00)是本案实测;
 * point 黄 #FFDF01 取自案例 05/08 的黄签底;here 橙 #FF7100 取自案例 16/18 的橙色强调;
 * warn 红是秋芝常见警示红的近似(没有逐帧实测过的红色标签,用前可按片子调)。
 */
export const TAG_TONES = {
  /** 要点 */
  point: { bg: '#FFDF01', fg: '#000000' },
  /** 正面 / 结论(原片) */
  positive: { bg: '#9CFE00', fg: '#000000' },
  /** 警示 / 坑 */
  warn: { bg: '#FF3B30', fg: '#FFFFFF' },
  /** 指这里 */
  here: { bg: '#FF7100', fg: '#FFFFFF' },
} as const;
export type TagTone = keyof typeof TAG_TONES;

export type TagItem = {
  text: string;
  tone?: TagTone;
  /** 自定义色块底 / 字色(覆盖 tone) */
  color?: string;
  textColor?: string;
  /** 出现时刻(当前 fps 的帧,相对组件起点)= 标签第一次露头的那一帧;对准口播念到这个词的时刻 */
  at?: number;
  /** 亚像素微调(px,缩放前):box = 整块上下挪;text = 字在色块里上下挪(色块高不变)。复刻原片逐个对位用,平时不用填 */
  nudge?: { box?: number; text?: number };
};

export type TagStackProps = {
  /** 标签列表(1–8 个,字符串或对象) */
  tags: Array<string | TagItem>;
  /** 主体槽位:视频 / 图片 / 任意 React 节点;不给就只有标签 */
  subject?: React.ReactNode;
  /** 主体在哪一侧,标签站另一侧。默认 left(= 原片:画面主体在左、标签在右) */
  subjectSide?: 'left' | 'right';
  /** full = 主体铺满全屏(原片);panel = 主体放进一侧圆角面板 */
  subjectLayout?: 'full' | 'panel';
  /** panel 模式的面板矩形(1080p px);不给按 subjectSide 自动放 */
  panel?: { x: number; y: number; width: number; height: number; radius?: number };
  /** 画布底色(panel 模式露出来的部分) */
  background?: string;
  /** 标签侧暗渐变:默认 full 模式开、panel 模式关 */
  shade?: boolean;
  /** 暗渐变入场时刻(帧,相对组件起点);默认比第一个标签晚 6 原片帧(= 原片) */
  shadeAt?: number;
  /** 堆的竖直对齐:top = 从顶往下堆(原片);center = 整堆居中(标签少时用) */
  align?: 'top' | 'center';
  /** 没写 at 的标签:第一个标签出现帧 + 间隔(当前 fps 的帧)。默认 1 帧 + 原片 23 帧(0.77 秒) */
  firstAt?: number;
  stagger?: number;
  /** 整体缩放;不给 = 自动(≤6 个是 1,更多时缩到堆底不压字幕带) */
  scale?: number;
  /** 标签列左沿 / 第一个标签顶 / 行距(1080p px,缩放前);不给按实测 + 自动 */
  tagX?: number;
  top?: number;
  pitch?: number;
  /** 默认色调 */
  tone?: TagTone;
  /** 单个标签最大宽度(px);超了只缩字、色块高度不变。默认到画面边留 40px */
  maxTagWidth?: number;
  fontFamily?: string;
  /** 速度倍率:1 = 原片(每个标签 0.5 秒到位);>1 更利落 */
  speed?: number;
  /** 起播延迟(帧,按当前 fps) */
  delayFrames?: number;
};

/** 估算字宽(em):中日韩 0.8em(实测 3 字 → 4 字宽差 76.9px = 0.8 × 96.15),其余 0.52em */
const estimateTextEm = (text: string) =>
  Array.from(text).reduce((sum, ch) => sum + (/[⺀-鿿豈-﫿＀-￯]/.test(ch) ? 0.8 : ch === ' ' ? 0.3 : 0.52), 0);

export const TagStack: React.FC<TagStackProps> = ({
  tags,
  subject,
  subjectSide = 'left',
  subjectLayout = 'full',
  panel,
  background = '#0B0B0D',
  shade,
  shadeAt,
  align = 'top',
  firstAt,
  stagger,
  scale,
  tagX,
  top,
  pitch = G.pitch,
  tone = 'positive',
  maxTagWidth,
  fontFamily = 'SmileySansV1',
  speed = 1,
  delayFrames = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  // 原片帧时刻:换 fps / 调速都在这里折算
  const toMeasured = (localFrames: number) => (localFrames / fps) * MEASURED_FPS * speed;
  const t = toMeasured(frame - delayFrames);

  const tagsOnRight = subjectSide === 'left';
  const n = tags.length;
  const baseBoxH = G.padTop + G.lineHeight;
  const autoScale = Math.min(1, (G.stackBottom - G.firstTop) / ((n - 1) * pitch + baseBoxH));
  const s = scale ?? autoScale;
  const boxH = baseBoxH * s;
  const rowPitch = pitch * s;
  const stackH = (n - 1) * rowPitch + boxH;
  const firstTop = top ?? (align === 'center' ? G.stackCenterY - stackH / 2 : G.firstTop);
  const colX = tagX ?? (tagsOnRight ? G.tagX : W - G.tagX - 400);
  const maxW = maxTagWidth ?? (tagsOnRight ? W - colX - 40 : W / 2 - colX - 40);

  // 出现时刻(原片帧):给了 at 按 at,否则 firstAt + i × stagger
  const defaultFirst = firstAt === undefined ? 1 : toMeasured(firstAt);
  const defaultStagger = stagger === undefined ? MEASURED_STAGGER : toMeasured(stagger);
  const items = tags.map((raw, i) => {
    const item: TagItem = typeof raw === 'string' ? { text: raw } : raw;
    const toneColors = TAG_TONES[item.tone ?? tone];
    const appear = item.at === undefined ? defaultFirst + i * defaultStagger : toMeasured(item.at);
    const textW = estimateTextEm(item.text) * G.fontSize * s;
    const fontK = Math.min(1, (maxW - 2 * G.padX * s) / Math.max(1, textW));
    return { ...item, bg: item.color ?? toneColors.bg, fg: item.textColor ?? toneColors.fg, appear, fontK };
  });

  const firstAppear = items.length ? Math.min(...items.map((it) => it.appear)) : 0;
  const shadeOn = shade ?? subjectLayout === 'full';
  const shadeStart = shadeAt === undefined ? firstAppear + SHADE_AFTER_FIRST_TAG : toMeasured(shadeAt);
  const tShade = t - shadeStart;
  const shadeDx = interpolate(tShade, [SHADE_SLIDE.from, SHADE_SLIDE.to], [SHADE_SLIDE.dx, 0], { ...clampBoth, easing: SHADE_SLIDE.ease });
  const shadeOpacity = interpolate(tShade, [SHADE_FADE.from, SHADE_FADE.to], [0, 1], { ...clampBoth, easing: SHADE_FADE.ease });

  const autoPanel = (() => {
    const w = 1340;
    const h = (w * 9) / 16;
    return { x: tagsOnRight ? 60 : W - 60 - w, y: (H - h) / 2 - 20, width: w, height: h, radius: 24 };
  })();
  const P = { radius: 24, ...(panel ?? autoPanel) };

  return (
    <AbsoluteFill style={{ backgroundColor: subjectLayout === 'panel' ? background : undefined }}>
      {subject ? (
        subjectLayout === 'full' ? (
          <AbsoluteFill>{subject}</AbsoluteFill>
        ) : (
          <div style={{ position: 'absolute', left: P.x, top: P.y, width: P.width, height: P.height, borderRadius: P.radius, overflow: 'hidden' }}>
            {subject}
          </div>
        )
      ) : null}
      {shadeOn && tShade > SHADE_SLIDE.from ? (
        <div
          style={{
            position: 'absolute',
            top: 0,
            height: H,
            width: G.shadeWidth,
            left: tagsOnRight ? W - G.shadeWidth : 0,
            backgroundImage: `linear-gradient(${tagsOnRight ? 'to right' : 'to left'}, ${SHADE_STOPS})`,
            opacity: shadeOpacity,
            // Z1:落定后清变换
            translate: tShade >= SHADE_SLIDE.to ? undefined : `${tagsOnRight ? shadeDx : -shadeDx}px 0px`,
          }}
        />
      ) : null}
      {items.map((it, i) => {
        const tTag = t - it.appear;
        if (tTag < -RISE.before) return null;
        const dy = interpolate(tTag, [-RISE.before, RISE.after], [RISE.dy * s, 0], { ...clampBoth, easing: RISE.ease });
        const tagTop = firstTop + i * rowPitch + (it.nudge?.box ?? 0) * s;
        const textDy = (it.nudge?.text ?? 0) * s;
        const maskTop = tagTop - G.maskAbove * s;
        const maskLeft = colX - G.maskLeftPad * s;
        const fs = G.fontSize * s * it.fontK;
        return (
          <div
            key={`${i}-${it.text}`}
            style={{ position: 'absolute', left: maskLeft, top: maskTop, width: Math.max(0, (tagsOnRight ? W : W / 2) - maskLeft), height: G.maskHeight * s, overflow: 'hidden' }}
          >
            <div
              style={{
                position: 'absolute',
                left: G.maskLeftPad * s,
                top: G.maskAbove * s,
                display: 'flex',
                alignItems: 'flex-start',
                fontFamily,
                WebkitFontSmoothing: 'antialiased',
                fontKerning: 'none',
                fontSize: fs,
                lineHeight: 1,
                whiteSpace: 'pre',
                color: it.fg,
                WebkitTextStroke: `${G.stroke * s}px ${it.fg}`,
                // Z1:到位后清变换
                translate: tTag >= RISE.after ? undefined : `0px ${dy}px`,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  whiteSpace: 'pre',
                  // 行高用绝对 px:缩字时色块高度不变,字在块里竖直居中
                  lineHeight: `${G.lineHeight * s}px`,
                  padding: `${G.padTop * s}px ${G.padX * s}px 0px`,
                  borderRadius: G.radius * s,
                  backgroundColor: it.bg,
                }}
              >
                {textDy ? <span style={{ position: 'relative', top: textDy }}>{it.text}</span> : it.text}
              </span>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
