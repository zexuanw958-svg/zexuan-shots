/**
 * PixelLevelMap.tsx — 「像素游戏关卡地图」章节转场模板(秋芝《Claude Code 全解》29:33 实测版)。
 *
 * 出处:内部复刻案例 qz-cc-1773-pixel-map(交付 08),工序④逐帧实测 + 拟合。
 * 默认值 = 原片 30fps 实测曲线与 1080p 几何(specs/motion.json、assets/recreated/pixel-sprites.json),不是手调。
 *
 * 画面:黑底一条横向像素轨道,每章一个像素圆节点(绿 = 已过、红 + 小红旗 = 当前、白 = 未到),
 *       当前节点头顶黄色章节标签,小人站在画面中间不动;「过关」时小人原地跑、整条地图左移一格:
 *   旧节点红→绿、旧旗拔起上飞淡出、旧标签换成黑底绿框完成态边上浮边淡出、橙色填充推进到下一节点,
 *   新节点白→红、新旗从上落下过冲回弹、新标签边淡入边落下。
 *
 * 用法:
 *   <PixelLevelMap
 *     chapters={['入门', '掌握&管理', '个性化', '进阶']}
 *     startChapter={1}          // 开场停在第几章(0 起)
 *     advanceAt={[20, 110]}     // 每个数 = 一次「走到下一章」的起点帧(当前 fps,相对组件起点)
 *   />
 * 组件铺满父容器(AbsoluteFill 语义),几何按 1920×1080 画布像素给。
 * 转场时基:advanceAt 的那一帧 = 原片 f20(小人开始转身);地图 +5 帧起步、+25 帧停稳,新旗 +40 帧回弹完,
 * 小人 +52 帧竖拇指。两次转场间隔 ≥ PIXEL_MAP_MIN_GAP_MEASURED 个原片帧(约 2 秒)才不会叠在一起。
 *
 * 小人是可替换槽位 `avatar`:不给 = 代码画的中性像素小人;给图片路径 / 分帧图集 / React 节点 / 渲染函数都行,
 * 渲染函数会拿到当前动作阶段(idle/turn/run/turnBack/stand/cheer)和跑步步态序号,用来接自己的分帧动画。
 */
import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { fonts } from '../theme';

const clampBoth = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 实测时基:原片 30fps。下面所有帧号都是原片绝对帧号(fNNN) */
const MEASURED_FPS = 30;
/** advanceAt 那一帧对应原片 f20(小人开始转身,地图还没动) */
const ANCHOR = 20;
/** 两次转场之间至少要隔多少原片帧(f20 → 新旗回弹完 f60 + 竖拇指 f75,留余量) */
export const PIXEL_MAP_MIN_GAP_MEASURED = 60;

type Curve = { from: number; to: number; ease: (t: number) => number };
const bz = (a: number, b: number, c: number, d: number) => Easing.bezier(a, b, c, d);

// ── 实测曲线(帧号 = 原片帧号;证据见案例 specs/motion.json 同名 id) ──
/** s1a-map-slide:整条地图左移 0 → −449px,f25→f45,拟合 [0.42,0,0.58,1](= CSS ease-in-out)rmse 0.17px */
const SLIDE: Curve = { from: 25, to: 45, ease: bz(0.42, 0, 0.58, 1) };
/** 地图每次左移距离 = 节点间距 − 1(原片停稳后比格位右偏 1px) */
const SLIDE_TRIM = 1;
/** s1a-node2-turn-green:旧当前节点红态层透明度 1→0,f32→f43,rmse 0.026 */
const TURN_GREEN: Curve = { from: 32, to: 43, ease: bz(0.208, 0.14, 0.416, 1) };
/** s1a-glow-off-node / -flag + s1a-label-off:辉光与黄标签在 f33 硬切掉 */
const OLD_OFF_AT = 33;
/** s1a-label-done-fade:完成态标签亮度比(竖向对齐后),f36→f37 有一级台阶,按实测折线 */
const DONE_FADE_F = [33, 34, 35, 36, 37, 38, 39];
const DONE_FADE_V = [1, 0.913, 0.761, 0.715, 0.352, 0.211, 0];
/** s1a-label-done-rise:完成态上浮 0 → −12px,f33→f38,rmse 0.41px */
const DONE_RISE: Curve & { dy: number } = { from: 33, to: 38, dy: -12, ease: bz(1, 0.65, 0.5, 0.6) };
/** s1a-flag-fade:旧旗亮度比 f32→f41 实测折线 */
const FLAG_OUT_F = [32, 33, 34, 35, 36, 37, 38, 39, 40, 41];
const FLAG_OUT_V = [1, 0.947, 0.889, 0.828, 0.786, 0.601, 0.505, 0.328, 0.155, 0];
/** s1a-flag-flyup:旧旗拔起上飞 0 → −31px,f32→f40(加速),rmse 0.87px */
const FLAG_UP: Curve & { dy: number } = { from: 32, to: 40, dy: -31, ease: bz(0.75, 0.4, 0.3, 0.1) };
/** s1a-fill-advance:下一段虚线被橙色从左往右吃掉,剩余比例 1→0,f37→f45,rmse 0.0099 */
const FILL: Curve = { from: 37, to: 45, ease: bz(0.336, 0.148, 0.3, 0.408) };
/** s1b-glow-on-node:新节点辉光 f48 硬亮 */
const GLOW_ON_AT = 48;
/** s1b-node3-turn-red:新节点红态层 0→1,f47→f58,rmse 0.018 */
const TURN_RED: Curve = { from: 47, to: 58, ease: bz(0.252, 0.01, 0.256, 0.9) };
/** s1b-flag-drop:新旗 −65 → +5(过冲),f47→f54;透明度 f47→f52 */
const FLAG_DROP: Curve & { y0: number; y1: number } = { from: 47, to: 54, y0: -65, y1: 5, ease: bz(0.14, 0.212, 0.224, 0.956) };
const FLAG_DROP_FADE: Curve = { from: 47, to: 52, ease: bz(0.536, 0.724, 0.332, 0.74) };
/** s1b-flag-settle:回弹 +5 → 0,f56→f60 */
const FLAG_SETTLE: Curve & { dy: number } = { from: 56, to: 60, dy: -5, ease: bz(0.596, 0.396, 0, 0.284) };
/** s1b-label-in / -drop:新标签淡入 f47→f55 + 从 −20.7px 落下 */
const LABEL_IN: Curve = { from: 47, to: 55, ease: bz(0.8, 1, 0.35, 0.55) };
const LABEL_DROP: Curve & { y0: number } = { from: 47, to: 55, y0: -20.7, ease: bz(0.65, 1, 0.6, 0.65) };
/** 小人动作表(plan.md §3 逐帧看):f20–23 转身、f24–57 原地跑(约 4 帧一步)、f58–61 转回、f62–71 站定、f72 起竖拇指 */
const HERO_PHASES = { turn: 20, run: 24, turnBack: 58, stand: 62, cheer: 72 } as const;
/** 竖拇指保持多久后回到待机(原片 f75–f97 一直保持到硬切;模板里保持 60 帧再回待机,方便连着用) */
const CHEER_HOLD = 60;

