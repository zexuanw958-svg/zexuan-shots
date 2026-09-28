/**
 * ScreenExplain.tsx — 「录屏抠件放大解释」镜头模板(秋芝《Claude Code 全解》20:51 /simplify 输出讲解实测版)。
 *
 * 出处:内部复刻案例 qz-cc-1251-explain-output(交付 06,独立审稿 0 高 0 中)。
 * 默认值 = 原片 30fps 实测曲线与 1080p 几何(specs/motion.json + layout.json + layout-ext.json 同名 id),不是手调。
 *
 * 一整套动作(原片帧号):
 *   f1→f11  抠卡:录屏里选中的一块(crop)叠成卡片,左上角为原点从原位放大上移到卡位(motion card-lift-*)
 *           同时其余录屏线性变糊 σ0→6(f1→f8)、压暗到 ×0.0423(f1→f10),清晰层 f5→f10 淡掉(rec-*)
 *   f13→f24 英文(抠出来的原始画面)淡出;f14→f29 中文逐字幂次显影(四行同时起步,越靠后的字越晚到齐)
 *   f46     重点词橙色高亮硬出(正片叠底 + 红色外发光)
 *   f83→f92 窗内压暗 ×0.2,只留一句「反色框」(focus)
 *   f84→f99 竖线从中点向两头伸;f99→f113 分支从中点向两头伸
 *   f135/167/204  关键词从下沿遮罩升起(13 帧,不模糊不横移)
 *   f291/377      荧光绿标签同样从下沿遮罩升起(14 帧)
 *
 * 用法(组件铺满父容器,几何按 1920×1080 画布 px):
 *   <Sequence from={x}>
 *     <ScreenExplain
 *       recording={<OffthreadVideo src={staticFile('rec.mp4')} muted style={{width:'100%',height:'100%'}} />}
 *       crop={{ x: 15, y: 468, width: 990, height: 200 }}   // 窗口内坐标
 *       lines={['正在对项目运行 /simplify 审查。', { text: '现在启动3个审查 Agent。', highlights: ['3个审查 Agent'] }]}
 *       focus={{ line: 1 }}
 *       points={['代码质量', '运行效率', '可复用性']}
 *       tags={['代码审核', '优化修改']}
 *     />
 *   </Sequence>
 * 本地第 0 帧 = 原片 f1(卡片出现那一帧)。各段出现时刻都能用 at(当前 fps 的帧,相对组件起点)对口播。
 */
import React from 'react';
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { splitGraphemes } from '../textfx/graphemes';
import { fonts } from '../theme';

const clampBoth = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 实测时基:原片 30fps。下面帧号都是原片绝对帧号 */
const MEASURED_FPS = 30;
/** 组件本地第 0 帧 = 原片 f1 */
const F0 = 1;

// ── 实测曲线(原片帧号;id = 案例 specs/motion.json) ──
/** card-lift-scale / card-lift-move:f1→f11,左上角为原点,rmse 顶边 ≤0.42px */
const LIFT = { from: 1, to: 11, ease: Easing.bezier(0.4203, 0, 0.5776, 0.9964) };
/** rec-blur:模糊 σ 0→6 线性,f1→f8 */
const REC_BLUR = { from: 1, to: 8 };
/** rec-dim / rec-sharp-dim:亮度 1→0.0423,f1→f10;对比度 1→0.945 线性 */
const REC_DIM = { from: 1, to: 10, ease: Easing.bezier(0.3438, 0.3249, 0.677, 0.6582) };
/** rec-sharp-fade:清晰层 f5→f10 淡掉(露出下面的模糊层) */
const REC_SHARP_FADE = { from: 5, to: 10, ease: Easing.bezier(0.6, 0, 0.9, 0.6) };
/** card-en-*-fade:原文 f13→f24 淡出 */
const SOURCE_FADE = { from: 13, to: 24, ease: Easing.bezier(0.0448, 0, 0.3344, 0.7612) };
/** card-zh-*-reveal:逐字显影进度 s,f14→f29;第 i 字 α = min(1,(s/u_i)^3.925),u_i=(i+0.726)/N(1650 个字×帧联合拟合 rms 0.014) */
const REVEAL = { from: 14, to: 29, ease: Easing.bezier(0.6362, 0.6295, 0.9481, 1), exponent: 3.925, indexOffset: 0.726 };
/** hl-orange:f46 硬出 */
const HIGHLIGHT_AT = 46;
/** focus-dim-in:f83→f92 线性 */
const FOCUS = { from: 83, to: 92 };
/** tree-vline-grow:scaleY 0.557→1(f84→f99)、α(f84→f97),从中点伸 */
const VLINE = {
  from: 84, to: 99, s0: 0.55746, ease: Easing.bezier(0.1334, 0, 0.4153, 0.9766),
  fadeTo: 97, fadeEase: Easing.bezier(0.6759, 1, 0.7435, 0.8412),
};
/** tree-branch-*-grow:scaleX 0.458→1、α,f99→f113,从中点伸 */
const BRANCH = {
  from: 99, to: 113, s0: 0.45795, ease: Easing.bezier(0, 0.1976, 0.5467, 0.9585),
  fadeEase: Easing.bezier(0.7224, 1, 0.6277, 0.8909),
};
/** kw-*-rise:下沿遮罩里升 125.78px(76px 字)→0,13 帧 */
const KW_RISE = { dur: 13, distEm: 125.77982 / 76, ease: Easing.bezier(0.3342, 0.9346, 0.6705, 0.9932) };
const KW_AT = [135, 167, 204];
/** tag-*-rise:升 134.78px(84.9px 字)→0,14 帧 */
const TAG_RISE = { dur: 14, distEm: 134.77801 / 84.9, ease: Easing.bezier(0.3317, 0.923, 0.6564, 0.9956) };
const TAG_AT = [291, 377];

