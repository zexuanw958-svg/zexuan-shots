/**
 * 16 · 卷页飞入 + 样片轮播
 *
 * 一张缩略图截图像纸一样从右下角卷进来盖住上一个画面；几张缩略图变成白色相纸卡排到左边，逐个被挑中、右边升起视频窗播放样片，换下一条时整块往上推。适合从多个案例里挑一个单独演示。卷页那一下也能单独当转场（WebGL）。
 *
 * 组件:src/kit/components/SampleCarousel.tsx(SampleCarousel + PageCurlTransition)。本文件是它的变体演示,Studio 里选 composition「SampleCarouselVariants」。
 * 左上角 / 底部的小字是变体说明;渲染时加 --props='{"clean":true}' 就不画。
 * 参考：秋芝《Codex 全解》7:08，逐帧复刻。
 */
import React from 'react';
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, useCurrentFrame, getInputProps } from 'remotion';
import { SampleCarousel, SAMPLE_CAROUSEL_RECT } from '../../kit/components/SampleCarousel';
import { PageCurlTransition } from '../../kit/components/PageCurlTransition';

// ── Variants ──
const R = SAMPLE_CAROUSEL_RECT;

/** 录屏框舞台:黑底 + 细白框线(模仿原片画框,纯代码) */
const Stage: React.FC<{ full?: boolean }> = ({ full }) => (
  <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 45%, #1B1D24 0%, #0B0B0E 70%)' }}>
    {full ? null : (
      <div style={{ position: 'absolute', left: R[0] - 2, top: R[1] - 2, width: R[2] + 4, height: R[3] + 4, border: '2px solid rgba(255,255,255,0.85)', boxSizing: 'border-box' }} />
    )}
  </AbsoluteFill>
);

/** 卷页之前的「上一个镜头」:代码画的假聊天界面 */
const FakeChat: React.FC<{ rect?: [number, number, number, number] }> = ({ rect = R }) => (
  <div style={{ position: 'absolute', left: rect[0], top: rect[1], width: rect[2], height: rect[3], background: '#FBFBFC', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', left: 0, top: 0, width: 260, height: '100%', background: '#F1F1F4' }} />
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <div key={i} style={{ position: 'absolute', left: 30, top: 70 + i * 44, width: 180 - (i % 3) * 30, height: 16, borderRadius: 8, background: '#D9D9E0' }} />
    ))}
    <div style={{ position: 'absolute', right: 80, top: 80, width: 560, height: 56, borderRadius: 16, background: '#E9EEF8' }} />
    {[0, 1, 2, 3].map((i) => (
      <div key={i} style={{ position: 'absolute', left: 340, top: 200 + i * 40, width: 900 - i * 120, height: 16, borderRadius: 8, background: '#E2E2E8' }} />
    ))}
    <div style={{ position: 'absolute', left: 340, right: 80, bottom: 60, height: 90, borderRadius: 20, border: '2px solid #E2E2E8', background: '#FFFFFF' }} />
    <div style={{ position: 'absolute', left: 380, bottom: 150, fontFamily: 'Noto Sans SC', fontWeight: 700, fontSize: 30, color: '#555' }}>
      上一个镜头(代码画的假界面)
    </div>
  </div>
);

const ph = (f: string) => staticFile(`ph/${f}`);
const V = {
  aurora: { src: ph('v-aurora.mp4'), thumb: ph('v-aurora.png'), name: '01_极光渐变.mp4' },
  fractal: { src: ph('v-fractal.mp4'), thumb: ph('v-fractal.png'), name: '02_分形深潜.mp4' },
  life: { src: ph('v-life-wide.mp4'), thumb: ph('v-life-wide.png'), name: '03_细胞生命游戏宽银幕.mp4', aspect: 1280 / 544 },
  test: { src: ph('v-test.mp4'), thumb: ph('v-test.png'), name: '04_测试信号.mp4' },
};
const C = (f: string, name: string) => ({ src: ph(`${f}.png`), name });
const COVERS = [
  C('c-neon', '05_赛博夜市.png'),
  C('c-mountain', '06_山海之间.png'),
  C('c-cat', '07_猫咪宇航员.png'),
  C('c-snow', '08_极光小镇.png'),
  C('c-ink', '09_水墨江南.png'),
  C('c-sun', '10_落日公路.png'),
];

const OutroText: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      position: 'absolute',
      left: 780,
      top: 400,
      width: 1000,
      height: 150,
      borderRadius: 20,
      background: '#FFFFFF',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'SmileySans',
      fontSize: 96,
      color: '#000',
    }}
  >
    {text}
  </div>
);

/** 口播时刻提示条(变体 5 用) */
const CueTicker: React.FC<{ cues: Array<{ at: number; text: string }> }> = ({ cues }) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  let cur = '';
  for (const c of cues) if (t >= c.at) cur = c.text;
  if (!cur) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 985, textAlign: 'center' }}>
      <span style={{ padding: '6px 18px', borderRadius: 8, background: 'rgba(0,0,0,.8)', color: '#fff', fontFamily: 'SmileySans', fontSize: 50 }}>{cur}</span>
    </div>
  );
};

