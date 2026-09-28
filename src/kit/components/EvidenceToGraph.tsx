/**
 * EvidenceToGraph.tsx — 「录屏/截图推上 → 变成节点图」镜头模板(秋芝《Codex全解40分钟》11:24.7 实测版)。
 *
 * 出处:内部复刻案例 qz-cx-0684-evidence-to-graph(交付 13),工序③静帧 + 工序④逐帧实测。
 * 默认值 = 原片 30fps 实测曲线与 1080p 几何(specs/layout.json、layout-ext.json、motion.json、motion-ext.json),不是手调。
 *
 * 一整段分四幕(帧号 = 原片帧号 fNNN,组件第 0 帧 = 原片 f0 = 录屏硬切进来那帧):
 *   ① 证据:截图/录屏摆在 evidence.rect(原片 230,39 1648×927)
 *   ② 抽一句(可选 extract):f62 白条一帧硬出 + 录屏 f62→f71 线性压到黑 α0.9;关键词荧光 f209/f211 单帧闪两下、f213 起常亮
 *        白条位置:给 extract.from(那句话在截图里的位置)就盖在那句话上放大;enter='grow'(新增)= 从原句原位原大小放大出来
 *   ③ 换页:
 *        pageMode='push'(原样):整张不透明黑页 f250→f253 线性淡入(整组只乘一次透明度),f251→f265 从 +486.1px 推上来,盖住录屏;
 *                                   新页自带画布框、「源卡」(默认终端卡)、种子节点(卡上的胶囊)、汇聚节点和它们之间的连线
 *        pageMode='shrink'(新增):黑页照样推上来;同一时刻截图边缩向源卡位置边淡出,
 *                                     截图里给了 from 的那几块同时「飞出来」—— 从原位原大小原样(截图像素)出发,
 *                                     一边放大移到节点终位一边渐变成节点(底板/图标/端点在飞行中长出),到位后连线再画出来。
 *                                     整段 ease-in-out,时长 morphFrames,多个节点按 morphStagger 错开(均非实测)
 *   ④ 长出节点图:f295→f328 种子胶囊从卡上变宽变扁飞到节点位(位置/宽/高/字号共用一条曲线);
 *                  源卡晚 3 帧(f298)向上飞出画面并淡出;其余节点按顺序 f350→f366 淡入 + 上浮 86px 汇进来
 *
 * 连线:两端水平切线的三次贝塞尔,控制柄是固定像素(出端 194.5 / 入端 141,原片 3 条线 RMS 0.15px),
 *       起止点 = 源节点右中点的蓝端点 → 目标节点左中点的蓝端点,端点跟着节点走,线形自动变成 S 形。
 *
 * 取帧节奏:原片 ④ 是约 45fps 网页动画按 30fps 取帧,逐帧位移「大步小步」交替。默认用平滑曲线;
 *           steppy=true 复现原片取帧(motion-ext.json timeWarp:偶数帧 −0.15、奇数帧 −0.4833,f312 起偶数帧 −0.8167)。
 *
 * 用法:
 *   <EvidenceToGraph
 *     evidence={{ src: staticFile('xx.png') }}
 *     extract={{ text: '现在有可用 ffmpeg 了。', keyword: 'ffmpeg' }}
 *     nodes={[{ id: 'a', text: 'ffmpeg -i' }, { id: 'hub', text: '命令行工具' }, { id: 'b', text: 'git clone' }]}
 *     edges={[{ from: 'a', to: 'hub' }, { from: 'b', to: 'hub' }]}
 *   />
 * 组件铺满父容器,几何按 1920×1080 画布像素给。
 */