// ── 实测几何(1080p 画布 px;layout.json + pixel-sprites.json) ──
const G = {
  /** 节点 12×12 格 × 8px = 96px;左上角 y283,中心 y331 */
  nodeSize: 96,
  nodeTop: 283,
  /** 节点间距(f000 origins 461/911/1361/1811) */
  spacing: 450,
  /** 当前节点中心 x(f000 = 959) */
  centerX: 959,
  /** 起点小节点 = 同一角色图缩到 5.75px/格(69px),中心在第 0 章左边 449px(= 间距 − 1) */
  startNodeSize: 69,
  /** 起点虚线框 100×100,线宽 8,每段 16 空 5;底边中段是一整条更亮的 */
  startBox: 100,
  /** 轨道:外带 y316.5–344.5,芯 y324.5–336.5;外带从起点框右内侧(起点中心 +30)开始,到最后一章中心结束 */
  bandTop: 316.5,
  bandH: 28,
  coreTop: 324.5,
  coreH: 12,
  bandStartFromStart: 30,
  /** 起点框右边两格轨道被压暗 53%(x101.5–117.5 = 框左沿 +92) */
  startDimFrom: 92,
  startDimW: 16,
  /** 虚线周期 50:实 38 + 空 8.5 + 实 3.5,锚在节点右沿 */
  dashA: 38,
  dashGap: 8.5,
  dashPeriod: 50,
  /** 旗:13×12 格 × 8px,左上角相对节点左上角 (20.5, −84);硬投影偏 (+3.5, +8) 不透明度 0.55 */
  flagDX: 20.5,
  flagDY: -84,
  flagShadowDX: 3.5,
  flagShadowDY: 8,
  flagShadowOpacity: 0.55,
  /** 旗杆在红节点上投的暗条:相对节点左上角 (40,12) 24×8 */
  pole: [40, 12, 24, 8] as const,
  /** 辉光 = 剪影 + blur 23px,不透明度 0.96 */
  glowBlur: 23,
  glowOpacity: 0.96,
  /** 标签:盒顶 y63 高 107,左右留白 45.5(盒宽 = 字宽 + 约 91);指针三角 17×11.5 顶在 y169.5 */
  labelTop: 63,
  labelH: 107,
  labelPadX: 45.5,
  pointerTop: 169.5,
  pointerW: 17,
  pointerH: 11.5,
  labelFont: 58,
  labelTextDy: -1,
  /** 完成态:黑底 3.8px 绿框 */
  doneBorder: 3.8,
  /** 小人框(案例 hero 视频层 836,428 240×376) */
  avatarBox: { x: 836, y: 428, width: 240, height: 376 },
};

// ── 像素精灵格子(pixel-sprites.json,在原片上逐格量出) ──
const NODE_GRID = [
  '....AAAA....',
  '..AABBBBAA..',
  '.ABBCCCCCCA.',
  '.DCCCCCCCCA.',
  'ABCCCCCCCCCA',
  'ACCCCCCCCCCA',
  'ACCCCCCCCCCA',
  'ACCCCCCCCCEA',
  '.ACCCCCCCCF.',
  '.ACCCCCCEEA.',
  '..AAEEEEAA..',
  '....AAAA....',
];
const FLAG_GRID = [
  '.............',
  '..OKO........',
  '..OPOOOOOO...',
  '..OPHHHHHHO..',
  '..OPRRRRRRRO.',
  '..OPRRRRRRRO.',
  '..OPLLLLLLO..',
  '..OPOOOOOO...',
  '..OPO........',
  '..OPO........',
  '..OPO........',
  '..OPO........',
];

/** 节点调色板:A 描边 / B 高光 / C 填充 / D 描边高光 / E 暗部 / F 描边暗部 */
export type NodePalette = Record<'A' | 'B' | 'C' | 'D' | 'E' | 'F', string>;
/** 旗调色板:O 描边 / P 旗杆 / K 杆顶 / H 旗面高光 / R 旗面 / L 旗面暗部 */
export type FlagPalette = Record<'O' | 'P' | 'K' | 'H' | 'R' | 'L', string>;

