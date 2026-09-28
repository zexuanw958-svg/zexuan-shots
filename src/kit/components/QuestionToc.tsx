/**
 * QuestionToc.tsx — 「问号悬念目录」镜头模板(秋芝《Claude Code 全解》6:55「方法1 / 方法2 ???」实测版)。
 *
 * 出处:内部复刻案例 qz-cc-0413-title-toc-dive(交付 20),工序④逐帧拟合 + ⑦b 字形修正。
 * 默认值 = 原片 30fps 实测曲线与 1080p 几何(specs/motion.json 的 d-row* / d-macwin / d-arrow* / fx-arrow*,
 * specs/layout.json + layout-ext.json + motion-ext.json 同名元素),不是手调。
 * 本地帧 0 = 原片 f064(硬切进小节页那一帧);默认时间点都按这个零点折算。
 *
 * 构成(全部可选,按 props 出现):
 *   页眉:圆底图标 + 厚底黑标题,硬出不动(原片 f064)
 *   目录行 ×N:灰块(淡入 3 帧 + 0.90→1 放大 + 上移 138px,15 帧)+ 标签从遮罩线后升起 178px(14 帧),行间错峰 6 帧
 *   问号:整组左滑 92px(8 帧)+ 逐个弹入(每个晚 1 帧,0→1.12 过冲→0.985→1,12 帧)
 *   副标:整行右滑入 141px + 逐字弹入(错峰 1.125 帧,空格不占位)
 *   点名:当前行硬出橙色圆角框 + 左右三角箭头(先黄后橙、横竖反相果冻 15 帧、镜像小摆)
 *   揭晓:当前行一帧翻成荧光绿,露出答案;已讲过的行(doneCount)入场就是绿块 + 答案
 *
 * 用法:
 *   <Sequence from={x}>
 *     <QuestionToc
 *       header={{ text: '安装Claude Code', icon: staticFile('icon.svg') }}
 *       note="（Mac、Win 通用）"
 *       items={[{ label: '方法1：', answer: '命令安装' }, { label: '方法2：' }]}
 *       current={0}
 *     />
 *   </Sequence>
 * 组件铺满父容器,几何按 1920×1080 画布像素给;背景(点阵/深色)由调用方铺(白字只上深底,坑 Z7)。
 * 行数 2–6 自动排:行距在 area 里均分,放不下时整组按 rowScale 等比缩(以画面中线 x=960 为轴)。
 */
