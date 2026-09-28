/**
 * PageCurlTransition.tsx — 「卷页飞入」过门(秋芝《Codex全解》7:08.9 Finder 截图从右下翻进来,实测版)。
 *
 * 出处:内部复刻案例 qz-cx-0428-sample-carousel(交付 14),工序④逐帧拟合 + ⑦b 重拟合。
 * 数学与案例 remotion/runtime.tsx 的 PageFlipCanvas、tools/b7_flip_model.py 同一套;默认值 = 原片 30fps 实测,不是手调。
 *
 * 动作(原片 f4→f19,共 15 帧 = 0.5 秒):
 *   一张比画面大的「纸」绕画面右外侧一根竖直书脊 x0 翻进来:
 *   · 每一行按 cos θ 绕书脊横向收缩(行保持水平);扭转角 θ 挂在【屏幕行】上,沿屏幕高度二次分布(上 19°/中 59°/下 83°),
 *     所以前沿弧线原地不动、纸从下面沿着它往上长(f5–f9),然后扭转放平(f10–f18),f19 落定
 *   · 整页同时往上滑 ty(1270px → 0)
 *   · 扭得越狠、越往页面下半越暗:k = 1 − (θ/90°)^5.04 · clamp(v/820)
 *   · 快门运动模糊:每帧按实测快门长度取 12–64 个子时刻平均(每个子样本最多挪约 4px,治横向台阶纹)
 *
 * 用法(当转场用):下面放旧画面,上面套这个,新画面给一张静帧图当「纸」,落定后换成活的新画面(children):
 *   <AbsoluteFill><OldScene /></AbsoluteFill>
 *   <Sequence from={x}>
 *     <PageCurlTransition src={staticFile('new-scene-still.png')} rect={[0, 0, 1920, 1080]}>
 *       <NewScene />
 *     </PageCurlTransition>
 *   </Sequence>
 * 本地第 0 帧 = 原片 f4(纸还在画外);第 1 帧开始露角;第 15 帧(×1/speed)落定。几何按 1920×1080 画布像素给。
 *
 * 渲染要 WebGL2:工程 remotion.config.ts 加 Config.setChromiumOpenGlRenderer('angle')(官方 effects.md 的做法),
 * 拿不到 WebGL2 会直接报错「PageCurlTransition: WebGL2 不可用」,不会偷偷跳过。
 */
import React, { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, cancelRender, continueRender, delayRender, useCurrentFrame, useVideoConfig } from 'remotion';

/** 实测时基:原片 30fps */
const MEASURED_FPS = 30;
/** 关键帧表的首帧(原片 f4 = 本地第 0 帧) */
const KEY_F0 = 4;
/** 原片落定帧 f19 → 本地 15 */
export const PAGE_CURL_SETTLE = 15;

// ── 实测几何(原片 1080p 画布 px;specs/motion-ext.json pageFlip)──
/** 内容区(录屏框)X0,Y0,X1,Y1:纸落定时就铺满这块 */
const C0 = [233.4, 40.3, 1874.2, 964.7] as const;
/** 书脊 x0(画框右外侧) */
const SPINE_X = 1960.0;
/** 纸的范围(页坐标):左 uL、上 vT、右 uR —— 纸比内容区大(左边多 293px、上边多 190px) */
const PAGE_BOUNDS = { uL: -60.0, vT: -150.0, uR: 1880.0 };
/** 明暗 shade = [a, p, v0, v1]:k = 1 − a·(θ/90°)^p·clamp((v−v0)/(v1−v0)) */
const SHADE = [1.0, 5.0449, -0.0031, 819.5776] as const;

/**
 * 逐帧参数 (θT, θM, θB[度], ty[px]):f4–f18,⑦b 重拟合(1/8 分辨率模糊 MAE + 逐行前沿 + 逐列上沿,Powell + 平滑罚项)。
 * 前 6 帧扭转形状不变、只上滑(纸沿着固定弧线往上长);f10 起放平。tx 全程 0,省略。
 */