export type PixelMapPalette = {
  /** 画面底色;transparent = 不铺底 */
  background: string;
  /** 已过 / 当前 / 未到 三种节点 */
  done: NodePalette;
  current: NodePalette;
  todo: NodePalette;
  flag: FlagPalette;
  /** 当前节点与旗的辉光色 */
  glow: string;
  /** 旗杆在节点上的投影 */
  pole: string;
  /** 轨道外带 / 已走橙芯 / 未走虚线 */
  trackBand: string;
  trackDone: string;
  trackTodo: string;
  /** 起点虚线框 / 底边中段 */
  startBox: string;
  startBoxBottom: string;
  /** 黄标签:底 / 字 / 指针 / 内沿两圈高光 */
  labelBg: string;
  labelText: string;
  labelPointer: string;
  labelHi1: string;
  labelHi2: string;
  /** 完成态标签:底 / 框 / 字 / 指针 */
  doneBg: string;
  doneBorder: string;
  doneText: string;
  donePointer: string;
};

/** 原片配色(逐格取色) */
export const PIXEL_MAP_PALETTES: Record<'original' | 'neon' | 'paper', PixelMapPalette> = {
  original: {
    background: '#000000',
    done: { A: '#D69039', B: '#A9D08F', C: '#6AB239', D: '#E6BB8B', E: '#497E2B', F: '#95652A' },
    current: { A: '#D48E3C', B: '#E88682', C: '#D83A3B', D: '#E6BA8E', E: '#952829', F: '#9D602B' },
    todo: { A: '#D6903B', B: '#EBEBEB', C: '#EBEBEB', D: '#E8BB8C', E: '#A3A4A4', F: '#92652E' },
    flag: { O: '#452817', P: '#B26621', K: '#E7974C', H: '#E4615C', R: '#C1393B', L: '#8C1C1B' },
    glow: '#8C2123',
    pole: '#612D2C',
    trackBand: '#4A2F1A',
    trackDone: '#D59138',
    trackTodo: '#5C3F36',
    startBox: '#37220F',
    startBoxBottom: '#4A3019',
    labelBg: '#F1C65C',
    labelText: '#2A1708',
    labelPointer: '#F0C45E',
    labelHi1: '#EDE2C0',
    labelHi2: '#FEDF98',
    doneBg: '#000000',
    doneBorder: '#506432',
    doneText: '#B0C89C',
    donePointer: '#4D7323',
  },
  /** 赛博蓝紫:深蓝底,已过青、当前品红、未到灰蓝 */
  neon: {
    background: '#0B0E1F',
    done: { A: '#5B6CFF', B: '#9FF5F0', C: '#2FD3C8', D: '#A7B0FF', E: '#15877F', F: '#3C46A8' },
    current: { A: '#5B6CFF', B: '#FF9BD9', C: '#F2389F', D: '#A7B0FF', E: '#9A1463', F: '#3C46A8' },
    todo: { A: '#5B6CFF', B: '#C9CDE6', C: '#C9CDE6', D: '#A7B0FF', E: '#8288A8', F: '#3C46A8' },
    flag: { O: '#1A1440', P: '#8D96FF', K: '#D4D8FF', H: '#FFE08A', R: '#FFC23D', L: '#B8820F' },
    glow: '#B01875',
    pole: '#3A1150',
    trackBand: '#1C2150',
    trackDone: '#2FD3C8',
    trackTodo: '#343B78',
    startBox: '#2A3070',
    startBoxBottom: '#3A418A',
    labelBg: '#2FD3C8',
    labelText: '#07122A',
    labelPointer: '#2FD3C8',
    labelHi1: '#A9F3EE',
    labelHi2: '#6BE6DD',
    doneBg: '#0B0E1F',
    doneBorder: '#3C46A8',
    doneText: '#8E97D8',
    donePointer: '#3C46A8',
  },
  /** 泽轩暖纸:纸底,已过 teal、当前泽轩橙、未到米白 */
  paper: {
    background: '#F6F0E5',
    done: { A: '#1C1B17', B: '#9CC9C1', C: '#4B8A80', D: '#6E6A60', E: '#3A6F67', F: '#1C1B17' },
    current: { A: '#1C1B17', B: '#F4B98E', C: '#E07B39', D: '#6E6A60', E: '#C9662A', F: '#1C1B17' },
    todo: { A: '#1C1B17', B: '#FDFAF2', C: '#FDFAF2', D: '#6E6A60', E: '#CFC7B6', F: '#1C1B17' },
    flag: { O: '#1C1B17', P: '#6E6A60', K: '#3E3B34', H: '#F4B98E', R: '#E07B39', L: '#C9662A' },
    glow: '#E9A56F',
    pole: '#B8AE9C',
    trackBand: '#D8CFBE',
    trackDone: '#E07B39',
    trackTodo: '#BDB3A0',
    startBox: '#6E6A60',
    startBoxBottom: '#3E3B34',
    labelBg: '#1C1B17',
    labelText: '#FFF9E3',
    labelPointer: '#1C1B17',
    labelHi1: '#3E3B34',
    labelHi2: '#2A2823',
    doneBg: '#F6F0E5',
    doneBorder: '#4B8A80',
    doneText: '#4B8A80',
    donePointer: '#4B8A80',
  },
};

/** 小人槽位拿到的动作状态 */
export type PixelAvatarState = {
  /** idle 待机 / turn 转身 / run 原地跑 / turnBack 转回 / stand 站定 / cheer 竖拇指(过关) */
  phase: 'idle' | 'turn' | 'run' | 'turnBack' | 'stand' | 'cheer';
  /** 进入当前阶段后过了多少「原片帧」(30fps 口径,已按 speed 折算,可带小数) */
  phaseFrame: number;
  /** 跑步步态序号 0–3(每 2 个原片帧换一格:迈左 → 并腿 → 迈右 → 并腿,约 4 帧一步) */
  runStep: 0 | 1 | 2 | 3;
  /** 当前停在 / 正要去第几章(0 起) */
  chapter: number;
};

