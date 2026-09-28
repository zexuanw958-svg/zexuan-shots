/**
 * 06 · 发光标题 · 黑底去模糊收拢
 *
 * 黑底上标题糊糊地、微微放大地冒出来，外罩一圈白光；0.2 秒内变清楚、缩回原大小、字距往中间收拢，白光再散掉。适合章节大标题、目录前的总标题。
 *
 * 组件:src/kit/textfx/GlowTitleIn.tsx(GlowTitleIn)。本文件是它的变体演示,Studio 里选 composition「GlowTitleVariants」。
 * 左上角 / 底部的小字是变体说明;渲染时加 --props='{"clean":true}' 就不画。
 * 参考：秋芝《Claude Code 全解》小节开头大标题，逐帧复刻。
 */
import React from 'react';
import { AbsoluteFill, Sequence, getInputProps } from 'remotion';
import { GlowTitleIn, type GlowTitleInProps } from '../../kit/textfx/GlowTitleIn';

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
      background: 'rgba(255,255,255,.14)',
      color: '#FFFFFF',
      fontFamily: 'Noto Sans SC',
      fontWeight: 700,
      fontSize: 34,
    }}
  >
    {children}
  </div>
);

type Variant = { label: string; props: Omit<GlowTitleInProps, 'fontFamily'> };

const BASE = { fontSize: 163.2 } as const;
const VARIANTS: Variant[] = [
  { label: '原参数 · 原文案「安装CC」', props: { ...BASE, text: '安装CC' } },
  { label: '短标题「开工」', props: { ...BASE, text: '开工' } },
  { label: '长标题 · maxWidthPx=1500 自动缩', props: { ...BASE, text: '配置MCP服务器全流程', maxWidthPx: 1500 } },
  { label: '中英混排「Claude Code 入门」', props: { ...BASE, text: 'Claude Code 入门', maxWidthPx: 1500 } },
  { label: '换光色 glowColor=#6FC3FF · glow 1.4', props: { ...BASE, text: '搞钱思路', glowColor: '#6FC3FF', glow: 1.4 } },
  { label: 'speed 0.6 · 更缓', props: { ...BASE, text: '安装CC', speed: 0.6 } },
  { label: 'speed 1.4 · 更脆', props: { ...BASE, text: '安装CC', speed: 1.4 } },
];

/** 每段:6 帧黑场 + 动画 + 停留,总长 48 帧(1.6 秒) */
const SLOT = 48;
const LEAD = 6;
export const VARIANTS_DURATION = SLOT * VARIANTS.length;

export const GlowTitleVariants: React.FC = () => (
  <AbsoluteFill style={{ background: '#000' }}>
    {VARIANTS.map((v, i) => (
      <Sequence key={v.label} from={i * SLOT} durationInFrames={SLOT} layout="none">
        <Sequence from={LEAD} layout="none">
          <GlowTitleIn {...v.props} fontFamily="AlibabaPuHuiTi" />
        </Sequence>
        <Label>{`${i + 1}/${VARIANTS.length}  ${v.label}`}</Label>
      </Sequence>
    ))}
  </AbsoluteFill>
);