import React from 'react';
import { AbsoluteFill, Easing, Img, OffthreadVideo, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

const clampBoth = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 实测时基:原片 30fps。下面帧号都是原片帧号 */
const MEASURED_FPS = 30;

// ── 实测时刻(原片帧号)──
/** 白条硬出 + 压暗开始(scene s3-hl);压暗 f62→f71 线性(motion rec-dim-fade-in,逐帧 −10%) */
const F_EXTRACT = 62;
const F_DIM_END = 71;
/** 压暗落定 α(layout rec-dim appearance.opacity 0.9) */
const DIM_ALPHA = 0.9;
/** grow 入场(新增,非实测):8 帧 ease-out,和 f62→f71 压暗同一帧起步 */
const GROW = { frames: 8, ease: Easing.out(Easing.cubic) };
/** 抽句放大倍数:原片字墨宽 854.3/474.25 = 1.801、高 30.4/16.9 = 1.80;沿用案例记录的 1.81 */
const EXTRACT_ZOOM = 1.81;
/** 白条推回证据框内时留的边(px,未实测) */
const EXTRACT_EDGE = 16;
/** 关键词荧光:f209、f211 单帧亮,f213 起常亮(scene s4-flash-a / s4-flash-b / s5-hl-mark) */
const F_MARK = 209;
/** 换页:整组 α f250→f253 线性;y +486.1→0 f251→f265 bezier(0.371,0.586,0.563,1),无过冲(motion page-push-*) */
const F_PAGE = 250;
const PAGE_FADE: [number, number] = [250, 253];
const PAGE_PUSH = { from: 251, to: 265, dy: 486.1, ease: Easing.bezier(0.371, 0.586, 0.563, 1) };
/** 种子胶囊变形:x/y/宽/高/字号共用一条曲线 f295→f328(motion cap-ffmpeg-morph,33 帧) */
const F_MORPH = 295;
const MORPH = { from: 295, to: 328, ease: Easing.bezier(0.184, 0.869, 0.316, 0.994) };
/** 源卡飞出:y 0→−951.5 f298→f312;α 1→0 f298→f308(motion term-card-exit) */
const CARD_EXIT_Y = { from: 298, to: 312, dy: -951.507, ease: Easing.bezier(0.074, 0, 0.215, 0.942) };
const CARD_EXIT_A = { from: 298, to: 308, ease: Easing.bezier(0.283, 0.281, 0, 0.291) };
/** 追加节点:α 0→1 + 上浮 85.98→0 f350→f366(motion cap-git-enter,胶囊+端点整组乘一次 α;连线同曲线) */
const F_POP = 350;
const POP = { from: 350, to: 366, dy: 85.98, ease: Easing.bezier(0.188, 0.873, 0.36, 0.976) };
/**
 * shrink 飞出渐变(新增,非实测):截图区域 → 节点。进度 p 走 ease-in-out;下面区间都是 p 上的分段:
 *   前段仍是截图原样(裁出来的截图像素),然后节点底板在它身后长出,中段截图像素换成节点字、图标撑开淡入,末段端点淡入;p=1 恰好是完整节点。
 *   默认时长 36 帧(原片变形段 33 帧略长一点),相邻节点错开 4 帧;落地后连线 10 帧从出端画到入端。
 */
const FLY = { frames: 36, stagger: 4, ease: Easing.inOut(Easing.cubic) };
/** 底板先长满,截图像素再在底板上换成节点字(两者不同时半透明,飞行中不发灰) */
const FLY_BG: [number, number] = [0.2, 0.5];
const FLY_CROP: [number, number] = [0.35, 0.65];
const FLY_TEXT: [number, number] = [0.35, 0.65];
const FLY_ICON: [number, number] = [0.45, 0.9];
const FLY_DOT: [number, number] = [0.75, 1];
/** 截图卡(shrink)在飞行中淡出的区间(p 上):早点淡掉,免得截图里那块原字和飞出去的字叠成两份 */
const FLY_CARD_FADE: [number, number] = [0.02, 0.5];
/** 截图文字字号 ≈ from.h × 0.55(一行字 + 上下留白的常见比例,未实测;只影响飞行中字号插值的起点) */
const FLY_SRC_FONT = 0.55;
const LINK_DRAW = { frames: 10, ease: Easing.inOut(Easing.cubic) };
/** 原片取帧表(motion-ext.json timeWarp,⑦b 第 2 轮含 slip) */
export const ORIGINAL_TIME_WARP: TimeWarp = { frames: [295, 330], even: -0.15, odd: -0.4833, slip: { fromFrame: 312, even: -0.8167, odd: -0.4833 } };

// ── 实测几何(1080p 画布 px)──
const G = {
  /** 录屏 rec-plate (230,39) 1648×927 */
  evidence: { x: 230, y: 39, w: 1648, h: 927 },
  /** 白条:中心 (1051.25,500.28),原片宽 883.34 高 61.01;字左缘比条左缘内收 14.82 */
  barCenter: [1051.25, 500.28] as [number, number],
  barH: 61.01,
  barPadX: 14.82,
  barShadow: '0 0 1.5px rgba(0,0,0,0.35)',
  /** 高亮句:SF Pro Text 30.3px rgb(41,41,41),词距 −0.5 */
  extractFont: 30.3,
  extractColor: 'rgb(41, 41, 41)',
  /** 荧光:高 42.13(比条上沿低 9.49),圆角 8,白边 2px rgb(255,242,236),粉外发光 0 0 47px 9px */
  markH: 42.13,
  markRadius: 8,
  markBorder: 'rgb(255, 242, 236)',
  markGlow: '0 0 47px 9px rgb(255, 178, 177)',
  /** 画布框 (50,50) 1820×980,2px rgb(16,16,16) */
  frame: { x: 50, y: 50, w: 1820, h: 980 },
  /** 终端卡 (276,257) 744×516;外缘 1px 灰紫 = 组底色;上角 9 下角 5.2 */
  card: { x: 276, y: 257, w: 744, h: 516 },
  /** 卡上的种子胶囊 (467.97,467.94) 360.06×124.96,字 45.8px */
  seedOnCard: { x: 467.97, y: 467.94, w: 360.06, h: 124.96, font: 45.8 },
  /** 节点胶囊 648.07×91.39,字 41px;汇聚框 396.07×108.15,字 48px;胶囊竖向间距 162.12 */
  chip: { w: 648.07, h: 91.39, font: 41 },
  box: { w: 396.07, h: 108.15, font: 48 },
  rowPitch: 162.12,
  colGap: 239.93,
  /** 字盒比胶囊低 0.85(cap-ffmpeg-text / cap-git-text bounds) */
  chipTextDy: 0.85,
  /** 蓝端点:白圈 Ø21.6 + 芯 Ø14.4;出端圆心在胶囊右沿内 1.2,入端圆心在框左沿内 1.29 */
  dot: 21.6,
  dotCore: 14.4,
  dotOutInset: 1.2,
  dotInInset: 1.29,
  /** 连线:白 4.8px,固定像素控制柄 */
  linkW: 4.8,
  c1: 194.5,
  c2: 141,
};

export type Rect = { x: number; y: number; w: number; h: number };
export type TimeWarp = { frames: [number, number]; even: number; odd: number; slip?: { fromFrame: number; even: number; odd: number } };

export type GraphNode = {
  id: string;
  text: string;
  /** 文字前的小图标(任意 React 节点,如 <svg>/<Img>);尺寸 = 1em */
  icon?: React.ReactNode;
  /** chip = 胶囊(等宽字,原片「ffmpeg -i」);box = 汇聚框(粗黑体,原片「命令行工具」)。默认:只进不出的节点是 box */
  variant?: 'chip' | 'box';
  /** 手摆位置(画布 px);不给就自动排版 */
  rect?: Rect;
  /** 这个节点是从截图哪块「长出来」的(证据坐标:相对 evidence.rect 左上角、按 evidence.rect 尺寸的 px)。给了就当种子 */
  from?: Rect;
  /** 出现时刻(秒,相对组件起点;对口播用)。只对追加节点生效 */
  at?: number;
  /** 出场方式:seed = 从源卡上变形出来;page = 跟新页一起推上来;pop = 之后逐个淡入上浮。默认自动 */
  enter?: 'seed' | 'page' | 'pop';
  color?: string;
  textColor?: string;
};
export type GraphEdge = { from: string; to: string };

export type EvidenceSpec = {
  /** 图片或视频地址(staticFile(...));或者用 content 直接给 React 画面 */
  src?: string;
  kind?: 'image' | 'video';
  content?: React.ReactNode;
  /** 证据在画布上的位置,默认原片 (230,39) 1648×927 */
  rect?: Rect;
  objectFit?: React.CSSProperties['objectFit'];
  radius?: number;
};

export type ExtractSpec = {
  /** text = 把那句话重打成白条(原样);crop = 直接把截图那块放大抽出来 */
  mode?: 'text' | 'crop';
  text?: string;
  /** 要荧光的关键词(text 模式,第一次出现处) */
  keyword?: string;
  /**
   * 那句话在证据里的位置(证据坐标:相对 evidence.rect 左上角)。text / crop 共用。
   *   text:给那句话的「字框」——左右 = 首字左缘到末字右缘,上下 ≈ 一个字号高(原片原句 526.75,566.8 474.25×16.9)。
   *         给了它,白条就盖在这句话上(见 pull),字号默认 = from.h × zoom。
   *   crop:要裁出来放大的那一行;白条同样按它定位。
   */
  from?: Rect;
  /** 放大倍数(原片实测 1.80–1.81,取 1.81):text 模式决定默认字号与 grow 起点,crop 模式是裁切放大倍数 */
  zoom?: number;
  /**
   * 给了 from 时白条往证据中心靠多少:0 = 就地放大、白条中心 = 原句中心(默认);1 = 挪到证据中心(原片就是这样,见 extractPlacement 注释)。
   * 算完再推回证据框内(留 16px),不出画。
   */
  pull?: number;
  /** 入场:pop = 原片一帧硬出(默认);grow = 新增,白条从原句原位原大小 8 帧 ease-out 放大移到终位,压暗同步开始 */
  enter?: 'pop' | 'grow';
  /** crop 模式:荧光框位置(证据坐标) */
  markFrom?: Rect;
  /** 白条中心(画布 px),显式给了就用它(覆盖 from 算出的位置);都不给 = 原片 (1051.25,500.28) */
  center?: [number, number];
  /** 白条宽:不给 = 随字宽(左右各留 14.82) */
  width?: number;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  /** 荧光框相对关键词字面的外扩(左/右 px)与竖向微调,默认按原片量 */
  markPad?: [number, number];
  markDy?: number;
  markColor?: string;
};

export type EvidenceToGraphProps = {
  evidence: EvidenceSpec;
  extract?: ExtractSpec | false;
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** push = 黑页推上盖住录屏(原样);shrink = 截图缩成源卡(新增,曲线借推上) */
  pageMode?: 'push' | 'shrink';
  /** 源卡样式:terminal = 终端卡(原样);evidence = 截图缩略卡;none = 不要卡,种子直接在节点位上出现。shrink 时固定 evidence */
  card?: 'terminal' | 'evidence' | 'none';
  cardRect?: Rect;
  /** 自动排版区域(画布 px) */
  area?: Rect;
  /** 自动排版方向:columns = 按层级左→右分列(汇聚/链式/树形都走它) */
  chipWidth?: number;
  /** 时刻(秒,相对组件起点)。不给 = 原片节奏(抽句 2.07s、荧光 6.97s、换页 8.33s、变形 9.83s、追加 11.67s) */
  timing?: { extractAt?: number; markAt?: number; pushAt?: number; morphAt?: number; popAt?: number; popStagger?: number; morphStagger?: number };
  /** shrink 模式「截图区域飞出渐变成节点」的时长(原片 30fps 帧数,随 speed 缩放;默认 36 = 1.2s)。push 模式不用它 */
  morphFrames?: number;
  /** 速度倍率,1 = 原片 */
  speed?: number;
  /** 复现原片「大步小步」取帧节奏(只影响变形段);默认平滑 */
  steppy?: boolean;
  /** 自定义取帧表(覆盖 steppy) */
  timeWarp?: TimeWarp;
  delayFrames?: number;
  /** 颜色 */
  pageColor?: string;
  frameColor?: string;
  nodeColor?: string;
  chipTextColor?: string;
  boxTextColor?: string;
  linkColor?: string;
  dotColor?: string;
  /** 字体 */
  chipFontFamily?: string;
  boxFontFamily?: string;
  /** 画布框(2px 极淡灰线)要不要 */
  showFrame?: boolean;
};

const overlaps = (a: Rect | undefined, b: Rect) => !!a && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const lerpRect = (a: Rect, b: Rect, p: number): Rect => ({ x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), w: lerp(a.w, b.w, p), h: lerp(a.h, b.h, p) });
const prog = (t: number, c: { from: number; to: number; ease?: (x: number) => number }) =>
  interpolate(t, [c.from, c.to], [0, 1], { ...clampBoth, easing: c.ease });

