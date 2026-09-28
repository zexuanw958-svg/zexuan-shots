/**
 * 03 · 章节卡标题 · 白光入场 + 金光换题
 *
 * 章节标题带白光入场；换到下一个标题时，一道金光扫过去完成替换。适合进新章节、换话题。
 *
 * 组件:src/kit/textfx/ChapterTitleFx.tsx(ChapterTitleFx)。本文件是它的变体演示,Studio 里选 composition「ChapterTitleVariants」。
 * 左上角 / 底部的小字是变体说明;渲染时加 --props='{"clean":true}' 就不画。
 * 参考：秋芝《40 分钟学会 Codex》20:57 章节缩卡，逐帧量出的曲线当默认值。
 */
import React from 'react';
import { AbsoluteFill, Sequence, getInputProps } from 'remotion';
import { ChapterTitleFx, type ChapterTitleFxProps } from '../../kit/textfx/ChapterTitleFx';

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
      zIndex: 100,
    }}
  >
    {children}
  </div>
);

type Variant = { label: string; props: ChapterTitleFxProps };

/** 变体:入场 → 停一下 → 换字。每段 0 帧起入场,exitAt 20 帧(比原片的 277 短,变体只看特效) */
const V_EXIT = 20;
const VARIANTS: Variant[] = [
  { label: '原文案 · 图片生成 → 个人主页开发', props: { text: '图片生成', nextText: '个人主页开发', exitAt: V_EXIT } },
  { label: '短标题 · 两个字', props: { text: '入门', nextText: '实战', exitAt: V_EXIT } },
  { label: '长标题 · maxWidthPx=1500 自动缩', props: { text: '从零搭一个自动化工作流', nextText: '接入飞书多维表格做数据看板', exitAt: V_EXIT, maxWidthPx: 1500 } },
  { label: '中英混排', props: { text: 'Codex 能力', nextText: 'Skills 技能系统', exitAt: V_EXIT } },
  { label: 'speed 0.7 · 更沉', props: { text: '图片生成', nextText: '个人主页开发', exitAt: V_EXIT, speed: 0.7 } },
  { label: 'speed 1.4 · 更脆', props: { text: '图片生成', nextText: '个人主页开发', exitAt: V_EXIT, speed: 1.4 } },
  {
    label: '换色 · 蓝光换字',
    props: {
      text: '图片生成',
      nextText: '个人主页开发',
      exitAt: V_EXIT,
      swapPalette: { streak: '#3F8CFF', streakLine: '#4A9BFF', rim: '#5AA8FF', rimLight: '#E6F0FF', core: '#A9D0FF', tint: '#BFE0FF', spark: ['rgba(170,215,255,0.34)', 'rgba(80,140,230,0.20)', 'rgba(30,80,160,0.07)'] },
    },
  },
];

/** 每段:4 帧空场 + 入场(14) + 停 + 淡出(15) + 空 15 帧 + 换字(14) + 停,共 90 帧(3 秒) */
const SLOT = 90;
const LEAD = 4;
export const VARIANTS_DURATION = SLOT * VARIANTS.length;

export const ChapterTitleVariants: React.FC = () => (
  <AbsoluteFill style={{ background: '#101014' }}>
    {VARIANTS.map((v, i) => (
      <Sequence key={v.label} from={i * SLOT} durationInFrames={SLOT} layout="none">
        <Sequence from={LEAD} layout="none">
          <ChapterTitleFx {...v.props} />
        </Sequence>
        <Label>{`${i + 1}/${VARIANTS.length}  ${v.label}`}</Label>
      </Sequence>
    ))}
  </AbsoluteFill>
);
