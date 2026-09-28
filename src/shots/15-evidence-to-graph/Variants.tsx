/**
 * 15 · 截图变节点图 · 从实拍一句话长成动画
 *
 * 先放一张真截图当证据，把其中一句话抽出来放大、关键词闪橙色荧光；黑色新页推上来，一张小卡片上的词「长」成节点，其余节点淡入、连线串起来。适合从实拍截图 / 录屏丝滑转成动画讲解。
 *
 * 组件:src/kit/components/EvidenceToGraph.tsx(EvidenceToGraph)。本文件是它的变体演示,Studio 里选 composition「EvidenceToGraphVariants」。
 * 左上角 / 底部的小字是变体说明;渲染时加 --props='{"clean":true}' 就不画。
 * 参考：秋芝《Codex 全解》11:24，逐帧复刻。
 */
import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, getInputProps } from 'remotion';
import { EvidenceToGraph, evidenceToGraphDurationInFrames, type EvidenceToGraphProps, type GraphEdge, type GraphNode } from '../../kit/components/EvidenceToGraph';

// --props='{"clean":true}' 时不画调试角标,渲对外展示的干净版
const Label: React.FC<{ children: React.ReactNode; top?: boolean }> = (p) => (getInputProps().clean ? null : <LabelBox {...p} />);

const LabelBox: React.FC<{ children: React.ReactNode; top?: boolean }> = ({ children, top }) => (
  <div
    style={{
      position: 'absolute',
      right: 40,
      ...(top ? { top: 24 } : { bottom: 24 }),
      padding: '8px 18px',
      borderRadius: 10,
      background: 'rgba(40,40,40,.85)',
      color: '#FFFFFF',
      fontFamily: 'Noto Sans SC',
      fontWeight: 700,
      fontSize: 30,
      zIndex: 100,
    }}
  >
    {children}
  </div>
);

// ───────── 代码画的假界面(变体用,不出现原片)─────────
type Line = { x: number; y: number; text: string; size?: number; color?: string; weight?: number; bg?: string; pad?: number };
const FakeScreen: React.FC<{ title: string; lines: Line[]; accent?: string }> = ({ title, lines, accent = '#E07B39' }) => (
  <div style={{ position: 'absolute', inset: 0, background: '#FBFAF7', fontFamily: 'Noto Sans SC' }}>
    <div style={{ position: 'absolute', left: 0, top: 0, width: 280, height: 927, background: '#EFEDE8' }}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} style={{ position: 'absolute', left: 32, top: 110 + i * 58, width: 170 - (i % 3) * 30, height: 18, borderRadius: 9, background: i === 1 ? '#D9D4CA' : '#E3DFD7' }} />
      ))}
      <div style={{ position: 'absolute', left: 32, top: 40, width: 40, height: 40, borderRadius: 10, background: accent }} />
    </div>
    <div
      style={{
        position: 'absolute',
        left: 280,
        top: 0,
        right: 0,
        height: 72,
        borderBottom: '2px solid #ECE9E2',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 40,
        fontSize: 26,
        fontWeight: 700,
        color: '#3E3B34',
      }}
    >
      {title}
    </div>
    {lines.map((l, i) => (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: l.x,
          top: l.y,
          fontSize: l.size ?? 24,
          lineHeight: 1.3,
          fontWeight: l.weight ?? 700,
          color: l.color ?? '#55514A',
          whiteSpace: 'pre',
          background: l.bg,
          padding: l.pad ? `${l.pad / 2}px ${l.pad}px` : undefined,
          borderRadius: l.bg ? 8 : undefined,
        }}
      >
        {l.text}
      </div>
    ))}
  </div>
);

const PARA = ['我先看了一下项目结构，入口在 main.py。', '依赖里缺少几个包，已经补上。', '下面开始处理素材，先把音频单独导出来。', '处理完以后会生成一份字幕文件。'];
const para = (y0: number, n: number, x = 340): Line[] => Array.from({ length: n }, (_, i) => ({ x, y: y0 + i * 40, text: PARA[i % 4], color: '#8A857B' }));