// ── 实测几何(1080p 画布 px) ──
/** 录屏窗:rec-window-f0 原片裁切位置;外框 window-stroke 比窗外扩 0.9、2px #F0F0F0 */
const DEFAULT_WINDOW = { x: 220, y: 30, width: 1666, height: 927, radius: 30 };
const G = {
  /** 卡片:左右各缩 14、顶在窗顶下 29(234,59,1638 宽) */
  cardInsetX: 14,
  cardTop: 29,
  cardRadius: 16,
  /** 卡内文字:字号 33.76,左留白 39.3(=1.164em),行距实测 62–69 → 1.95em */
  fontSize: 33.76,
  padXEm: 39.3 / 33.76,
  pitchEm: 1.95,
  /** 橙色高亮框:比字面盒 上 −2.75 / 下 +0.72 / 左 +0.84 / 右 −5.3(斜体 t 出头) */
  hl: { top: 2.75 / 33.76, bottom: -0.72 / 33.76, left: -0.84 / 33.76, right: 5.34 / 33.76 },
  hlColor: '#F57C19',
  hlRadius: 5,
  hlShadow: '0 0 0 1px rgba(255, 255, 255, 0.65), 0 3.7px 3.4px 3.4px rgba(255, 0, 0, 0.067), 0 3.7px 66.9px 10.2px rgba(255, 0, 0, 0.336)',
  /** 反色框(挖洞):上 6.1 / 下 1.14 / 左 8.4;以「。」等全角标点收尾时右沿收 11.6 */
  hole: { top: 6.14 / 33.76, bottom: 1.14 / 33.76, left: 8.4 / 33.76, right: 8.4 / 33.76, punctTrim: 20.0 / 33.76 },
  holeRadius: 6.5,
  focusDim: 0.8,
  /** 树形线:竖线顶在洞底下 14.85,线宽 3;首根分支在竖线顶下 90.88,分支间距 131.86,长 147.5 */
  vlineGap: 14.85,
  stroke: 3,
  firstBranch: 90.88,
  branchBelowCard: 88.7,
  branchPitch: 131.86,
  branchLength: 147.52,
  /** 关键词:字号 76,左沿在分支末端右 8.9,字盒中心比分支中心高 2.8,遮罩下沿在字盒底下 42.6 */
  kwFont: 76,
  kwGap: 8.9,
  kwLift: 2.8,
  kwMaskBelow: 42.6,
  /** 标签:字号 84.9,绿底 #9DFF01,上留白 3.02、左右 13.4、圆角 14.75、行高 97.33;
   *  左沿在关键词右沿右 125.2(按 76px 字的比例缩);首个标签顶比首根分支中心高 7.1,间距 130.55;遮罩下沿在底块下 21.6 */
  tagFont: 84.9,
  tagColor: '#9DFF01',
  tagTextColor: '#000000',
  tagPadTop: 3.02,
  tagPadX: 13.4,
  tagRadius: 14.75,
  tagLineHeight: 97.33,
  tagGap: 125.2,
  tagLift: 7.1,
  tagPitch: 130.55,
  tagMaskBelow: 21.6,
  /** 录屏压暗落定亮度 ×0.0423、对比 0.945、模糊 6(白底 255 → 17) */
  recDim: 0.0423,
  recContrast: 0.945,
  recBlur: 6,
};

type Rect = { x: number; y: number; width: number; height: number };

export type ScreenExplainLine = {
  text: string;
  /** 这一行的字色(原片第 3 行 #6F6F6F 灰) */
  color?: string;
  /** 要打橙色高亮的片段(原文子串,可多个) */
  highlights?: string[];
  /** 卡内坐标覆写(px,卡左上为原点);不给就自动排 */
  x?: number;
  y?: number;
};

export type ScreenExplainPoint = { text: string; at?: number };
export type ScreenExplainTag = { text: string; at?: number; color?: string; textColor?: string };

