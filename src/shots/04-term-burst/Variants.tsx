/**
 * 04 · 术语冲入 · 字距炸开收拢 + 绿标签
 *
 * 白色大字带横向拖影和辉光从两边往中间收拢，0.47 秒落成干净的字；随后荧光绿标签从下方滑出。适合第一次出现的关键术语、英文全称（「Command Line Interface / 命令行工具」）。
 *
 * 组件:src/kit/textfx/TermBurst.tsx(TermBurst)。本文件是它的变体演示,Studio 里选 composition「TermBurstVariants」。
 * 左上角 / 底部的小字是变体说明;渲染时加 --props='{"clean":true}' 就不画。
 * 参考：秋芝《Claude Code 全解》47:18，逐帧复刻。
 */
import React from 'react';
import { AbsoluteFill, Sequence, getInputProps } from 'remotion';
import { TermBurst, type TermBurstProps } from '../../kit/textfx/TermBurst';

// --props='{"clean":true}' 时不画调试角标,渲对外展示的干净版
const Tag: React.FC<{ children: React.ReactNode }> = (p) => (getInputProps().clean ? null : <TagBox {...p} />);

const TagBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
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

type Variant = { label: string; props: TermBurstProps };

const PLEX = "'IBM Plex Sans JP'";
const VARIANTS: Variant[] = [
  { label: '原文案 · 标签用正式字体', props: { text: 'Command Line Interface', label: '命令行工具', fontSize: 114 } },
  { label: '短术语', props: { text: 'API', label: '应用程序接口', fontSize: 180 } },
  {
    label: '长英文全称 · 自动缩字号 · 标签下移避开 g',
    props: { text: 'Application Programming Interface', label: '应用程序编程接口', fontSize: 114, maxWidthPx: 1700, labelGapEm: 0.12 },
  },
  { label: '中英混排', props: { text: 'MCP协议', label: '模型上下文协议', fontSize: 160 } },
  { label: 'speed 0.7 · 更沉', props: { text: 'Command Line Interface', label: '命令行工具', fontSize: 114, speed: 0.7 } },
  { label: 'speed 1.4 · 更脆', props: { text: 'Command Line Interface', label: '命令行工具', fontSize: 114, speed: 1.4 } },
  { label: '关掉标签 · 中文术语', props: { text: '检索增强生成', fontSize: 150 } },
];

/** 每段:6 帧空场 + 大字 + 0.8 秒后标签 + 停留,总长 66 帧(2.2 秒)。原片标签是 1.83 秒后才出,这里缩短方便看 */
const SLOT = 66;
const LEAD = 6;
export const VARIANTS_DURATION = SLOT * VARIANTS.length;

export const TermBurstVariants: React.FC = () => (
  <AbsoluteFill style={{ background: '#000' }}>
    {VARIANTS.map((v, i) => (
      <Sequence key={v.label} from={i * SLOT} durationInFrames={SLOT} layout="none">
        <Sequence from={LEAD} layout="none">
          <TermBurst fontFamily="SmileySansV1" labelFontFamily={PLEX} labelDelaySeconds={0.8} {...v.props} />
        </Sequence>
        <Tag>{`${i + 1}/${VARIANTS.length}  ${v.label}`}</Tag>
      </Sequence>
    ))}
  </AbsoluteFill>
);