/** 估字宽(em):CJK/全角 1,等宽拉丁 0.602(Menlo),其它拉丁 0.56 */
const estimateEm = (s: string, mono: boolean) =>
  Array.from(s).reduce((a, ch) => a + (/[⺀-鿿＀-￯　-〿]/.test(ch) ? 1 : mono ? 0.602 : 0.56), 0);

const applyWarp = (t: number, w?: TimeWarp) => {
  if (!w || t < w.frames[0] || t > w.frames[1]) return t;
  const f = Math.floor(t + 1e-6);
  const ph = w.slip && f >= w.slip.fromFrame ? w.slip : w;
  return t + (f % 2 === 1 ? ph.odd : ph.even);
};

/** 按秒算时刻 → 原片帧号单位 */
const secToM = (s: number, speed: number) => s * MEASURED_FPS * speed;

type Resolved = {
  node: GraphNode;
  rect: Rect;
  variant: 'chip' | 'box';
  font: number;
  enter: 'seed' | 'page' | 'pop';
  seedRect?: Rect;
  seedFont?: number;
  popAt?: number;
  /** shrink 飞出:起点 = 截图里的原位原大小(画布 px)、起点字号、起飞时刻(原片帧号单位) */
  fly?: { src: Rect; srcFont: number; at: number };
};

/** 各幕起点(原片帧号单位);组件和时长函数共用 */
const phases = (p: Pick<EvidenceToGraphProps, 'timing' | 'speed' | 'extract' | 'pageMode'>) => {
  const speed = p.speed ?? 1;
  const t = p.timing ?? {};
  const E0 = t.extractAt !== undefined ? secToM(t.extractAt, speed) : F_EXTRACT;
  const K0 = t.markAt !== undefined ? secToM(t.markAt, speed) : E0 + (F_MARK - F_EXTRACT);
  const P0 = t.pushAt !== undefined ? secToM(t.pushAt, speed) : p.extract ? K0 + (F_PAGE - F_MARK) : 60;
  // shrink:飞出和截图缩小同一帧起步(= 推上开始那帧);push:原片变形时刻
  const M0 = t.morphAt !== undefined ? secToM(t.morphAt, speed) : P0 + ((p.pageMode === 'shrink' ? PAGE_PUSH.from : F_MORPH) - F_PAGE);
  const Q0 = t.popAt !== undefined ? secToM(t.popAt, speed) : M0 + (F_POP - F_MORPH);
  /** 追加节点间隔(原片只有一个追加节点,18 帧 = 未实测默认值) */
  const QS = t.popStagger !== undefined ? secToM(t.popStagger, speed) : 18;
  const MS = t.morphStagger !== undefined ? secToM(t.morphStagger, speed) : FLY.stagger;
  return { E0, K0, P0, M0, Q0, QS, MS };
};

/** 自动排版:按最长路径分层成列,列内竖排居中 */
const autoLayout = (nodes: GraphNode[], edges: GraphEdge[], area: Rect, variants: Map<string, 'chip' | 'box'>, chipWidth?: number) => {
  const depth = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (let k = 0; k < nodes.length; k += 1) {
    for (const e of edges) {
      const d = (depth.get(e.from) ?? 0) + 1;
      if (depth.has(e.to) && d > (depth.get(e.to) ?? 0)) depth.set(e.to, d);
    }
  }
  const nCols = Math.max(...nodes.map((n) => depth.get(n.id) ?? 0)) + 1;
  const cols: GraphNode[][] = Array.from({ length: nCols }, () => []);
  nodes.forEach((n) => cols[depth.get(n.id) ?? 0].push(n));
  const colW = cols.map((col) =>
    Math.max(
      ...col.map((n) => {
        const v = variants.get(n.id) ?? 'chip';
        const base = v === 'chip' ? G.chip : G.box;
        const est = estimateEm(n.text, v === 'chip') * base.font + (n.icon ? base.font * 1.35 : 0);
        if (v === 'chip') return chipWidth ?? (nCols <= 2 ? Math.max(base.w, est + 112) : Math.min(base.w, Math.max(240, est + 96)));
        return Math.max(base.w * (nCols <= 2 ? 1 : 0.8), est + 80);
      }),
    ),
  );
  /** 4 列以上连线走平,列距收到 140(原片两列 239.93) */
  const colGap = nCols >= 4 ? 140 : G.colGap;
  const total = colW.reduce((a, b) => a + b, 0) + (nCols - 1) * colGap;
  const maxRows = Math.max(...cols.map((c) => c.length));
  const sx = Math.min(1, area.w / total);
  const sy = Math.min(1, area.h / (maxRows * G.rowPitch));
  const s = Math.max(0.5, Math.min(sx, sy + (1 - sy) * 0.25));
  const pitch = Math.min(G.rowPitch * s, area.h / maxRows);
  const gap = colGap * s;
  const totalS = colW.reduce((a, b) => a + b * s, 0) + (nCols - 1) * gap;
  let x = area.x + (area.w - totalS) / 2;
  const out = new Map<string, { rect: Rect; font: number }>();
  cols.forEach((col, ci) => {
    const w = colW[ci] * s;
    col.forEach((n, ri) => {
      const v = variants.get(n.id) ?? 'chip';
      const base = v === 'chip' ? G.chip : G.box;
      const h = Math.min(base.h * s, pitch - 14);
      const k = h / base.h;
      const cy = area.y + area.h / 2 + (ri - (col.length - 1) / 2) * pitch;
      out.set(n.id, { rect: { x, y: cy - h / 2, w, h }, font: base.font * Math.min(s, k) });
    });
    x += w + gap;
  });
  return out;
};

