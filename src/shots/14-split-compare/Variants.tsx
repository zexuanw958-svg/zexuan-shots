/**
 * 14 · 分屏对比聚焦 · A / B 一边讲一边亮
 *
 * 对比卡从下面滑上来、把上一个画面压暗；两栏标题从模糊变清楚，然后聚焦一栏（白色虚线框，另一栏压暗），里面的按钮、图片、要点逐个弹出；讲到 B 时一帧硬切去聚焦 B。适合「A 和 B」「免费版和付费版」「以前和现在」。
 *
 * 组件:src/kit/components/SplitCompare.tsx(SplitCompare)。本文件是它的变体演示,Studio 里选 composition「SplitCompareVariants」。
 * 左上角 / 底部的小字是变体说明;渲染时加 --props='{"clean":true}' 就不画。
 * 参考：秋芝《40 分钟学会 Codex》4:02 ChatGPT vs Codex，逐帧复刻。
 */
import React from 'react';
import { AbsoluteFill, Sequence, staticFile, getInputProps } from 'remotion';
import { SplitCompare, type SplitCompareProps } from '../../kit/components/SplitCompare';

// --props='{"clean":true}' 时不画调试角标,渲对外展示的干净版
const Label: React.FC<{ children: React.ReactNode; bottom?: boolean; right?: boolean }> = (p) => (getInputProps().clean ? null : <LabelBox {...p} />);

const LabelBox: React.FC<{ children: React.ReactNode; bottom?: boolean; right?: boolean }> = ({ children, bottom, right }) => (
  <div
    style={{
      position: 'absolute',
      ...(right ? { right: 40 } : { left: 40 }),
      ...(bottom ? { bottom: 24 } : { top: 28 }),
      padding: '8px 18px',
      borderRadius: 10,
      background: 'rgba(230,120,50,.92)',
      color: '#FFFFFF',
      fontFamily: 'Noto Sans SC',
      fontWeight: 700,
      fontSize: 32,
      zIndex: 50,
    }}
  >
    {children}
  </div>
);