const KEYS: Record<number, [number, number, number, number]> = {
  4: [19.15, 59.3536, 83.4904, 1270.0],
  5: [19.15, 59.3536, 83.4904, 1131.9918],
  6: [19.15, 59.3536, 83.4904, 942.472],
  7: [19.15, 59.3536, 83.4904, 747.9341],
  8: [19.15, 59.3536, 83.4904, 550.198],
  9: [19.15, 59.3536, 83.4904, 349.8607],
  10: [19.15, 57.775, 82.8647, 170.3271],
  11: [19.15, 55.2926, 79.7706, 72.2911],
  12: [18.191, 50.0444, 71.5034, 17.6208],
  13: [15.8276, 41.9333, 59.3055, 0.4291],
  14: [12.1127, 31.7732, 44.0164, 0.3396],
  15: [8.4968, 22.1447, 30.3504, 0.25],
  16: [5.3243, 13.6321, 18.8342, 0.15],
  17: [2.3631, 6.3793, 8.6902, 0.08],
  18: [0.0296, -0.0, 0.2767, 0.03],
};
/** 每帧快门长度(帧):原片 f7–f9 纸滑得最快,快门 ~1 帧(很重的扇形模糊) */
const SHUTTER: Record<number, number> = {
  4: 0, 5: 0.4471, 6: 0.3827, 7: 0.9085, 8: 1.1348, 9: 0.9953, 10: 0.4354, 11: 0.3662, 12: 0.2, 13: 0.1,
  14: 0.0093, 15: 0.0011, 16: 0.0056, 17: 0.0267, 18: 0.0318,
};
/** 每帧快门样本数(按「每个样本在画面上最多挪 4px」加密) */
const SAMPLE_COUNT: Record<number, number> = {
  4: 1, 5: 19, 6: 19, 7: 45, 8: 57, 9: 49, 10: 16, 11: 14, 12: 14, 13: 12, 14: 1, 15: 1, 16: 1, 17: 12, 18: 12,
};

/** 关键帧表的单调三次 Hermite(Fritsch–Carlson),与案例 runtime monoAt 同一算法;f19 起补 0(落定) */
const KEY_MAP: Map<number, number[]> = (() => {
  const m = new Map<number, number[]>(Object.entries(KEYS).map(([f, v]) => [Number(f), v as number[]]));
  for (let f = 19; f <= 26; f += 1) m.set(f, [0, 0, 0, 0]);
  return m;
})();
const monoTangent = (f: number): number[] => {
  const P = KEY_MAP.get(f) as number[];
  const L = KEY_MAP.get(f - 1);
  const R = KEY_MAP.get(f + 1);
  return P.map((p, j) => {
    const dl = L ? p - L[j] : undefined;
    const dr = R ? R[j] - p : undefined;
    if (dl === undefined && dr === undefined) return 0;
    if (dl === undefined) return dr as number;
    if (dr === undefined) return dl;
    let m = dl * dr > 0 ? 0.5 * (dl + dr) : 0;
    if (Math.abs(m) > 3 * Math.abs(dl)) m = 3 * dl;
    if (Math.abs(m) > 3 * Math.abs(dr)) m = 3 * dr;
    return m;
  });
};
const keyAt = (t: number): number[] => {
  if (t <= 4) return KEY_MAP.get(4) as number[];
  if (t >= 26) return [0, 0, 0, 0];
  const f0 = Math.floor(t);
  const w = t - f0;
  const P1 = KEY_MAP.get(f0) as number[];
  if (w === 0) return P1;
  const P2 = KEY_MAP.get(f0 + 1) as number[];
  const m1 = monoTangent(f0);
  const m2 = monoTangent(f0 + 1);
  const w2 = w * w;
  const w3 = w2 * w;
  return P1.map((p1, j) => (2 * w3 - 3 * w2 + 1) * p1 + (w3 - 2 * w2 + w) * m1[j] + (-2 * w3 + 3 * w2) * P2[j] + (w3 - w2) * m2[j]);
};