const Dot: React.FC<{ cx: number; cy: number; k: number; color: string }> = ({ cx, cy, k, color }) => {
  const d = G.dot * k;
  const c = G.dotCore * k;
  return (
    <>
      <div style={{ position: 'absolute', left: cx - d / 2, top: cy - d / 2, width: d, height: d, borderRadius: '50%', background: '#FFFFFF' }} />
      <div style={{ position: 'absolute', left: cx - c / 2, top: cy - c / 2, width: c, height: c, borderRadius: '50%', background: color }} />
    </>
  );
};

/** 终端卡(原片 term-card:浅灰标题栏 + 红黄绿三点 + 深蓝窗体 + 3 条假代码线),按 744×516 画,整体缩放 */
const TerminalCard: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  const sx = w / G.card.w;
  const sy = h / G.card.h;
  const box = (x: number, y: number, ww: number, hh: number): React.CSSProperties => ({ position: 'absolute', left: x * sx, top: y * sy, width: ww * sx, height: hh * sy });
  const dot = (x: number, c: string) => <div style={{ ...box(x, 27.5, 16.8, 16.8), borderRadius: '50%', background: c }} />;
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgb(57, 61, 88)', borderRadius: '9.03px 8.91px 5.27px 5.21px', overflow: 'hidden' }}>
      <div
        style={{
          ...box(1.4, 1.4, 741.2, 69),
          background: 'rgb(222, 227, 240)',
          borderRadius: '7.63px 7.51px 0 0',
          boxShadow:
            'inset 1px 1px 0 0 rgb(165, 170, 195), inset -1px 0 0 0 rgb(165, 170, 195), inset 2px 2px 0 0 rgb(230, 235, 248), inset -2px 0 0 0 rgb(230, 235, 248), inset 0 -1px 0 0 rgb(202, 206, 230)',
        }}
      />
      <div
        style={{
          ...box(1.4, 70.39, 741.2, 444.21),
          background: 'rgb(18, 25, 67)',
          borderRadius: '0 0 3.87px 3.81px',
          boxShadow: 'inset 0 1px 0 0 rgb(120, 125, 149), inset 1px 0 0 0 rgb(37, 43, 77), inset -1px 0 0 0 rgb(37, 43, 77), inset 0 -1px 0 0 rgb(45, 50, 80)',
        }}
      />
      {dot(34.87, 'rgb(254, 95, 90)')}
      {dot(63.79, 'rgb(255, 187, 45)')}
      {dot(92.59, 'rgb(38, 200, 63)')}
      <div style={{ ...box(63.76, 353.84, 678.84, 14.29), background: 'rgb(83, 90, 118)', borderRadius: '7.2px 0 0 7.2px' }} />
      <div style={{ ...box(63.76, 392.19, 611.77, 14.38), background: 'rgb(83, 90, 118)', borderRadius: 7.2 }} />
      <div style={{ ...box(63.77, 430.6, 479.8, 14.48), background: 'rgb(83, 90, 118)', borderRadius: 7.2 }} />
    </div>
  );
};

/** 证据画面(按 evidence.rect 原尺寸画,外面再缩放) */
const EvidenceContent: React.FC<{ ev: EvidenceSpec; w: number; h: number }> = ({ ev, w, h }) => {
  const style: React.CSSProperties = { position: 'absolute', left: 0, top: 0, width: w, height: h, objectFit: ev.objectFit ?? 'fill' };
  if (ev.content) return <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, overflow: 'hidden' }}>{ev.content}</div>;
  if (!ev.src) return null;
  return ev.kind === 'video' ? <OffthreadVideo src={ev.src} muted style={style} /> : <Img src={ev.src} style={style} />;
};

/** 在画布 rect 处显示证据(内部按 base 尺寸画,整体 scale);scale=1 时不挂 transform */
const EvidenceAt: React.FC<{ ev: EvidenceSpec; base: Rect; at: Rect; radius?: number; children?: React.ReactNode }> = ({ ev, base, at, radius, children }) => {
  const s = at.w / base.w;
  const sy = at.h / base.h;
  const still = Math.abs(s - 1) < 1e-6 && Math.abs(sy - 1) < 1e-6;
  return (
    <div style={{ position: 'absolute', left: at.x, top: at.y, width: at.w, height: at.h, overflow: 'hidden', borderRadius: radius }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: base.w, height: base.h, transformOrigin: '0 0', scale: still ? undefined : `${s} ${sy}` }}>
        <EvidenceContent ev={ev} w={base.w} h={base.h} />
      </div>
      {children}
    </div>
  );
};

