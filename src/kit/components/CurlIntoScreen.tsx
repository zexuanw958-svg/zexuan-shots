/**
 * CurlIntoScreen.tsx — 「卷页过门切进录屏」转场模板(秋芝《Claude Code 全解》7:04 目录页 → 官网录屏实测版)。
 *
 * 出处:内部复刻案例 qz-cc-0413-title-toc-dive(交付 20)。案例里卷页层是原片差分抠的 15 张 PNG
 * (换不了内容);这里改成代码画的参数化卷页,两种画法:
 *
 * curlStyle='cylinder'(默认):纸绕窗口右外侧一根竖直书脊卷进来 —— 每一屏幕行按 cos θ 往书脊横向压缩(行保持水平),
 *   θ 沿屏幕高度二次分布(上小下大,所以左下沿是一条弧),整页同时往上滑;越扭越往下越暗。
 *   依据:案例 15 张图的覆盖掩膜是「上沿水平、从下往上长、右沿贴窗、左下沿是弧」,和模板 16(PageCurlTransition,
 *   秋芝同一个录屏窗模板、同为 15 帧)的实测模型一致,所以直接沿用它的逐帧参数与明暗公式(数值拷过来,原文件不动),
 *   时间对齐偏移 −0.5 帧由本案例 Check 片扫出来(卷页段均差 19.7,旧直线折页 27.3)。
 *   实现是 2D:横切 ~150 条,每条 = 同一个 to 做一次 matrix(cosθ,0,0,1,…) + clip-path,纸边按条两端 θ 连斜线;
 *   不用 CSS 3D(HARD_RULES §10 那些坑都绕开了)。模板 16 的逐像素快门模糊做不了,用按上滑速度的小半径 blur 近似。
 *
 * curlStyle='fold'(旧版备选):直线折边 + 纸背。覆盖率 C(t)、落平率 F(t) 按 15 张图逐帧量;折边法线角 θ(t) 为
 *   「给定面积下与覆盖掩膜最吻合的直线」逐帧搜索结果。
 *
 * 本地帧 0 = 原片 f335(录屏窗 2px 白外框硬出);1–15 = f336–f350 卷页;16 = f351 新页完全落定。
 *
 * 用法:
 *   <Sequence from={x}>
 *     <CurlIntoScreen from={<目录页 />} to={<OffthreadVideo src={录屏} />} />
 *   </Sequence>
 * from 铺满画布;to 放进窗口盒子(宽高 = 窗口),自己铺满即可。窗口默认原片录屏窗;window="full" 整屏卷。
 * 转场后窗口外仍显示 from(原片就是点阵页 + 头像留在窗外),不要就给 outside。
 */
import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

const clampBoth = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 实测时基:原片 30fps */
const MEASURED_FPS = 30;
/** 卷页从本地第 1 帧开始(f336),第 16 帧(f351)落定 */
const CURL_START = 1;
const CURL_DONE = 16;
/** 覆盖率 f336–f350 → f351(curl/*.png alpha>128 占比) */
const COVER = [0.003, 0.012, 0.036, 0.099, 0.197, 0.311, 0.416, 0.518, 0.62, 0.735, 0.847, 0.927, 0.97, 0.991, 0.995, 1];
/** 已落平率 f336–f350 → f351(阈值法原值 ×1.046 归一到 f350 覆盖率,封顶 = 覆盖率) */
const FLAT = [0, 0.001, 0.008, 0.025, 0.065, 0.141, 0.236, 0.334, 0.425, 0.528, 0.635, 0.87, 0.942, 0.974, 0.995, 1];
const CURL_FRAMES = COVER.map((_, i) => CURL_START + i);
/** 覆盖边界法线角(度,屏幕坐标 y 向下;0 = 朝右,正 = 朝右下,负 = 朝右上)f336–f351 */
const NORMAL_DEG = [82, 82, 68, 42, 40, -14, -38, -60, -48, -42, -28, -14, -4, 0, 0, 0];

/** 原片录屏窗:219.03–1886.87 × 29.3–958.51,圆角 30.8(三帧拟合一致到 0.03px) */
export const CURL_WINDOW_ORIGINAL = { x: 219.03, y: 29.3, width: 1667.84, height: 929.21, radius: 30.8 };