/** 分帧图集:按阶段换图(PNG/WebP,透明底);run 给几张就循环几张 */
export type PixelAvatarSprites = {
  idle: string;
  run?: string[];
  turn?: string;
  stand?: string;
  cheer?: string;
};

export type PixelLevelMapProps = {
  /** 章节名(4–12 个最合适,更多也能画) */
  chapters: string[];
  /** 开场停在第几章(0 起) */
  startChapter?: number;
  /** 每次「走到下一章」的起点帧(当前 fps,相对组件起点;这一帧 = 小人开始转身) */
  advanceAt?: number[];
  /** 配色:预设名或完整调色板 */
  palette?: keyof typeof PIXEL_MAP_PALETTES | PixelMapPalette;
  /** 小人槽位:不给 = 内置像素小人;字符串 = 单张图;图集 = 按阶段换图;React 节点 = 原样放;函数 = 拿动作状态自己画 */
  avatar?: string | PixelAvatarSprites | React.ReactNode | ((s: PixelAvatarState) => React.ReactNode);
  /** 小人框(画布 px),默认原片位置 (836,428) 240×376 */
  avatarBox?: { x: number; y: number; width: number; height: number };
  /** 不要小人 */
  hideAvatar?: boolean;
  /** 整张地图上下平移(px,正 = 往下) */
  offsetY?: number;
  /** 当前节点停在画面哪一列(px),原片 959 */
  centerX?: number;
  /** 节点间距(px),原片 450 */
  spacing?: number;
  /** 起点虚线框(原片有) */
  showStart?: boolean;
  /** 标签字体 / 字号(原片得意黑 58px);标签太长会自动缩字号到 labelMaxWidth 以内 */
  labelFontFamily?: string;
  labelFontSize?: number;
  labelMaxWidth?: number;
  /** 速度倍率:1 = 原片(一次转场约 1.4 秒);0.8 更稳,1.3 更利落 */
  speed?: number;
};

// ── 工具 ──
const prog = (t: number, c: Curve) => interpolate(t, [c.from, c.to], [0, 1], { ...clampBoth, easing: c.ease });
const table = (t: number, xs: number[], ys: number[]) => interpolate(t, xs, ys, clampBoth);

/** 格子 → 按颜色合并的 path(crispEdges),避免几百个 rect */
const gridPaths = (grid: string[], pitch: number, colors: Record<string, string>) => {
  const byColor: Record<string, string> = {};
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      const ch = row[x];
      const c = colors[ch];
      if (!c) continue;
      byColor[c] = (byColor[c] ?? '') + `M${x * pitch} ${y * pitch}h${pitch}v${pitch}h${-pitch}Z`;
    }
  });
  return Object.entries(byColor).map(([c, d]) => <path key={c} d={d} fill={c} />);
};

const PixelSprite: React.FC<{
  grid: string[];
  pitch: number;
  colors: Record<string, string>;
  style?: React.CSSProperties;
}> = ({ grid, pitch, colors, style }) => {
  const w = grid[0].length * pitch;
  const h = grid.length * pitch;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" style={{ position: 'absolute', overflow: 'visible', ...style }}>
      {gridPaths(grid, pitch, colors)}
    </svg>
  );
};

/** 剪影(所有非空格子同一个色):辉光 / 旗投影用 */
const silhouette = (grid: string[], color: string) => {
  const map: Record<string, string> = {};
  grid.join('').split('').forEach((ch) => {
    if (ch !== '.') map[ch] = color;
  });
  return map;
};

/** 标签字号:按字宽估算(得意黑中文 ≈0.86em、西文/符号 ≈0.5em),超过 maxWidth 就等比缩 */
const fitLabelSize = (text: string, size: number, maxWidth: number) => {
  let em = 0;
  for (const ch of text) em += /[\u0000-ÿ]/.test(ch) ? 0.52 : 0.86;
  const w = em * size;
  return w > maxWidth ? (size * maxWidth) / w : size;
};

