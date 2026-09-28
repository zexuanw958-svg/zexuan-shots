/**
 * 13 · 思维导图复习 · 描线长出分支卡
 *
 * 黑底点阵上根卡在最上面，口播说到哪一项，就从父卡描一条蓝线出去，线描到头卡片再浮上来，叶子小卡一张张往下堆。适合「我们回顾一下」，方便观众截图。
 *
 * 组件:src/kit/components/MindmapReview.tsx(MindmapReview)。本文件是它的变体演示,Studio 里选 composition「MindmapReviewVariants / MindmapReviewPortrait」。
 * 左上角 / 底部的小字是变体说明;渲染时加 --props='{"clean":true}' 就不画。
 * 参考：秋芝《Codex 全解》39:04 回顾导图，逐帧复刻。
 */
import React from 'react';
import { AbsoluteFill, Sequence, getInputProps } from 'remotion';
import { MindmapReview, layoutMindmap, mindmapDuration, type MindmapReviewProps } from '../../kit/components/MindmapReview';

// --props='{"clean":true}' 时不画调试角标,渲对外展示的干净版
const Label: React.FC<{ children: React.ReactNode; top?: boolean }> = (p) => (getInputProps().clean ? null : <LabelBox {...p} />);

const LabelBox: React.FC<{ children: React.ReactNode; top?: boolean }> = ({ children, top }) => (
  <div
    style={{
      position: 'absolute',
      left: 40,
      ...(top ? { top: 24 } : { bottom: 32 }),
      padding: '8px 18px',
      borderRadius: 10,
      background: 'rgba(255,255,255,.14)',
      color: '#FFFFFF',
      fontFamily: 'Noto Sans SC',
      fontWeight: 700,
      fontSize: top ? 24 : 30,
      zIndex: 10,
    }}
  >
    {children}
  </div>
);