const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
const FS = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec4 uA[64];      // (θT, θM, θB, ty):弧度、弧度、弧度、像素
uniform int uN;
uniform vec4 uShade;      // (a, p, v0, v1)
uniform vec3 uBounds;     // 纸 uL, vT, uR(页坐标)
uniform vec2 uOrigin;     // 画布左上角在合成里的坐标
uniform vec2 uSize;       // 画布宽高(CSS px)
uniform vec2 uBuf;        // 画布像素宽高
uniform float uX0;        // 书脊 x
uniform vec2 uSpanY;      // 扭转廓线的屏幕 y 起点与跨度
uniform vec2 uTexOrigin; uniform vec2 uTexSize;
out vec4 o;
void main(){
  float x = uOrigin.x + gl_FragCoord.x * (uSize.x / uBuf.x);
  float y = uOrigin.y + (uBuf.y - gl_FragCoord.y) * (uSize.y / uBuf.y);
  vec3 acc = vec3(0.0); float cov = 0.0;
  float t = (y - uSpanY.x) / uSpanY.y;
  for (int k = 0; k < 64; k++) {
    if (k >= uN) break;
    vec4 a = uA[k];
    float v = y - a.w;
    float th = a.x * (1.0 - t) * (1.0 - 2.0 * t) + a.y * 4.0 * t * (1.0 - t) + a.z * t * (2.0 * t - 1.0);
    float c = cos(th);
    if (abs(c) < 1e-4) c = 1e-4;
    float u = uX0 + (x - uX0) / c;
    if (u >= uBounds.x && v >= uBounds.y && u <= uBounds.z) {
      vec2 tc = (vec2(u, v) - uTexOrigin) / uTexSize;
      float dth = (a.x * (4.0 * t - 3.0) + a.y * (4.0 - 8.0 * t) + a.z * (4.0 * t - 1.0)) / uSpanY.y;
      float duy = (x - uX0) * sin(th) / (c * c) * dth;
      float shade = 1.0;
      if (uShade.x > 0.0) shade = 1.0 - uShade.x * pow(clamp(th, 0.0, 1.5707963) / 1.5707963, uShade.y) * clamp((v - uShade.z) / max(1.0, uShade.w - uShade.z), 0.0, 1.0);
      acc += shade * textureGrad(uTex, tc, vec2(abs(1.0 / c) / uTexSize.x, 0.0), vec2(duy / uTexSize.x, 1.0 / uTexSize.y)).rgb;
      cov += 1.0;
    }
  }
  float n = float(uN);
  o = vec4(acc / n, cov / n);   // 预乘 alpha:覆盖率 = 落在纸内的样本比例
}`;

export type Rect = [number, number, number, number];

export type PageCurlTransitionProps = {
  /** 「纸」的图(一张静帧:新画面截图 / 文件夹截图 / 海报)。和 paint 二选一 */
  src?: string;
  /** 用代码画纸:往 2D 画布上画(画布坐标 = 页坐标减去纸左上角),可异步(等图片加载) */
  paint?: (ctx: CanvasRenderingContext2D, box: { x: number; y: number; width: number; height: number }) => void | Promise<void>;
  /** paint 的缓存键:内容变了就换键 */
  paintKey?: string;
  /** 纸落定后铺满的区域(画布 px,[x, y, 宽, 高])。默认 = 原片录屏框 (233.4, 40.3, 1640.8×924.4);全屏转场给 [0, 0, 1920, 1080] */
  rect?: Rect;
  /** src 图片在页坐标里的位置(默认 = rect)。图比 rect 大(带出血)时给它 */
  srcRect?: Rect;
  /** 纸比 rect 多出来的边(翻动时会露出来):给颜色就填色;不给就把图的四边往外拉伸(案例替换素材时的做法) */
  bleedColor?: string;
  /** false = 纸就是这张图本身的大小(不要出血,翻动时直接露出纸边);默认 true = 原片比例的大纸 */
  bleed?: boolean;
  /** 速度倍率:1 = 原片(0.5 秒落定);0.7 更舒展,1.3 更利落 */
  speed?: number;
  /** 明暗(越扭越暗),默认开 */
  shading?: boolean;
  /** 快门运动模糊,默认开(关掉渲得快,但翻动时会有硬边) */
  motionBlur?: boolean;
  /** 落定后显示的活画面(比如新场景的真视频);不给就一直显示纸 */
  children?: React.ReactNode;
  /** 给画布加的样式(比如落定后当背景:filter 模糊压暗) */
  canvasStyle?: React.CSSProperties;
};

/** 按 rect 把原片几何等比折算(原片 rect = 录屏框) */
export const pageCurlGeometry = (rect: Rect) => {
  const [rx, ry, rw, rh] = rect;
  const sx = rw / (C0[2] - C0[0]);
  const sy = rh / (C0[3] - C0[1]);
  return {
    sx,
    sy,
    spineX: rx + (SPINE_X - C0[0]) * sx,
    uL: rx + (PAGE_BOUNDS.uL - C0[0]) * sx,
    vT: ry + (PAGE_BOUNDS.vT - C0[1]) * sy,
    uR: rx + (PAGE_BOUNDS.uR - C0[0]) * sx,
  };
};

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`PageCurlTransition: 图片加载失败 ${url}`));
    img.src = url;
  });

type GlState = { gl: WebGL2RenderingContext; prog: WebGLProgram; ready: Promise<void>; key: string };

export const PageCurlTransition: React.FC<PageCurlTransitionProps> = ({
  src,
  paint,
  paintKey,
  rect = [C0[0], C0[1], C0[2] - C0[0], C0[3] - C0[1]],
  srcRect,
  bleedColor,
  bleed = true,
  speed = 1,
  shading = true,
  motionBlur = true,
  children,
  canvasStyle,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<GlState | null>(null);
  /** 原片时基下的时刻(帧,可小数):本地 0 = 原片 f4 */
  const tMeasured = (frame * MEASURED_FPS * speed) / fps;
  const settled = tMeasured >= PAGE_CURL_SETTLE;
  const [rx, ry, rw, rh] = rect;
  const geo0 = pageCurlGeometry(rect);
  const sr = srcRect ?? rect;
  const geo = bleed ? geo0 : { ...geo0, uL: sr[0], vT: sr[1], uR: sr[0] + sr[2] };
  const W = Math.max(1, Math.round(rw));
  const H = Math.max(1, Math.round(rh));
  const texKey = `${src ?? ''}|${paintKey ?? ''}|${rect.join(',')}|${(srcRect ?? rect).join(',')}|${bleedColor ?? ''}|${bleed}`;
  const showChildren = settled && children !== undefined;

  useLayoutEffect(() => {
    if (showChildren) return undefined;
    const handle = delayRender(`PageCurlTransition f${frame}`, { timeoutInMilliseconds: 60000 });
    const canvas = ref.current;
    if (!canvas) {
      continueRender(handle);
      return undefined;
    }
    try {
      if (!glRef.current || glRef.current.key !== texKey) {
        const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, premultipliedAlpha: true, antialias: false }) as WebGL2RenderingContext | null;
        if (!gl) throw new Error('PageCurlTransition: WebGL2 不可用(渲染加 Config.setChromiumOpenGlRenderer(\'angle\'))');
        const sh = (type: number, source: string) => {
          const s = gl.createShader(type) as WebGLShader;
          gl.shaderSource(s, source);
          gl.compileShader(s);
          if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
          return s;
        };
        const prog = gl.createProgram() as WebGLProgram;
        gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
        gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || 'link');
        gl.useProgram(prog);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, 'p');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        // 纹理 = 纸的整个范围(uL..uR × vT..rect 底 / 图底),图画在 srcRect,四周出血填色或夹边外延
        const [sx0, sy0, sw, shh] = srcRect ?? rect;
        const tx0 = Math.min(geo.uL, sx0);
        const ty0 = Math.min(geo.vT, sy0);
        const tx1 = Math.max(geo.uR, sx0 + sw);
        const ty1 = Math.max(ry + rh, sy0 + shh);
        const TW = Math.min(4096, Math.ceil(tx1 - tx0));
        const TH = Math.min(4096, Math.ceil(ty1 - ty0));
        const ready = (async () => {
          const cv = document.createElement('canvas');
          cv.width = TW;
          cv.height = TH;
          const ctx = cv.getContext('2d') as CanvasRenderingContext2D;
          ctx.imageSmoothingEnabled = true;
          if (bleedColor) {
            ctx.fillStyle = bleedColor;
            ctx.fillRect(0, 0, TW, TH);
          }
          const ox = sx0 - tx0;
          const oy = sy0 - ty0;
          if (paint) {
            ctx.save();
            ctx.translate(ox, oy);
            await paint(ctx, { x: sx0, y: sy0, width: sw, height: shh });
            ctx.restore();
          } else if (src) {
            const img = await loadImage(src);
            ctx.drawImage(img, ox, oy, sw, shh);
          }
          if (!bleedColor) {
            ctx.drawImage(cv, ox, oy, 1, shh, 0, oy, ox, shh);
            ctx.drawImage(cv, ox + sw - 1, oy, 1, shh, ox + sw, oy, TW - ox - sw, shh);
            ctx.drawImage(cv, 0, oy, TW, 1, 0, 0, TW, oy);
            ctx.drawImage(cv, 0, oy + shh - 1, TW, 1, 0, oy + shh, TW, TH - oy - shh);
          }
          const tex = gl.createTexture();
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
          gl.generateMipmap(gl.TEXTURE_2D);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          const U = (name: string) => gl.getUniformLocation(prog, name);
          gl.uniform2f(U('uTexOrigin'), tx0, ty0);
          gl.uniform2f(U('uTexSize'), TW, TH);
        })();
        glRef.current = { gl, prog, ready, key: texKey };
      }
      const { gl, prog, ready } = glRef.current;
      ready
        .then(() => {
          const t = tMeasured + KEY_F0;
          const fi = Math.max(4, Math.min(18, Math.floor(t)));
          const sigma = motionBlur && t < 19 ? SHUTTER[fi] ?? 0 : 0;
          const n = sigma >= 0.01 ? Math.max(1, Math.min(64, SAMPLE_COUNT[fi] ?? 12)) : 1;
          const A = new Float32Array(256);
          const d2r = Math.PI / 180;
          for (let k = 0; k < n; k += 1) {
            const tk = n === 1 ? t : t - sigma / 2 + (sigma * (k + 0.5)) / n;
            const P = keyAt(tk);
            A.set([P[0] * d2r, P[1] * d2r, P[2] * d2r, P[3] * geo.sy], 4 * k);
          }
          gl.useProgram(prog);
          const U = (name: string) => gl.getUniformLocation(prog, name);
          gl.uniform4fv(U('uA'), A);
          gl.uniform1i(U('uN'), n);
          gl.uniform4f(
            U('uShade'),
            shading ? SHADE[0] : 0,
            SHADE[1],
            ry + (SHADE[2] - C0[1]) * geo.sy,
            ry + (SHADE[3] - C0[1]) * geo.sy,
          );
          gl.uniform3f(U('uBounds'), geo.uL, geo.vT, geo.uR);
          gl.uniform2f(U('uOrigin'), rx, ry);
          gl.uniform2f(U('uSize'), rw, rh);
          gl.uniform2f(U('uBuf'), W, H);
          gl.uniform1f(U('uX0'), geo.spineX);
          gl.uniform2f(U('uSpanY'), ry, rh);
          gl.uniform1i(U('uTex'), 0);
          gl.viewport(0, 0, W, H);
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          gl.finish();
          continueRender(handle);
        })
        .catch((error) => cancelRender(error));
    } catch (error) {
      cancelRender(error);
    }
    return undefined;
  }, [frame, texKey, tMeasured, showChildren, motionBlur, shading]);

  if (showChildren) return <AbsoluteFill>{children}</AbsoluteFill>;
  return (
    <canvas
      ref={ref}
      width={W}
      height={H}
      style={{ position: 'absolute', left: rx, top: ry, width: rw, height: rh, ...canvasStyle }}
    />
  );
};