// ────────────────────────────────────────────────────────────────────────────
// 内置占位小人(代码画的中性像素小人,18×28 格 × 12px):正面待机 / 侧身跑 3 帧 / 举双手过关
// ────────────────────────────────────────────────────────────────────────────
const AV_PITCH = 12;
const AV_COLORS: Record<string, string> = {
  K: '#1E1A1D',
  H: '#4A3428',
  h: '#7A5540',
  S: '#F3C9A4',
  C: '#F0A08E',
  E: '#1E1A1D',
  T: '#3F7BE0',
  t: '#2C5CB0',
  P: '#363B4E',
  p: '#262A38',
  B: '#F2F2F2',
  b: '#BDBDBD',
  G: '#3A3A40',
};
const AV_HEAD_FRONT = [
  '.....KKKKKKKK.....',
  '....KHHHHHHHHK....',
  '...KHHhhHHHHHHK...',
  '...KHHHHHHHHHHK...',
  '...KHHSSSSSSHHK...',
  '...KHSSSSSSSSHK...',
  '...KSSEESSEESSK...',
  '...KSSEESSEESSK...',
  '...KSCCSSSSCCSK...',
  '...KSSSSKKSSSSK...',
  '....KSSSSSSSSK....',
  '.....KKKSSKKK.....',
];
const AV_BODY_FRONT = [
  '....KKTTTTTTKK....',
  '...KTTTTTTTTTTK...',
  '..KTTKTTTTTTKTTK..',
  '..KSKTTTTTTTTKSK..',
  '..KSKTTTTTTTTKSK..',
  '..KSKttttttttKSK..',
  '...K.KPPPPPPK.K...',
];
const AV_BODY_CHEER = [
  '.KSKKTTTTTTTTKKSK.',
  '..KTTTTTTTTTTTTK..',
  '....KTTTTTTTTK....',
  '....KTTTTTTTTK....',
  '....KTTTTTTTTK....',
  '....KttttttttK....',
  '.....KPPPPPPK.....',
];
/** 举双手:手在头两侧(头行 5–11 的最外两列) */
const AV_CHEER_ARMS: Array<[number, string]> = [
  [4, '.K..............K.'],
  [5, 'KSK............KSK'],
  [6, 'KSK............KSK'],
  [7, '.KSK..........KSK.'],
  [8, '.KSK..........KSK.'],
  [9, '.KSK..........KSK.'],
  [10, '.KSK..........KSK.'],
  [11, '.KSK..........KSK.'],
];
const AV_LEGS_FRONT = [
  '.....KPPKKPPK.....',
  '.....KPPKKPPK.....',
  '.....KPPKKPPK.....',
  '.....KPPKKPPK.....',
  '....KBBBKKBBBK....',
  '....KBbbKKbbBK....',
  '.....KKK..KKK.....',
  '...GGGGGGGGGGGG...',
];
const AV_HEAD_SIDE = [
  '.....KKKKKKK......',
  '....KHHHHHHHK.....',
  '...KHHhhHHHHHK....',
  '...KHHHHHHHHHK....',
  '...KHHHHHSSSSK....',
  '...KHHHHSSSSSSK...',
  '...KHHHSSSSEESK...',
  '...KHHHSSSSEESK...',
  '...KHHSSSSSCSSK...',
  '....KHSSSSSKKK....',
  '.....KSSSSSSK.....',
  '......KKSSKK......',
];
const AV_BODY_SIDE = [
  '.....KKTTTTKK.....',
  '....KTTTTTTTTK....',
  '....KTTTKSKTTK....',
  '....KTTKSSKTTK....',
  '....KtttKKKttK....',
  '.....KPPPPPPK.....',
  '.....KPPPPPPK.....',
];
const AV_LEGS_STRIDE_A = [
  '....KpppKPPPPK....',
  '...KpppK..KPPPK...',
  '..KpppK....KPPPK..',
  '.KpppK......KPPK..',
  'KBBBK.......KBBBK.',
  'KBbbK........KBbbK',
  '.KKK..........KKK.',
  '...GGGGGGGGGGGG...',
];
const AV_LEGS_STRIDE_B = [
  '....KPPPPKpppK....',
  '...KPPPK..KpppK...',
  '..KPPPK....KpppK..',
  '.KPPPK......KppK..',
  'KBBBK.......KBBBK.',
  'KBbbK........KBbbK',
  '.KKK..........KKK.',
  '...GGGGGGGGGGGG...',
];
const AV_LEGS_PASS = [
  '......KPPPPK......',
  '......KPPPPK......',
  '......KPPPPK......',
  '......KPPPPK......',
  '.....KBBBBBBK.....',
  '.....KBbbbbBK.....',
  '......KKKKKK......',
  '...GGGGGGGGGGGG...',
];
const withRows = (grid: string[], rows: Array<[number, string]>) =>
  grid.map((row, i) => {
    const o = rows.find(([r]) => r === i);
    if (!o) return row;
    return row
      .split('')
      .map((ch, x) => (o[1][x] !== '.' ? o[1][x] : ch))
      .join('');
  });
const AV_FRONT = [...AV_HEAD_FRONT, ...AV_BODY_FRONT, ...AV_LEGS_FRONT];
const AV_CHEER = withRows([...AV_HEAD_FRONT, ...AV_BODY_CHEER, ...AV_LEGS_FRONT], AV_CHEER_ARMS);
const AV_SIDE_PASS = [...AV_HEAD_SIDE, ...AV_BODY_SIDE, ...AV_LEGS_PASS];
const AV_RUN = [
  [...AV_HEAD_SIDE, ...AV_BODY_SIDE, ...AV_LEGS_STRIDE_A],
  AV_SIDE_PASS,
  [...AV_HEAD_SIDE, ...AV_BODY_SIDE, ...AV_LEGS_STRIDE_B],
  AV_SIDE_PASS,
];

/** 内置占位小人:按动作阶段换格子图;跑步并腿帧整体上跳一格(12px,整像素,不产生亚像素漂移) */
export const DefaultPixelAvatar: React.FC<{ state: PixelAvatarState; width: number; height: number }> = ({ state, width, height }) => {
  const grid =
    state.phase === 'run'
      ? AV_RUN[state.runStep]
      : state.phase === 'turn' || state.phase === 'turnBack'
        ? AV_SIDE_PASS
        : state.phase === 'cheer'
          ? AV_CHEER
          : AV_FRONT;
  const w = grid[0].length * AV_PITCH;
  const h = grid.length * AV_PITCH;
  const hop = state.phase === 'run' && state.runStep % 2 === 1 ? -AV_PITCH : 0;
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      style={{ position: 'absolute', left: Math.round((width - w) / 2), top: height - h - 8 }}
    >
      {/* 影子不跟着跳:先画影子行,再画身体 */}
      {gridPaths(grid.map((r) => r.replace(/[^G]/g, '.')), AV_PITCH, AV_COLORS)}
      <g transform={hop ? `translate(0 ${hop})` : undefined}>{gridPaths(grid.map((r) => r.replace(/G/g, '.')), AV_PITCH, AV_COLORS)}</g>
    </svg>
  );
};

const isSprites = (a: unknown): a is PixelAvatarSprites =>
  typeof a === 'object' && a !== null && !React.isValidElement(a) && typeof (a as PixelAvatarSprites).idle === 'string';