type Pt = [number, number];
type Win = { x: number; y: number; width: number; height: number; radius: number };

/** 半平面 {p: a·p ≤ b} 裁多边形(Sutherland–Hodgman) */
const clipHalf = (poly: Pt[], ax: number, ay: number, b: number): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i += 1) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const fp = ax * p[0] + ay * p[1] - b;
    const fq = ax * q[0] + ay * q[1] - b;
    if (fp <= 0) out.push(p);
    if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) {
      const t = fp / (fp - fq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
};

const polyCss = (poly: Pt[]) => `polygon(${poly.map(([x, y]) => `${x.toFixed(2)}px ${y.toFixed(2)}px`).join(', ')})`;

const polyArea = (poly: Pt[]): number => {
  let sum = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    sum += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(sum) / 2;
};

/** 找 c 使矩形里 {n·p ≥ c} 的面积占比 = f(二分,纯函数,逐帧确定) */
const offsetForFraction = (f: number, rect: Pt[], W: number, H: number, nx: number, ny: number): number => {
  const proj = rect.map(([x, y]) => nx * x + ny * y);
  let lo = Math.min(...proj);
  let hi = Math.max(...proj);
  if (f <= 0) return hi + 1;
  if (f >= 1) return lo - 1;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    // {n·p ≥ mid} ⇔ {−n·p ≤ −mid}
    const a = polyArea(clipHalf(rect, -nx, -ny, -mid)) / (W * H);
    if (a > f) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};

// ── 'cylinder' 画法:绕右外侧竖直书脊卷进来(剪映「卷页」同款几何)──
// 案例 15 张卷页图的覆盖掩膜显示:纸的上沿是水平线、从下往上滑,右沿贴窗右边,左下沿是一条弧 ——
// 这正是模板 16(kit/components/PageCurlTransition.tsx,秋芝《Codex全解》7:08 实测)那套模型:
// 每一屏幕行绕书脊 x0 横向收缩 cos θ(行保持水平),θ 沿屏幕高度二次分布(上小下大),整页同时上滑 ty。
// 两段都是秋芝同一个录屏窗模板、同为 15 帧,这里直接沿用模板 16 的逐帧参数与明暗公式(数值拷自该文件 KEYS / SHADE,
// 原文件不动),按窗口几何等比折算;WebGL 纹理换成 CSS 横切条(每条 = 同一个 to 做一次 2D 仿射 + clip-path),
// 所以 to 可以是任意 React 节点(录屏视频也行)。模板 16 的快门运动模糊没搬(CSS 做不了逐像素多样本)。
/** 模板 16 的录屏框(原片 1080p):参数按它和本窗口的比例折算 */
/** 与模板 16 的帧对齐:本组件第 1 帧 = 它的 −0.5 帧(Check 片扫 0/±0.5/±1/±1.5/±2 与时间缩放 1–1.2,卷页段均差最低 19.8) */
const SPINE_TIME_OFFSET = -0.5;
/** 运动模糊半径 = 每帧上滑像素 × 此系数(封顶 6px) */
const BLUR_PER_PX = 0.025;
const S16_BOX = [233.4, 40.3, 1874.2, 964.7] as const;
const S16_SPINE_X = 1960.0;
const S16_PAGE = { uL: -60.0, vT: -150.0, uR: 1880.0 };
/** 明暗 k = 1 − a·(θ/90°)^p·clamp((v−v0)/(v1−v0)) */
const S16_SHADE = [1.0, 5.0449, -0.0031, 819.5776] as const;
/** 逐帧 (θ上, θ中, θ下[度], ty[px]),模板 16 本地帧 0–14 = 原片 f4–f18;f19 落定全 0。本组件本地帧 1–15 对应它的 0–14 */
const S16_KEYS: [number, number, number, number][] = [
  [19.15, 59.3536, 83.4904, 1270.0],
  [19.15, 59.3536, 83.4904, 1131.9918],
  [19.15, 59.3536, 83.4904, 942.472],
  [19.15, 59.3536, 83.4904, 747.9341],
  [19.15, 59.3536, 83.4904, 550.198],
  [19.15, 59.3536, 83.4904, 349.8607],
  [19.15, 57.775, 82.8647, 170.3271],
  [19.15, 55.2926, 79.7706, 72.2911],
  [18.191, 50.0444, 71.5034, 17.6208],
  [15.8276, 41.9333, 59.3055, 0.4291],
  [12.1127, 31.7732, 44.0164, 0.3396],
  [8.4968, 22.1447, 30.3504, 0.25],
  [5.3243, 13.6321, 18.8342, 0.15],
  [2.3631, 6.3793, 8.6902, 0.08],
  [0.0296, 0, 0.2767, 0.03],
  [0, 0, 0, 0],
];

const renderSpineCurl = ({
  t,
  W,
  H,
  to,
  paperColor,
  timeOffset,
  flipX,
}: {
  t: number;
  W: number;
  H: number;
  to: React.ReactNode;
  paperColor: string;
  timeOffset: number;
  flipX: boolean;
}): React.ReactNode => {
  // 模板 16 帧号(可带小数)→ 线性插值
  const kf = Math.max(0, Math.min(S16_KEYS.length - 1, (t - CURL_START) + timeOffset));
  const i0 = Math.floor(kf);
  const i1 = Math.min(S16_KEYS.length - 1, i0 + 1);
  const w = kf - i0;
  const K = S16_KEYS[i0].map((v, j) => v + (S16_KEYS[i1][j] - v) * w);
  // 窗口坐标系(0..W, 0..H)下的几何折算
  const sx = W / (S16_BOX[2] - S16_BOX[0]);
  const sy = H / (S16_BOX[3] - S16_BOX[1]);
  // mirror-x:书脊换到左外侧,纸的出血边跟着镜像(内容本身不镜像)
  const x0r = (S16_SPINE_X - S16_BOX[0]) * sx;
  const uLr = (S16_PAGE.uL - S16_BOX[0]) * sx;
  const uRr = (S16_PAGE.uR - S16_BOX[0]) * sx;
  const x0 = flipX ? W - x0r : x0r;
  const uL = flipX ? W - uRr : uLr;
  const uR = flipX ? W - uLr : uRr;
  const vT = (S16_PAGE.vT - S16_BOX[1]) * sy;
  const ty = K[3] * sy;
  const deg = Math.PI / 180;
  const theta = (y: number) => {
    const u = y / H;
    return (K[0] * (1 - u) * (1 - 2 * u) + K[1] * 4 * u * (1 - u) + K[2] * u * (2 * u - 1)) * deg;
  };
  // 条高约 6px:再粗时深色块边缘会出台阶(变体 5 自检看到)
  const N = Math.max(24, Math.min(180, Math.round(H / 6)));
  const strips: React.ReactNode[] = [];
  for (let j = 0; j < N; j += 1) {
    const y0 = (j / N) * H;
    const y1 = ((j + 1) / N) * H;
    const ym = (y0 + y1) / 2;
    const v = ym - ty;
    if (y1 - ty < vT) continue; // 纸上沿以上
    const th = theta(ym);
    const c = Math.max(1e-3, Math.cos(th));
    const shadeK = S16_SHADE[0] * Math.pow(Math.min(1, Math.max(0, th / (Math.PI / 2))), S16_SHADE[1]) * Math.min(1, Math.max(0, (v / sy - S16_SHADE[2]) / (S16_SHADE[3] - S16_SHADE[2])));
    // 页坐标 (u, v) → 屏幕 (x0 + (u − x0)·c, v + ty)
    const m = `matrix(${c}, 0, 0, 1, ${(x0 * (1 - c)).toFixed(3)}, ${ty.toFixed(3)})`;
    const top = Math.max(y0, vT + ty) - 0.5;
    const bot = y1 + 0.5;
    // 纸的左(镜像时右)外沿按条两端各自的 θ 连成斜线,避免 12px 一级的台阶
    const edgeX = (y: number) => x0 + ((flipX ? uR : uL) - x0) * Math.cos(theta(y));
    const [ex0, ex1] = [edgeX(top), edgeX(bot)];
    const poly = flipX
      ? `polygon(0px ${top.toFixed(2)}px, ${ex0.toFixed(2)}px ${top.toFixed(2)}px, ${ex1.toFixed(2)}px ${bot.toFixed(2)}px, 0px ${bot.toFixed(2)}px)`
      : `polygon(${ex0.toFixed(2)}px ${top.toFixed(2)}px, ${W}px ${top.toFixed(2)}px, ${W}px ${bot.toFixed(2)}px, ${ex1.toFixed(2)}px ${bot.toFixed(2)}px)`;
    strips.push(
      <div key={j} style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, clipPath: poly }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, transform: m, transformOrigin: '0 0' }}>
          {/* 纸比窗口大(左多、上多):先铺纸色出血,再放新画面 */}
          <div style={{ position: 'absolute', left: uL - 4000, top: vT, width: uR - uL + 8000, height: H - vT + 4, background: paperColor }} />
          <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H }}>{to}</div>
          {shadeK > 0.002 ? <div style={{ position: 'absolute', left: uL - 4000, top: vT, width: uR - uL + 8000, height: H - vT + 4, background: `rgba(0,0,0,${shadeK.toFixed(3)})` }} /> : null}
        </div>
      </div>,
    );
  }
  // 运动模糊近似:模板 16 原片 f7–f9 快门约 1 帧(纸每帧上滑近 200px)。CSS 只有各向同性模糊,按本帧上滑速度给一个小半径
  const kfNext = Math.min(S16_KEYS.length - 1, kf + 1);
  const dty = Math.abs(ty - (S16_KEYS[Math.floor(kfNext)][3] + (S16_KEYS[Math.min(S16_KEYS.length - 1, Math.floor(kfNext) + 1)][3] - S16_KEYS[Math.floor(kfNext)][3]) * (kfNext - Math.floor(kfNext))) * sy);
  const blur = Math.min(6, dty * BLUR_PER_PX);
  return <div style={{ position: 'absolute', inset: 0, filter: blur > 0.3 ? `blur(${blur.toFixed(2)}px)` : undefined }}>{strips}</div>;
};