// ── Variants:代码画的图标 ──
const LetterIcon: React.FC<{ text: string; from: string; to: string; size?: number }> = ({ text, from, to, size = 94 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.24,
      background: `linear-gradient(135deg, ${from}, ${to})`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#FFFFFF',
      fontFamily: 'Noto Sans SC',
      fontWeight: 800,
      fontSize: size * (text.length > 1 ? 0.36 : 0.5),
    }}
  >
    {text}
  </div>
);
const Glyph: React.FC<{ d: string; size?: number }> = ({ d, size = 44 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#E9E9E4" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const ICON_CLOCK = 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 7v5l3 2';
const ICON_GRID = 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z';
const ICON_HAND = 'M8 13V5a1.5 1.5 0 0 1 3 0v6M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V5.5a1.5 1.5 0 0 1 3 0V14c0 4-2.5 7-6 7s-5-2-6.5-5L3 12.5a1.5 1.5 0 0 1 2.5-1.5L8 13';

type Variant = { label: string; props: SplitCompareProps; dur?: number };

const S = (sec: number) => sec;

const VARIANTS: Variant[] = [
  {
    label: '① 原样式 · 换内容(剪映 vs Remotion)',
    props: {
      columns: [
        {
          title: '剪映',
          icon: <LetterIcon text="剪" from="#3A3F47" to="#1E2126" />,
          items: [
            { kind: 'button', text: '拖时间线', icon: <Glyph d={ICON_CLOCK} />, at: S(0.9) },
            { kind: 'button', text: '套模板', icon: <Glyph d={ICON_GRID} />, at: S(1.6) },
          ],
        },
        {
          title: 'Remotion',
          icon: <LetterIcon text="R" from="#3D8EF2" to="#1B4F9C" />,
          items: [
            { kind: 'chips', chips: [{ text: '写代码' }, { text: '改参数' }], at: S(3.9) },
            { kind: 'media', src: staticFile('demo/app-screenshot-a.png'), height: 380, at: S(4.5) },
          ],
        },
      ],
      focus: [
        { at: 0.5, index: 0 },
        { at: 3.4, index: 1 },
      ],
    },
  },
  {
    label: '② 聚焦 A→B 来回切(硬切)',
    props: {
      columns: [
        {
          title: '手动剪',
          icon: <LetterIcon text="手" from="#4A4F57" to="#23262B" />,
          items: [
            { kind: 'text', text: '一条片 6 小时', at: S(0.8) },
            { kind: 'text', text: '改一处全返工', at: S(2.5) },
          ],
        },
        {
          title: 'AI 剪',
          icon: <LetterIcon text="AI" from="#3D8EF2" to="#1B4F9C" />,
          items: [
            { kind: 'text', text: '一条片 40 分钟', at: S(1.7) },
            { kind: 'text', text: '改参数重渲', at: S(3.4) },
          ],
        },
      ],
      focus: [
        { at: 0.5, index: 0 },
        { at: 1.5, index: 1 },
        { at: 2.3, index: 0 },
        { at: 3.2, index: 1 },
        { at: 4.6, index: null },
      ],
    },
  },
  {
    label: '③ 文字要点对比(按钮当要点)',
    props: {
      columns: [
        {
          title: '免费版',
          icon: <LetterIcon text="免" from="#4A4F57" to="#23262B" />,
          items: [
            { kind: 'button', text: '每天 10 次', at: S(0.9) },
            { kind: 'button', text: '排队等', at: S(1.4) },
            { kind: 'button', text: '只能网页用', at: S(1.9) },
          ],
        },
        {
          title: 'Pro 版',
          icon: <LetterIcon text="Pro" from="#3D8EF2" to="#1B4F9C" />,
          items: [
            { kind: 'button', text: '随便用', at: S(3.8) },
            { kind: 'button', text: '秒回', at: S(4.3) },
            { kind: 'button', text: '接进本地文件', at: S(4.8) },
          ],
        },
      ],
      focus: [
        { at: 0.5, index: 0 },
        { at: 3.4, index: 1 },
      ],
    },
  },
  {
    label: '④ 图片素材对比(改之前 / 改之后)',
    props: {
      columns: [
        {
          title: '改之前',
          items: [{ kind: 'media', src: staticFile('demo/app-screenshot-a.png'), height: 450, at: S(0.9) }],
        },
        {
          title: '改之后',
          items: [{ kind: 'media', src: staticFile('demo/app-screenshot-b.png'), height: 450, at: S(3.8) }],
        },
      ],
      focus: [
        { at: 0.5, index: 0 },
        { at: 3.4, index: 1 },
      ],
    },
  },
  {
    label: '⑤ 3 侧对比(依次聚焦)',
    dur: 240,
    props: {
      columns: [
        {
          title: '网页版',
          icon: <LetterIcon text="网" from="#4A4F57" to="#23262B" size={80} />,
          items: [
            { kind: 'chips', chips: [{ text: '复制' }], at: S(0.9) },
            { kind: 'text', text: '手动搬运', fontSize: 44, at: S(1.3) },
          ],
        },
        {
          title: '插件版',
          icon: <LetterIcon text="插" from="#5C6B7A" to="#2C343D" size={80} />,
          items: [
            { kind: 'chips', chips: [{ text: '读网页' }], at: S(3.0) },
            { kind: 'text', text: '半自动', fontSize: 44, at: S(3.4) },
          ],
        },
        {
          title: '本地版',
          icon: <LetterIcon text="本" from="#3D8EF2" to="#1B4F9C" size={80} />,
          tone: 'blue',
          items: [
            { kind: 'chips', chips: [{ text: '读写文件' }], at: S(5.1) },
            { kind: 'media', src: staticFile('demo/speaker-placeholder.mp4'), type: 'video', height: 240, startFromSec: 20, at: S(5.5) },
          ],
        },
      ],
      focus: [
        { at: 0.5, index: 0 },
        { at: 2.6, index: 1 },
        { at: 4.7, index: 2 },
      ],
    },
  },
  {
    label: '⑥ 优化构图 · 整齐版(aligned)',
    props: {
      preset: 'aligned',
      columns: [
        {
          title: '剪映',
          icon: <LetterIcon text="剪" from="#3A3F47" to="#1E2126" />,
          items: [
            { kind: 'button', text: '拖时间线', icon: <Glyph d={ICON_CLOCK} />, at: S(0.9) },
            { kind: 'button', text: '套模板', icon: <Glyph d={ICON_GRID} />, at: S(1.6) },
          ],
        },
        {
          title: 'Remotion',
          icon: <LetterIcon text="R" from="#3D8EF2" to="#1B4F9C" />,
          items: [
            { kind: 'button', text: '写代码', icon: <Glyph d={ICON_HAND} />, at: S(3.9) },
            { kind: 'media', src: staticFile('demo/app-screenshot-a.png'), height: 300, at: S(4.5) },
          ],
        },
      ],
      focus: [
        { at: 0.5, index: 0 },
        { at: 3.4, index: 1 },
      ],
    },
  },
  {
    label: '⑦ 优化构图 · 对决版(versus)',
    props: {
      preset: 'versus',
      columns: [
        {
          title: '真人出镜',
          icon: <LetterIcon text="人" from="#4A4F57" to="#23262B" />,
          items: [
            { kind: 'media', src: staticFile('demo/speaker-placeholder.mp4'), type: 'video', height: 330, startFromSec: 30, at: S(0.9) },
            { kind: 'chips', chips: [{ text: '有温度' }, { text: '费时间' }], at: S(1.6) },
          ],
        },
        {
          title: '纯动效',
          icon: <LetterIcon text="动" from="#3D8EF2" to="#1B4F9C" />,
          items: [
            { kind: 'media', src: staticFile('demo/app-screenshot-b.png'), height: 330, at: S(3.9) },
            { kind: 'chips', chips: [{ text: '信息密' }, { text: '能复用' }], at: S(4.6) },
          ],
        },
      ],
      focus: [
        { at: 0.5, index: 0 },
        { at: 3.4, index: 1 },
      ],
    },
  },
];

const SLOT = 210;
const slotOf = (v: Variant) => v.dur ?? SLOT;
export const VARIANTS_DURATION = VARIANTS.reduce((a, v) => a + slotOf(v), 0);
export const VARIANT_STARTS = VARIANTS.map((_, i) => VARIANTS.slice(0, i).reduce((a, v) => a + slotOf(v), 0));

export const SplitCompareVariants: React.FC = () => (
  <AbsoluteFill style={{ background: '#000' }}>
    {VARIANTS.map((v, i) => (
      <Sequence key={i} from={VARIANT_STARTS[i]} durationInFrames={slotOf(v)} premountFor={30}>
        <AbsoluteFill style={{ background: 'linear-gradient(180deg,#E9E4DA,#CFC8BA)' }} />
        <SplitCompare {...v.props} />
        <Label>{v.label}</Label>
      </Sequence>
    ))}
  </AbsoluteFill>
);