// ────────────────────────────────────────────────────────────────────────────
export const PixelLevelMap: React.FC<PixelLevelMapProps> = ({
  chapters,
  startChapter = 0,
  advanceAt = [],
  palette: paletteIn = 'original',
  avatar,
  avatarBox = G.avatarBox,
  hideAvatar = false,
  offsetY = 0,
  centerX = G.centerX,
  spacing = G.spacing,
  showStart = true,
  labelFontFamily = fonts.smiley,
  labelFontSize = G.labelFont,
  labelMaxWidth = 380,
  speed = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps, width: W } = useVideoConfig();
  const pal = typeof paletteIn === 'string' ? PIXEL_MAP_PALETTES[paletteIn] : paletteIn;
  const n = chapters.length;
  const start = Math.max(0, Math.min(n - 1, startChapter));

  // 每次转场的「原片帧号时刻」:advanceAt[k] 那一帧 = f20;超出章节数的转场忽略
  const toMeasured = (local: number) => (local / fps) * MEASURED_FPS * speed;
  const trans = advanceAt.slice(0, Math.max(0, n - 1 - start)).map((at) => toMeasured(frame - at) + ANCHOR);
  /** 第 k 次转场的时刻;没有这次转场 → −∞(还没开始) */
  const tk = (k: number) => (k >= 0 && k < trans.length ? trans[k] : -Infinity);

  // ── 地图位移:当前章中心对齐 centerX,每次转场左移 spacing−1 ──
  const slideDist = spacing - SLIDE_TRIM;
  const slid = trans.reduce((acc, t) => acc + prog(t, SLIDE) * slideDist, 0);
  const tx = centerX - start * spacing - slid;
  const cx = (j: number) => tx + j * spacing; // 第 j 章节点中心(画布 px)
  const nodeTop = G.nodeTop + offsetY;
  const nodeCy = nodeTop + G.nodeSize / 2;
  const half = G.nodeSize / 2;
  const visible = (x: number, margin = 400) => x > -margin && x < W + margin;

  // ── 轨道 ──
  const startCx = cx(0) - (spacing - SLIDE_TRIM); // 原片 −449 = −(间距 − 1)
  const bandFrom = showStart ? startCx + G.bandStartFromStart : cx(0);
  const bandTo = cx(n - 1);
  // 已走橙芯的右端:起始到当前章中心;转场里从旧节点右沿按实测擦到新节点左沿,停稳后到新节点中心
  let doneEnd = cx(start);
  trans.forEach((t, k) => {
    const a = start + k;
    if (t >= FILL.to) doneEnd = Math.max(doneEnd, cx(a + 1));
    else if (t >= FILL.from) {
      const segFrom = cx(a) + half;
      const segLen = spacing - G.nodeSize;
      doneEnd = Math.max(doneEnd, segFrom + segLen * prog(t, FILL));
    }
  });

  const segs: React.ReactNode[] = [];
  for (let j = 0; j < n - 1; j += 1) {
    const x0 = cx(j) + half;
    const x1 = cx(j + 1) - half;
    if (!visible(x0) && !visible(x1)) continue;
    // 虚线锚在节点右沿:实 38 → 空 8.5 → 实 3.5(周期 50,和原片 todoGapX_mod50 一致)
    segs.push(
      <div
        key={`d${j}`}
        style={{
          position: 'absolute',
          left: x0,
          top: G.coreTop + offsetY,
          width: x1 - x0,
          height: G.coreH,
          backgroundImage: `repeating-linear-gradient(90deg, ${pal.trackTodo} 0px ${G.dashA}px, ${pal.trackBand} ${G.dashA}px ${G.dashA + G.dashGap}px, ${pal.trackTodo} ${G.dashA + G.dashGap}px ${G.dashPeriod}px)`,
        }}
      />,
    );
  }

  // ── 每章节点状态 ──
  // 第 j 章相对开场当前章的序号 m:m<0 早已过关(绿);m=0 开场当前(红);m>0 在第 m−1 次转场变红、第 m 次转场变绿
  const nodes: React.ReactNode[] = [];
  const glows: React.ReactNode[] = [];
  const flags: React.ReactNode[] = [];
  const labels: React.ReactNode[] = [];
  const nodeSvg = (p: NodePalette, key: string, left: number, opacity = 1) =>
    opacity <= 0 ? null : (
      <PixelSprite key={key} grid={NODE_GRID} pitch={8} colors={p} style={{ left, top: nodeTop, opacity: opacity >= 1 ? undefined : opacity }} />
    );

  for (let j = 0; j < n; j += 1) {
    const x = cx(j);
    if (!visible(x)) continue;
    const left = x - half;
    const m = j - start;
    const tIn = tk(m - 1); // 变红那次
    const tOut = tk(m); // 变绿那次
    if (m < 0) {
      nodes.push(nodeSvg(pal.done, `n${j}g`, left));
      continue;
    }
    const redIn = m === 0 ? 1 : prog(tIn, TURN_RED);
    const greenP = prog(tOut, TURN_GREEN);
    const greenOn = tOut >= TURN_GREEN.from;
    if (m > 0 && redIn < 1 && !greenOn) nodes.push(nodeSvg(pal.todo, `n${j}w`, left));
    if (greenOn) nodes.push(nodeSvg(pal.done, `n${j}g`, left));
    nodes.push(nodeSvg(pal.current, `n${j}r`, left, redIn * (1 - greenP)));

    // 是不是「当前」:进场后(或开场就是)且还没过 f33
    const arrived = m === 0 || tIn >= FLAG_DROP.from;
    const leaving = tOut >= OLD_OFF_AT;

    // 旗:入场 = 落下过冲回弹 + 淡入;离场 = 拔起上飞 + 淡出
    let flagY = 0;
    let flagA = 1;
    if (m > 0) {
      flagY = interpolate(tIn, [FLAG_DROP.from, FLAG_DROP.to], [FLAG_DROP.y0, FLAG_DROP.y1], { ...clampBoth, easing: FLAG_DROP.ease }) + prog(tIn, FLAG_SETTLE) * FLAG_SETTLE.dy;
      flagA = prog(tIn, FLAG_DROP_FADE);
    }
    if (tOut >= FLAG_UP.from) {
      flagY += prog(tOut, FLAG_UP) * FLAG_UP.dy;
      flagA *= table(tOut, FLAG_OUT_F, FLAG_OUT_V);
    }
    const flagVisible = arrived && flagA > 0;
    const fx = left + G.flagDX;
    const fy = nodeTop + G.flagDY + flagY;

    // 辉光:节点辉光 f48 硬亮、f33 硬灭;旗辉光跟着旗落下淡入,f33 硬灭
    const nodeGlowOn = (m === 0 || tIn >= GLOW_ON_AT) && !leaving;
    if (nodeGlowOn) {
      glows.push(
        <PixelSprite
          key={`gn${j}`}
          grid={NODE_GRID}
          pitch={8}
          colors={silhouette(NODE_GRID, pal.glow)}
          style={{ left, top: nodeTop, filter: `blur(${G.glowBlur}px)`, opacity: G.glowOpacity }}
        />,
      );
    }
    if (flagVisible && !leaving) {
      glows.push(
        <svg
          key={`gf${j}`}
          width={107.5}
          height={104}
          viewBox="0 0 107.5 104"
          shapeRendering="crispEdges"
          style={{ position: 'absolute', left: fx, top: fy, filter: `blur(${G.glowBlur}px)`, opacity: G.glowOpacity * flagA }}
        >
          {gridPaths(FLAG_GRID, 8, silhouette(FLAG_GRID, pal.glow))}
          <g transform={`translate(${G.flagShadowDX} ${G.flagShadowDY})`}>{gridPaths(FLAG_GRID, 8, silhouette(FLAG_GRID, pal.glow))}</g>
        </svg>,
      );
    }
    if (flagVisible) {
      flags.push(
        <div key={`f${j}`} style={{ position: 'absolute', left: 0, top: 0, opacity: flagA >= 1 ? undefined : flagA }}>
          {/* 硬投影:旗剪影平移 (+3.5,+8) */}
          <PixelSprite
            grid={FLAG_GRID}
            pitch={8}
            colors={silhouette(FLAG_GRID, '#000000')}
            style={{ left: fx + G.flagShadowDX, top: fy + G.flagShadowDY, opacity: G.flagShadowOpacity }}
          />
          <div
            style={{
              position: 'absolute',
              left: left + G.pole[0],
              top: nodeTop + flagY + G.pole[1],
              width: G.pole[2],
              height: G.pole[3],
              background: pal.pole,
            }}
          />
          <PixelSprite grid={FLAG_GRID} pitch={8} colors={pal.flag} style={{ left: fx, top: fy }} />
        </div>,
      );
    }

    // 标签:黄态(当前)/ 完成态(f33–f39 上浮淡出)
    const text = chapters[j];
    const fs = fitLabelSize(text, labelFontSize, labelMaxWidth);
    const labelBox = (done: boolean, dy: number, opacity: number, key: string) => (
      <div
        key={key}
        style={{
          position: 'absolute',
          left: x,
          top: G.labelTop + offsetY + dy,
          width: 0,
          height: G.labelH + (G.pointerTop - G.labelTop - G.labelH) + G.pointerH,
          opacity: opacity >= 1 ? undefined : opacity,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: G.labelH,
            translate: '-50% 0',
            padding: `0 ${done ? G.labelPadX - G.doneBorder : G.labelPadX}px`,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            whiteSpace: 'pre',
            background: done ? pal.doneBg : pal.labelBg,
            border: done ? `${G.doneBorder}px solid ${pal.doneBorder}` : undefined,
            boxShadow: done
              ? undefined
              : `inset 0 1px 0 0 ${pal.labelHi1}, inset 1px 0 0 0 ${pal.labelHi1}, inset -1px 0 0 0 ${pal.labelHi1}, inset 0 3.5px 0 0 ${pal.labelHi2}, inset 3.5px 0 0 0 ${pal.labelHi2}, inset -3.5px 0 0 0 ${pal.labelHi2}`,
            fontFamily: labelFontFamily,
            fontSize: fs,
            lineHeight: 1,
            color: done ? pal.doneText : pal.labelText,
            WebkitTextStroke: `0.6px ${done ? pal.doneText : pal.labelText}`,
          }}
        >
          {/* 得意黑在 flex 居中下比原片低 1px(f10 模板搜索实测),字面单独上提 */}
          <span style={{ position: 'relative', top: G.labelTextDy }}>{text}</span>
        </div>
        <div
          style={{
            position: 'absolute',
            left: -G.pointerW / 2,
            top: G.pointerTop - G.labelTop,
            width: G.pointerW,
            height: G.pointerH,
            background: done ? pal.donePointer : pal.labelPointer,
            clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)',
          }}
        />
      </div>
    );
    if (arrived && !leaving) {
      const a = m === 0 ? 1 : prog(tIn, LABEL_IN);
      const dy = m === 0 ? 0 : interpolate(tIn, [LABEL_DROP.from, LABEL_DROP.to], [LABEL_DROP.y0, 0], { ...clampBoth, easing: LABEL_DROP.ease });
      if (a > 0) labels.push(labelBox(false, dy >= 0 ? 0 : dy, a, `l${j}`));
    }
    if (leaving) {
      const a = table(tOut, DONE_FADE_F, DONE_FADE_V);
      if (a > 0) labels.push(labelBox(true, prog(tOut, DONE_RISE) * DONE_RISE.dy, a, `ld${j}`));
    }
  }

  // ── 小人动作状态:看最近一次已开始的转场 ──
  let lastK = -1;
  trans.forEach((t, k) => {
    if (t >= ANCHOR) lastK = k;
  });
  const tl = tk(lastK);
  const phase: PixelAvatarState['phase'] =
    lastK < 0
      ? 'idle'
      : tl < HERO_PHASES.run
        ? 'turn'
        : tl < HERO_PHASES.turnBack
          ? 'run'
          : tl < HERO_PHASES.stand
            ? 'turnBack'
            : tl < HERO_PHASES.cheer
              ? 'stand'
              : tl < HERO_PHASES.cheer + CHEER_HOLD
                ? 'cheer'
                : 'idle';
  const phaseStart = lastK < 0 ? -Infinity : phase === 'idle' ? HERO_PHASES.cheer + CHEER_HOLD : HERO_PHASES[phase];
  const phaseFrame = lastK < 0 ? toMeasured(frame) : tl - phaseStart;
  const avatarState: PixelAvatarState = {
    phase,
    phaseFrame,
    runStep: (Math.floor(Math.max(0, phaseFrame) / 2) % 4) as PixelAvatarState['runStep'],
    chapter: Math.min(n - 1, start + (lastK < 0 ? 0 : tl >= SLIDE.to ? lastK + 1 : lastK)),
  };
  let avatarNode: React.ReactNode = null;
  if (!hideAvatar) {
    if (avatar === undefined || avatar === null) {
      avatarNode = <DefaultPixelAvatar state={avatarState} width={avatarBox.width} height={avatarBox.height} />;
    } else if (typeof avatar === 'function') {
      avatarNode = (avatar as (s: PixelAvatarState) => React.ReactNode)(avatarState);
    } else if (typeof avatar === 'string') {
      avatarNode = <Img src={avatar} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
    } else if (isSprites(avatar)) {
      const run = avatar.run && avatar.run.length > 0 ? avatar.run : [avatar.idle];
      const src =
        phase === 'run'
          ? run[Math.floor(Math.max(0, phaseFrame) / 2) % run.length]
          : phase === 'turn' || phase === 'turnBack'
            ? (avatar.turn ?? run[0])
            : phase === 'cheer'
              ? (avatar.cheer ?? avatar.idle)
              : phase === 'stand'
                ? (avatar.stand ?? avatar.idle)
                : avatar.idle;
      avatarNode = <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
    } else {
      avatarNode = avatar as React.ReactNode;
    }
  }

  const startLeft = startCx - G.startBox / 2;
  return (
    <AbsoluteFill style={{ background: pal.background, overflow: 'hidden' }}>
      {/* 轨道外带 */}
      <div style={{ position: 'absolute', left: bandFrom, top: G.bandTop + offsetY, width: Math.max(0, bandTo - bandFrom), height: G.bandH, background: pal.trackBand }} />
      {/* 未走虚线 */}
      {segs}
      {/* 已走橙芯 */}
      <div
        style={{
          position: 'absolute',
          left: bandFrom,
          top: G.coreTop + offsetY,
          width: Math.max(0, doneEnd - bandFrom),
          height: G.coreH,
          background: pal.trackDone,
        }}
      />
      {/* 起点虚线框 + 小绿点 */}
      {showStart && visible(startCx) ? (
        <>
          <svg width={100} height={100} viewBox="0 0 100 100" shapeRendering="crispEdges" style={{ position: 'absolute', left: startLeft, top: nodeCy - 50 }}>
            {[0, 21, 41.5, 63, 83.5].map((x, i) => (
              <rect key={`t${i}`} x={x} y={0} width={i === 1 ? 15.5 : i === 4 ? 16.5 : 16} height={8} fill={pal.startBox} />
            ))}
            {[0, 83.5].map((x, i) => (
              <rect key={`b${i}`} x={x} y={92} width={i === 1 ? 16.5 : 16} height={8} fill={pal.startBox} />
            ))}
            {[0, 21, 42, 63, 84].map((y, i) => (
              <React.Fragment key={`s${i}`}>
                <rect x={0} y={y} width={8} height={16} fill={pal.startBox} />
                <rect x={92} y={y} width={8} height={16} fill={pal.startBox} />
              </React.Fragment>
            ))}
            <rect x={21} y={92} width={57.5} height={8} fill={pal.startBoxBottom} />
          </svg>
          <div style={{ position: 'absolute', left: startLeft + G.startDimFrom, top: G.bandTop + offsetY, width: G.startDimW, height: G.bandH, background: '#000000', opacity: 0.53 }} />
          <PixelSprite
            grid={NODE_GRID}
            pitch={G.startNodeSize / 12}
            colors={pal.done}
            style={{ left: startCx - G.startNodeSize / 2, top: nodeCy - G.startNodeSize / 2 }}
          />
        </>
      ) : null}
      {glows}
      {nodes}
      {flags}
      {labels}
      {avatarNode !== null ? (
        <div style={{ position: 'absolute', left: avatarBox.x, top: avatarBox.y + offsetY, width: avatarBox.width, height: avatarBox.height }}>{avatarNode}</div>
      ) : null}
    </AbsoluteFill>
  );
};

/** 从开场到第 k 次转场(0 起)的小人竖拇指完成,需要多少帧(当前 fps) */
export const pixelMapTransitionFrames = (fps: number, speed = 1): number =>
  Math.ceil(((HERO_PHASES.cheer + 3 - ANCHOR) / MEASURED_FPS / speed) * fps);