// ── 变体(中性内容,不出现秋芝画面) ──
/** 代码画的根图标(圆角渐变方块 + 符号),不用任何品牌图 */
const CodeIcon: React.FC<{ from: string; to: string; glyph: string }> = ({ from, to, glyph }) => (
  <svg viewBox="0 0 72 72" width="100%" height="100%">
    <defs>
      <linearGradient id={`ci-${glyph}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={from} />
        <stop offset="1" stopColor={to} />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="68" height="68" rx="18" fill={`url(#ci-${glyph})`} />
    <text x="36" y="47" textAnchor="middle" fill="#fff" style={{ fontFamily: 'Space Mono', fontWeight: 700, fontSize: 30 }}>
      {glyph}
    </text>
  </svg>
);
const icon = (glyph: string, from = '#4F7BFF', to = '#8A5CFF') => ({ node: <CodeIcon from={from} to={to} glyph={glyph} />, width: 72, height: 72 });

type Variant = { label: string; props: MindmapReviewProps };
const VARIANTS: Variant[] = [
  {
    label: '原结构换内容(三层:分支 → 中卡 → 小卡)',
    props: {
      root: { label: 'Claude Code', icon: icon('>_') },
      branches: [
        {
          label: '上手基础', caption: 'BASICS',
          children: [
            { label: '项目文件', caption: 'FILES', children: [{ label: '读写权限' }, { label: '撤销重来' }, { label: '上下文压缩' }] },
            { label: '终端命令', caption: 'TERMINAL' },
            { label: '记忆文件', caption: 'MEMORY', children: [{ label: 'CLAUDE.md' }, { label: '自动记忆' }] },
          ],
        },
        {
          label: '实战项目', caption: 'PROJECT',
          children: [{ label: '做个网站', caption: 'CASE STUDY', accent: true, children: [{ label: '部署上线\n绑定域名', caption: 'CASE STUDY', accent: true, size: 'card' }] }],
        },
        { label: '进阶玩法', caption: 'ADVANCED' },
      ],
    },
  },
  {
    label: '3 支少子项 · 一级分支也逐个长(preshownDepth 0)',
    props: {
      root: { label: 'AI 搞钱三件套', icon: icon('¥', '#2FB67C', '#1E7FD0') },
      preshownDepth: 0,
      branches: [
        { label: '选题', caption: 'TOPIC', children: [{ label: '找爆款' }, { label: '做对标' }] },
        { label: '内容', caption: 'CONTENT', children: [{ label: '写口播稿' }] },
        { label: '变现', caption: 'MONEY', children: [{ label: '接商单' }, { label: '卖资料包' }] },
      ],
    },
  },
  {
    label: '6 支多子项 · 自动缩(speed 1.5)',
    props: {
      root: { label: '一期视频全流程' },
      speed: 1.5,
      branches: [
        { label: '选题', caption: 'IDEA', children: [{ label: '灵感记录' }, { label: '打分' }, { label: '对标研究' }] },
        { label: '写稿', caption: 'SCRIPT', children: [{ label: '开头钩子' }, { label: '结构骨架' }, { label: '念顺' }, { label: '删废话' }] },
        { label: '拍摄', caption: 'SHOOT', children: [{ label: '灯光' }, { label: '收音' }, { label: '提词器' }] },
        { label: '剪辑', caption: 'EDIT', children: [{ label: '粗剪' }, { label: '精剪' }, { label: '动效' }, { label: '字幕' }, { label: '配乐' }] },
        { label: '发布', caption: 'PUBLISH', children: [{ label: '标题封面' }, { label: '发布时间' }, { label: '引流文档' }] },
        { label: '复盘', caption: 'REVIEW', children: [{ label: '看数据' }, { label: '找原因' }, { label: '改下一期' }] },
      ],
    },
  },
  {
    label: '单侧展开(direction right)',
    props: {
      root: { label: 'Cursor 全解', icon: icon('C', '#3A3F4B', '#15171C') },
      direction: 'right',
      branches: [
        { label: '三种模式', caption: 'MODES', children: [{ label: 'Ask' }, { label: 'Edit' }, { label: 'Agent' }] },
        { label: '规则文件', caption: 'RULES', children: [{ label: '.cursorrules' }, { label: '项目规则' }] },
        { label: '上下文', caption: 'CONTEXT', children: [{ label: '@文件' }, { label: '@文档' }, { label: '@网页' }, { label: '索引' }] },
        { label: '实战', caption: 'PROJECT', children: [{ label: '改个老项目', accent: true }] },
      ],
    },
  },
  {
    label: '逐支高亮回顾(highlights)',
    props: {
      root: { label: '今天学了什么', icon: icon('✓', '#4F7BFF', '#2FB67C') },
      speed: 1.6,
      branches: [
        { label: '装环境', caption: 'SETUP', children: [{ label: '下载安装' }, { label: '登录账号' }] },
        { label: '写提示词', caption: 'PROMPT', children: [{ label: '说清目标' }, { label: '给例子' }, { label: '限定格式' }] },
        { label: '做项目', caption: 'BUILD', children: [{ label: '拆任务' }, { label: '逐步验证' }] },
        { label: '上线', caption: 'SHIP', children: [{ label: '一键部署' }] },
      ],
      highlights: [
        { branch: 0, from: 105, to: 140 },
        { branch: 1, from: 140, to: 175 },
        { branch: 2, from: 175, to: 210 },
        { branch: 3, from: 210, to: 245 },
      ],
    },
  },
  {
    label: '换配色(暖橙)',
    props: {
      root: { label: '副业起步清单', icon: icon('★', '#FF9A3C', '#E0455B') },
      palette: {
        line: 'rgb(255,168,92)',
        cardFrom: [58, 38, 22],
        cardTo: [22, 14, 9],
        accentFrom: [238, 120, 40],
        accentTo: [214, 62, 92],
        accentGlow: [255, 120, 40],
        titleGlow: [120, 50, 10],
        caption: 'rgb(214,190,168)',
        bg: '#0B0806',
        glowA: 'rgba(170,80,20,0.12)',
        glowB: 'rgba(170,40,70,0.08)',
      },
      branches: [
        { label: '找方向', caption: 'DIRECTION', children: [{ label: '看自己会啥' }, { label: '看谁在付钱' }] },
        { label: '做样品', caption: 'SAMPLE', children: [{ label: '先做一个', accent: true }, { label: '发出去看反馈' }] },
        { label: '收第一笔钱', caption: 'FIRST DEAL', children: [{ label: '定价' }, { label: '交付' }, { label: '要复购' }] },
      ],
    },
  },
];

/** 标签上注明:最小字号达到下限的百分比、是否自动切了单侧展开 */
const readNote = (p: MindmapReviewProps, w: number, h: number) => {
  const L = layoutMindmap(p, w, h, 30);
  const auto = !p.direction && L.dir === 'right' ? ' · 自动切单侧展开' : '';
  return L.readable >= 0.99 ? `${auto}` : `${auto} · 字低于下限(${Math.round(L.readable * 100)}%),建议拆两屏`;
};
const HOLD = 75;
const slotOf = (p: MindmapReviewProps, w = 1920, h = 1080) => {
  const hl = Math.max(0, ...(p.highlights ?? []).map((x) => (x.to ?? x.from) + 20));
  return Math.max(mindmapDuration(p, 30, w, h), hl) + HOLD;
};
const SLOTS = VARIANTS.map((v) => slotOf(v.props));
const STARTS = SLOTS.map((_, i) => SLOTS.slice(0, i).reduce((a, b) => a + b, 0));
export const VARIANTS_DURATION = SLOTS.reduce((a, b) => a + b, 0);

export const MindmapReviewVariants: React.FC = () => (
  <AbsoluteFill style={{ background: '#000', WebkitFontSmoothing: 'antialiased' }}>
    {VARIANTS.map((v, i) => (
      <Sequence key={v.label} from={STARTS[i]} durationInFrames={SLOTS[i]} layout="none">
        <MindmapReview {...v.props} />
        <Label top>{`${i + 1}/${VARIANTS.length + 1}  ${v.label}${readNote(v.props, 1920, 1080)}`}</Label>
      </Sequence>
    ))}
  </AbsoluteFill>
);

// ── 竖屏 9:16 ──
const PORTRAIT: MindmapReviewProps = {
  root: { label: '三步用好 AI', icon: icon('AI') },
  safe: { top: 260, bottom: 420, side: 40 },
  branches: [
    { label: '问清楚', caption: 'ASK', children: [{ label: '说目标' }, { label: '给背景' }, { label: '定格式' }] },
    { label: '看结果', caption: 'CHECK', children: [{ label: '挑错' }, { label: '追问' }] },
    { label: '存下来', caption: 'SAVE', children: [{ label: '做模板' }, { label: '下次复用' }, { label: '分享' }] },
  ],
};
export const PORTRAIT_DURATION = slotOf(PORTRAIT, 1080, 1920);
export const MindmapReviewPortrait: React.FC = () => (
  <AbsoluteFill style={{ background: '#000', WebkitFontSmoothing: 'antialiased' }}>
    <MindmapReview {...PORTRAIT} />
    <Label top>{`${VARIANTS.length + 1}/${VARIANTS.length + 1}  竖屏 9:16(自动放大到撑满宽度)${readNote(PORTRAIT, 1080, 1920)}`}</Label>
  </AbsoluteFill>
);
