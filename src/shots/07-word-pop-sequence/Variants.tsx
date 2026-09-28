/**
 * 07 · 词语蹦出 · 一串词逐个滑入弹一下
 *
 * 给一串词，按原片不均匀的节奏一个接一个从旁边滑进来、像弹簧一样蹦一下再停住。适合列举、概念组装（「X = A + B + C」）。
 *
 * 组件:src/kit/textfx/WordPopSequence.tsx(WordPopSequence)。本文件是它的变体演示,Studio 里选 composition「WordPopVariants」。
 * 左上角 / 底部的小字是变体说明;渲染时加 --props='{"clean":true}' 就不画。
 * 参考：秋芝《60 分钟全面掌握 Claude Code》3:51 概念组装，逐帧复刻。
 */
import React from 'react';
import { AbsoluteFill, Sequence, getInputProps } from 'remotion';
import { WordPopSequence, wordPopSequenceDurationInFrames, type WordPopSequenceProps } from '../../kit/textfx/WordPopSequence';

/** 原片词云实测排版(1080p):庞门正道替身 156px、字距 12.5px、横压 0.615 */
const CLOUD_LOOK = {
  fontFamily: 'PangMenZhengDao',
  fontSize: 156,
  letterSpacingEm: 12.5 / 156,
  squeezeX: 0.615,
  color: '#FFFFFF',
} as const;

/** 原片出现顺序 */
const ORIGINAL_WORDS = ['工具', '审查', '上下文', '权限', '规划', '记忆', '沙盒'];

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

type Variant = { label: string; props: WordPopSequenceProps };

const VARIANTS: Variant[] = [
  { label: '原词表 · 原片节奏 · 词云布局', props: { words: ORIGINAL_WORDS, ...CLOUD_LOOK } },
  {
    label: '3 个词 · 一行排开',
    props: { words: ['提示词', '工作流', '知识库'], layout: 'row', ...CLOUD_LOOK, gapEm: 0.5 },
  },
  {
    label: '10 个词 · 第 8 个起用卡片空位',
    props: {
      words: ['工具', '审查', '上下文', '权限', '规划', '记忆', '沙盒', '钩子', '子代理', '插件'],
      ...CLOUD_LOOK,
      fontSize: 132,
      center: { x: 960, y: 560 },
    },
  },
  {
    label: '对口播 · 手动时刻 0 / 0.15 / 0.8 / 0.9 / 1.6 秒',
    props: {
      words: [
        { text: '选题', at: 0 },
        { text: '脚本', at: 0.15 },
        { text: '拍摄', at: 0.8 },
        { text: '剪辑', at: 0.9 },
        { text: '发布', at: 1.6 },
      ],
      layout: 'row',
      ...CLOUD_LOOK,
      gapEm: 0.45,
    },
  },
  {
    label: 'tempo 0.5 节奏放慢一倍 · speed 0.7 动作更软',
    props: { words: ORIGINAL_WORDS, ...CLOUD_LOOK, tempo: 0.5, speed: 0.7 },
  },
  {
    label: '中英混排 · 均匀节奏 even',
    props: {
      words: ['AI', 'Agent', 'MCP', '提示词', 'Skills'],
      layout: 'row',
      ...CLOUD_LOOK,
      fontSize: 140,
      squeezeX: 0.8,
      rhythm: 'even',
      evenGapSeconds: 0.2,
      gapEm: 0.4,
    },
  },
  {
    label: '概念组装卡 X = A + B + C',
    props: {
      words: ['Agent', '模型', '工具', '记忆'],
      layout: 'equation',
      ...CLOUD_LOOK,
      squeezeX: 0.8,
      symbolColor: '#9CFE00',
      gapEm: 0.3,
    },
  },
];

/** 每段:6 帧空场 + 整组蹦完 + 36 帧停留 */
const LEAD = 6;
const HOLD = 36;
const slotOf = (v: Variant) => LEAD + wordPopSequenceDurationInFrames(v.props.words, 30, v.props) + HOLD;
const SLOTS = VARIANTS.map(slotOf);
const STARTS = SLOTS.map((_, i) => SLOTS.slice(0, i).reduce((s, v) => s + v, 0));
export const VARIANTS_DURATION = SLOTS.reduce((s, v) => s + v, 0);

export const WordPopVariants: React.FC = () => (
  <AbsoluteFill style={{ background: '#16151A' }}>
    {VARIANTS.map((v, i) => (
      <Sequence key={v.label} from={STARTS[i]} durationInFrames={SLOTS[i]} layout="none">
        <Sequence from={LEAD} layout="none">
          <WordPopSequence {...v.props} />
        </Sequence>
        <Label>{`${i + 1}/${VARIANTS.length}  ${v.label}`}</Label>
      </Sequence>
    ))}
  </AbsoluteFill>
);
