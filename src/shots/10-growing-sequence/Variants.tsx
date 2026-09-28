/**
 * 10 · 生长时序图 · 谁发给谁一步步长出来
 *
 * 黑底点阵上几个角色胶囊掉下来、竖线长出，每一步的消息签带着箭头依次闪入 / 升起，最后一方开始转 loading。适合讲链路比较长的工作原理（用户 → Agent → 大模型……）。
 *
 * 组件:src/kit/components/GrowingSequence.tsx(GrowingSequence)。本文件是它的变体演示,Studio 里选 composition「GrowingSequenceVariants」。
 * 左上角 / 底部的小字是变体说明;渲染时加 --props='{"clean":true}' 就不画。
 * 参考：秋芝《Claude Code 全解》02:18「LLM loop」，逐帧复刻。
 */
import React from 'react';
import { AbsoluteFill, Series, useCurrentFrame, useVideoConfig, getInputProps } from 'remotion';
import { GrowingSequence, growingSequenceDurationInFrames, type GrowingSequenceProps } from '../../kit/components/GrowingSequence';
import { colors as themeColors } from '../../kit/theme';

// ── Variants ──

type Variant = { label: string; props: GrowingSequenceProps; hold?: number; note?: React.ReactNode };

const VoiceLine: React.FC<{ cues: Array<[number, string]> }> = ({ cues }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const cur = [...cues].reverse().find(([s]) => t >= s);
  if (!cur) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 950, display: 'flex', justifyContent: 'center' }}>
      <div style={{ background: 'rgba(0,0,0,.78)', color: '#fff', fontFamily: 'SmileySans', fontSize: 50, padding: '6px 14px', whiteSpace: 'pre' }}>
        口播:{cur[1]}
      </div>
    </div>
  );
};

const PAPER = {
  background: themeColors.bgCream,
  line: themeColors.ink,
  capsuleFill: themeColors.surface,
  nodeText: themeColors.ink,
  iconBg: themeColors.blueSoft,
  iconInk: themeColors.ink,
  highlight: themeColors.blue,
  highlightText: '#FFFFFF',
  plain: themeColors.orange,
  plainText: '#FFFFFF',
  boxFill: themeColors.surface,
  spinner: themeColors.blue,
  processText: themeColors.ink,
  dot: themeColors.inkMuted,
};

const VOICE_CUES: Array<[number, string]> = [
  [0, '你在 Cursor 里敲一句话'],
  [1.0, '它先把代码库里相关的文件翻出来'],
  [2.4, '连同你的问题一起打包发给模型'],
  [3.6, '模型想一会儿'],
  [4.5, '回一段改好的代码给你'],
];