/** original = 原片(右下冒出 → 右上 → 顶部 → 左下收尾);mirror-x 左右镜像;mirror-y 上下镜像;mirror-xy 都镜像 */
export type CurlDirection = 'original' | 'mirror-x' | 'mirror-y' | 'mirror-xy';

export type CurlIntoScreenProps = {
  /** 前一画面(铺满画布) */
  from: React.ReactNode;
  /** 后一画面(放进窗口,宽高 = 窗口) */
  to: React.ReactNode;
  /** 窗口几何(画布 px);'full' = 整个画布、不圆角。默认原片录屏窗 */
  window?: Win | 'full';
  /** 转场后窗口外显示什么;默认继续显示 from */
  outside?: React.ReactNode;
  /** 卷页前一帧先硬出窗口白外框(原片 f335);false 不出 */
  frameFlash?: boolean;
  frameColor?: string;
  /** 扫动方向,默认原片 */
  direction?: CurlDirection;
  /** 画法:'cylinder'(默认)= 纸绕右外侧竖直书脊卷进来(逐行 cos θ 压缩 + 上滑 + 越扭越暗,CSS 横切条);'fold' = 旧版直线折页 */
  /** mirror-y / mirror-xy 只对 fold 生效;cylinder 支持 original / mirror-x */
  curlStyle?: 'cylinder' | 'fold';
  /** 纸色(原片偏白) */
  paperColor?: string;
  /** 只对 fold 生效:纸背透出新页内容的程度 0–1,默认 0.45 */
  showThrough?: number;
  /** 速度倍率:1 = 原片 15 帧卷完(0.5 秒) */
  speed?: number;
  /** 起播延迟(帧,按当前 fps) */
  delayFrames?: number;
};

