/**
 * 01 · 放大残影 · 大字过冲爆开
 *
 * 大字从中心爆开，先冲过头再回落，一层径向残影往外冲、淡掉。适合开场定调、口号、情绪词（「奶妈级」「保姆级」）。
 *
 * 组件:src/kit/textfx/ZoomTrailPop.tsx(ZoomTrailPop)。本文件是它的变体演示,Studio 里选 composition「ZoomTrailVariants」。
 * 左上角 / 底部的小字是变体说明;渲染时加 --props='{"clean":true}' 就不画。
 * 参考：秋芝《Codex 全解》「奶妈级」人后大字，逐帧量出的曲线当默认值。
 */
import React from 'react';
import { AbsoluteFill, Sequence, getInputProps } from 'remotion';
import { ZoomTrailPop, type ZoomTrailPopProps } from '../../kit/textfx/ZoomTrailPop';

// --props='{"clean":true}' 时不画调试角标,渲对外展示的干净版
const Label: React.FC<{ children: React.ReactNode }> = (p) => (getInputProps().clean ? null : <LabelBox {...p} />);

const LabelBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      position: 'absolute',
      left: 40,
      top: 32,
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

type Variant = { label: string; props: Omit<ZoomTrailPopProps, 'fontFamily'> };

const VARIANTS: Variant[] = [
  { label: '原参数 · 换字「保姆级」', props: { text: '保姆级', fontSize: 560, color: '#FCF7C2' } },
  { label: '字多了自动缩 · maxWidthPx=1700', props: { text: '零基础系统教程', fontSize: 560, maxWidthPx: 1700, color: '#FCF7C2' } },
  { label: '中英混排', props: { text: 'AI搞钱', fontSize: 520, color: '#FFFFFF' } },
  { label: 'speed 0.7 · 更沉', props: { text: '奶妈级', fontSize: 560, speed: 0.7, color: '#FCF7C2' } },
  { label: 'speed 1.4 · 更脆', props: { text: '奶妈级', fontSize: 560, speed: 1.4, color: '#FCF7C2' } },
  { label: 'echo 0.5 · 残影减半', props: { text: '奶妈级', fontSize: 560, echo: 0.5, color: '#FCF7C2' } },
  { label: 'echo 0 · 只弹不拖', props: { text: '奶妈级', fontSize: 560, echo: 0, color: '#FCF7C2' } },
];

/** 每段:6 帧空场 + 动画 + 停留,总长 48 帧(1.6 秒) */
const SLOT = 48;
const LEAD = 6;
export const VARIANTS_DURATION = SLOT * VARIANTS.length;

export const ZoomTrailVariants: React.FC = () => (
  <AbsoluteFill style={{ background: '#16151A' }}>
    {VARIANTS.map((v, i) => (
      <Sequence key={v.label} from={i * SLOT} durationInFrames={SLOT} layout="none">
        <Sequence from={LEAD} layout="none">
          <ZoomTrailPop {...v.props} fontFamily="SmileySansV1" />
        </Sequence>
        <Label>{`${i + 1}/${VARIANTS.length}  ${v.label}`}</Label>
      </Sequence>
    ))}
  </AbsoluteFill>
);
