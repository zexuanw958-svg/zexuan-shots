/**
 * CapsuleList.tsx — 「编号胶囊清单 → 证据页」镜头模板(秋芝《40分钟学会Codex》19:42.7「自动记忆原则」实测版)。
 *
 * 出处:内部复刻案例 qz-cx-1182-capsule-list(交付 09,复刻均差 0.97/255),工序④逐帧实测 + 拟合。
 * 默认值 = 原片 30fps 实测曲线与 1080p 几何,不是手调;每条曲线的来源写在常量注释里(案例 specs/motion.json 同名 id)。
 *
 * 构成(自下而上):
 *   黑底(可换色 / 透明)
 *   标题:整行居中,组件第 0 帧硬切出现(原片 f13 硬切黑底)
 *   清单组:N 行「彩色编号胶囊 + 白描边空槽」,整组从画面下方刚体升起(9 帧 easeOutQuad,无回弹)+ 同曲线提亮
 *   编号数字:钉在落定位置不动,只在「胶囊当前位置」里可见 —— 胶囊当移动遮罩把数字扫出来(原片 f22–f24 黄胶囊里会先闪过半个「2」)
 *   槽内字:到点逐字闪烁 14 帧后落定(逐字逐帧查表,原片 NNLS 分解的 6 权重 SVG 滤镜:清晰字形 + 3 档模糊光 + 2 档空心描边)
 *   证据页(可选):清单压暗(9 帧线性到 0.9)→ 证据卡(截图 / 视频 / 任意 React 内容)从下方升起 11 帧 + 3 帧淡入
 *   荧光笔(可选):证据卡里一块黄色 multiply 矩形从左往右擦出(23 帧,慢起-匀速-慢收)
 *
 * 用法:
 *   <Sequence from={x}>
 *     <CapsuleList
 *       title="自动记忆原则"
 *       items={[{ text: '对话过短不记录' }, { text: '没额度不记录', at: 92 }]}
 *       evidence={{ src: staticFile('shot.png'), aspect: 1840 / 446, highlight: { x: 911, y: 323, width: 353, height: 53 } }}
 *     />
 *   </Sequence>
 * 组件铺满父容器(AbsoluteFill),几何按 1920×1080 画布像素给;本地第 0 帧 = 原片 f13(硬切黑底、标题出现那一帧)。
 * 所有「at」类时刻都是当前 fps 的帧、相对组件起点;不给就按原片节奏。speed 只缩放动作本身和默认节奏。
 *
 * 字体(出片工程 fonts.ts 自己加载):
 *   标题 AaHouDiHei(Aa厚底黑,猫啃网免费商用、禁二次分发 → 字体文件不进 git)
 *   槽内字 SmileySans(得意黑,SIL OFL)
 *   编号 HelloFontIDYouQiTi(字由点字油漆体 = 原片同款剪映花字数字,自带做旧内线;剪映缓存取,授权未确认按非商用处理,不进 git)
 */