export const EvidenceToGraph: React.FC<EvidenceToGraphProps> = ({
  evidence,
  extract,
  nodes,
  edges,
  pageMode = 'push',
  card: cardIn = 'terminal',
  cardRect,
  area = { x: 110, y: 110, w: 1700, h: 800 },
  chipWidth,
  timing = {},
  speed = 1,
  steppy = false,
  timeWarp,
  morphFrames = FLY.frames,
  delayFrames = 0,
  pageColor = '#000000',
  frameColor = 'rgb(16, 16, 16)',
  nodeColor = 'rgb(241, 241, 241)',
  chipTextColor = 'rgb(18, 25, 54)',
  boxTextColor = 'rgb(34, 45, 112)',
  linkColor = '#FFFFFF',
  dotColor = 'rgb(50, 86, 232)',
  chipFontFamily = "MenloBold, Menlo, 'Space Mono', 'Noto Sans SC', monospace",
  boxFontFamily = "'PingFangSC-Semibold', 'PingFang SC', 'Noto Sans SC', sans-serif",
  showFrame = true,
}) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  // 原片帧号时刻(可带小数):换 fps / 调速都在这里折算
  const tm = ((frame - delayFrames) / fps) * MEASURED_FPS * speed;
  if (tm < 0) return null;

  const ev = { ...evidence, rect: evidence.rect ?? G.evidence };
  const evR = ev.rect;
  const card = pageMode === 'shrink' ? 'evidence' : cardIn;

  // ── 各幕起点(原片帧号单位);只给前一幕时后一幕跟着顺延,保持原片间隔 ──
  const ex = extract || undefined;
  const { E0, K0, P0, M0, Q0, QS, MS } = phases({ timing, speed, extract, pageMode });
  /** 飞出时长(原片帧号单位,和其它实测段一样随 speed 变快) */
  const MF = Math.max(1, morphFrames);

  const te = tm - E0 + F_EXTRACT;
  const tk = tm - K0 + F_MARK;
  const tp = tm - P0 + F_PAGE;
  const warp = timeWarp ?? (steppy ? ORIGINAL_TIME_WARP : undefined);
  const tmo = applyWarp(tm - M0 + F_MORPH, warp);

  // ── 换页 ──
  const pageA = interpolate(tp, PAGE_FADE, [0, 1], clampBoth);
  const pushP = prog(tp, PAGE_PUSH);
  const pageDy = PAGE_PUSH.dy * (1 - pushP);
  const pageOn = tp >= PAGE_FADE[0];
  const covered = tp >= PAGE_PUSH.to;

  // ── 源卡 ──
  const slotBox = cardRect ?? G.card;
  // evidence 卡:按截图比例塞进卡位(居中)
  const evSlot: Rect = (() => {
    const s = Math.min(slotBox.w / evR.w, slotBox.h / evR.h);
    const w = evR.w * s;
    const h = evR.h * s;
    return { x: slotBox.x + (slotBox.w - w) / 2, y: slotBox.y + (slotBox.h - h) / 2, w, h };
  })();
  const slot = card === 'evidence' ? evSlot : slotBox;
  // shrink:截图不飞走,缩小的同时淡出(节奏跟飞出节点,见 shrinkFlyP);push:原片源卡飞出
  const cardExitY = pageMode === 'shrink' ? 0 : CARD_EXIT_Y.dy * prog(tmo, CARD_EXIT_Y);
  let cardA = 1 - prog(tmo, CARD_EXIT_A);
  let cardGone = tmo >= CARD_EXIT_A.to;

  // ── 节点:样式 / 出场方式 / 终点位置 / 种子起点 ──
  const hasOut = new Set(edges.map((e) => e.from));
  const hasIn = new Set(edges.map((e) => e.to));
  const variants = new Map(nodes.map((n) => [n.id, n.variant ?? (!hasOut.has(n.id) && hasIn.has(n.id) ? 'box' : 'chip')] as const));
  const auto = autoLayout(nodes.filter((n) => !n.rect), edges, area, variants, chipWidth);
  const explicitSeeds = nodes.filter((n) => n.enter === 'seed' || (n.enter === undefined && n.from));
  const seedIds = new Set((explicitSeeds.length ? explicitSeeds : nodes.slice(0, 1).filter((n) => n.enter === undefined)).map((n) => n.id));
  const pageIds = new Set(
    nodes
      .filter(
        (n) =>
          !seedIds.has(n.id) &&
          (n.enter === 'page' ||
            (n.enter === undefined &&
              edges.some((e) => seedIds.has(e.from) && e.to === n.id) &&
              // 会压在源卡上的节点不跟页出来,改成追加(原片汇聚框在卡右侧)
              !(card !== 'none' && overlaps(n.rect ?? auto.get(n.id)?.rect, slotBox)))),
      )
      .map((n) => n.id),
  );
  const seedList = nodes.filter((n) => seedIds.has(n.id));
  let popIdx = 0;
  const resolved: Resolved[] = nodes.map((n) => {
    const variant = variants.get(n.id) ?? 'chip';
    const base = variant === 'chip' ? G.chip : G.box;
    const a = auto.get(n.id);
    const rect = n.rect ?? a?.rect ?? { x: 0, y: 0, w: base.w, h: base.h };
    const font = n.rect ? base.font * Math.min(1, rect.h / base.h) : a?.font ?? base.font;
    const enter = seedIds.has(n.id) ? 'seed' : pageIds.has(n.id) ? 'page' : 'pop';
    const r: Resolved = { node: n, rect, variant, font, enter };
    if (enter === 'seed') {
      const k = seedList.findIndex((s) => s.id === n.id);
      if (card === 'none') {
        r.seedRect = rect;
        r.seedFont = font;
      } else if (pageMode === 'shrink' && n.from) {
        // 截图里的原位原大小(画布 px),全部由 evidence.rect + from 算
        const src = { x: evR.x + n.from.x, y: evR.y + n.from.y, w: n.from.w, h: n.from.h };
        const flyIdx = seedList.filter((sn) => sn.from).findIndex((sn) => sn.id === n.id);
        r.seedRect = src;
        r.seedFont = n.from.h * FLY_SRC_FONT;
        r.fly = { src, srcFont: r.seedFont, at: M0 + flyIdx * MS };
      } else if (card === 'evidence' && n.from) {
        const s = evSlot.w / evR.w;
        r.seedRect = { x: evSlot.x + n.from.x * s, y: evSlot.y + n.from.y * s, w: n.from.w * s, h: n.from.h * s };
        r.seedFont = font * Math.min(1.2, Math.max(0.35, r.seedRect.h / rect.h));
      } else {
        // 终端卡上的胶囊:单个 = 原片位置;多个在卡里竖排
        const sc = slot.w / G.card.w;
        const n1 = seedList.length;
        const h1 = n1 === 1 ? G.seedOnCard.h : Math.min(G.seedOnCard.h, 250 / n1 - 10);
        const est = estimateEm(n.text, variant === 'chip') * G.seedOnCard.font * (h1 / G.seedOnCard.h) + 90;
        const w1 = Math.min(700, Math.max(G.seedOnCard.w, est));
        const cy = G.seedOnCard.y - G.card.y + G.seedOnCard.h / 2 + (k - (n1 - 1) / 2) * (h1 + 16);
        r.seedRect = { x: slot.x + (slot.w - w1 * sc) / 2, y: slot.y + (cy - h1 / 2) * sc, w: w1 * sc, h: h1 * sc };
        r.seedFont = G.seedOnCard.font * (h1 / G.seedOnCard.h) * sc;
      }
    }
    if (enter === 'pop') {
      r.popAt = n.at !== undefined ? secToM(n.at, speed) : Q0 + popIdx * QS;
      popIdx += 1;
    }
    return r;
  });
  const byId = new Map(resolved.map((r) => [r.node.id, r]));

  const morphP = prog(tmo, MORPH);
  /** 种子在 shrink / evidence 卡上:卡落定后 3 帧淡入(借用换页淡入,未实测) */
  const seedA = card === 'terminal' ? 1 : interpolate(tp, [PAGE_PUSH.to, PAGE_PUSH.to + 3], [0, 1], clampBoth);

  /** 飞行进度(ease-in-out,0..1);落定后 = 1 */
  const flyP = (at: number) => interpolate(tm, [at, at + MF], [0, 1], { ...clampBoth, easing: FLY.ease });
  /** 截图卡(shrink)跟着第一个飞出节点的节奏缩小 + 淡出;没有飞出节点就用默认起飞时刻 */
  const firstFly = resolved.reduce((a, r) => (r.fly ? Math.min(a, r.fly.at) : a), Infinity);
  const shrinkFlyP = flyP(Number.isFinite(firstFly) ? firstFly : M0);
  if (pageMode === 'shrink') {
    cardA = 1 - interpolate(shrinkFlyP, FLY_CARD_FADE, [0, 1], clampBoth);
    cardGone = shrinkFlyP >= FLY_CARD_FADE[1];
  }

  type Fly = { p: number; kc: number; src: Rect; landAt: number };
  type NodeState = { rect: Rect; font: number; alpha: number; textDy: number; scaleText: number; inPage: boolean; fly?: Fly };
  const stateOf = (r: Resolved): NodeState => {
    if (r.fly) {
      const p = flyP(r.fly.at);
      // 起点中心跟着正在缩小的截图走(词是从截图上「揭下来」的),大小保持原大 → 只放大不先缩
      const cardNow = lerpRect(evR, evSlot, shrinkFlyP);
      const cs = cardNow.w / evR.w;
      const { src } = r.fly;
      const srcNow = { x: cardNow.x + (src.x + src.w / 2 - evR.x) * cs - src.w / 2, y: cardNow.y + (src.y + src.h / 2 - evR.y) * cs - src.h / 2, w: src.w, h: src.h };
      const font = lerp(r.fly.srcFont, r.font, p);
      return {
        rect: lerpRect(srcNow, r.rect, p),
        font: r.font,
        scaleText: font / r.font,
        alpha: tm >= r.fly.at ? 1 : 0,
        textDy: r.variant === 'chip' ? G.chipTextDy * p : 0,
        inPage: true,
        fly: { p, kc: font / r.fly.srcFont, src: r.fly.src, landAt: r.fly.at + MF },
      };
    }
    if (r.enter === 'seed') {
      const from = r.seedRect ?? r.rect;
      const rect = lerpRect(from, r.rect, morphP);
      const font = lerp(r.seedFont ?? r.font, r.font, morphP);
      return { rect, font: r.font, scaleText: font / r.font, alpha: morphP > 0 ? 1 : seedA, textDy: r.variant === 'chip' ? G.chipTextDy * morphP : 0, inPage: true };
    }
    if (r.enter === 'page') return { rect: r.rect, font: r.font, scaleText: 1, alpha: 1, textDy: r.variant === 'chip' ? G.chipTextDy : 0, inPage: true };
    const tq = tm - (r.popAt ?? Q0) + F_POP;
    const p = prog(tq, POP);
    const k = r.rect.h / (r.variant === 'chip' ? G.chip.h : G.box.h);
    return {
      rect: { ...r.rect, y: r.rect.y + POP.dy * k * (1 - p) },
      font: r.font,
      scaleText: 1,
      alpha: tq < POP.from ? 0 : p,
      textDy: r.variant === 'chip' ? G.chipTextDy : 0,
      inPage: true,
    };
  };
  const states = new Map(resolved.map((r) => [r.node.id, stateOf(r)]));

  // ── 连线 ──
  const links = edges.map((e, i) => {
    const a = states.get(e.from);
    const b = states.get(e.to);
    if (!a || !b) return null;
    const alpha = Math.min(a.alpha, b.alpha);
    if (alpha <= 0) return null;
    // shrink 飞出节点:两端都落地后才画线,从出端画到入端
    const landAt = Math.max(a.fly?.landAt ?? -Infinity, b.fly?.landAt ?? -Infinity);
    const drawP = Number.isFinite(landAt) ? interpolate(tm, [landAt, landAt + LINK_DRAW.frames], [0, 1], { ...clampBoth, easing: LINK_DRAW.ease }) : 1;
    if (drawP <= 0) return null;
    const ka = a.rect.h / G.chip.h;
    const ax = a.rect.x + a.rect.w - G.dotOutInset * ka;
    const ay = a.rect.y + a.rect.h / 2;
    const kb = b.rect.h / G.box.h;
    const bx = b.rect.x + G.dotInInset * kb;
    const by = b.rect.y + b.rect.h / 2;
    const span = Math.abs(bx - ax);
    const kc = Math.min(1, Math.max(0.35, span / 240));
    const d = `M ${ax} ${ay} C ${ax + G.c1 * kc} ${ay}, ${bx - G.c2 * kc} ${by}, ${bx} ${by}`;
    const drawing = drawP < 1;
    return (
      <path
        key={i}
        d={d}
        fill="none"
        stroke={linkColor}
        strokeWidth={G.linkW * Math.min(1, Math.max(0.6, ka))}
        opacity={alpha >= 1 ? undefined : alpha}
        pathLength={drawing ? 1 : undefined}
        strokeDasharray={drawing ? '1 1' : undefined}
        strokeDashoffset={drawing ? 1 - drawP : undefined}
      />
    );
  });

  /** 飞行中各部件的透明度(落定 = undefined,不留残余样式) */
  const flyA = (f: Fly | undefined, range: [number, number]) => {
    if (!f || f.p >= 1) return undefined;
    const v = interpolate(f.p, range, [0, 1], clampBoth);
    return v >= 1 ? undefined : v;
  };
  const renderNode = (r: Resolved) => {
    const s = states.get(r.node.id)!;
    if (s.alpha <= 0) return null;
    const { rect, fly } = s;
    const chip = r.variant === 'chip';
    const settledText = Math.abs(s.scaleText - 1) < 1e-4;
    const kd = rect.h / (chip ? G.chip.h : G.box.h);
    const bgA = flyA(fly, FLY_BG);
    const textA = flyA(fly, FLY_TEXT);
    const iconP = fly && fly.p < 1 ? interpolate(fly.p, FLY_ICON, [0, 1], clampBoth) : 1;
    const dotA = flyA(fly, FLY_DOT);
    const cropA = fly && fly.p < 1 ? 1 - interpolate(fly.p, FLY_CROP, [0, 1], clampBoth) : 0;
    const dotEl = (cx: number) => <Dot cx={cx} cy={rect.y + rect.h / 2} k={Math.min(1, Math.max(0.6, kd))} color={dotColor} />;
    const dots = (
      <>
        {hasOut.has(r.node.id) ? dotEl(rect.x + rect.w - G.dotOutInset * kd) : null}
        {hasIn.has(r.node.id) ? dotEl(rect.x + G.dotInInset * kd) : null}
      </>
    );
    // 截图原样:把 from 那块截图像素裁出来,随字号同比放大,居中贴在飞行框里,前段就是截图里那块本身
    const crop =
      fly && cropA > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: rect.x + rect.w / 2 - (fly.src.w * fly.kc) / 2,
            top: rect.y + rect.h / 2 - (fly.src.h * fly.kc) / 2,
            width: fly.src.w * fly.kc,
            height: fly.src.h * fly.kc,
            overflow: 'hidden',
            opacity: cropA >= 1 ? undefined : cropA,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: -(fly.src.x - evR.x) * fly.kc,
              top: -(fly.src.y - evR.y) * fly.kc,
              width: evR.w,
              height: evR.h,
              transformOrigin: '0 0',
              scale: Math.abs(fly.kc - 1) < 1e-6 ? undefined : `${fly.kc}`,
            }}
          >
            <EvidenceContent ev={ev} w={evR.w} h={evR.h} />
          </div>
        </div>
      ) : null;
    return (
      <div key={r.node.id} style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, opacity: s.alpha >= 1 ? undefined : s.alpha }}>
        {fly && bgA !== undefined ? (
          <div style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.w, height: rect.h, background: r.node.color ?? nodeColor, opacity: bgA }} />
        ) : null}
        <div
          style={{
            position: 'absolute',
            left: rect.x,
            top: rect.y,
            width: rect.w,
            height: rect.h,
            background: fly && bgA !== undefined ? undefined : r.node.color ?? nodeColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: s.font * 0.35 * iconP,
              whiteSpace: 'pre',
              lineHeight: 1,
              fontFamily: chip ? chipFontFamily : boxFontFamily,
              fontWeight: chip ? 700 : 600,
              fontSize: s.font,
              color: r.node.textColor ?? (chip ? chipTextColor : boxTextColor),
              position: 'relative',
              top: s.textDy || undefined,
              scale: settledText ? undefined : `${s.scaleText}`,
              opacity: textA,
            }}
          >
            {r.node.icon ? (
              <span style={{ display: 'inline-flex', width: iconP >= 1 ? '1em' : `${iconP}em`, height: '1em', opacity: iconP >= 1 ? undefined : iconP }}>{r.node.icon}</span>
            ) : null}
            <span>{r.node.text}</span>
          </div>
        </div>
        {crop}
        {dotA === undefined ? dots : fly && fly.p < 1 && dotA <= 0 ? null : <div style={{ position: 'absolute', inset: 0, opacity: dotA }}>{dots}</div>}
      </div>
    );
  };
  const nodeEls = resolved.map((r) => (r.fly ? null : renderNode(r)));
  /** shrink 飞出节点单独一层,不跟黑页的推上位移走 */
  const flyEls = resolved.map((r) => (r.fly ? renderNode(r) : null));

  const graphLayer = (
    <>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        {links}
      </svg>
      {nodeEls}
    </>
  );

  // ── 源卡(push 模式在新页里;shrink 模式是截图本身)──
  const shrinkP = pageMode === 'shrink' ? shrinkFlyP : 0;
  const cardNode =
    card === 'none' || cardGone ? null : (
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: W,
          height: H,
          translate: cardExitY ? `0px ${cardExitY}px` : undefined,
          opacity: cardA >= 1 ? undefined : cardA,
        }}
      >
        {card === 'terminal' ? (
          <div style={{ position: 'absolute', left: slot.x, top: slot.y, width: slot.w, height: slot.h }}>
            <TerminalCard w={slot.w} h={slot.h} />
          </div>
        ) : (
          <EvidenceAt ev={ev} base={evR} at={pageMode === 'shrink' ? lerpRect(evR, evSlot, shrinkP) : evSlot} radius={(ev.radius ?? 0) + 6 * shrinkP}>
            {pageMode === 'shrink' && ex && tp < PAGE_PUSH.to ? (
              <div style={{ position: 'absolute', inset: 0, background: '#000', opacity: dimAlpha(te) * (1 - shrinkP) }} />
            ) : null}
          </EvidenceAt>
        )}
      </div>
    );

  // ── 抽句白条 + 荧光 ──
  const markOn = Math.floor(tk + 1e-6) === F_MARK || Math.floor(tk + 1e-6) === F_MARK + 2 || tk >= F_MARK + 4;
  const extractVisible = ex && te >= F_EXTRACT && (pageMode === 'shrink' ? tp < PAGE_FADE[0] : !covered);
  const growP = interpolate(te, [F_EXTRACT, F_EXTRACT + GROW.frames], [0, 1], { ...clampBoth, easing: GROW.ease });
  const extractEl = extractVisible ? <ExtractBar ex={ex} ev={ev} markOn={markOn && !!(ex.keyword || ex.markFrom)} growP={growP} /> : null;

  const pageBase = (
    <>
      <div style={{ position: 'absolute', inset: 0, background: pageColor }} />
      {showFrame ? (
        <div style={{ position: 'absolute', left: G.frame.x, top: G.frame.y, width: G.frame.w, height: G.frame.h, border: `2px solid ${frameColor}`, boxSizing: 'border-box' }} />
      ) : null}
    </>
  );
  const pageWrap = (children: React.ReactNode, key: string) => (
    <div
      key={key}
      style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, opacity: pageA >= 1 ? undefined : pageA, translate: pageDy ? `0px ${pageDy}px` : undefined }}
    >
      {children}
    </div>
  );

  return (
    <AbsoluteFill>
      {/* ① 证据(push:被新页盖住后不再画;shrink:整段交给源卡层) */}
      {pageMode === 'push' && !covered ? (
        <EvidenceAt ev={ev} base={evR} at={evR} radius={ev.radius}>
          {ex && te >= F_EXTRACT ? <div style={{ position: 'absolute', inset: 0, background: '#000', opacity: dimAlpha(te) }} /> : null}
        </EvidenceAt>
      ) : null}
      {pageMode === 'shrink' && !pageOn ? (
        <EvidenceAt ev={ev} base={evR} at={evR} radius={ev.radius}>
          {ex && te >= F_EXTRACT ? <div style={{ position: 'absolute', inset: 0, background: '#000', opacity: dimAlpha(te) }} /> : null}
        </EvidenceAt>
      ) : null}
      {/* ② 抽句 */}
      {extractEl}
      {/* ③④ 新页:push 时整组一个包裹层(原片整页只乘一次 α);shrink 时截图卡夹在底和图之间 */}
      {pageOn
        ? pageMode === 'push'
          ? pageWrap(
              <>
                {pageBase}
                {cardNode}
                {graphLayer}
              </>,
              'page',
            )
          : [
              pageWrap(pageBase, 'page-base'),
              <React.Fragment key="card">{cardNode}</React.Fragment>,
              pageWrap(graphLayer, 'page-graph'),
              <React.Fragment key="fly">{flyEls}</React.Fragment>,
            ]
        : null}
    </AbsoluteFill>
  );
};