const Icon: React.FC<{ d: string }> = ({ d }) => (
  <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const IC = {
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  doc: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7',
  cut: 'M6 6l12 12M18 6L6 18M4 4h4v4H4zM16 16h4v4h-4z',
  img: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  star: 'M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.3L12 17.5 6.5 20.4l1-6.3L3 9.7l6.2-.9z',
};

type Variant = { label: string; props: EvidenceToGraphProps; dual?: boolean; hint?: Array<[number, string]> };

const FAST = { extractAt: 0.6, markAt: 1.6, pushAt: 2.6 };

const V1_SCREEN = (
  <FakeScreen title="自动剪辑助手 · 会话" lines={[...para(130, 4), { x: 340, y: 330, text: '素材都齐了。我用 Whisper 先转写，再按停顿自动粗剪：', color: '#2F2C27' }, ...para(420, 5)]} />
);
const V2_SCREEN = (
  <FakeScreen
    title="今日待办 · 截图"
    lines={[
      ...para(130, 2),
      { x: 360, y: 260, text: '收集选题', bg: '#FCE3CF', pad: 16, size: 30 },
      { x: 360, y: 400, text: '写口播稿', bg: '#DDEBE6', pad: 16, size: 30 },
      { x: 360, y: 540, text: '剪辑发布', bg: '#E4E1F5', pad: 16, size: 30 },
      ...para(660, 3),
    ]}
  />
);
/** 那句话在假界面里的字框(证据坐标,按 1080p 渲染逐列量字墨;上下取一个字号高 24) */
const V1_LINE = { x: 341, y: 334, w: 595, h: 24 };
const V3_SCREEN = <FakeScreen title="终端输出" lines={[...para(130, 3), { x: 340, y: 300, text: '已安装 3 个依赖：whisper、ffmpeg、pydub', color: '#2F2C27' }, ...para(380, 6)]} />;

const node = (id: string, text: string, extra: Partial<GraphNode> = {}): GraphNode => ({ id, text, ...extra });
const e = (from: string, to: string): GraphEdge => ({ from, to });

const VARIANTS: Variant[] = [
  {
    label: '原结构换内容 · 白条 grow:从原句原位放大出来(新增)',
    props: {
      evidence: { content: V1_SCREEN },
      extract: { text: '素材都齐了。我用 Whisper 先转写，再按停顿自动粗剪：', keyword: 'Whisper', fontFamily: 'Noto Sans SC', from: V1_LINE, enter: 'grow' },
      nodes: [node('w', 'whisper -m'), node('hub', '语音转文字'), node('p', 'pydub split')],
      edges: [e('w', 'hub'), e('p', 'hub')],
      timing: FAST,
    },
  },
  {
    label: '3 节点 · 截图缩小淡出,三处文字边飞边变成节点(shrink)',
    props: {
      evidence: { content: V2_SCREEN },
      pageMode: 'shrink',
      nodes: [
        node('a', '收集选题', { from: { x: 360, y: 260, w: 152, h: 55 }, icon: <Icon d={IC.star} /> }),
        node('b', '写口播稿', { from: { x: 360, y: 400, w: 152, h: 55 }, icon: <Icon d={IC.doc} /> }),
        node('c', '剪辑发布', { from: { x: 360, y: 540, w: 152, h: 55 }, icon: <Icon d={IC.cut} /> }),
      ],
      edges: [e('a', 'b'), e('b', 'c')],
      timing: { pushAt: 1.2 },
      chipFontFamily: "'Noto Sans SC'",
      boxFontFamily: "'Noto Sans SC'",
    },
  },
  {
    label: '7 节点汇聚 · 抽句用 crop 裁截图那行,pop 硬出盖在原句上',
    props: {
      evidence: { content: V3_SCREEN },
      extract: { mode: 'crop', from: { x: 336, y: 300, w: 504, h: 32 }, markFrom: { x: 651, y: 304, w: 96, h: 24 } },
      nodes: [
        node('a', 'ffmpeg -i'),
        node('hub', '命令行工具'),
        node('b', 'git clone'),
        node('c', 'npm install'),
        node('d', 'pip install'),
        node('f', 'brew install'),
        node('g', 'curl -O'),
      ],
      edges: [e('a', 'hub'), e('b', 'hub'), e('c', 'hub'), e('d', 'hub'), e('f', 'hub'), e('g', 'hub')],
      timing: { ...FAST, popStagger: 0.35 },
    },
  },
  {
    label: '横向链式 · 5 个节点一路连下去(不要源卡)',
    props: {
      evidence: { content: V3_SCREEN },
      card: 'none',
      nodes: [
        node('a', '录音', { icon: <Icon d={IC.mic} /> }),
        node('b', '转写', { icon: <Icon d={IC.doc} /> }),
        node('c', '粗剪', { icon: <Icon d={IC.cut} /> }),
        node('d', '配图', { icon: <Icon d={IC.img} /> }),
        node('f', '发布', { icon: <Icon d={IC.bolt} /> }),
      ],
      edges: [e('a', 'b'), e('b', 'c'), e('c', 'd'), e('d', 'f')],
      chipFontFamily: "'Noto Sans SC'",
      boxFontFamily: "'Noto Sans SC'",
      timing: { pushAt: 1.2, popStagger: 0.4 },
    },
  },
  {
    label: '树形 · 1 → 2 → 4(换暖纸配色)',
    props: {
      evidence: { content: V1_SCREEN },
      nodes: [node('r', 'AI 剪辑'), node('x', '听得懂'), node('y', '剪得动'), node('x1', '转写'), node('x2', '找停顿'), node('y1', '切片'), node('y2', '配字幕')],
      edges: [e('r', 'x'), e('r', 'y'), e('x', 'x1'), e('x', 'x2'), e('y', 'y1'), e('y', 'y2')],
      chipFontFamily: "'Noto Sans SC'",
      boxFontFamily: "'Noto Sans SC'",
      pageColor: '#F6F0E5',
      frameColor: '#E6DDCB',
      nodeColor: '#FFFFFF',
      chipTextColor: '#1C1B17',
      boxTextColor: '#1C1B17',
      linkColor: '#3E3B34',
      dotColor: '#E07B39',
      timing: { pushAt: 1.2, popStagger: 0.3 },
    },
  },
  {
    label: '按口播时刻 · 每个节点 at 对准一句话(白条 grow)',
    hint: [
      [0, '剪口播最费时间的是什么'],
      [3.6, '自动粗剪能帮你'],
      [5.2, '找停顿'],
      [6.0, '删口误'],
      [7.4, '最后再对一遍字幕'],
    ],
    props: {
      evidence: { content: V1_SCREEN },
      extract: { text: '素材都齐了。我用 Whisper 先转写，再按停顿自动粗剪：', keyword: '粗剪', fontFamily: 'Noto Sans SC', from: V1_LINE, enter: 'grow' },
      nodes: [node('s', '自动粗剪'), node('hub', '省下的时间'), node('a', '找停顿', { at: 5.2 }), node('b', '删口误', { at: 6.0 }), node('c', '对字幕', { at: 7.4 })],
      edges: [e('s', 'hub'), e('a', 'hub'), e('b', 'hub'), e('c', 'hub')],
      chipFontFamily: "'Noto Sans SC'",
      timing: { extractAt: 0.5, markAt: 1.3, pushAt: 2.2, morphAt: 3.6 },
    },
  },
  {
    label: '取帧节奏对比 · 左平滑(默认) / 右 steppy(原片大步小步)',
    dual: true,
    props: {
      evidence: { content: V3_SCREEN },
      nodes: [node('a', 'ffmpeg -i'), node('hub', '命令行工具'), node('b', 'git clone')],
      edges: [e('a', 'hub'), e('b', 'hub')],
      timing: { pushAt: 0.8 },
    },
  },
];

const slotOf = (v: Variant) => Math.max(evidenceToGraphDurationInFrames(30, v.props, 36), 150);
const SLOTS = VARIANTS.map(slotOf);
const STARTS = SLOTS.map((_, i) => SLOTS.slice(0, i).reduce((a, b) => a + b, 0));
export const VARIANTS_DURATION = SLOTS.reduce((a, b) => a + b, 0);

const SubHint: React.FC<{ items: Array<[number, string]> }> = ({ items }) => {
  const f = useCurrentFrame();
  const t = f / 30;
  const cur = [...items].reverse().find(([s]) => t >= s);
  if (!cur) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 950, textAlign: 'center', zIndex: 60 }}>
      <span style={{ fontFamily: 'SmileySansV1', fontSize: 50, color: '#FFF', background: 'rgba(0,0,0,.75)', padding: '8px 14px', borderRadius: 10 }}>{cur[1]}</span>
    </div>
  );
};

export const EvidenceToGraphVariants: React.FC = () => (
  <AbsoluteFill style={{ background: '#111' }}>
    {VARIANTS.map((v, i) => (
      <Sequence key={v.label} from={STARTS[i]} durationInFrames={SLOTS[i]} layout="none">
        <AbsoluteFill style={{ background: '#1A1A1A' }} />
        {v.dual ? (
          [false, true].map((st, k) => (
            <div key={k} style={{ position: 'absolute', left: k * 960, top: 270, width: 1920, height: 1080, scale: '0.5', transformOrigin: '0 0', overflow: 'hidden' }}>
              <EvidenceToGraph {...v.props} steppy={st} />
              <div style={{ position: 'absolute', left: 90, top: 70, fontFamily: 'Noto Sans SC', fontWeight: 700, fontSize: 64, color: '#E07B39', zIndex: 50 }}>
                {st ? 'steppy' : '平滑'}
              </div>
            </div>
          ))
        ) : (
          <EvidenceToGraph {...v.props} />
        )}
        {v.hint ? <SubHint items={v.hint} /> : null}
        <Label>{`${i + 1}/${VARIANTS.length}  ${v.label}`}</Label>
      </Sequence>
    ))}
  </AbsoluteFill>
);