export const curlIntoScreenDurationInFrames = (fps: number, speed = 1): number => Math.ceil((CURL_DONE / MEASURED_FPS / speed) * fps);

export const CurlIntoScreen: React.FC<CurlIntoScreenProps> = ({
  from,
  to,
  window: winIn = CURL_WINDOW_ORIGINAL,
  outside,
  frameFlash = true,
  frameColor = '#F0F0F0',
  direction = 'original',
  curlStyle = 'cylinder',
  paperColor = '#FAFAFA',
  showThrough: showThroughIn,
  speed = 1,
  delayFrames = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = ((frame - delayFrames) / fps) * MEASURED_FPS * speed;
  const win: Win = winIn === 'full' ? { x: 0, y: 0, width, height, radius: 0 } : winIn;
  const W = win.width;
  const H = win.height;

  const before = t < CURL_START - 0.001;
  const done = t >= CURL_DONE;
  const showFrame = frameFlash && t >= 0 && !done;

  const mx = direction === 'mirror-x' || direction === 'mirror-xy' ? -1 : 1;
  const my = direction === 'mirror-y' || direction === 'mirror-xy' ? -1 : 1;

  let body: React.ReactNode = null;
  if (!before && !done) {
    const cover = interpolate(t, CURL_FRAMES, COVER, clampBoth);
    const flat = Math.min(cover, interpolate(t, CURL_FRAMES, FLAT, clampBoth));
    const deg = interpolate(t, CURL_FRAMES, NORMAL_DEG, clampBoth);
    const nx = Math.cos((deg * Math.PI) / 180) * mx;
    const ny = Math.sin((deg * Math.PI) / 180) * my;
    const rect: Pt[] = [[0, 0], [W, 0], [W, H], [0, H]];
    const cE = offsetForFraction(cover, rect, W, H, nx, ny);
    const cF = Math.max(cE, offsetForFraction(flat, rect, W, H, nx, ny));
    // 已落平 {n·p ≥ cF};书页 {cE ≤ n·p < cF}
    const flatPoly = clipHalf(rect, -nx, -ny, -cF);
    const flapPoly = clipHalf(clipHalf(rect, -nx, -ny, -cE), nx, ny, cF);
    // 沿折线 n·p = cF 镜像:p' = p − 2(n·p − cF)n
    const m = `matrix(${1 - 2 * nx * nx}, ${-2 * nx * ny}, ${-2 * nx * ny}, ${1 - 2 * ny * ny}, ${2 * cF * nx}, ${2 * cF * ny})`;
    // 明暗沿 −n(从折线往书页外沿):CSS 渐变方向向量 (sinA, −cosA) = −n;0 点在 −n·p 最小的角上
    const angle = Math.atan2(-nx, ny);
    const base = Math.min(...rect.map(([x, y]) => -nx * x - ny * y));
    const dF = -cF - base;
    const dE = -cE - base;
    const band = Math.max(1, dE - dF);
    const showThrough = showThroughIn ?? 0.45;
    const shade = `linear-gradient(${angle}rad, rgba(0,0,0,0.16) ${dF.toFixed(1)}px, rgba(0,0,0,0) ${(dF + band * 0.35).toFixed(1)}px, rgba(255,255,255,0.25) ${(dF + band * 0.7).toFixed(1)}px, rgba(0,0,0,0.14) ${dE.toFixed(1)}px)`;
    body = curlStyle === 'cylinder' ? (
      renderSpineCurl({ t, W, H, to, paperColor, timeOffset: SPINE_TIME_OFFSET, flipX: mx < 0 })
    ) : (
      <>
        {flatPoly.length >= 3 ? (
          <div style={{ position: 'absolute', inset: 0, clipPath: polyCss(flatPoly) }}>{to}</div>
        ) : null}
        {flapPoly.length >= 3 ? (
          <div style={{ position: 'absolute', inset: 0, clipPath: polyCss(flapPoly) }}>
            <div style={{ position: 'absolute', inset: 0, background: paperColor }} />
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: W,
                height: H,
                transform: m,
                transformOrigin: '0 0',
                opacity: showThrough,
                filter: 'blur(3px)',
              }}
            >
              {to}
            </div>
            <div style={{ position: 'absolute', inset: 0, background: shade }} />
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width, height, overflow: 'hidden' }}>
      {done && outside !== undefined ? outside : from}
      {showFrame ? (
        <div
          style={{
            position: 'absolute',
            left: win.x,
            top: win.y,
            width: W,
            height: H,
            boxSizing: 'border-box',
            border: `2px solid ${frameColor}`,
            borderRadius: win.radius,
          }}
        />
      ) : null}
      {!before ? (
        <div
          style={{
            position: 'absolute',
            left: win.x,
            top: win.y,
            width: W,
            height: H,
            borderRadius: win.radius,
            overflow: 'hidden',
          }}
        >
          {done ? to : body}
        </div>
      ) : null}
    </div>
  );
};