/** 压暗 α:f62→f71 线性到 0.9 */
const dimAlpha = (te: number) => DIM_ALPHA * interpolate(te, [F_EXTRACT, F_DIM_END], [0, 1], clampBoth);

/**
 * 白条位置 + grow 起点。
 *
 * 原片实测「原句 → 白条」(1080p 画布 px;原句在录屏底板 rec-plate-f0-61.png 上逐列量字墨,白条来自 layout.json hl-bar / hl-text):
 *   原句字墨  x 756.75–1231.0、y 605.8–622.7(= 证据坐标 526.75,566.8 474.25×16.9),中心 (993.9, 614.3)
 *   白条字墨  x 625.9–1480.2、y 485.9–516.3,中心 (1053.1, 501.1);白条框中心 (1051.25, 500.28)
 *   → 白条 = 原句绕自身中心放大 1.80–1.81 倍,再平移 (+59.2, −113.2)。
 *     这个平移正好是「原句中心 → 录屏中心 (1054, 502.5)」的向量 (+60.1, −111.8)(残差 ≤ 1.4px):
 *     原片其实是把那句话放大后摆到录屏正中,只因原句本来就在正中附近,看着像「就地放大」。
 *   等价写法:白条 = 原句绕锚点 (920.8, 753.9) 放大 1.81 倍。这个锚点只对原片那一处成立,换句子没有意义,所以不当规则用。
 * 所以模板规则 = 绕原句中心放大 zoom 倍 + 往证据中心拉 pull(原片 pull≈1;默认 0 = 盖在原句上,泽轩604 09-27 要的观感),
 *   再推回证据框内。没给 from:沿用原片白条中心 (1051.25, 500.28),Check 不变。
 * grow 起点 = 原句原位原大小:中心 = 原句中心,缩放 = 1/zoom(字号 = from.h × zoom 时字面与原句重合)。
 */