import React, { useId } from 'react';
import { AbsoluteFill, Easing, Img, OffthreadVideo, Sequence, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

const clampBoth = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 实测时基:原片 30fps。下面帧号都是原片绝对帧号(fNNN) */
const MEASURED_FPS = 30;
/** 组件本地第 0 帧 = 原片 f13(硬切黑底 + 标题) */
const F0 = 13;

// ── 实测曲线(帧号 = 原片帧号) ──
/** list-group-rise:整组刚体上移 dy=827.3·((28−f)/9)²,f19→f28 精确 easeOutQuad,残差 ≤0.04px;dx≡0、无缩放、无回弹 */
const RISE = { from: 19, to: 28, dy: 827.3, ease: Easing.bezier(0.3333, 0.6667, 0.6667, 1) };
/** list-group-rise opacity:黑底逐帧增益 f19 .628 → f27 1(同一条 easeOutQuad,rmse 0.0043) */
const RISE_FADE = { from: 19, to: 27, from0: 0.628 };
/** 整组第一帧可见(f19 组顶在画外,s2 从 f20 挂载) */
const LIST_FIRST_VISIBLE = 20;
/** slot-*-text-flicker:progress 线性 f54:0 → f69:1,step = round(progress·15),1..14 查表、15 落定。两条槽相隔 92 帧 */
const ITEM_AT = [54, 146];
const ITEM_GAP = 92;
const FLICKER_ROWS = 14;
/** dim-overlay-fade:保留比 1 − 0.1·(f−340),遮罩 0.9 × 线性 f340→f349 */
const DIM = { from: 340, to: 349, opacity: 0.9 };
/** evidence-card-rise:dy 472.41 → 0,f341→f352,bezier 拟合 rmse 0.022px(前三帧匀速 ≈70px/帧后减速) */
const CARD_RISE = { from: 341, to: 352, dy: 472.41, ease: Easing.bezier(0.3684, 0.5905, 0.5622, 0.9996) };
/** evidence-card opacity:从 f340.0 起每帧 +0.417 → f343 满 */
const CARD_FADE_F = [340, 342, 343];
const CARD_FADE_V = [0, 0.8338, 1];
/** highlight-wipe:右沿逐帧(0.35px rmse),完整 23 帧 f427 .0042 → f450 1 */
const HIGHLIGHT = { from: 427, to: 450, p0: 0.0042, ease: Easing.bezier(0.3298, 0.0716, 0.6641, 0.9983) };

// ── 实测几何(1080p 画布 px;案例 specs/layout.json) ──
const G = {
  /** 胶囊 (451.94,298.83) 294.24×165.24,白描边 3;空槽 x771.28 宽 777.11,白描边 2.62;两行相距 307 */
  capsuleX: 451.94,
  capsuleW: 294.24,
  rowH: 165.24,
  slotX: 771.28,
  slotW: 777.11,
  firstTop: 298.83,
  pitch: 307,
  capsuleStroke: 3,
  slotStroke: 2.62,
  /** 槽内字:左 856.2(槽左 +84.92)、顶 329.4 / 633.1(槽顶 +30.57 / +27.27,两行实测差 3.3px,第 3 行起取均值),得意黑 111.85px */
  textLeft: 84.92,
  textTop: [30.57, 27.27, 28.92],
  textSize: 111.85,
  /** 槽内字右侧留白(估):原片 7 字刚好不出槽,超出按比例缩字 */
  textRightPad: 52,
  /** 编号:油漆体 155px(1080p 实渲逐帧对原片墨框校准:「1」墨高 122、「2」123,宽 41 / 74 一致);墨心比胶囊中心偏右 0.5、偏上 2.75 */
  digitSize: 155,
  digitDx: 0.5,
  digitDy: -2.75,
  /** 油漆体数字墨心在基线上方 0.3455em(字形 bbox 196..995 / 1000,ascent 941) */
  digitInkCenterEm: 0.3455,
  /** 标题:顶 42.7,Aa厚底黑 125px,整行居中 */
  titleTop: 42.7,
  titleSize: 125,
  /** 证据卡 (40,211) 1840×446 → 中心 y 434 */
  cardCenterY: 434,
  cardMaxW: 1840,
  cardMaxH: 760,
};
/** 原片整组中心(两行):x 1000.17、y 534.95 */
const ORIGINAL_CENTER = { x: 1000.165, y: 534.95 };

/** 原片胶囊色:黄 #FFF489、绿 #9CFE00;第 3 条起是同亮度的补充色 */
export const CAPSULE_PALETTE = ['#FFF489', '#9CFE00', '#7FE7FF', '#FFB3DC', '#FFC46B', '#C9B5FF'] as const;

/**
 * 槽内字逐字闪烁表(案例 specs/text-flicker.json,tools/flicker_fit.py 对原片每帧做全句 NNLS 分解)。
 * [行 = 闪烁第 1..14 帧][列 = 字][6 权重 fill, blur2, blur5, blur12, edge1, edge2.5]
 * A = 槽 1「对话过短不记录」f55–f68;B = 槽 2「没额度不记录」f147–f160。第 i 条用表 i%2,字多于表的按 index % 列数。
 * 表里 σ(px)是 111.85px 字号下的,换字号等比缩。原片额外的局部光斑 / 星芒层(text-glints)没搬。
 */
const FLICKER_BLUR = [2, 5, 12];
const FLICKER_EDGE = [1, 2.5];
const FLICKER_A = [[[0,0,0,0.271,0,0.777],[0,0,0,0.005,0,0.092],[0,0,0,0.207,0.002,0.318],[0,0,0,0.269,0,0.561],[0,0,0,0.014,0,0.227],[0,0,0,0.195,0,0.34],[0,0,0,0.057,0,0.254]],
  [[0,0,0,0.579,0,0.985],[0,0,0,0.097,0,0.412],[0.008,0.333,0,0.323,0,0.381],[0,0,0,0.84,0,1.156],[0,0,0,0.14,0,0.835],[0.006,0,0.075,0.121,0,0.222],[0,0.063,0.018,0.286,0,0.618]],
  [[0,0,0,0.514,0,0.8],[0.144,0.051,0.212,0.388,0,1.215],[0,0,0.312,0.605,0,0.958],[0.004,0.127,0,0.738,0,0.809],[0.111,0.294,0.448,0.231,0,0.87],[0.029,0.096,0,0.061,0,0.07],[0.221,0.262,0.198,0.23,0,0.511]],
  [[0.038,0.458,0.145,0.613,0,0.946],[0,0,0,0.216,0,0.765],[0.184,0.299,0.289,0.448,0,0.799],[0.064,0.334,0,0.459,0,0.59],[0.033,0.196,0.45,0.28,0,1.065],[0.155,0.331,0.293,0.283,0,0.957],[0.118,0.058,0.235,0.128,0,0.377]],
  [[0,0,0,0.463,0,0.806],[0.331,0.23,0.205,0.286,0,0.793],[0,0,0.045,0.124,0,0.221],[0,0,0,0.095,0,0.224],[0.016,0.039,0.192,0.132,0,0.714],[0.125,0.209,0.087,0.122,0,0.37],[0,0,0.013,0.025,0,0.067]],
  [[0.104,0.224,0.056,0.333,0,0.516],[0.188,0,0.117,0.065,0,0.382],[0.106,0.076,0.089,0.246,0,0.407],[0,0.2,0.391,0.722,0,1.157],[0,0.087,0.035,0.066,0,0.207],[0.281,0.245,0.183,0.145,0,0.462],[0.3,0.347,0.146,0.135,0,0.522]],
  [[0,0,0,0.266,0,0.469],[0.421,0.217,0.214,0.175,0,0.598],[0.236,0.091,0.186,0.183,0,0.464],[0.24,0.227,0,0.359,0,0.484],[0.415,0.064,0.375,0.129,0,0.738],[0.213,0.065,0.038,0.068,0,0.162],[0.304,0.307,0.089,0.105,0,0.56]],
  [[0.173,0.328,0.25,0.474,0,0.813],[0.092,0.137,0.058,0.145,0,0.545],[0.07,0.015,0.154,0.073,0,0.299],[0.109,0.028,0.064,0.359,0,0.794],[0.236,0.04,0.191,0.137,0,0.604],[0,0.04,0.091,0.051,0,0.189],[0.261,0.356,0.131,0.212,0,0.878]],
  [[0,0.214,0.462,0.682,0,1.044],[0.507,0.154,0.09,0.111,0,0.288],[0.47,0.199,0.222,0.166,0,0.562],[0.254,0.144,0,0.196,0.014,0.26],[0.457,0.11,0.209,0.11,0,0.494],[0.481,0.242,0.12,0.119,0,0.366],[0.114,0.127,0,0.065,0,0.16]],
  [[0.549,0.219,0.058,0.307,0,0.415],[0.592,0.175,0.146,0.132,0,0.454],[0.59,0.12,0.157,0.105,0,0.472],[0.583,0.179,0.044,0.238,0,0.416],[0.458,0,0.192,0.087,0,0.486],[0.552,0.13,0.126,0.12,0,0.426],[0.352,0.026,0.159,0.086,0,0.462]],
  [[0.71,0.114,0.097,0.136,0,0.311],[0.715,0.167,0.053,0.103,0,0.232],[0.703,0.113,0.144,0.077,0,0.317],[0.598,0.163,0.041,0.174,0,0.344],[0.471,0.131,0.068,0.058,0,0.218],[0.634,0.141,0.103,0.12,0,0.378],[0.617,0.078,0.125,0.114,0,0.436]],
  [[0.841,0.065,0.033,0.051,0.016,0.114],[0.83,0.092,0.02,0.052,0.003,0.11],[0.832,0.069,0.052,0.044,0.016,0.107],[0.776,0.154,0,0.078,0.025,0.067],[0.869,0,0.07,0.032,0,0.101],[0.612,0.054,0,0.063,0.002,0.097],[0.617,0.034,0.009,0.061,0.003,0.075]],
  [[0.917,0.034,0,0.018,0.007,0.032],[0.908,0.043,0,0.018,0.01,0.025],[0.914,0.038,0,0.015,0.015,0.018],[0.913,0.041,0,0.019,0.022,0.004],[0.912,0.039,0,0.006,0.004,0.041],[0.795,0.062,0,0.012,0.01,0.024],[0.616,0.094,0,0.013,0.015,0.019]],
  [[0.917,0.04,0,0.001,0.013,0.006],[0.92,0.043,0,0.003,0.015,0],[0.918,0.043,0,0.003,0.019,0],[0.917,0.044,0,0.002,0.021,0],[0.916,0.043,0,0,0.006,0.027],[0.916,0.039,0,0.01,0.002,0.007],[0.857,0.088,0,0,0.004,0]]];
const FLICKER_B = [[[0,0,0,0.27,0,0.737],[0,0,0.008,0,0,0.089],[0,0,0,0.078,0,0.487],[0,0,0,0.217,0,0.566],[0,0,0,0.08,0,0.237],[0,0,0,0.123,0,0.462]],
  [[0,0.128,0,0.588,0,1.017],[0.04,0,0.121,0.119,0,0.411],[0,0.091,0,0.155,0,0.295],[0,0,0.237,0.863,0,1.399],[0,0,0,0.552,0,0.932],[0.115,0.194,0.106,0.216,0,0.447]],
  [[0,0,0,0.459,0,0.803],[0.138,0,0.354,0.454,0,0.808],[0.001,0.085,0.088,0.574,0,1.1],[0.003,0.062,0.221,0.522,0,0.839],[0.085,0.327,0.341,0.448,0,0.89],[0.003,0.116,0.024,0.037,0,0.059]],
  [[0.064,0.314,0,0.467,0,0.763],[0.065,0,0.128,0.395,0,0.643],[0,0,0,0.198,0,0.337],[0.165,0.285,0.344,0.322,0,0.807],[0.063,0,0.252,0.569,0,0.945],[0.062,0.031,0.279,0.101,0,0.456]],
  [[0,0,0,0.449,0,0.778],[0.312,0.265,0.173,0.333,0.013,0.567],[0,0,0.024,0.137,0,0.238],[0,0,0,0.067,0,0.234],[0.017,0,0.177,0.373,0,0.679],[0.123,0.186,0.145,0.098,0,0.317]],
  [[0.108,0.206,0.082,0.307,0,0.513],[0.16,0.029,0.124,0.081,0.009,0.294],[0.125,0.033,0.11,0.207,0,0.463],[0,0.028,0.887,0.367,0,1.142],[0.016,0.069,0,0.154,0,0.222],[0.328,0.176,0.219,0.113,0,0.438]],
  [[0.02,0.079,0.088,0.3,0,0.524],[0,0,0.042,0.042,0,0.16],[0.433,0.115,0.183,0.25,0,0.645],[0.093,0.115,0.125,0.169,0,0.373],[0.037,0.122,0.054,0.202,0,0.516],[0,0,0.025,0.005,0,0.012]],
  [[0.19,0.294,0.301,0.414,0,0.797],[0.165,0,0.07,0.178,0,0.441],[0.011,0.088,0.046,0.127,0,0.319],[0.081,0,0.225,0.19,0,0.841],[0.243,0.029,0.157,0.226,0,0.557],[0.002,0.036,0.066,0.044,0,0.211]],
  [[0,0.206,0.534,0.567,0,1.047],[0.464,0.163,0.033,0.142,0.002,0.192],[0.482,0.199,0.15,0.195,0,0.555],[0.206,0.129,0.071,0.113,0,0.301],[0.462,0.11,0.153,0.175,0,0.483],[0.565,0.134,0.135,0.112,0,0.329]],
  [[0.607,0.115,0.147,0.25,0,0.403],[0.596,0.181,0.105,0.172,0.008,0.34],[0.573,0.117,0.113,0.12,0,0.452],[0.572,0.103,0.224,0.113,0,0.445],[0.396,0.061,0.115,0.143,0,0.458],[0.573,0.056,0.206,0.103,0.009,0.328]],
  [[0.665,0.18,0.078,0.132,0.006,0.283],[0.76,0.115,0.04,0.106,0,0.173],[0.732,0.058,0.099,0.091,0,0.306],[0.584,0.066,0.143,0.095,0,0.372],[0.468,0.061,0.024,0.093,0,0.206],[0.635,0.127,0.118,0.125,0.003,0.291]],
  [[0.814,0.091,0.037,0.043,0.006,0.143],[0.854,0.061,0.022,0.048,0,0.1],[0.858,0.035,0.02,0.064,0,0.157],[0.81,0.032,0.081,0.04,0,0.134],[0.751,0.124,0.028,0.048,0,0.138],[0.517,0.031,0.062,0.029,0,0.061]],
  [[0.952,0.001,0.006,0.025,0,0.032],[0.947,0.009,0.001,0.024,0.004,0.022],[0.952,0,0,0.023,0,0.038],[0.947,0.004,0,0.018,0,0.043],[0.92,0,0.004,0.016,0.001,0.045],[0.679,0.09,0,0.012,0.017,0.005]],
  [[0.95,0.004,0,0,0.008,0.015],[0.944,0.009,0,0,0.009,0.011],[0.95,0,0,0.002,0.007,0.02],[0.945,0.004,0,0,0.002,0.037],[0.962,0,0,0,0.006,0.011],[0.86,0.064,0,0.004,0.005,0]]];
const FLICKER_TABLES = [FLICKER_A, FLICKER_B];

export type CapsuleItem = {
  /** 槽里的字 */
  text: string;
  /** 胶囊里的编号(默认 1、2、3…);任意短字符都行:「A」「①」「一」 */
  label?: string;
  /** 胶囊底色(默认按 CAPSULE_PALETTE 轮换) */
  color?: string;
  /** 这一条的字开始闪的时刻(当前 fps 的帧,相对组件起点)。默认 = 原片节奏(第 1 条约 1.4 秒,之后每条隔约 3 秒) */
  at?: number;
};

export type CapsuleEvidence = {
  /** 图片 / 视频地址(staticFile(...));和 content 二选一 */
  src?: string;
  type?: 'image' | 'video';
  /** 不用文件、直接塞 React 内容(代码画的界面等),铺满证据卡 */
  content?: React.ReactNode;
  /** 素材宽高比。默认 1840/446(原片长条截图);卡片自动按比例放在画面中上部 */
  aspect?: number;
  /** 直接指定证据卡位置大小(画布 px),覆盖 aspect 推算 */
  box?: { x: number; y: number; width: number; height: number };
  objectFit?: 'cover' | 'contain';
  /** 圆角 / 投影 / 卡底色:原片是直角、无投影的白底截图 */
  radius?: number;
  shadow?: string;
  background?: string;
  /** 视频素材:从素材第几帧开始放(当前 fps) */
  trimBefore?: number;
  /** 荧光笔:证据卡内的矩形,从左往右擦出。默认单位 = 卡内 px;relative: true 时 = 占卡片宽高的比例(换素材 / 换卡片大小不用重算) */
  highlight?: { x: number; y: number; width: number; height: number; color?: string; relative?: boolean };
  /** 证据页开始(压暗第一帧)的时刻(当前 fps,相对组件起点)。默认 = 原片 f340(约 10.9 秒) */
  at?: number;
  /** 荧光笔开始时刻(当前 fps,相对组件起点)。默认 = 证据页开始后 87 原片帧(约 2.9 秒) */
  highlightAt?: number;
};

export type CapsuleListProps = {
  items: CapsuleItem[];
  /** 顶部标题;不给就没有 */
  title?: string;
  /** 证据页;不给 = 只有清单 */
  evidence?: CapsuleEvidence;
  /** 颜色 */
  background?: string | null;
  textColor?: string;
  digitColor?: string;
  /** 胶囊 / 空槽描边色(原片白) */
  strokeColor?: string;
  titleColor?: string;
  palette?: readonly string[];
  /** 压暗:原片黑 0.9 */
  dimColor?: string;
  dimOpacity?: number;
  /** 字体 */
  titleFontFamily?: string;
  textFontFamily?: string;
  digitFontFamily?: string;
  /** 布局:清单组中心点(画布 px)。默认 2 条 = 原片位置;3 条以上往下挪一点避开标题 */
  center?: { x: number; y: number };
  /** 清单组最大总高(默认 2 条 690、3 条起 780);超出就整体等比缩(胶囊、字号一起缩,空槽长度不缩) */
  maxListHeight?: number;
  /** 空槽长度(原片 777.11) */
  slotWidth?: number;
  /** 槽内字闪烁入场;false = 到点直接出现 */
  flicker?: boolean;
  /** 速度倍率:1 = 原片 */
  speed?: number;
  /** 起播延迟(当前 fps) */
  delayFrames?: number;
};

/** 估算字宽(em):中日韩全角 0.8(得意黑实测 0.800),其余 0.5 */
const estimateEm = (s: string, cjk = 0.8, latin = 0.5) =>
  [...s].reduce((a, ch) => a + (/[⺀-鿿＀-￯　-〿]/.test(ch) ? cjk : latin), 0);

const pillPath = (x: number, y: number, w: number, h: number) => {
  const r = h / 2;
  return `M${x + r},${y} H${x + w - r} A${r},${r} 0 0 1 ${x + w - r},${y + h} H${x + r} A${r},${r} 0 0 1 ${x + r},${y} Z`;
};

/** 整个镜头(到荧光笔擦完)需要多少帧(当前 fps);只有清单时算到最后一条落定 + 1 秒 */
export const capsuleListDurationInFrames = (fps: number, itemCount = 2, withEvidence = true, speed = 1): number => {
  const lastItemM = ITEM_AT[0] + Math.max(0, itemCount - 1) * ITEM_GAP + 15 + MEASURED_FPS;
  const endM = withEvidence ? HIGHLIGHT.to : lastItemM;
  return Math.ceil(((endM - F0 + 1) / MEASURED_FPS / speed) * fps);
};

export const CapsuleList: React.FC<CapsuleListProps> = ({
  items,
  title,
  evidence,
  background = '#000000',
  textColor = '#FFFFFF',
  digitColor = '#000000',
  strokeColor = '#FFFFFF',
  titleColor = '#FFFFFF',
  palette = CAPSULE_PALETTE,
  dimColor = '#000000',
  dimOpacity = DIM.opacity,
  titleFontFamily = 'AaHouDiHei',
  textFontFamily = 'SmileySans',
  digitFontFamily = 'HelloFontIDYouQiTi',
  center,
  maxListHeight,
  slotWidth = G.slotW,
  flicker = true,
  speed = 1,
  delayFrames = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps, width: W } = useVideoConfig();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');

  // 原片帧号时刻:换 fps / 调速都在这里折算
  const toMeasured = (localFrames: number) => (localFrames / fps) * MEASURED_FPS * speed;
  const fromMeasured = (measuredFrames: number) => (measuredFrames / MEASURED_FPS / speed) * fps;
  const t = toMeasured(frame - delayFrames) + F0;
  if (t < F0) return null;

  // ── 布局 ──
  const n = Math.max(1, items.length);
  // 行距:≤3 条用原片 141.76(= 0.858 行高);4 条起收紧到 0.3 行高,免得整体缩得太小
  const gapRatio = n <= 3 ? (G.pitch - G.rowH) / G.rowH : 0.3;
  const naturalH = G.rowH * (n + (n - 1) * gapRatio);
  const s = Math.min(1, (maxListHeight ?? (n <= 2 ? 690 : 780)) / naturalH);
  const rowH = G.rowH * s;
  const pitch = rowH * (1 + gapRatio);
  const capW = G.capsuleW * s;
  const midGap = (G.slotX - G.capsuleX - G.capsuleW) * s;
  const groupW = capW + midGap + slotWidth;
  const c = center ?? (n <= 2 ? ORIGINAL_CENTER : { x: ORIGINAL_CENTER.x, y: 580 });
  const groupH = n * rowH + (n - 1) * (pitch - rowH);
  const left = n <= 2 && !center && slotWidth === G.slotW ? G.capsuleX : c.x - groupW / 2;
  const top0 = n === 2 && !center ? G.firstTop : c.y - groupH / 2;
  const slotLeft = left + capW + midGap;
  const rowTop = (i: number) => top0 + i * pitch;

  // ── 整组升起 ──
  const riseP = interpolate(t, [RISE.from, RISE.to], [0, 1], { ...clampBoth, easing: RISE.ease });
  const riseDone = riseP >= 1;
  const dy = riseDone ? 0 : RISE.dy * (1 - riseP);
  const groupOpacity = interpolate(t, [RISE_FADE.from, RISE_FADE.to], [RISE_FADE.from0, 1], { ...clampBoth, easing: RISE.ease });
  const listVisible = t >= LIST_FIRST_VISIBLE;

  // ── 每条字的时刻(原片帧号) ──
  const itemAtM = items.map((it, i) =>
    it.at !== undefined ? F0 + toMeasured(it.at) : i < ITEM_AT.length ? ITEM_AT[i] : ITEM_AT[ITEM_AT.length - 1] + (i - ITEM_AT.length + 1) * ITEM_GAP,
  );

  // ── 证据页时刻 ──
  const evM = evidence?.at !== undefined ? F0 + toMeasured(evidence.at) : DIM.from;
  const hlM = evidence?.highlightAt !== undefined ? F0 + toMeasured(evidence.highlightAt) : evM + (HIGHLIGHT.from - DIM.from);
  const dimA = evidence ? interpolate(t, [evM, evM + (DIM.to - DIM.from)], [0, 1], clampBoth) * dimOpacity : 0;
  const cardP = interpolate(t, [evM + (CARD_RISE.from - DIM.from), evM + (CARD_RISE.to - DIM.from)], [0, 1], { ...clampBoth, easing: CARD_RISE.ease });
  const cardSettled = cardP >= 1;
  const cardOpacity = interpolate(t, CARD_FADE_F.map((f) => f - DIM.from + evM), CARD_FADE_V, clampBoth);
  const cardVisible = !!evidence && t >= evM + (CARD_RISE.from - DIM.from);
  const hlP = interpolate(t, [hlM, hlM + (HIGHLIGHT.to - HIGHLIGHT.from)], [HIGHLIGHT.p0, 1], { ...clampBoth, easing: HIGHLIGHT.ease });

  // 证据卡几何
  const aspect = evidence?.aspect ?? G.cardMaxW / 446;
  const cardW = evidence?.box?.width ?? Math.min(G.cardMaxW, G.cardMaxH * aspect);
  const cardH = evidence?.box?.height ?? cardW / aspect;
  const cardX = evidence?.box?.x ?? (W - cardW) / 2;
  const cardY = evidence?.box?.y ?? Math.max(40, G.cardCenterY - cardH / 2);
  // 视频素材的起播时刻(当前 fps,相对组件起点)
  const videoFrom = Math.round(delayFrames + fromMeasured(evM + (CARD_RISE.from - DIM.from) - F0));

  // ── 槽内字 ──
  const slotText = (it: CapsuleItem, i: number) => {
    const baseSize = G.textSize * s;
    const avail = slotWidth - (G.textLeft + G.textRightPad) * s;
    const est = estimateEm(it.text) * baseSize;
    const size = est > avail ? (baseSize * avail) / est : baseSize;
    const k = size / G.textSize;
    const step = Math.round(t - itemAtM[i]);
    if (step <= 0) return null;
    const style: React.CSSProperties = {
      position: 'absolute',
      left: slotLeft + G.textLeft * s,
      top: rowTop(i) + G.textTop[Math.min(i, 2)] * s + (baseSize - size) / 2,
      fontFamily: textFontFamily,
      fontSize: size,
      lineHeight: 1,
      whiteSpace: 'pre',
      color: textColor,
    };
    if (!flicker || step > FLICKER_ROWS) {
      return (
        <div key={`t${i}`} style={style}>
          {it.text}
        </div>
      );
    }
    const table = FLICKER_TABLES[i % FLICKER_TABLES.length];
    const row = table[step - 1];
    const chars = [...it.text];
    const fid = (j: number) => `${uid}-f${i}-${j}`;
    return (
      <div key={`t${i}`} style={style}>
        <svg aria-hidden width={0} height={0} style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
          <defs>
            {chars.map((_, j) => {
              const w = row[j % row.length];
              const terms: Array<[string, number]> = [
                ...FLICKER_BLUR.map((_s, q) => [`g${q}`, w[1 + q]] as [string, number]),
                ...FLICKER_EDGE.map((_s, q) => [`r${q}`, w[1 + FLICKER_BLUR.length + q]] as [string, number]),
              ];
              return (
                <filter key={j} id={fid(j)} x="-80%" y="-60%" width="260%" height="220%" colorInterpolationFilters="sRGB">
                  {FLICKER_BLUR.map((sg, q) => (
                    <feGaussianBlur key={`g${q}`} in="SourceAlpha" stdDeviation={sg * k} result={`g${q}`} />
                  ))}
                  <feMorphology in="SourceAlpha" operator="dilate" radius={k} result="dil" />
                  <feMorphology in="SourceAlpha" operator="erode" radius={k} result="ero" />
                  <feComposite in="dil" in2="ero" operator="arithmetic" k1={0} k2={1} k3={-1} k4={0} result="ring" />
                  {FLICKER_EDGE.map((sg, q) => (
                    <feGaussianBlur key={`r${q}`} in="ring" stdDeviation={sg * k} result={`r${q}`} />
                  ))}
                  {terms.map(([name, weight], q) => (
                    <feComposite
                      key={`s${q}`}
                      in={q === 0 ? 'SourceAlpha' : `s${q - 1}`}
                      in2={name}
                      operator="arithmetic"
                      k1={0}
                      k2={q === 0 ? w[0] : 1}
                      k3={weight}
                      k4={0}
                      result={`s${q}`}
                    />
                  ))}
                  <feFlood floodColor={textColor} result="ink" />
                  <feComposite in="ink" in2={`s${terms.length - 1}`} operator="in" />
                </filter>
              );
            })}
          </defs>
        </svg>
        {chars.map((ch, j) => (
          <span key={j} style={{ display: 'inline-block', whiteSpace: 'pre', filter: `url(#${fid(j)})` }}>
            {ch}
          </span>
        ))}
      </div>
    );
  };

  // ── 胶囊 / 空槽 / 数字 ──
  const capStroke = G.capsuleStroke * Math.max(0.75, s);
  const slotStroke = G.slotStroke * Math.max(0.75, s);
  const colorOf = (it: CapsuleItem, i: number) => it.color ?? palette[i % palette.length];
  const clipId = `${uid}-digits`;
  const digitSize = G.digitSize * s;

  return (
    <AbsoluteFill style={{ background: background ?? undefined, WebkitFontSmoothing: 'antialiased' }}>
      {title ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            width: W,
            top: G.titleTop,
            textAlign: 'center',
            fontFamily: titleFontFamily,
            fontSize: Math.min(G.titleSize, (W - 160) / Math.max(1, estimateEm(title, 1, 0.55))),
            lineHeight: 1,
            whiteSpace: 'pre',
            color: titleColor,
          }}
        >
          {title}
        </div>
      ) : null}

      {listVisible ? (
        <>
          {/* 清单组:胶囊 + 空槽刚体升起 */}
          <svg
            width={W}
            height={1080}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              overflow: 'visible',
              translate: riseDone ? undefined : `0px ${dy}px`,
              opacity: riseDone ? undefined : groupOpacity,
            }}
          >
            {items.map((it, i) => (
              <g key={i}>
                <path
                  d={pillPath(left + capStroke / 2, rowTop(i) + capStroke / 2, capW - capStroke, rowH - capStroke)}
                  fill={colorOf(it, i)}
                  stroke={strokeColor}
                  strokeWidth={capStroke}
                />
                <path
                  d={pillPath(slotLeft + slotStroke / 2, rowTop(i) + slotStroke / 2, slotWidth - slotStroke, rowH - slotStroke)}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={slotStroke}
                />
              </g>
            ))}
          </svg>
          {/* 编号:钉在落定位置,只在胶囊当前位置里可见(胶囊当移动遮罩) */}
          <svg width={W} height={1080} style={{ position: 'absolute', left: 0, top: 0 }}>
            <defs>
              <clipPath id={clipId}>
                {items.map((_, i) => (
                  <path key={i} d={pillPath(left, rowTop(i) + dy, capW, rowH)} />
                ))}
              </clipPath>
            </defs>
            <g clipPath={riseDone ? undefined : `url(#${clipId})`}>
              {items.map((it, i) => (
                <text
                  key={i}
                  x={left + capW / 2 + G.digitDx * s}
                  y={rowTop(i) + rowH / 2 + G.digitDy * s + G.digitInkCenterEm * digitSize}
                  textAnchor="middle"
                  fontFamily={digitFontFamily}
                  fontSize={it.label && [...it.label].length > 1 ? digitSize * 0.72 : digitSize}
                  fill={digitColor}
                >
                  {it.label ?? String(i + 1)}
                </text>
              ))}
            </g>
          </svg>
          {/* 槽内字(落定位置,不跟组走:原片字在组落定 f28 后才出现) */}
          {items.map((it, i) => slotText(it, i))}
        </>
      ) : null}

      {/* 证据页:压暗 + 证据卡升起 + 荧光笔 */}
      {evidence && dimA > 0 ? <AbsoluteFill style={{ background: dimColor, opacity: dimA }} /> : null}
      {evidence && cardVisible ? (
        <div
          style={{
            position: 'absolute',
            left: cardX,
            top: cardY,
            width: cardW,
            height: cardH,
            overflow: 'hidden',
            borderRadius: evidence.radius ?? 0,
            boxShadow: evidence.shadow,
            background: evidence.background,
            translate: cardSettled ? undefined : `0px ${CARD_RISE.dy * (1 - cardP)}px`,
            opacity: cardOpacity >= 1 ? undefined : cardOpacity,
          }}
        >
          {evidence.content ??
            (evidence.src ? (
              evidence.type === 'video' ? (
                <Sequence from={videoFrom} layout="none">
                  <OffthreadVideo
                    src={evidence.src}
                    muted
                    trimBefore={evidence.trimBefore}
                    style={{ width: '100%', height: '100%', objectFit: evidence.objectFit ?? 'cover' }}
                  />
                </Sequence>
              ) : (
                <Img src={evidence.src} style={{ width: '100%', height: '100%', objectFit: evidence.objectFit ?? 'cover', display: 'block' }} />
              )
            ) : null)}
          {evidence.highlight && t >= hlM ? (
            <div
              style={{
                position: 'absolute',
                left: evidence.highlight.x * (evidence.highlight.relative ? cardW : 1),
                top: evidence.highlight.y * (evidence.highlight.relative ? cardH : 1),
                width: evidence.highlight.width * (evidence.highlight.relative ? cardW : 1) * hlP,
                height: evidence.highlight.height * (evidence.highlight.relative ? cardH : 1),
                background: evidence.highlight.color ?? '#FEDE00',
                mixBlendMode: 'multiply',
              }}
            />
          ) : null}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
