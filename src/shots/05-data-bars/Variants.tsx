/**
 * 05 · 数据条 · 压暗 + 条形生长 + 数字浮现
 *
 * 背景一下压暗，条形从左往右长出来，括号描出、数字浮上，再滑出荧光绿标签和一句逐字弹出的副文字。适合口播里比两三个数：百分比、前后对比、倍数、金额。
 *
 * 组件:src/kit/components/DataBars.tsx(DataBars)。本文件是它的变体演示,Studio 里选 composition「DataBarsVariants」。
 * 左上角 / 底部的小字是变体说明;渲染时加 --props='{"clean":true}' 就不画。
 * 参考：秋芝《Claude Code 全解》12:04「93%」那段，逐帧复刻。
 */
import React from 'react';
import { AbsoluteFill, Sequence, getInputProps } from 'remotion';
import { DataBars, type DataBarsProps } from '../../kit/components/DataBars';

// --props='{"clean":true}' 时不画调试角标,渲对外展示的干净版
const Label: React.FC<{ children: React.ReactNode; bottom?: boolean }> = (p) => (getInputProps().clean ? null : <LabelBox {...p} />);

const LabelBox: React.FC<{ children: React.ReactNode; bottom?: boolean }> = ({ children, bottom }) => (
  <div
    style={{
      position: 'absolute',
      left: 40,
      ...(bottom ? { bottom: 32 } : { top: 32 }),
      padding: '8px 18px',
      borderRadius: 10,
      background: 'rgba(0,0,0,.6)',
      color: '#FFFFFF',
      fontFamily: 'Noto Sans SC',
      fontWeight: 700,
      fontSize: 34,
      zIndex: 10,
    }}
  >
    {children}
  </div>
);

type Variant = { label: string; props: DataBarsProps };

const VARIANTS: Variant[] = [
  { label: '原参数 93% / 7%(默认)', props: { tag: { text: '直接同意' }, subtext: '- 不审核CC的修改' } },
  {
    label: '三段切分 60 / 25 / 15',
    props: {
      segments: [
        { value: 60, text: '60%' },
        { value: 25, text: '25%', color: 'rgb(40,110,200)' },
        { value: 15, text: '15%' },
      ],
      tag: { text: '直接用' },
      subtext: '- 剩下的再改改',
    },
  },
  {
    label: '三条对比 rows',
    props: {
      layout: 'rows',
      segments: [
        { value: 38, text: '38%', name: 'GPT' },
        { value: 52, text: '52%', name: 'Gemini' },
        { value: 81, text: '81%', name: 'Claude' },
      ],
      max: 100,
      tag: { text: '一次跑通率' },
    },
  },
  {
    label: '单条进度 62%(剩下是空槽)',
    props: { segments: [{ value: 62, text: '62%' }], total: 100, tag: { text: '已经学完' }, subtext: '- 还差最后一章' },
  },
  {
    label: '非百分比:倍数 / 金额',
    props: {
      layout: 'rows',
      segments: [
        { value: 800, text: '¥800', name: '以前' },
        { value: 2400, text: '¥2400 · 3 倍', name: '现在' },
      ],
      tag: { text: '收入翻了 3 倍' },
    },
  },
  {
    label: '换颜色 + 纸底不压暗(blend normal)',
    props: {
      segments: [
        { value: 70, text: '70%', color: '#E8762B' },
        { value: 30, text: '30%', color: '#9A948A' },
      ],
      dim: false,
      blend: 'normal',
      tag: { text: '都在摸鱼', color: '#E8762B', textColor: '#FFFFFF' },
    },
  },
  { label: 'speed 1.6 · 更利落', props: { speed: 1.6, tag: { text: '直接同意' }, subtext: '- 不审核CC的修改' } },
];

const SLOT = 160;
export const VARIANTS_DURATION = SLOT * VARIANTS.length;
/** 变体片里标签/副文字提前,免得每段等 3 秒 */
const TAG_AT = 50;
const SUB_AT = 80;

const Backdrop: React.FC<{ light: boolean }> = ({ light }) => (
  <AbsoluteFill
    style={{
      background: light
        ? '#F6F0E5'
        : 'radial-gradient(ellipse at 50% 40%, #6B6F7A 0%, #3B3E46 55%, #1E1F24 100%)',
    }}
  />
);

export const DataBarsVariants: React.FC = () => (
  <AbsoluteFill style={{ background: '#16151A', WebkitFontSmoothing: 'antialiased' }}>
    {VARIANTS.map((v, i) => {
      const light = v.props.dim === false;
      const speed = v.props.speed ?? 1;
      return (
        <Sequence key={v.label} from={i * SLOT} durationInFrames={SLOT} layout="none">
          <Backdrop light={light} />
          <Sequence from={6} layout="none">
            <DataBars
              {...v.props}
              tagDelayFrames={Math.round(TAG_AT / speed)}
              subtextDelayFrames={Math.round(SUB_AT / speed)}
            />
          </Sequence>
          <Label bottom>{`${i + 1}/${VARIANTS.length}  ${v.label}`}</Label>
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