export type ScreenExplainProps = {
  /** 录屏画面:铺满 window(视频 / 图片 / 代码画的界面都行)。会渲两份:背景一份、抠卡一份 */
  recording: React.ReactNode;
  /** 录屏窗在画布上的位置。默认 = 原片(220,30,1666×927,圆角 30) */
  window?: Rect & { radius?: number };
  /** 要抠出来放大的区域(录屏窗内坐标 px) */
  crop: Rect;
  /** 卡片落点:默认左右各缩 14、顶在窗顶下 29、宽 = 窗宽 − 28;maxHeight 限高(超了就按高缩、水平居中) */
  card?: { x?: number; y?: number; width?: number; maxHeight?: number; radius?: number; color?: string };
  /** 卡片干净底图(可选,英文淡出后留下的底,比如擦掉原文的截图);铺满卡片 */
  plate?: React.ReactNode;
  /** 中文解释,每条一行(太长自动缩字号,再不够就折行;条数多了卡片自动长高) */
  lines: Array<string | ScreenExplainLine>;
  fontFamily?: string;
  /** 卡内中文字号;默认原片 33.76 按卡宽缩,但不低于 minFontSize */
  fontSize?: number;
  /** 最小字号(px);默认 1080p 下 34、按画布高等比。1:1 复刻原片时传 0 */
  minFontSize?: number;
  textColor?: string;
  /** 行距(em),原片 1.95 */
  lineHeightEm?: number;
  /** 高亮:颜色、出现时刻(帧,相对组件起点;默认原片 1.5 秒) */
  highlight?: { color?: string; at?: number; glow?: boolean };
  /** 聚焦:压暗整窗,只留第 line 行的 text 片段(默认整行)。不给就没有聚焦和树形线 */
  focus?: { line: number; text?: string; at?: number; opacity?: number };
  /** 要点(从反色框底下伸出竖线 + 分支 + 关键词)。x 覆写竖线横坐标 */
  points?: Array<string | ScreenExplainPoint>;
  pointsX?: number;
  pointColor?: string;
  pointFontSize?: number;
  /** 结论标签(荧光绿) */
  tags?: Array<string | ScreenExplainTag>;
  tagColor?: string;
  tagTextColor?: string;
  tagFontSize?: number;
  /** 外框细白线;false 关掉 */
  frame?: boolean | { color?: string; width?: number };
  /** 录屏压暗落定亮度(原片 0.0423);模糊 σ(原片 6) */
  recordingDim?: number;
  recordingBlur?: number;
  /** 速度倍率:1 = 原片(0.33 秒抠卡、1 秒内中文到齐) */
  speed?: number;
  /** 起播延迟(帧,当前 fps);延迟期间只显示原样录屏 */
  delayFrames?: number;
};