import React from 'react';
import { Easing, Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { splitGraphemes } from '../textfx/graphemes';

const clampBoth = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 实测时基:原片 30fps。下面帧号都是本地帧(0 = 原片 f064) */
const MEASURED_FPS = 30;

// ── 实测时间点(本地帧;原片帧号 − 64) ──
/** 行 1 灰块开始升起:f127 */
const ROWS_AT = 63;
/** 行间错峰:行 2 灰块/标签/问号都比行 1 晚 6 帧(f133 vs f127,问号 f148 vs f142) */
const ROW_STAGGER = 6;
/** 副标开始:f200 */
const NOTE_AT = 136;
/** 点名(橙框 + 箭头硬出):f246 */
const HIGHLIGHT_AT = 182;
/** 揭晓(灰块一帧翻绿):f293 */
const FLIP_AT = 229;

// ── 实测曲线(u = 本行起点起算的本地帧) ──
/** d-row1-block-rise / -grow:y 137.956→0、缩放 0.900587→1,f127→f142,同一条 bezier */
const BLOCK_DY = 137.956;
const BLOCK_S0 = 0.900587;
const BLOCK_END = 15;
const BLOCK_EASE = Easing.bezier(0.2327, 0.4603, 0.5758, 0.9995);
/** d-row1-block-fade-in:f127 0 → f130 1,二次缓出(rmse 4e-16) */
const BLOCK_FADE_END = 3;
const BLOCK_FADE_EASE = Easing.bezier(0.3159, 0.639, 0.6448, 1.0001);
/** d-row1-label-rise:y 177.539→0,f127→f141(遮罩线以下不可见) */
const LABEL_DY = 177.539;
const LABEL_END = 14;
const LABEL_EASE = Easing.bezier(0.3395, 0.9661, 0.6942, 0.9919);
/** 遮罩线在行心下方 85.15px(行 1 字面下沿恒 y489,行心 403.85) */
const LABEL_CLIP_BELOW = 85.15;
/** d-row*-q*-slide:三个问号字心同帧同位移(整组左滑)92.405→0,行起点 +15 → +23 */
const Q_AT = 15;
const Q_SLIDE_DX = 92.405;
const Q_SLIDE_END = 8;
const Q_SLIDE_EASE = Easing.bezier(0.3831, 0.2311, 0.0653, 0.9679);
/** 问号逐个弹入:第 k 个在 Q_AT + k 帧起;三段乘法(上冲 4 帧 × 回落 4 帧 × 回稳 4 帧),q1/q2/q3 各自实测,第 4 个起沿用 q3 */
type Pop = { up: number; upEase: (t: number) => number; down: number; downEase: (t: number) => number; settle: number; settleEase: (t: number) => number };
const Q_POPS: Pop[] = [
  // d-row1-q1-pop-up/down/settle
  { up: 1.122, upEase: Easing.bezier(0.5285, 0.2656, 0.2556, 0.9959), down: 0.877897, downEase: Easing.bezier(0.4974, 0.3178, 0.5155, 1.0271), settle: 1.015228, settleEase: Easing.bezier(0.7916, 0.42, 0.1963, -0.0365) },
  // d-row1-q2-*
  { up: 1.115, upEase: Easing.bezier(0.3252, -0.1747, 0.2875, 1.0312), down: 0.883408, downEase: Easing.bezier(0.573, 0.1946, 0.4217, 0.8605), settle: 1.015228, settleEase: Easing.bezier(0.6574, 0.3488, 0.3768, -0.3201) },
  // d-row1-q3-*
  { up: 1.118, upEase: Easing.bezier(0.1834, -0.4147, 0.3899, 1.0785), down: 0.87746, downEase: Easing.bezier(0.4411, 0.0645, 0.5112, 0.8383), settle: 1.019368, settleEase: Easing.bezier(0.2086, 0.317, 0.5325, -0.0925) },
];
/** d-macwin-chars(motion-ext charPop):「（」与问号 1 的均值曲线,错峰 1.125 帧,空格不占位 */
const NOTE_POP: Pop = {
  up: 1.1275, upEase: Easing.bezier(0.4951, 0.2195, 0.2586, 0.9853),
  down: 0.87184, downEase: Easing.bezier(0.3322, 0.0749, 0.5458, 0.9981),
  settle: 1.017294, settleEase: Easing.bezier(0.5026, -0.135, 0.6906, 0.5167),
};
const NOTE_STAGGER = 1.125;
/** d-macwin-slide:整行 x 140.726→0,f200→f217 */
const NOTE_DX = 140.726;
const NOTE_SLIDE_END = 17;
const NOTE_SLIDE_EASE = Easing.bezier(0.3781, -0.0077, 0.0057, 0.9901);
const POP_END = 12;
/** 箭头逐帧仿射(arrow_fit.py,f246–f261 共 16 帧,逐帧 MAE ≤0.45;五段 jelly + 四段 sway 拟合的原始表,直接线性连) */
const ARROW_SX = [0.769, 0.769, 0.94, 1.253, 1.075, 0.878, 0.871, 0.966, 1.074, 1.068, 1.021, 0.987, 0.985, 0.989, 0.994, 1];
const ARROW_SY = [1.511, 1.512, 1.091, 0.833, 0.936, 1.181, 1.19, 1.04, 0.935, 0.937, 0.983, 1.014, 1.016, 1.016, 1.008, 1];
const ARROW_ROT = [-2.99, -2.99, -4.83, -1.51, 1.84, 1.86, 1.6, 1.05, 0.43, 0.05, -0.35, -0.44, -0.43, -0.23, -0.08, 0];
const ARROW_FRAMES = ARROW_SX.map((_, i) => i);
const ARROW_END = 15;
/** fx-arrow-*-yellow-fade:黄色层 f248 1 → f254 0(芯色 G 反解,rmse 0.004) */
const YELLOW_FROM = 2;
const YELLOW_TO = 8;
const YELLOW_EASE = Easing.bezier(0, -0.2474, 0.9129, 1.0757);

// ── 实测几何(1080p,行 1 为基准;行心 y 403.85) ──
const G = {
  /** 原片两行行心 403.85 / 668.15 → 行距 264.3,两行中点 536 */
  rowPitch: 264.3,
  /** 灰块 886.81–1381.0 × 338.2–469.5,圆角 14.4,色 #949494 */
  blockLeft: 886.81,
  blockWidth: 494.19,
  blockHeight: 131.3,
  blockRadius: 14.4,
  /** 标签居中 x682.5;真帅体 89.03px 横压 0.86 字距 36、白色实心描边 4.4 */
  labelCx: 682.5,
  labelFont: 89.03,
  labelScaleX: 0.86,
  labelSpacing: 36,
  labelOutline: 4.4,
  /** 标签字面心比行心高约 3px(字面 354–447) */
  labelDy: -3.3,
  /** 标签里的数字 / 冒号换方圆体 600(⑦b glyphClasses):字号 93.4 / 80.4,纵移 2.7 / 4.7 */
  digitFont: 93.4,
  digitDy: 2.7,
  colonFont: 80.4,
  colonDy: 4.7,
  /** 标签以全角冒号结尾时整行右移 24px:全角「：」墨在左半格、右半格空着,不补偿整行视觉偏左(Check f320 实测 534→555) */
  labelColonDx: 24,
  /** 问号:方圆体 700 99.93px,字心间距 83,整组比灰块中心偏左 16.4(原片如此);字盒下移 4.15 使墨框 y630–705 对上原片 */
  qFont: 99.93,
  qGap: 83,
  qGroupDx: -16.4,
  qDy: 4.15,
  /** 弹入锚点:距字盒顶 74.86px(motion-ext transformOrigin) */
  qOriginY: 74.86,
  /** 答案:抖音美好体 104px 横压 0.632 字距 13.5,居灰块中心 */
  answerFont: 104,
  answerScaleX: 0.632,
  answerSpacing: 13.5,
  answerDy: -4.35,
  /** 橙框外沿 500.17–1419.89 × 行心 −83.78 → +86.9,线宽 5,外圆角 29.2 */
  frameLeft: 500.17,
  frameRight: 1419.89,
  frameTop: -83.78,
  frameBottom: 86.9,
  frameWidth: 5,
  frameRadius: 29.2,
  /** 箭头 60×89 三角:左 x398.0、右 x1462.0,顶在行心 −46.85;缩放锚点(motion-ext) */
  arrowLeftX: 398.0,
  arrowRightX: 1462.0,
  arrowTop: -46.85,
  arrowW: 60,
  arrowH: 89,
  /** 页眉:图标白圆心 (601.91,115.04) r74.64;厚底黑 88.1px 字距 −0.5,字盒左 693.6 顶 79.6 */
  iconCx: 601.91,
  iconCy: 115.04,
  iconR: 74.64,
  headerLeft: 693.6,
  headerTop: 79.6,
  headerFont: 88.1,
  /** 副标:得意黑 60.7px,字盒左 1157 顶 175.9;弹入锚点距盒顶 50.53 */
  noteLeft: 1157.0,
  noteTop: 175.9,
  noteFont: 60.7,
  noteOriginY: 50.53,
};

/** 秋芝配色 */
export const QUESTION_TOC_COLORS = {
  block: '#949494',
  answerBg: '#9DFF01',
  answerText: '#000000',
  label: '#FFFFFF',
  question: '#000000',
  frame: '#FF7000',
  arrow: '#FF8F01',
  arrowFlash: '#FED900',
  arrowGlow: 'rgba(255,40,10,0.62)',
  header: '#FFFFFF',
  note: '#FFFFFF',
} as const;

export type QuestionTocItem = {
  /** 左边标签,如「方法1：」「第一步：」。数字和冒号自动换方圆体 */
  label: string;
  /** 答案(揭晓时 / 已讲时显示在绿块里);不给就一直是问号 */
  answer?: string;
};

export type QuestionTocProps = {
  items: QuestionTocItem[];
  /** 前几条已经讲过:入场就是绿块 + 答案(不出问号) */
  doneCount?: number;
  /** 当前讲到第几条(0 起):出橙框 + 箭头;不给就不点名 */
  current?: number;
  /** 当前条到 flipAt 时翻绿揭晓答案(要有 answer);false = 只点名不揭晓 */
  flipCurrent?: boolean;
  /** 每行问号个数,原片 3 */
  questionMarks?: number;
  /** 页眉(可选):图标地址 + 标题 */
  header?: { text: string; icon?: string };
  /** 页眉下的小副标(可选),逐字弹出,如「（Mac、Win 通用）」 */
  note?: string;
  /** 目录行可用的纵向区域(行块上沿 → 下沿,画布 px)。默认 272–800,两行时正好落在原片位置 */
  area?: { top: number; bottom: number };
  /** 整组缩放(以 x=960 为轴);不给就按行数自动算,行少时是 1 */
  rowScale?: number;
  /** 各事件时间(帧,按当前 fps,相对组件起点);默认 = 原片节奏 */
  timing?: { rowsAt?: number; noteAt?: number; highlightAt?: number; flipAt?: number };
  /** 行间错峰(帧,按当前 fps);默认原片 6 帧@30fps */
  rowStaggerFrames?: number;
  /** 速度倍率:只改每个动作本身快慢,不改事件时间;1 = 原片 */
  speed?: number;
  colors?: Partial<Record<keyof typeof QUESTION_TOC_COLORS, string>>;
  fonts?: { label?: string; digit?: string; question?: string; answer?: string; header?: string; note?: string };
};

const popScale = (u: number, p: Pop): number =>
  interpolate(u, [0, 4], [0, p.up], { ...clampBoth, easing: p.upEase }) *
  interpolate(u, [4, 8], [1, p.down], { ...clampBoth, easing: p.downEase }) *
  interpolate(u, [8, 12], [1, p.settle], { ...clampBoth, easing: p.settleEase });

const DIGIT_RE = /^[0-9]$/;
const COLON_RE = /^[：:]$/;

/** 标签墨宽估算(1080p、k=1):汉字 76.6 + 字距,数字约 0.55em,冒号约 0.35em */
const estimateLabelWidth = (g: string[]): number =>
  g.reduce((s, c) => s + (DIGIT_RE.test(c) ? 44 : COLON_RE.test(c) ? 24 : 76.6) + G.labelSpacing, -G.labelSpacing);

export const questionTocDefaultDuration = (fps: number): number => Math.ceil(((FLIP_AT + 60) / MEASURED_FPS) * fps);

export const QuestionToc: React.FC<QuestionTocProps> = ({
  items,
  doneCount = 0,
  current,
  flipCurrent = true,
  questionMarks = 3,
  header,
  note,
  area = { top: 272, bottom: 800 },
  rowScale,
  timing,
  rowStaggerFrames,
  speed = 1,
  colors: colorsIn,
  fonts: fontsIn,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const C = { ...QUESTION_TOC_COLORS, ...colorsIn };
  const F = {
    label: 'HXBZhenShuai',
    digit: 'AlimamaFangYuanTi',
    question: 'AlimamaFangYuanTi',
    answer: 'DouyinSans',
    header: 'AaHouDiHei',
    note: 'SmileySans',
    ...fontsIn,
  };
  const toComp = (measured: number) => (measured / MEASURED_FPS) * fps;
  const rowsAt = timing?.rowsAt ?? toComp(ROWS_AT);
  const noteAt = timing?.noteAt ?? toComp(NOTE_AT);
  const highlightAt = timing?.highlightAt ?? toComp(HIGHLIGHT_AT);
  const flipAt = timing?.flipAt ?? toComp(FLIP_AT);
  const stagger = rowStaggerFrames ?? toComp(ROW_STAGGER);
  /** 事件起算的本地实测帧(可带小数) */
  const since = (at: number) => ((frame - at) / fps) * MEASURED_FPS * speed;

  // ── 排版:行距在区域里均分,放不下就整组等比缩 ──
  const n = Math.max(1, items.length);
  const span = area.bottom - area.top;
  let k = rowScale ?? 1;
  let pitch = G.rowPitch;
  if (n > 1) {
    if (rowScale === undefined) {
      // pitch = (span − 块高·k)/(n−1),k = min(1, pitch/(块高·1.35)) 联立
      const p1 = (span - G.blockHeight) / (n - 1);
      if (p1 >= G.blockHeight * 1.35) k = 1;
      else k = span / (G.blockHeight * 1.35 * (n - 1) + G.blockHeight);
    }
    pitch = Math.min(G.rowPitch * k, (span - G.blockHeight * k) / (n - 1));
  }
  const midY = (area.top + area.bottom) / 2;
  const rowCy = (i: number) => midY + (i - (n - 1) / 2) * pitch;
  const X = (x: number) => 960 + (x - 960) * k;

  const blockCx = X(G.blockLeft + G.blockWidth / 2);
  const blockW = G.blockWidth * k;
  const blockH = G.blockHeight * k;

  const labelMaxW = (X(G.blockLeft) - 40 * k - X(G.labelCx)) * 2;

  const renderLabel = (text: string) => {
    const g = splitGraphemes(text);
    const est = estimateLabelWidth(g) * G.labelScaleX * k;
    const fit = est > labelMaxW ? labelMaxW / est : 1;
    const fs = G.labelFont * k * fit;
    const colonDx = g[g.length - 1] === '：' ? G.labelColonDx * k * fit : 0;
    return (
      <div
        style={{
          position: 'absolute',
          left: X(G.labelCx) - 2000 + colonDx,
          width: 4000,
          top: -fs / 2,
          height: fs,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          scale: `${G.labelScaleX} 1`,
          fontFamily: F.label,
          fontSize: fs,
          lineHeight: 1,
          whiteSpace: 'pre',
          color: C.label,
          letterSpacing: G.labelSpacing * k * fit,
          // 白色实心描边(案例 textOutlines 4.4px):描边画在填充下面
          WebkitTextStroke: `${(G.labelOutline * 2 * k * fit).toFixed(2)}px ${C.label}`,
          paintOrder: 'stroke fill',
        }}
      >
        {/* 字距会在末字后多留一格:左 padding 抵掉,保证居中 */}
        <span style={{ paddingLeft: G.labelSpacing * k * fit }}>
          {g.map((c, i) => {
            if (DIGIT_RE.test(c) || COLON_RE.test(c)) {
              const digit = DIGIT_RE.test(c);
              return (
                <span
                  key={i}
                  style={{
                    fontFamily: F.digit,
                    fontWeight: 600,
                    fontSize: (digit ? G.digitFont : G.colonFont) * k * fit,
                    position: 'relative',
                    top: (digit ? G.digitDy : G.colonDy) * k * fit,
                  }}
                >
                  {c}
                </span>
              );
            }
            return <span key={i}>{c}</span>;
          })}
        </span>
      </div>
    );
  };

  const renderAnswer = (text: string) => {
    const g = splitGraphemes(text);
    const est = g.length * (G.answerFont * G.answerScaleX + G.answerSpacing * G.answerScaleX) * k;
    const maxW = blockW - 36 * k;
    const fit = est > maxW ? maxW / est : 1;
    const fs = G.answerFont * k * fit;
    return (
      <div
        style={{
          position: 'absolute',
          left: -2000,
          width: 4000,
          top: -fs / 2 + G.answerDy * k,
          height: fs,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          scale: `${G.answerScaleX} 1`,
          fontFamily: F.answer,
          fontSize: fs,
          lineHeight: 1,
          whiteSpace: 'pre',
          color: C.answerText,
          letterSpacing: G.answerSpacing * k * fit,
          WebkitTextStroke: `${(0.6 * k).toFixed(2)}px ${C.answerText}`,
          paintOrder: 'stroke fill',
        }}
      >
        <span style={{ paddingLeft: G.answerSpacing * k * fit }}>{text}</span>
      </div>
    );
  };

  const rows = items.map((item, i) => {
    const at = rowsAt + i * stagger;
    const u = since(at);
    if (u < 0) return null;
    const cy = rowCy(i);
    const blockP = interpolate(u, [0, BLOCK_END], [0, 1], { ...clampBoth, easing: BLOCK_EASE });
    const blockSettled = u >= BLOCK_END;
    const blockOpacity = interpolate(u, [0, BLOCK_FADE_END], [0, 1], { ...clampBoth, easing: BLOCK_FADE_EASE });
    const blockDy = BLOCK_DY * k * (1 - blockP);
    const blockS = BLOCK_S0 + (1 - BLOCK_S0) * blockP;
    const labelDy = LABEL_DY * k * interpolate(u, [0, LABEL_END], [1, 0], { ...clampBoth, easing: LABEL_EASE });

    const done = i < doneCount && !!item.answer;
    const flipped = !done && i === current && flipCurrent && !!item.answer && frame >= flipAt;
    const green = done || flipped;

    // 问号:整组左滑 + 逐个弹入(绿块时不画)
    let qNode: React.ReactNode = null;
    const uq = u - Q_AT;
    if (!green && uq >= 0) {
      const slide = Q_SLIDE_DX * k * interpolate(uq, [0, Q_SLIDE_END], [1, 0], { ...clampBoth, easing: Q_SLIDE_EASE });
      const m = Math.max(1, questionMarks);
      const gap = m > 3 ? Math.min(G.qGap, (blockW - 60 * k) / m / k) : G.qGap;
      const groupCx = blockCx + G.qGroupDx * k;
      const qfs = G.qFont * k;
      qNode = Array.from({ length: m }, (_, q) => {
        const uk = uq - q;
        if (uk <= 0) return null;
        const s = popScale(uk, Q_POPS[Math.min(q, Q_POPS.length - 1)]);
        const settled = uk >= POP_END && slide < 0.01;
        const cx = groupCx + (q - (m - 1) / 2) * gap * k + slide;
        return (
          <div
            key={q}
            style={{
              position: 'absolute',
              left: cx - qfs,
              width: qfs * 2,
              top: -qfs / 2 + G.qDy * k,
              height: qfs,
              textAlign: 'center',
              fontFamily: F.question,
              fontWeight: 700,
              fontSize: qfs,
              lineHeight: 1,
              color: C.question,
              WebkitTextStroke: `${(0.8 * k).toFixed(2)}px ${C.question}`,
              paintOrder: 'stroke fill',
              scale: settled ? undefined : `${s}`,
              transformOrigin: `50% ${(G.qOriginY * k).toFixed(2)}px`,
            }}
          >
            ?
          </div>
        );
      });
    }

    return (
      <div key={i} style={{ position: 'absolute', left: 0, top: cy, width: 1920, height: 0 }}>
        {/* 灰块 / 绿块 + 答案(已讲的行答案跟灰块一起升) */}
        <div
          style={{
            position: 'absolute',
            left: blockCx - blockW / 2,
            top: -blockH / 2,
            width: blockW,
            height: blockH,
            borderRadius: G.blockRadius * k,
            background: green ? C.answerBg : C.block,
            opacity: blockSettled ? undefined : blockOpacity,
            translate: blockSettled ? undefined : `0px ${blockDy.toFixed(3)}px`,
            scale: blockSettled ? undefined : `${blockS}`,
          }}
        >
          {green && item.answer ? (
            <div style={{ position: 'absolute', left: blockW / 2, top: blockH / 2 }}>{renderAnswer(item.answer)}</div>
          ) : null}
        </div>
        {qNode}
        {/* 标签:遮罩线(行心下 85.15)以下不可见,从线后升起 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            width: 1920,
            top: -400 * k,
            height: (400 + LABEL_CLIP_BELOW) * k,
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', left: 0, top: (400 + G.labelDy) * k + labelDy }}>{renderLabel(item.label)}</div>
        </div>
      </div>
    );
  });

  // ── 点名:橙框 + 箭头 ──
  let highlightNode: React.ReactNode = null;
  if (current !== undefined && current >= 0 && current < items.length) {
    const u = since(highlightAt);
    if (u >= 0) {
      const cy = rowCy(current);
      const sx = interpolate(u, ARROW_FRAMES, ARROW_SX, clampBoth);
      const sy = interpolate(u, ARROW_FRAMES, ARROW_SY, clampBoth);
      const rot = interpolate(u, ARROW_FRAMES, ARROW_ROT, clampBoth);
      const settled = u >= ARROW_END;
      const yellow = interpolate(u, [YELLOW_FROM, YELLOW_TO], [1, 0], { ...clampBoth, easing: YELLOW_EASE });
      const arrow = (side: 'l' | 'r') => {
        const left = side === 'l';
        const x = X(left ? G.arrowLeftX : G.arrowRightX);
        const w = (left ? G.arrowW : G.arrowW + 1) * k;
        const h = G.arrowH * k;
        const pts = left ? `0,0 ${w},${h / 2} 0,${h}` : `${w},0 0,${h / 2} ${w},${h}`;
        const origin = left ? `${(-1.31 * k).toFixed(2)}px ${(48.44 * k).toFixed(2)}px` : `${(60.75 * k).toFixed(2)}px ${(48.25 * k).toFixed(2)}px`;
        const tf: React.CSSProperties = settled
          ? {}
          : { scale: `${sx} ${sy}`, rotate: `${left ? rot : -rot}deg`, transformOrigin: origin };
        return (
          <div key={side} style={{ position: 'absolute', left: x, top: G.arrowTop * k, width: w, height: h, ...tf }}>
            <svg width={w} height={h} style={{ position: 'absolute', inset: 0, overflow: 'visible', filter: `drop-shadow(0 0 ${7 * k}px ${C.arrowGlow})` }}>
              <polygon points={pts} fill={C.arrow} />
            </svg>
            {yellow > 0.001 ? (
              <svg width={w} height={h} style={{ position: 'absolute', inset: 0, overflow: 'visible', opacity: yellow }}>
                <polygon points={pts} fill={C.arrowFlash} />
              </svg>
            ) : null}
          </div>
        );
      };
      const fl = X(G.frameLeft);
      const fr = X(G.frameRight);
      highlightNode = (
        <div style={{ position: 'absolute', left: 0, top: cy, width: 1920, height: 0 }}>
          <div
            style={{
              position: 'absolute',
              left: fl,
              top: G.frameTop * k,
              width: fr - fl,
              height: (G.frameBottom - G.frameTop) * k,
              boxSizing: 'border-box',
              border: `${G.frameWidth * Math.max(0.6, k)}px solid ${C.frame}`,
              borderRadius: G.frameRadius * k,
            }}
          />
          {arrow('l')}
          {arrow('r')}
        </div>
      );
    }
  }

  // ── 副标:整行右滑入 + 逐字弹入 ──
  let noteNode: React.ReactNode = null;
  if (note) {
    const u = since(noteAt);
    if (u >= 0) {
      const g = splitGraphemes(note);
      const slide = NOTE_DX * interpolate(u, [0, NOTE_SLIDE_END], [1, 0], { ...clampBoth, easing: NOTE_SLIDE_EASE });
      let idx = 0;
      noteNode = (
        <div
          style={{
            position: 'absolute',
            left: G.noteLeft,
            top: G.noteTop,
            height: G.noteFont,
            whiteSpace: 'pre',
            fontFamily: F.note,
            fontSize: G.noteFont,
            lineHeight: 1,
            letterSpacing: 0.2,
            color: C.note,
            translate: slide > 0.01 ? `${slide.toFixed(3)}px 0px` : undefined,
          }}
        >
          {g.map((c, i) => {
            if (c.trim() === '') return <span key={i}>{c}</span>;
            const uc = u - NOTE_STAGGER * idx;
            idx += 1;
            const s = popScale(uc, NOTE_POP);
            const settled = uc >= POP_END;
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  scale: settled ? undefined : `${s}`,
                  transformOrigin: `50% ${G.noteOriginY}px`,
                }}
              >
                {c}
              </span>
            );
          })}
        </div>
      );
    }
  }

  const headerNode = header ? (
    <>
      {header.icon ? (
        <Img
          src={header.icon}
          style={{
            position: 'absolute',
            left: G.iconCx - G.iconR,
            top: G.iconCy - G.iconR,
            width: G.iconR * 2,
            height: G.iconR * 2,
          }}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          left: header.icon ? G.headerLeft : G.iconCx - G.iconR,
          top: G.headerTop,
          fontFamily: F.header,
          fontSize: G.headerFont,
          lineHeight: 1,
          letterSpacing: -0.5,
          whiteSpace: 'pre',
          color: C.header,
        }}
      >
        {header.text}
      </div>
    </>
  ) : null;

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080 }}>
      {headerNode}
      {noteNode}
      {rows}
      {highlightNode}
    </div>
  );
};