const extractPlacement = (ex: ExtractSpec, evR: Rect, barW: number, barH: number) => {
  const z = ex.zoom ?? EXTRACT_ZOOM;
  const f = ex.from;
  if (!f) {
    const c = ex.center ?? G.barCenter;
    return { c, c0: c, s0: 1 / z };
  }
  const fx = evR.x + f.x + f.w / 2;
  const fy = evR.y + f.y + f.h / 2;
  const pull = ex.pull ?? 0;
  const inside = (v: number, lo: number, size: number, span: number) =>
    size >= span - 2 * EXTRACT_EDGE ? lo + span / 2 : Math.min(lo + span - EXTRACT_EDGE - size / 2, Math.max(lo + EXTRACT_EDGE + size / 2, v));
  const c: [number, number] = ex.center ?? [
    inside(lerp(fx, evR.x + evR.w / 2, pull), evR.x, barW, evR.w),
    inside(lerp(fy, evR.y + evR.h / 2, pull), evR.y, barH, evR.h),
  ];
  return { c, c0: [fx, fy] as [number, number], s0: 1 / z };
};

/** grow 时白条的 translate / scale(落定后清掉,Z1) */
const growStyle = (p: number, c: [number, number], c0: [number, number], s0: number, baseTranslate?: string): React.CSSProperties => {
  if (p >= 1) return { translate: baseTranslate };
  const dx = (c0[0] - c[0]) * (1 - p);
  const dy = (c0[1] - c[1]) * (1 - p);
  return {
    translate: baseTranslate ? `calc(-50% + ${dx}px) ${dy}px` : `${dx}px ${dy}px`,
    scale: `${lerp(s0, 1, p)}`,
    transformOrigin: '50% 50%',
  };
};

