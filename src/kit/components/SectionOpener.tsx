/**
 * SectionOpener.tsx — 「小节开头三连」整套预设:发光标题 → 问号目录 → 卷页进录屏
 * (秋芝《Claude Code 全解》6:53–7:08 的固定结构,每个小节开头都这么走)。
 *
 * 三段都是现成模板串起来,不另造动效:
 *   ① 黑 1 帧 + kit/textfx/GlowTitleIn(原片 f016 黑、f017 标题入场、停到 f063)
 *   ② 硬切进小节页:点阵底 + kit/components/QuestionToc(原片 f064–f334)
 *   ③ kit/components/CurlIntoScreen 卷页进录屏(原片 f335 白框、f336–f350 卷页、f351 起录屏)
 * 默认时长 = 原片:标题段 48 帧、目录段 271 帧、卷页 16 帧(@30fps,按当前 fps 折算)。
 *
 * 用法:
 *   <SectionOpener
 *     title={{ text: '安装CC', fontFamily: 'AlibabaPuHuiTi' }}
 *     toc={{ header: { text: '安装Claude Code', icon }, items: [...], current: 0 }}
 *     to={<OffthreadVideo src={录屏} />}
 *   />
 * 总时长用 sectionOpenerDurationInFrames(fps, opts) 算(含卷完后录屏停留 tailFrames)。
 */
import React from 'react';
import { AbsoluteFill, random, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { GlowTitleIn, type GlowTitleInProps } from '../textfx/GlowTitleIn';
import { QuestionToc, type QuestionTocProps } from './QuestionToc';
import { CurlIntoScreen, curlIntoScreenDurationInFrames, type CurlIntoScreenProps } from './CurlIntoScreen';

const MEASURED_FPS = 30;
/** 原片:f016 黑 1 帧 → f017 标题 → f064 硬切目录页 → f335 白框 → f351 录屏 */
const BLACK_FRAMES = 1;
const TITLE_FRAMES = 47;
const TOC_FRAMES = 271;
const TAIL_FRAMES = 60;

/** 秋芝点阵(案例 dotgrid.json 公式):60.33px 方格,每列正弦上下漂;逐点亮度用 random(seed) 代替原片查表 */
const DOT = { X0: 24.4177, SX: 60.328, Y0: 26.9057, SY: 60.3263, AMP: 11.19, PERIOD: 150.12, LAMBDA: 450.56, PHI: -0.3953 };

export const QiuzhiDotGrid: React.FC<{ color?: string; background?: string; seed?: string }> = ({
  color = '#FFFFFF',
  background = '#000000',
  seed = 'dots',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = (frame / fps) * MEASURED_FPS;
  const dots: React.ReactNode[] = [];
  for (let i = 0; i < 32; i += 1) {
    const x = DOT.X0 + DOT.SX * i;
    const wave = DOT.AMP * Math.sin((2 * Math.PI * t) / DOT.PERIOD - (2 * Math.PI * x) / DOT.LAMBDA + DOT.PHI);
    for (let j = 0; j < 18; j += 1) {
      const a = 0.12 + 0.3 * random(`${seed}-${i}-${j}`);
      dots.push(<circle key={`${i}-${j}`} cx={x + 0.5} cy={DOT.Y0 + DOT.SY * j + wave + 0.5} r={1.6} fill={color} opacity={a} />);
    }
  }
  return (
    <AbsoluteFill style={{ background }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        {dots}
      </svg>
    </AbsoluteFill>
  );
};

export type SectionOpenerProps = {
  /** 发光标题(GlowTitleIn 的参数;fontSize 不给默认 163.2) */
  title: Omit<GlowTitleInProps, 'fontSize'> & { fontSize?: number };
  /** 问号目录(QuestionToc 的参数) */
  toc: QuestionTocProps;
  /** 卷进来的后一画面(录屏等) */
  to: React.ReactNode;
  /** 目录页底(默认秋芝点阵黑底) */
  pageBackground?: React.ReactNode;
  /** 卷页参数(除 from/to) */
  curl?: Omit<CurlIntoScreenProps, 'from' | 'to'>;
  /** 各段时长(帧,按当前 fps);默认原片 */
  titleFrames?: number;
  tocFrames?: number;
  tailFrames?: number;
};

const segs = (fps: number, o: { titleFrames?: number; tocFrames?: number; tailFrames?: number; curlSpeed?: number }) => {
  const k = fps / MEASURED_FPS;
  const black = Math.round(BLACK_FRAMES * k);
  const title = o.titleFrames ?? Math.round(TITLE_FRAMES * k);
  const toc = o.tocFrames ?? Math.round(TOC_FRAMES * k);
  const curl = curlIntoScreenDurationInFrames(fps, o.curlSpeed ?? 1);
  const tail = o.tailFrames ?? Math.round(TAIL_FRAMES * k);
  return { black, title, toc, curl, tail };
};

export const sectionOpenerDurationInFrames = (
  fps: number,
  o: { titleFrames?: number; tocFrames?: number; tailFrames?: number; curlSpeed?: number } = {},
): number => {
  const s = segs(fps, o);
  return s.black + s.title + s.toc + s.curl + s.tail;
};

export const SectionOpener: React.FC<SectionOpenerProps> = ({ title, toc, to, pageBackground, curl, titleFrames, tocFrames, tailFrames }) => {
  const { fps } = useVideoConfig();
  const s = segs(fps, { titleFrames, tocFrames, tailFrames, curlSpeed: curl?.speed });
  const page = (
    <AbsoluteFill>
      {pageBackground ?? <QiuzhiDotGrid />}
      <QuestionToc {...toc} />
    </AbsoluteFill>
  );
  const tocStart = s.black + s.title;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Sequence from={s.black} durationInFrames={s.title} layout="none">
        <GlowTitleIn fontSize={163.2} {...title} />
      </Sequence>
      <Sequence from={tocStart} durationInFrames={s.toc} layout="none">
        {page}
      </Sequence>
      {/* 卷页段:from 用目录页的最后状态继续播(Sequence 把本地帧接上,目录不会重播) */}
      <Sequence from={tocStart + s.toc} layout="none">
        <CurlIntoScreen
          {...curl}
          from={
            <Sequence from={-s.toc} layout="none">
              {page}
            </Sequence>
          }
          to={to}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
