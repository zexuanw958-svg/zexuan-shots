/**
 * 02 · 逐字闪 · 模糊白光乱闪落定
 *
 * 每个字各自在「糊成一团白光」和「清楚白字」之间乱闪，约 0.25 秒后一起稳住。适合副标题、角标小字（「0 基础系统教程」）。
 *
 * 组件:src/kit/textfx/CharFlickerIn.tsx(CharFlickerIn)。本文件是它的变体演示,Studio 里选 composition「CharFlickerVariants」。
 * 左上角 / 底部的小字是变体说明;渲染时加 --props='{"clean":true}' 就不画。
 * 参考：秋芝《Codex 全解》开头右下角小字入场，逐帧复刻。
 */
import React from 'react';
import { AbsoluteFill, Sequence, getInputProps } from 'remotion';
import { CharFlickerIn, type CharFlickerInProps } from '../../kit/textfx/CharFlickerIn';

// --props='{"clean":true}' 时不画调试角标,渲对外展示的干净版
const Label: React.FC<{ children: React.ReactNode; top?: number }> = (p) => (getInputProps().clean ? null : <LabelBox {...p} />);

const LabelBox: React.FC<{ children: React.ReactNode; top?: number }> = ({ children, top = 32 }) => (
  <div
    style={{
      position: 'absolute',
      left: 40,
      top,
      padding: '8px 18px',
      borderRadius: 10,
      background: 'rgba(0,0,0,.6)',
      color: '#FFFFFF',
      fontFamily: 'Noto Sans SC',
      fontWeight: 700,
      fontSize: 34,
    }}
  >
    {children}
  </div>
);

type Variant = { label: string; props: Omit<CharFlickerInProps, 'fontFamily'> };

/** 变体统一放画面正中,字号放大一点便于看 */
const MID = { anchor: { x: 960, y: 470 }, align: 'center', fontSize: 150 } as const;

const VARIANTS: Variant[] = [
  { label: '原文案 · 7 字 exact(原片实测表)', props: { text: '0基础系统教程', ...MID } },
  { label: '原文案 · 7 字 generated(按规律生成)', props: { text: '0基础系统教程', ...MID, mode: 'generated' } },
  { label: '少字 · 3 字', props: { text: '保姆级', ...MID, fontSize: 200 } },
  { label: '多字 · 12 字 + maxWidthPx 1700', props: { text: '零基础也能学会的系统教程', ...MID, maxWidthPx: 1700 } },
  { label: '中英混排', props: { text: 'Codex 全解教程', ...MID } },
  { label: 'speed 0.6 · 更慢', props: { text: '0基础系统教程', ...MID, speed: 0.6 } },
  { label: 'seed 换一个 · glow 1.4 更亮', props: { text: '0基础系统教程', ...MID, mode: 'generated', seed: 'b', glow: 1.4 } },
];

/** 每段:8 帧空场 + 动画 + 停留,总长 48 帧(1.6 秒) */
const SLOT = 48;
const LEAD = 8;
export const VARIANTS_DURATION = SLOT * VARIANTS.length;

/** 深色带纹理的底:白光要加在「有东西」的底上才看得出 */
const Backdrop: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        'radial-gradient(circle at 30% 35%, #3A3542 0%, #1B1A20 55%, #121116 100%), #16151A',
    }}
  />
);

export const CharFlickerVariants: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />
    {VARIANTS.map((v, i) => (
      <Sequence key={v.label} from={i * SLOT} durationInFrames={SLOT} layout="none">
        <Sequence from={LEAD} layout="none">
          <CharFlickerIn {...v.props} fontFamily="SmileySansV1" />
        </Sequence>
        <Label>{`${i + 1}/${VARIANTS.length}  ${v.label}`}</Label>
      </Sequence>
    ))}
  </AbsoluteFill>
);