/** 变体 6:卷页过门单独当转场 —— 上一个镜头(假界面)被一张海报翻页盖住,落定后换成活视频 */
const CurlAsTransition: React.FC = () => (
  <>
    <FakeChat rect={[0, 0, 1920, 1080]} />
    <Sequence from={20} layout="none">
      <PageCurlTransition src={ph('c-snow.png')} rect={[0, 0, 1920, 1080]} bleed={false}>
        <OffthreadVideo src={ph('v-aurora.mp4')} muted style={{ width: 1920, height: 1080, objectFit: 'cover' }} />
      </PageCurlTransition>
    </Sequence>
    <Sequence from={110} layout="none">
      <PageCurlTransition src={ph('c-neon.png')} rect={[0, 0, 1920, 1080]} bleedColor="#2A0B3A" speed={0.75} />
    </Sequence>
  </>
);

type Variant = { label: string; duration: number; full?: boolean; render: () => React.ReactNode };

const VARIANTS: Variant[] = [
  {
    label: '原结构换素材:3 条视频(含宽银幕)· 原片节奏 · 收尾右移接总结条',
    duration: 330,
    render: () => (
      <>
        <FakeChat />
        <Sequence from={4} layout="none">
          <SampleCarousel
            samples={[V.aurora, V.fractal, V.life]}
            folderTitle="杂乱素材"
            outroAtSec={9.9}
            outro={<OutroText text="[序号]_主题+风格" />}
          />
        </Sequence>
      </>
    ),
  },
  {
    label: '3 个样片 · 全屏版(rect 铺满画面)· 图片封面',
    duration: 240,
    full: true,
    render: () => (
      <>
        <FakeChat rect={[0, 0, 1920, 1080]} />
        <Sequence from={4} layout="none">
          <SampleCarousel rect={[0, 0, 1920, 1080]} samples={[COVERS[0], COVERS[1], COVERS[2]]} holdSec={2.2} folderTitle="封面" />
        </Sequence>
      </>
    ),
  },
  {
    label: '7 个样片 · 自动两列 · 挑第 1 / 4 / 7 个',
    duration: 240,
    render: () => (
      <>
        <FakeChat />
        <Sequence from={4} layout="none">
          <SampleCarousel samples={[V.aurora, COVERS[0], COVERS[1], V.fractal, COVERS[2], COVERS[3], V.test]} picks={[0, 3, 6]} holdSec={2.2} />
        </Sequence>
      </>
    ),
  },
  {
    label: '5 个样片只挑 2 个单独演示(第 2、第 4 个)· 青色强调',
    duration: 200,
    render: () => (
      <>
        <FakeChat />
        <Sequence from={4} layout="none">
          <SampleCarousel
            samples={[COVERS[4], V.fractal, COVERS[5], V.aurora, COVERS[0]]}
            picks={[1, 3]}
            holdSec={2.4}
            accent="#35C9B5"
            arrowColor="#35C9B5"
            glowColor="#0E6E66"
          />
        </Sequence>
      </>
    ),
  },
  {
    label: '按口播时刻挑:pickAtSec = [1.3, 2.3, 4.6] 秒(不等间隔)',
    duration: 240,
    render: () => (
      <>
        <FakeChat />
        <Sequence from={4} layout="none">
          <SampleCarousel samples={[COVERS[1], V.test, COVERS[3], COVERS[5]]} picks={[0, 1, 3]} pickAtSec={[1.3, 2.3, 4.6]} outroAtSec={6.8} />
        </Sequence>
        <CueTicker
          cues={[
            { at: 1.3 + 4 / 30, text: '口播:第一个是山海之间' },
            { at: 2.3 + 4 / 30, text: '口播:这个测试信号' },
            { at: 4.6 + 4 / 30, text: '口播:还有这条落日公路' },
            { at: 6.8 + 4 / 30, text: '口播:全都自动整理好了' },
          ]}
        />
      </>
    ),
  },
  {
    label: '卷页过门单独当转场:第一次纸=图本身(bleed 关)落定换活视频;第二次带深色出血、speed 0.75',
    duration: 190,
    full: true,
    render: () => <CurlAsTransition />,
  },
];

export const VARIANTS_DURATION = VARIANTS.reduce((a, v) => a + v.duration, 0);

export const SampleCarouselVariants: React.FC = () => {
  let at = 0;
  return (
    <AbsoluteFill style={{ background: '#000', WebkitFontSmoothing: 'antialiased' }}>
      {VARIANTS.map((v, i) => {
        const from = at;
        at += v.duration;
        return (
          <Sequence key={v.label} from={from} durationInFrames={v.duration} layout="none">
            <Stage full={v.full} />
            {v.render()}
            {getInputProps().clean ? null : (
              <div
                style={{
                  position: 'absolute',
                  left: 24,
                  top: 0,
                  padding: '4px 14px',
                  borderRadius: '0 0 10px 10px',
                  background: 'rgba(0,0,0,.72)',
                  color: '#FFFFFF',
                  fontFamily: 'Noto Sans SC',
                  fontWeight: 700,
                  fontSize: 26,
                  zIndex: 50,
                }}
              >
                {`${i + 1}/${VARIANTS.length}  ${v.label}`}
              </div>
            )}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