/** 抽句白条(text:重打那句话;crop:把截图那一行放大) */
const ExtractBar: React.FC<{ ex: ExtractSpec; ev: EvidenceSpec & { rect: Rect }; markOn: boolean; growP: number }> = ({ ex, ev, markOn, growP }) => {
  const markColor = ex.markColor ?? 'rgb(243, 125, 31)';
  const markBox = (extra: React.CSSProperties): React.CSSProperties => ({
    position: 'absolute',
    boxSizing: 'border-box',
    background: markColor,
    mixBlendMode: 'multiply',
    border: `2px solid ${G.markBorder}`,
    borderRadius: G.markRadius,
    boxShadow: G.markGlow,
    ...extra,
  });
  const grow = ex.enter === 'grow';
  if ((ex.mode ?? 'text') === 'crop' && ex.from) {
    const z = ex.zoom ?? EXTRACT_ZOOM;
    const w = ex.from.w * z;
    const h = ex.from.h * z;
    const bw = ex.width ?? w + 2 * G.barPadX;
    const bh = Math.max(h, G.barH);
    const m = ex.markFrom;
    const { c, c0, s0 } = extractPlacement(ex, ev.rect, bw, bh);
    const [cx, cy] = c;
    return (
      <div
        style={{
          position: 'absolute',
          left: cx - bw / 2,
          top: cy - bh / 2,
          width: bw,
          height: bh,
          background: '#FFFFFF',
          boxShadow: G.barShadow,
          ...(grow ? growStyle(growP, c, c0, s0) : {}),
        }}
      >
        <div style={{ position: 'absolute', left: (bw - w) / 2, top: (bh - h) / 2, width: w, height: h, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: -ex.from.x * z, top: -ex.from.y * z, width: ev.rect.w, height: ev.rect.h, transformOrigin: '0 0', scale: `${z}` }}>
            <EvidenceContent ev={ev} w={ev.rect.w} h={ev.rect.h} />
          </div>
          {markOn && m ? (
            <div style={markBox({ left: (m.x - ex.from.x) * z - 6, top: (m.y - ex.from.y) * z - 4, width: m.w * z + 12, height: m.h * z + 8 })} />
          ) : null}
        </div>
      </div>
    );
  }
  const text = ex.text ?? '';
  const kw = ex.keyword;
  const at = kw ? text.indexOf(kw) : -1;
  const [padL, padR] = ex.markPad ?? [3.4, 1.4];
  const z = ex.zoom ?? EXTRACT_ZOOM;
  const fontSize = ex.fontSize ?? (ex.from ? ex.from.h * z : G.extractFont);
  const markH = G.markH * (fontSize / G.extractFont);
  const fixed = ex.width !== undefined;
  const barH = G.barH * (fontSize / G.extractFont);
  /** 推回框内用的估宽(不测字宽);grow 起点缩放按字号折算,字面才和原句同大 */
  const estW = fixed ? ex.width! : estimateEm(text, false) * fontSize + 2 * G.barPadX;
  const place = extractPlacement(ex, ev.rect, estW, barH);
  const [cx, cy] = place.c;
  const s0 = ex.from ? ex.from.h / fontSize : place.s0;
  const content =
    at >= 0 && kw ? (
      <>
        {text.slice(0, at)}
        <span style={{ display: 'inline-block', position: 'relative' }}>
          {kw}
          {markOn ? (
            <span
              style={markBox({ left: -padL, right: -padR, top: `calc(50% - ${markH / 2}px + ${ex.markDy ?? 0}px)`, height: markH })}
            />
          ) : null}
        </span>
        {text.slice(at + kw.length)}
      </>
    ) : (
      text
    );
  const baseTranslate = fixed ? undefined : '-50% 0px';
  return (
    <div
      style={{
        position: 'absolute',
        left: fixed ? cx - ex.width! / 2 : cx,
        top: cy - barH / 2,
        width: fixed ? ex.width : undefined,
        height: barH,
        ...(grow ? growStyle(growP, place.c, place.c0, s0, baseTranslate) : { translate: baseTranslate }),
        padding: `0 ${G.barPadX}px`,
        boxSizing: 'border-box',
        background: '#FFFFFF',
        boxShadow: G.barShadow,
        display: 'flex',
        alignItems: 'center',
        whiteSpace: 'pre',
        fontFamily: ex.fontFamily ?? "SFProText, 'PingFangSC-Regular', 'PingFang SC', 'Noto Sans SC', sans-serif",
        fontSize,
        lineHeight: 1,
        wordSpacing: -0.5,
        color: ex.color ?? G.extractColor,
      }}
    >
      <span>{content}</span>
    </div>
  );
};

/** 整段(到最后一个节点落定)需要多少帧(当前 fps) */
export const evidenceToGraphDurationInFrames = (
  fps: number,
  props: Pick<EvidenceToGraphProps, 'nodes' | 'edges' | 'timing' | 'speed' | 'extract' | 'pageMode' | 'morphFrames'>,
  tail = 30,
): number => {
  const speed = props.speed ?? 1;
  const { M0, Q0, QS, MS } = phases(props);
  let end = M0 + (MORPH.to - F_MORPH);
  if (props.pageMode === 'shrink') {
    const nFly = props.nodes.filter((n) => n.from && (n.enter === undefined || n.enter === 'seed')).length;
    if (nFly) end = Math.max(end, M0 + (nFly - 1) * MS + (props.morphFrames ?? FLY.frames) + LINK_DRAW.frames);
  }
  let k = 0;
  props.nodes.forEach((n, i) => {
    // 粗算(偏长):除种子/跟页节点外都当追加节点
    if (i === 0 || n.from || n.enter === 'seed' || n.enter === 'page') return;
    const at = n.at !== undefined ? secToM(n.at, speed) : Q0 + k * QS;
    k += 1;
    end = Math.max(end, at + (POP.to - F_POP));
  });
  return Math.ceil((end / MEASURED_FPS / speed) * fps) + tail;
};