// ── 文字测量(Canvas measureText 与 DOM 同一套排版;字体没到位时按字数估) ──
const widthCache = new Map<string, number>();
const measure = (text: string, fontSize: number, family: string): number => {
  if (!text) return 0;
  const key = `${family}|${fontSize}|${text}`;
  const hit = widthCache.get(key);
  if (hit !== undefined) return hit;
  const font = `400 ${fontSize}px "${family}"`;
  let w: number | null = null;
  const loaded =
    typeof document !== 'undefined' &&
    Array.from(document.fonts as unknown as Iterable<FontFace>).some((f) => f.family.replace(/["']/g, '') === family && f.status === 'loaded');
  if (loaded) {
    const ctx = document.createElement('canvas').getContext('2d');
    if (ctx) {
      ctx.font = font;
      w = ctx.measureText(text).width;
    }
  }
  if (w === null) {
    // 估算:CJK/全角 1em,其余 0.5em
    w = splitGraphemes(text).reduce((s, c) => s + (/[⺀-￯]/.test(c) ? 1 : 0.5), 0) * fontSize;
    return w; // 估算值不缓存,字体到位后重量
  }
  widthCache.set(key, w);
  return w;
};

/** 逐字 span 补字距(Chrome 不在 span 边界做 kerning,案例 06 探针实测会错 0.25–1.5px) */
const kerning = (chars: string[], fontSize: number, family: string): number[] =>
  chars.map((c, i) =>
    i === 0 ? 0 : measure(chars.slice(0, i + 1).join(''), fontSize, family) - measure(chars.slice(0, i).join(''), fontSize, family) - measure(c, fontSize, family),
  );

const CJK_PUNCT_END = /[。，、；：！？）」』]$/;
/** 卡内中文解释最小字号(1080p 画布 px);手机竖屏看清的下限 */
const MIN_FONT_1080 = 34;
const CJK_PUNCT = /^[。，、；：！？）」』”]$/;
/** 反色框左沿:前一个字是全角标点(字形靠左、右半边是空的)时按原片外扩 0.249em,否则只留 0.08em 免得压到前一个字 */
const HOLE_LEFT_TIGHT = 0.08;

type Row = { line: number; start: number; end: number; text: string; x: number; y: number };

export const ScreenExplain: React.FC<ScreenExplainProps> = ({
  recording,
  window: win = DEFAULT_WINDOW,
  crop,
  card: cardIn,
  plate,
  lines: linesIn,
  fontFamily = fonts.smiley,
  fontSize: fontSizeIn,
  minFontSize,
  textColor = '#000000',
  lineHeightEm = G.pitchEm,
  highlight,
  focus,
  points: pointsIn,
  pointsX,
  pointColor = '#FFFFFF',
  pointFontSize,
  tags: tagsIn,
  tagColor = G.tagColor,
  tagTextColor = G.tagTextColor,
  tagFontSize,
  frame: frameOpt = true,
  recordingDim = G.recDim,
  recordingBlur = G.recBlur,
  speed = 1,
  delayFrames = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const local = frame - delayFrames;
  /** 原片帧号时间(全局流程) */
  const T = F0 + (local / fps) * MEASURED_FPS * speed;
  /** 某个可对口播的事件:默认在原片 origStart 帧出现;给了 at 就挪到 at 帧,曲线照样按原片走 */
  const evT = (origStart: number, at?: number) => {
    const atFrames = at ?? ((origStart - F0) / MEASURED_FPS / speed) * fps;
    return origStart + ((local - atFrames) / fps) * MEASURED_FPS * speed;
  };

  const winR = win.radius ?? DEFAULT_WINDOW.radius;
  const lines: ScreenExplainLine[] = linesIn.map((l) => (typeof l === 'string' ? { text: l } : l));

  // ── 卡片几何 ──
  const cardX0 = cardIn?.x ?? win.x + G.cardInsetX;
  const cardW0 = cardIn?.width ?? win.width - 2 * G.cardInsetX;
  const cardY = cardIn?.y ?? win.y + G.cardTop;
  const maxH = cardIn?.maxHeight ?? win.height * 0.5;
  const scale = Math.min(cardW0 / crop.width, maxH / crop.height);
  const cardW = crop.width * scale;
  const cardX = cardW < cardW0 - 0.5 ? cardX0 + (cardW0 - cardW) / 2 : cardX0;
  const cropH = crop.height * scale;
  const cardRadius = cardIn?.radius ?? G.cardRadius;
  const cardColor = cardIn?.color ?? '#FFFFFF';

  // ── 卡内排字:最小字号保护(1080p 下 34px,按画布高等比)。顺序:先折行 → 卡片长高 → 放不下再缩字,最多缩到下限 ──
  //    到下限还超出窗口:卡片继续长到窗底为止(不再缩字),这种条数请拆两屏(两个 ScreenExplain 各放一半条数)
  const minFont = minFontSize ?? MIN_FONT_1080 * (height / 1080);
  const baseFont = Math.max(minFont, fontSizeIn ?? G.fontSize * Math.min(1, cardW / 1638));
  const padX = G.padXEm * baseFont;
  const textW = cardW - 2 * padX;
  const wrap = (fs: number) => {
    const out: Array<Omit<Row, 'x' | 'y'>> = [];
    lines.forEach((l, li) => {
      const chars = splitGraphemes(l.text);
      let start = 0;
      while (start < chars.length) {
        let end = chars.length;
        if (measure(chars.slice(start).join(''), fs, fontFamily) > textW) {
          end = start + 1;
          while (end < chars.length && measure(chars.slice(start, end + 1).join(''), fs, fontFamily) <= textW) end += 1;
          // 避头:标点不落到下一排开头,挂在本排行尾
          while (end < chars.length && CJK_PUNCT.test(chars[end])) end += 1;
        }
        out.push({ line: li, start, end, text: chars.slice(start, end).join('') });
        start = end;
      }
    });
    return out;
  };
  const needH = (fs: number, n: number) => (n - 1) * lineHeightEm * fs + fs + 2 * fs * 1.2;
  const availH = win.y + win.height - 24 - cardY;
  let fontSize = baseFont;
  let rowsRaw = wrap(fontSize);
  while (needH(fontSize, rowsRaw.length) > availH && fontSize > minFont + 0.01) {
    fontSize = Math.max(minFont, fontSize * 0.95);
    rowsRaw = wrap(fontSize);
  }
  const pitch = lineHeightEm * fontSize;
  const blockH = (rowsRaw.length - 1) * pitch + fontSize;
  const autoPadY = Math.max(fontSize * 1.2, (cropH - blockH) / 2);
  const cardH = Math.min(Math.max(cropH, blockH + 2 * autoPadY), Math.max(cropH, availH));
  const firstRowOfLine = new Map<number, number>();
  const rows: Row[] = rowsRaw.map((r, i) => {
    const l = lines[r.line];
    const isFirst = !firstRowOfLine.has(r.line);
    if (isFirst) firstRowOfLine.set(r.line, i);
    const rowInLine = i - (firstRowOfLine.get(r.line) ?? i);
    const y = l.y !== undefined ? l.y + rowInLine * pitch : (cardH - blockH) / 2 + i * pitch;
    return { ...r, x: cardX + (l.x ?? padX), y: cardY + y };
  });

  /** 某行里 [a,b) 字的画布矩形(可能跨多排,取并集) */
  const rangeRect = (line: number, a: number, b: number) => {
    const rs = rows.filter((r) => r.line === line && r.end > a && r.start < b);
    if (rs.length === 0) return null;
    const boxes = rs.map((r) => {
      const chars = splitGraphemes(r.text);
      const s = Math.max(a, r.start) - r.start;
      const e = Math.min(b, r.end) - r.start;
      const x0 = r.x + measure(chars.slice(0, s).join(''), fontSize, fontFamily);
      const x1 = r.x + measure(chars.slice(0, e).join(''), fontSize, fontFamily);
      return { x0, x1, y0: r.y, y1: r.y + fontSize, text: chars.slice(s, e).join('') };
    });
    return {
      x0: Math.min(...boxes.map((q) => q.x0)),
      x1: Math.max(...boxes.map((q) => q.x1)),
      y0: Math.min(...boxes.map((q) => q.y0)),
      y1: Math.max(...boxes.map((q) => q.y1)),
      boxes,
    };
  };
  const findRange = (line: number, sub?: string): [number, number] | null => {
    const chars = splitGraphemes(lines[line]?.text ?? '');
    if (!sub) return [0, chars.length];
    const idx = (lines[line]?.text ?? '').indexOf(sub);
    if (idx < 0) return null;
    const a = splitGraphemes(lines[line].text.slice(0, idx)).length;
    return [a, a + splitGraphemes(sub).length];
  };

  // ── 时间 ──
  const liftP = interpolate(T, [LIFT.from, LIFT.to], [0, 1], { ...clampBoth, easing: LIFT.ease });
  const lifted = T >= LIFT.to;
  const recBlur = interpolate(T, [REC_BLUR.from, REC_BLUR.to], [0, recordingBlur], clampBoth);
  const recBright = interpolate(T, [REC_DIM.from, REC_DIM.to], [1, recordingDim], { ...clampBoth, easing: REC_DIM.ease });
  const recContrast = interpolate(T, [REC_DIM.from, REC_DIM.to], [1, G.recContrast], clampBoth);
  const sharpOpacity = interpolate(T, [REC_SHARP_FADE.from, REC_SHARP_FADE.to], [1, 0], { ...clampBoth, easing: REC_SHARP_FADE.ease });
  const sourceOpacity = interpolate(T, [SOURCE_FADE.from, SOURCE_FADE.to], [1, 0], { ...clampBoth, easing: SOURCE_FADE.ease });
  const cardGrow = interpolate(T, [SOURCE_FADE.from, SOURCE_FADE.to], [0, 1], { ...clampBoth, easing: SOURCE_FADE.ease });
  const revealS = interpolate(T, [REVEAL.from, REVEAL.to], [0, 1], { ...clampBoth, easing: REVEAL.ease });

  const started = T >= F0;
  const recStyle = (blur: number): React.CSSProperties => ({
    position: 'absolute',
    inset: 0,
    filter: started ? `${blur > 0.01 ? `blur(${blur.toFixed(3)}px) ` : ''}brightness(${recBright.toFixed(4)}) contrast(${recContrast.toFixed(4)})` : undefined,
  });

  // 卡片抬升:从 crop 原位(缩 1/scale)到卡位,左上为原点
  const k0 = 1 / scale;
  const cropCanvasX = win.x + crop.x;
  const cropCanvasY = win.y + crop.y;
  const liftScale = interpolate(liftP, [0, 1], [k0, 1], clampBoth);
  const liftDx = interpolate(liftP, [0, 1], [cropCanvasX - cardX, 0], clampBoth);
  const liftDy = interpolate(liftP, [0, 1], [cropCanvasY - cardY, 0], clampBoth);
  const cardHNow = cropH + (cardH - cropH) * cardGrow;

  // ── 高亮 ──
  const hlColor = highlight?.color ?? G.hlColor;
  const hlVisible = evT(HIGHLIGHT_AT, highlight?.at) >= HIGHLIGHT_AT;
  const hlRects: Array<{ x0: number; x1: number; y0: number; y1: number }> = [];
  lines.forEach((l, li) =>
    (l.highlights ?? []).forEach((h) => {
      const r = findRange(li, h);
      const rr = r && rangeRect(li, r[0], r[1]);
      if (rr) rr.boxes.forEach((b) => hlRects.push(b));
    }),
  );

  // ── 聚焦洞 ──
  const focusRange = focus ? findRange(focus.line, focus.text) : null;
  const focusRect = focus && focusRange ? rangeRect(focus.line, focusRange[0], focusRange[1]) : null;
  const hole = focusRect
    ? {
        x0: focusRect.x0 - (focusRange && focusRange[0] > 0 && !CJK_PUNCT_END.test(splitGraphemes(lines[focus?.line ?? 0]?.text ?? "")[focusRange[0] - 1] ?? "") ? HOLE_LEFT_TIGHT : G.hole.left) * fontSize,
        x1: focusRect.x1 + G.hole.right * fontSize - (CJK_PUNCT_END.test(focusRect.boxes[focusRect.boxes.length - 1].text) ? G.hole.punctTrim * fontSize : 0),
        y0: focusRect.y0 - G.hole.top * fontSize,
        y1: focusRect.y1 + G.hole.bottom * fontSize,
      }
    : null;
  const focusT = evT(FOCUS.from, focus?.at);
  const focusOpacity = interpolate(focusT, [FOCUS.from, FOCUS.to], [0, 1], clampBoth);

  // ── 树形线 + 关键词 ──
  const points: ScreenExplainPoint[] = (pointsIn ?? []).map((p) => (typeof p === 'string' ? { text: p } : p));
  const nP = points.length;
  // 锚点:聚焦句里有高亮 → 高亮中心;否则洞中心;都没有 → 卡片底 38% 处
  const hlInFocus = hole ? hlRects.find((r) => r.x0 >= hole.x0 - 1 && r.x1 <= hole.x1 + 12 && r.y0 >= hole.y0 - 4 && r.y1 <= hole.y1 + 4) : undefined;
  const anchorX = pointsX ?? (hlInFocus ? (hlInFocus.x0 + hlInFocus.x1) / 2 - G.stroke / 2 : hole ? (hole.x0 + hole.x1) / 2 : cardX + cardW * 0.38);
  const treeTop = (hole ? hole.y1 : cardY + cardH) + G.vlineGap;
  const availBottom = win.y + win.height - 70;
  const kwScale0 = (pointFontSize ?? G.kwFont) / G.kwFont;
  let pitchP = G.branchPitch * kwScale0;
  const firstTop0 = Math.max(treeTop + G.firstBranch * kwScale0, cardY + cardH + G.branchBelowCard * kwScale0);
  if (nP > 1 && firstTop0 + (nP - 1) * pitchP + 60 * kwScale0 > availBottom) {
    pitchP = Math.max(40, (availBottom - firstTop0 - 60 * kwScale0) / (nP - 1));
  }
  const kScale = Math.min(kwScale0, pitchP / G.branchPitch);
  const kwFont = G.kwFont * kScale;
  // 首根分支至少在卡片底下 88.7(原片 391 → 479.7),聚焦句不在卡底时关键词不压卡
  const firstBranchTop = Math.max(treeTop + G.firstBranch * kScale, cardY + cardH + G.branchBelowCard * kScale);
  const branchY = (i: number) => firstBranchTop + i * pitchP; // 分支顶
  const vlineH = nP > 0 ? branchY(nP - 1) + G.stroke - treeTop : 0;
  const branchLen = G.branchLength * kScale;
  const kwX = anchorX + G.stroke / 2 + branchLen + G.kwGap * kScale;
  // 树从聚焦时刻起算(原片:压暗 f83、竖线 f84、分支 f99)
  const treeT = evT(FOCUS.from, focus?.at);
  const vScale = interpolate(treeT, [VLINE.from, VLINE.to], [VLINE.s0, 1], { ...clampBoth, easing: VLINE.ease });
  const vAlpha = interpolate(treeT, [VLINE.from, VLINE.fadeTo], [0, 1], { ...clampBoth, easing: VLINE.fadeEase });
  const bScale = interpolate(treeT, [BRANCH.from, BRANCH.to], [BRANCH.s0, 1], { ...clampBoth, easing: BRANCH.ease });
  const bAlpha = interpolate(treeT, [BRANCH.from, BRANCH.to], [0, 1], { ...clampBoth, easing: BRANCH.fadeEase });
  const kwStates = points.map((p, i) => {
    const orig = KW_AT[i] ?? KW_AT[KW_AT.length - 1] + 37 * (i - KW_AT.length + 1);
    const t = evT(orig, p.at);
    const prog = interpolate(t, [orig, orig + KW_RISE.dur], [0, 1], { ...clampBoth, easing: KW_RISE.ease });
    return { t, orig, prog, visible: t > orig };
  });
  const kwMaxW = Math.max(0, ...points.map((p) => measure(p.text, kwFont, fontFamily)));

  // ── 标签 ──
  const tags: ScreenExplainTag[] = (tagsIn ?? []).map((t) => (typeof t === 'string' ? { text: t } : t));
  const tagFont0 = (tagFontSize ?? G.tagFont) * (nP > 0 ? kScale / kwScale0 : 1);
  const tagX = nP > 0 ? kwX + kwMaxW + G.tagGap * kScale : cardX + cardW * 0.55;
  const tagRight = win.x + win.width - 24;
  const tagMaxW = Math.max(0, ...tags.map((t) => measure(t.text, tagFont0, fontFamily))) + 2 * G.tagPadX * (tagFont0 / G.tagFont);
  const tagFont = tagX + tagMaxW > tagRight ? Math.max(tagFont0 * 0.5, (tagFont0 * (tagRight - tagX)) / tagMaxW) : tagFont0;
  const tk = tagFont / G.tagFont;
  const tagTop0 = nP > 0 ? branchY(0) + G.stroke / 2 - G.tagLift * tk : cardY + cardH + 60;
  const tagPitch = nP > 0 ? G.tagPitch * (pitchP / G.branchPitch) * Math.max(1, tk / kScale) : G.tagPitch * tk;
  const tagStates = tags.map((tg, i) => {
    const orig = TAG_AT[i] ?? TAG_AT[TAG_AT.length - 1] + 86 * (i - TAG_AT.length + 1);
    const t = evT(orig, tg.at);
    const prog = interpolate(t, [orig, orig + TAG_RISE.dur], [0, 1], { ...clampBoth, easing: TAG_RISE.ease });
    return { prog, visible: t > orig };
  });

  const frameColor = typeof frameOpt === 'object' ? frameOpt.color ?? '#F0F0F0' : '#F0F0F0';
  const frameWidth = typeof frameOpt === 'object' ? frameOpt.width ?? 2 : 2;

  const recordingAt = (s: number) => (
    <div style={{ position: 'absolute', left: 0, top: 0, width: win.width, height: win.height, scale: s === 1 ? undefined : `${s}`, transformOrigin: '0 0' }}>
      {recording}
    </div>
  );

  // ── 逐字显影一排 ──
  const renderRow = (r: Row, i: number) => {
    const chars = splitGraphemes(r.text);
    const n = Math.max(1, chars.length);
    const color = lines[r.line].color ?? textColor;
    const style: React.CSSProperties = {
      position: 'absolute',
      left: r.x,
      top: r.y,
      height: fontSize,
      fontFamily,
      fontSize,
      lineHeight: 1,
      whiteSpace: 'pre',
      color,
      WebkitFontSmoothing: 'antialiased',
    };
    const done = revealS >= (n - 1 + REVEAL.indexOffset) / n;
    if (done) return <div key={i} style={style}>{r.text}</div>;
    const margins = kerning(chars, fontSize, fontFamily);
    return (
      <div key={i} style={style}>
        {chars.map((c, j) => {
          const u = (j + REVEAL.indexOffset) / n;
          const a = revealS <= 0 ? 0 : Math.min(1, (revealS / u) ** REVEAL.exponent);
          return (
            <span key={j} style={{ opacity: a, marginLeft: Math.abs(margins[j]) > 1e-4 ? margins[j] : undefined }}>
              {c}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* 录屏窗:清晰层在下(只在模糊层边缘透明晕处露出,f5→f10 淡掉)+ 模糊压暗层在上(原片 f2 起) */}
      <div style={{ position: 'absolute', left: win.x, top: win.y, width: win.width, height: win.height, borderRadius: winR, overflow: 'hidden' }}>
        {sharpOpacity > 0 ? <div style={{ ...recStyle(0), opacity: started ? sharpOpacity : 1 }}>{recording}</div> : null}
        {T >= F0 + 1 ? <div style={recStyle(recBlur)}>{recording}</div> : null}
      </div>

      {/* 抠出来的卡:底色 → 干净底图 → 原始画面(f13 起淡出) */}
      {started ? (
        <div
          style={{
            position: 'absolute',
            left: cardX,
            top: cardY,
            width: cardW,
            height: cardHNow,
            borderRadius: cardRadius,
            overflow: 'hidden',
            background: cardColor,
            // 落定后清变换(坑 Z1)
            translate: lifted ? undefined : `${liftDx.toFixed(3)}px ${liftDy.toFixed(3)}px`,
            scale: lifted ? undefined : `${liftScale.toFixed(5)}`,
            transformOrigin: '0 0',
          }}
        >
          {plate ? <div style={{ position: 'absolute', left: 0, top: 0, width: cardW, height: cropH }}>{plate}</div> : null}
          {sourceOpacity > 0 ? (
            <div style={{ position: 'absolute', left: 0, top: 0, width: cardW, height: cropH, overflow: 'hidden', opacity: sourceOpacity }}>
              <div style={{ position: 'absolute', left: -crop.x * scale, top: -crop.y * scale }}>{recordingAt(scale)}</div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* 橙色高亮(正片叠底:白卡上是橙、暗底上不泛红) */}
      {hlVisible
        ? hlRects.map((r, i) => (
            <div
              key={`hl-${i}`}
              style={{
                position: 'absolute',
                left: r.x0 + G.hl.left * fontSize,
                top: r.y0 - G.hl.top * fontSize,
                width: r.x1 - r.x0 + (G.hl.right - G.hl.left) * fontSize,
                height: r.y1 - r.y0 + (G.hl.top + G.hl.bottom) * fontSize,
                background: hlColor,
                borderRadius: G.hlRadius,
                mixBlendMode: 'multiply',
                boxShadow: highlight?.glow === false ? undefined : G.hlShadow,
              }}
            />
          ))
        : null}

      {/* 中文解释 */}
      {revealS > 0 ? rows.map(renderRow) : null}

      {/* 聚焦:整窗压暗,挖一个反色框 */}
      {hole && focusOpacity > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: win.x,
            top: win.y,
            width: win.width,
            height: win.height,
            borderRadius: winR,
            overflow: 'hidden',
            opacity: focusOpacity,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: hole.x0 - win.x,
              top: hole.y0 - win.y,
              width: hole.x1 - hole.x0,
              height: hole.y1 - hole.y0,
              borderRadius: G.holeRadius,
              boxShadow: `0 0 0 1px rgba(0, 0, 0, 0.12), 0 0 0 3000px rgba(0, 0, 0, ${focus?.opacity ?? G.focusDim})`,
            }}
          />
        </div>
      ) : null}

      {/* 树形线:竖线从中点向上下伸,分支从中点向左右伸 */}
      {nP > 0 && vAlpha > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: anchorX,
            top: treeTop,
            width: G.stroke,
            height: vlineH,
            background: pointColor,
            opacity: vAlpha,
            scale: vScale >= 1 ? undefined : `1 ${vScale.toFixed(5)}`,
          }}
        />
      ) : null}
      {nP > 0 && bAlpha > 0
        ? points.map((_, i) => (
            <div
              key={`br-${i}`}
              style={{
                position: 'absolute',
                left: anchorX + G.stroke / 2,
                top: branchY(i),
                width: branchLen,
                height: G.stroke,
                background: pointColor,
                opacity: bAlpha,
                scale: bScale >= 1 ? undefined : `${bScale.toFixed(5)} 1`,
              }}
            />
          ))
        : null}

      {/* 关键词:下沿遮罩里升起 */}
      {points.map((p, i) => {
        const s = kwStates[i];
        if (!s.visible) return null;
        const top = branchY(i) + G.stroke / 2 - G.kwLift * kScale - kwFont / 2;
        const maskBottom = top + kwFont + G.kwMaskBelow * kScale;
        const dy = (1 - s.prog) * KW_RISE.distEm * kwFont;
        return (
          <div key={`kw-${i}`} style={{ position: 'absolute', left: kwX - 20, top: top - kwFont, width: measure(p.text, kwFont, fontFamily) + 80, height: maskBottom - (top - kwFont), overflow: 'hidden' }}>
            <div
              style={{
                position: 'absolute',
                left: 20,
                top: kwFont,
                fontFamily,
                fontSize: kwFont,
                lineHeight: 1,
                whiteSpace: 'pre',
                color: pointColor,
                WebkitFontSmoothing: 'antialiased',
                translate: s.prog >= 1 ? undefined : `0px ${dy.toFixed(3)}px`,
              }}
            >
              {p.text}
            </div>
          </div>
        );
      })}

      {/* 结论标签:绿底块随字宽伸缩,下沿遮罩里升起 */}
      {tags.map((tg, i) => {
        const s = tagStates[i];
        if (!s.visible) return null;
        const top = tagTop0 + i * tagPitch;
        const boxH = (G.tagPadTop + G.tagLineHeight) * tk;
        const maskBottom = top + boxH + G.tagMaskBelow * tk;
        const dy = (1 - s.prog) * TAG_RISE.distEm * tagFont;
        return (
          <div key={`tag-${i}`} style={{ position: 'absolute', left: tagX - 20, top: top - boxH, width: tagRight - tagX + 60, height: maskBottom - (top - boxH), overflow: 'hidden' }}>
            <span
              style={{
                position: 'absolute',
                left: 20,
                top: boxH,
                display: 'inline-block',
                whiteSpace: 'pre',
                fontFamily,
                fontSize: tagFont,
                lineHeight: `${G.tagLineHeight * tk}px`,
                padding: `${G.tagPadTop * tk}px ${G.tagPadX * tk}px 0`,
                borderRadius: G.tagRadius * tk,
                background: tg.color ?? tagColor,
                color: tg.textColor ?? tagTextColor,
                WebkitFontSmoothing: 'antialiased',
                translate: s.prog >= 1 ? undefined : `0px ${dy.toFixed(3)}px`,
              }}
            >
              {tg.text}
            </span>
          </div>
        );
      })}

      {/* 外框细白线 */}
      {frameOpt !== false ? (
        <div
          style={{
            position: 'absolute',
            left: win.x - 0.9,
            top: win.y - 0.57,
            width: win.width + 1.6,
            height: win.height + 2.0,
            border: `${frameWidth}px solid ${frameColor}`,
            borderRadius: winR + 1,
            boxSizing: 'border-box',
            pointerEvents: 'none',
          }}
        />
      ) : null}
    </div>
  );
};

/** 原片整段(抠卡到第 2 个标签落定)时长,按当前 fps / speed 折算 */
export const screenExplainDurationInFrames = (fps: number, speed = 1): number => Math.ceil(((392 - F0) / MEASURED_FPS / speed) * fps);