const VARIANTS: Variant[] = [
  {
    label: '① 原结构换内容(3 方 3 步,默认节奏)',
    props: {
      participants: [
        { name: '你', icon: 'user' },
        { name: 'Codex', icon: 'code' },
        { name: 'GPT', icon: 'brain' },
      ],
      steps: [
        { from: '你', to: 'Codex', text: '把这个 bug 修了' },
        { from: 'Codex', to: 'GPT', text: ['需求:“把这个 bug 修了”', '相关代码:3 个文件'] },
        { from: 'GPT', kind: 'process' },
      ],
    },
  },
  {
    label: '② 2 方 3 步(一问一答再追问)',
    props: {
      participants: [
        { name: '顾客', icon: 'phone' },
        { name: '客服AI', icon: 'robot' },
      ],
      steps: [
        { from: '顾客', to: '客服AI', text: '我的快递到哪了' },
        { from: '客服AI', to: '顾客', text: ['已到杭州转运中心', '预计明天送达'] },
        { from: '顾客', to: '客服AI', text: '能改地址吗' },
      ],
      stepGap: 40,
    },
  },
  {
    label: '③ 4 方 8 步(Agent 调工具的完整循环,自动收小不出画)',
    props: {
      participants: [
        { name: '用户', icon: 'user' },
        { name: 'Agent', icon: 'robot' },
        { name: '大模型', icon: 'brain' },
        { name: '工具', icon: 'tool' },
      ],
      steps: [
        { from: '用户', to: 'Agent', text: '北京明天冷吗' },
        { from: 'Agent', to: '大模型', text: ['问题 + 工具说明书'] },
        { from: '大模型', kind: 'process' },
        { from: '大模型', to: 'Agent', text: ['调用 查天气(北京)'] },
        { from: 'Agent', to: '工具', text: ['get_weather("北京")'] },
        { from: '工具', to: 'Agent', text: ['最低 3℃ 有风'] },
        { from: 'Agent', to: '大模型', text: ['工具结果:3℃ 有风'] },
        { from: 'Agent', to: '用户', text: ['挺冷,记得穿羽绒服'] },
      ],
      firstStepAt: 30,
      stepGap: 34,
    },
  },
  {
    label: '④ 带口播手动时刻(每步 atSec 对口播)',
    props: {
      participants: [
        { name: '你', icon: 'user' },
        { name: 'Cursor', icon: 'code' },
        { name: '模型', icon: 'brain' },
      ],
      steps: [
        { from: '你', to: 'Cursor', text: '加个登录页', atSec: 1.0 },
        { from: 'Cursor', kind: 'process', text: '翻代码库…', atSec: 2.0 },
        { from: 'Cursor', to: '模型', text: ['问题 + 12 个相关文件'], atSec: 2.4 },
        { from: '模型', kind: 'process', atSec: 3.6 },
        { from: '模型', to: '你', text: ['改好的代码 diff'], atSec: 4.5 },
      ],
    },
    note: <VoiceLine cues={VOICE_CUES} />,
  },
  {
    label: '⑤ 换配色(泽轩暖纸底 · 橙 / teal 签)',
    props: {
      participants: [
        { name: '我', icon: 'user' },
        { name: 'Agent', icon: 'robot' },
        { name: '网页', icon: 'web' },
      ],
      steps: [
        { from: '我', to: 'Agent', text: '帮我比价' },
        { from: 'Agent', to: '网页', text: ['打开 3 家店', '抓价格和运费'] },
        { from: '网页', to: 'Agent', text: ['3 份价格表'] },
        { from: 'Agent', kind: 'process', text: '算到手价…' },
      ],
      background: 'solid',
      colors: PAPER,
    },
  },
  {
    label: '⑥ 横向流程图 layout="flow"(相邻直连 / 隔位走下方 U 线 / 框挂节点下)',
    props: {
      layout: 'flow',
      participants: [
        { name: '口播稿', icon: 'file' },
        { name: '分镜', icon: 'brain' },
        { name: 'Remotion', icon: 'code' },
        { name: '成片', icon: 'phone' },
      ],
      steps: [
        { from: '口播稿', to: '分镜', text: '逐句拆' },
        { from: '分镜', to: 'Remotion', text: '写动画' },
        { from: 'Remotion', kind: 'process', text: '渲 720P…' },
        { from: 'Remotion', to: '成片', text: '点头再渲 4K' },
        { from: '成片', to: '口播稿', text: ['复盘数据反哺下一条'] },
      ],
      stepGap: 40,
    },
  },
  {
    label: '⑦ 6 方 10 步 + speed 1.3(极限排版)',
    props: {
      participants: [
        { name: '用户', icon: 'user' },
        { name: '网关', icon: 'cloud' },
        { name: 'Agent', icon: 'robot' },
        { name: '模型', icon: 'brain' },
        { name: '检索', icon: 'db' },
        { name: '文件', icon: 'file' },
      ],
      steps: [
        { from: '用户', to: '网关', text: '总结上周周报' },
        { from: '网关', to: 'Agent', text: ['鉴权通过'] },
        { from: 'Agent', to: '检索', text: ['搜「周报」'] },
        { from: '检索', to: '文件', text: ['读 5 份文档'] },
        { from: '文件', to: '检索', text: ['原文 2 万字'] },
        { from: '检索', to: 'Agent', text: ['相关段落'] },
        { from: 'Agent', to: '模型', text: ['段落 + 要求'] },
        { from: '模型', kind: 'process' },
        { from: '模型', to: 'Agent', text: ['300 字摘要'] },
        { from: 'Agent', to: '用户', text: ['周报摘要已生成'] },
      ],
      firstStepAt: 26,
      stepGap: 26,
      speed: 1.3,
    },
  },
];

const HOLD = 45;
const slotOf = (v: Variant) => growingSequenceDurationInFrames(v.props, 30) + (v.hold ?? HOLD) - 48;
export const VARIANTS_DURATION = VARIANTS.reduce((a, v) => a + slotOf(v), 0);

const VariantSlot: React.FC<{ v: Variant }> = ({ v }) => {
  const light = v.props.background === 'solid' && v.props.colors?.background === themeColors.bgCream;
  return (
    <AbsoluteFill style={{ background: light ? themeColors.bgCream : '#000' }}>
      <GrowingSequence {...v.props} />
      {v.note}
      {getInputProps().clean ? null : (
        <div
          style={{
            position: 'absolute',
            left: 36,
            bottom: 28,
            padding: '8px 18px',
            borderRadius: 10,
            background: light ? 'rgba(28,27,23,.85)' : 'rgba(60,60,60,.85)',
            color: '#FFFFFF',
            fontFamily: 'Noto Sans SC',
            fontWeight: 700,
            fontSize: 30,
          }}
        >
          {v.label}
        </div>
      )}
    </AbsoluteFill>
  );
};

export const GrowingSequenceVariants: React.FC = () => (
  <AbsoluteFill style={{ background: '#000', WebkitFontSmoothing: 'antialiased' }}>
    <Series>
      {VARIANTS.map((v, i) => (
        <Series.Sequence key={i} durationInFrames={slotOf(v)} premountFor={15}>
          <VariantSlot v={v} />
        </Series.Sequence>
      ))}
    </Series>
  </AbsoluteFill>
);
