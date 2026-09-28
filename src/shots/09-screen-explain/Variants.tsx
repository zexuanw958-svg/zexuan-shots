/**
 * 09 · 录屏抠件解释 · 英文变中文 + 放大标注
 *
 * 把录屏里最要紧的一块（比如 AI 吐出来的一段英文）抠出来放大成卡片：英文淡出、中文逐字显影、橙色高亮重点词；还能整屏压暗，只留一句反色框，长出分支和荧光绿结论标签。适合解释 AI 输出是什么意思。
 *
 * 组件:src/kit/components/ScreenExplain.tsx(ScreenExplain)。本文件是它的变体演示,Studio 里选 composition「ScreenExplainVariants」。
 * 左上角 / 底部的小字是变体说明;渲染时加 --props='{"clean":true}' 就不画。
 * 参考：秋芝《Claude Code 全解》录屏抠件解释，逐帧复刻。
 */
import React from 'react';
import { AbsoluteFill, Sequence, getInputProps } from 'remotion';
import { ScreenExplain, type ScreenExplainProps } from '../../kit/components/ScreenExplain';

// --props='{"clean":true}' 时不画调试角标,渲对外展示的干净版
const Label: React.FC<{ children: React.ReactNode; top?: number }> = (p) => (getInputProps().clean ? null : <LabelBox {...p} />);

const LabelBox: React.FC<{ children: React.ReactNode; top?: number }> = ({ children, top }) => (
  <div
    style={{
      position: 'absolute',
      right: 40,
      ...(top !== undefined ? { top } : { bottom: 20 }),
      padding: '8px 18px',
      borderRadius: 10,
      background: 'rgba(255,214,0,.92)',
      color: '#000',
      fontFamily: 'Noto Sans SC',
      fontWeight: 700,
      fontSize: 30,
      zIndex: 100,
    }}
  >
    {children}
  </div>
);

// ───────────────────────── 假录屏(代码画的,英文输出) ─────────────────────────

type TermRow = { text: string; kind?: 'cmd' | 'bullet' | 'plain' | 'dim' | 'code' | 'blank' };
const ROW_H = 40;
const ROW_TOP = 96;
/** 第 i 行的顶(录屏窗内坐标),给 crop 算位置用 */
const rowTop = (i: number) => ROW_TOP + i * ROW_H;

const TERM_ROWS: TermRow[] = [
  { text: '36 +  const colors = { work: "#d94848", short: "#2e9e4f" };', kind: 'code' },
  { text: 'npm run build', kind: 'dim' },
  { text: '✓ built in 2.41s · 14 modules transformed', kind: 'plain' },
  { text: '', kind: 'blank' },
  { text: '/review', kind: 'cmd' },
  { text: "I'll review the changes in src/ and check for regressions before merging.", kind: 'bullet' },
  { text: 'First, let me run the test suite, then inspect the three changed modules.', kind: 'plain' },
  { text: 'Ran 42 tests (ctrl+o to expand)', kind: 'dim' },
  { text: 'All tests pass. I found 2 risky edits: a race in cache.ts and a null in api.ts.', kind: 'bullet' },
  { text: 'Suggest: add a lock around refresh(), and guard response.data before use.', kind: 'plain' },
  { text: '', kind: 'blank' },
  { text: 'Error: ENOENT: no such file or directory, open ".env.local"', kind: 'bullet' },
  { text: '  at Object.openSync (node:fs:601:3) — config loader could not find your keys', kind: 'dim' },
  { text: '', kind: 'blank' },
  { text: 'Agent(Security scan) Haiku 4.5', kind: 'plain' },
  { text: '  Read(api.ts) · Read(cache.ts)  (ctrl+b to run in background)', kind: 'dim' },
  { text: '* Reviewing… (31s · ↓ 842 tokens · thought for 3s)', kind: 'dim' },
];

const FakeTerminal: React.FC<{ dark?: boolean; rows?: TermRow[] }> = ({ dark, rows = TERM_ROWS }) => {
  const bg = dark ? '#16181D' : '#FAFAF8';
  const fg = dark ? '#E4E6EB' : '#1E1E1E';
  const dim = dark ? '#7D8390' : '#8A8A8A';
  const bar = dark ? '#2A2E37' : '#3A3A3A';
  return (
    <div style={{ position: 'absolute', inset: 0, background: bg, fontFamily: 'Space Mono', fontSize: 22, color: fg }}>
      <div style={{ height: 56, background: dark ? '#1F2229' : '#ECECEA', display: 'flex', alignItems: 'center', gap: 34, paddingLeft: 40, fontFamily: 'Noto Sans SC', fontWeight: 700, fontSize: 19, color: dim }}>
        {['File', 'Edit', 'View', 'Terminal', 'Help'].map((m) => (
          <span key={m}>{m}</span>
        ))}
        <span style={{ marginLeft: 'auto', marginRight: 40 }}>~/pomodoro · zsh</span>
      </div>
      {rows.map((r, i) => {
        const top = rowTop(i);
        if (r.kind === 'blank') return null;
        if (r.kind === 'cmd')
          return (
            <div key={i} style={{ position: 'absolute', left: 20, right: 0, top: top + 4, height: ROW_H - 8, background: bar, color: '#FFFFFF', paddingLeft: 18, lineHeight: `${ROW_H - 8}px` }}>
              {'> '}
              {r.text}
            </div>
          );
        if (r.kind === 'code')
          return (
            <div key={i} style={{ position: 'absolute', left: 60, right: 50, top: top + 4, height: ROW_H - 8, background: dark ? '#1C3B25' : '#1F6B34', color: '#FFFFFF', paddingLeft: 12, lineHeight: `${ROW_H - 8}px` }}>
              {r.text}
            </div>
          );
        return (
          <div key={i} style={{ position: 'absolute', left: r.kind === 'bullet' ? 24 : 44, top, height: ROW_H, lineHeight: `${ROW_H}px`, color: r.kind === 'dim' ? dim : fg, whiteSpace: 'pre' }}>
            {r.kind === 'bullet' ? '● ' : ''}
            {r.text}
          </div>
        );
      })}
    </div>
  );
};

/** 假 AI 对话界面(英文回答),段落位置固定,好算 crop */
const CHAT_PARAS = [
  { top: 300, text: 'Short answer: yes, but not with the default settings.' },
  { top: 350, text: 'The free tier caps context at 32k tokens, so long PDFs get silently truncated.' },
  { top: 400, text: 'Switch to the Pro model and enable "Extended context" in Settings → Model.' },
  { top: 450, text: 'Then upload the file again — it will read all 180 pages in one pass.' },
];
const FakeChat: React.FC = () => (
  <div style={{ position: 'absolute', inset: 0, background: '#F4F1EA', fontFamily: 'Space Mono', color: '#2B2A27' }}>
    <div style={{ height: 64, borderBottom: '1px solid #DDD8CC', display: 'flex', alignItems: 'center', paddingLeft: 48, fontFamily: 'Noto Sans SC', fontWeight: 800, fontSize: 24 }}>
      AI Assistant
    </div>
    <div style={{ position: 'absolute', right: 80, top: 120, maxWidth: 820, padding: '18px 26px', borderRadius: 20, background: '#E3DCCB', fontSize: 22, lineHeight: '34px' }}>
      Can it read a 180-page PDF and summarize every chapter?
    </div>
    <div style={{ position: 'absolute', left: 80, top: 240, width: 36, height: 36, borderRadius: 18, background: '#D97757' }} />
    {CHAT_PARAS.map((p) => (
      <div key={p.top} style={{ position: 'absolute', left: 140, top: p.top, fontSize: 22, lineHeight: '34px', whiteSpace: 'pre' }}>
        {p.text}
      </div>
    ))}
    <div style={{ position: 'absolute', left: 80, right: 80, bottom: 60, height: 70, borderRadius: 35, background: '#FFFFFF', border: '1px solid #DDD8CC', paddingLeft: 36, lineHeight: '70px', fontSize: 20, color: '#9A958A' }}>
      Reply to AI Assistant…
    </div>
  </div>
);

// ───────────────────────── Variants ─────────────────────────

/** 变体里各段出现时刻压紧(帧 @30fps,相对变体起点),免得每段等 13 秒 */
const FAST = { highlight: { at: 36 }, focusAt: 62, pointAt: [96, 114, 132, 150], tagAt: [168, 190, 212] };
const pts = (xs: string[]) => xs.map((text, i) => ({ text, at: FAST.pointAt[i] }));
const tgs = (xs: string[]) => xs.map((text, i) => ({ text, at: FAST.tagAt[i] }));

type Variant = { label: string; bg?: string; props: ScreenExplainProps };

const VARIANTS: Variant[] = [
  {
    label: '① 原样式:终端输出 4 行 + 高亮 + 聚焦 + 3 要点 + 2 标签',
    props: {
      recording: <FakeTerminal />,
      crop: { x: 12, y: rowTop(4), width: 1100, height: ROW_H * 6 },
      lines: [
        '我会检查 src/ 里的改动，合并前先排查有没有引入新问题。',
        '先跑一遍测试，再看改过的三个模块。',
        { text: '已运行 42 个测试（按 Ctrl+O 展开）', color: '#6F6F6F' },
        { text: '测试全过。我找到 2 处有风险的改动：cache.ts 的竞态和 api.ts 的空值。', highlights: ['2 处有风险的改动'] },
      ],
      highlight: FAST.highlight,
      focus: { line: 3, text: '我找到 2 处有风险的改动：cache.ts 的竞态和 api.ts 的空值。', at: FAST.focusAt },
      points: pts(['测试覆盖', '并发安全', '空值检查']),
      tags: tgs(['合并前修', '已给方案']),
    },
  },
  {
    label: '② 抠小区域:一行报错 → 放大到限高 + 2 条解释',
    props: {
      recording: <FakeTerminal />,
      crop: { x: 12, y: rowTop(11), width: 900, height: ROW_H * 2 },
      card: { maxHeight: 300 },
      lines: [
        { text: '报错：找不到 .env.local 这个文件。', highlights: ['找不到 .env.local'] },
        { text: '意思是：你的密钥配置文件还没建，程序读不到 Key。', color: '#555555' },
      ],
      highlight: FAST.highlight,
      focus: { line: 1, at: FAST.focusAt + 20 },
      tags: tgs(['先建配置文件']).map((t) => ({ ...t, at: 130 })),
    },
  },
  {
    label: '③ 抠大区域:半屏输出 → 5 条解释 + 2 处高亮',
    props: {
      recording: <FakeTerminal />,
      crop: { x: 12, y: rowTop(1), width: 1500, height: ROW_H * 9 },
      lines: [
        { text: '构建完成：2.41 秒，14 个模块。', color: '#6F6F6F' },
        '我会检查 src/ 里的改动，合并前先排查有没有引入新问题。',
        '先跑一遍测试，再看改过的三个模块。',
        { text: '测试全过，但有 2 处有风险的改动。', highlights: ['2 处有风险'] },
        { text: '建议：给 refresh() 加锁，用 response.data 之前先判空。', highlights: ['加锁', '先判空'] },
      ],
      highlight: FAST.highlight,
      focus: { line: 4, at: FAST.focusAt },
      points: pts(['加锁', '判空']),
    },
  },
  {
    label: '④ AI 对话界面 · 解释 2 条 + 1 标签',
    bg: 'linear-gradient(160deg,#1B2430,#0E1116)',
    props: {
      recording: <FakeChat />,
      crop: { x: 120, y: 290, width: 1080, height: 200 },
      lines: [
        { text: '能读，但默认设置不行：免费版上下文只有 32k，长 PDF 会被悄悄截断。', highlights: ['悄悄截断'] },
        '换 Pro 模型，在「设置 → 模型」里打开“长上下文”，重新上传就能一次读完 180 页。',
      ],
      highlight: FAST.highlight,
      focus: { line: 1, text: '打开“长上下文”', at: FAST.focusAt },
      points: pts(['换 Pro', '开长上下文']),
      tags: tgs(['一次读完']),
    },
  },
  {
    label: '⑤ 深色终端 · 解释 5 条(长句自动折行)',
    props: {
      recording: <FakeTerminal dark />,
      crop: { x: 12, y: rowTop(4), width: 1100, height: ROW_H * 6 },
      card: { color: '#1C1F26' },
      textColor: '#F2F2F2',
      lines: [
        '我来审查 src/ 目录里的改动：合并之前先排查一遍有没有引入新的问题，再看看哪些地方能顺手优化，比如重复的请求、没用上的依赖、写死在代码里的配置和已经过期的注释。',
        '第一步跑测试。',
        { text: '已运行 42 个测试', color: '#8A909C' },
        { text: '全部通过，但有 2 处改动有风险。', highlights: ['2 处改动有风险'] },
        '建议给 refresh() 加锁。',
      ],
      highlight: { ...FAST.highlight, color: '#FFB020' },
      focus: { line: 3, at: FAST.focusAt, opacity: 0.85 },
      points: pts(['并发', '空值', '回归', '性能']),
      tags: tgs(['要修']),
    },
  },
  {
    label: '⑥ 换配色 + speed 1.3:蓝高亮 / 黄要点 / 粉标签',
    bg: 'linear-gradient(160deg,#241B2F,#0F0B14)',
    props: {
      recording: <FakeTerminal />,
      crop: { x: 12, y: rowTop(7), width: 1100, height: ROW_H * 3 },
      lines: [
        { text: '已运行 42 个测试', color: '#6F6F6F' },
        { text: '全部通过。发现 2 处风险：cache.ts 竞态、api.ts 空值。', highlights: ['2 处风险'] },
        '建议：refresh() 加锁，读 data 前先判空。',
      ],
      highlight: { ...FAST.highlight, color: '#4DA3FF' },
      focus: { line: 1, text: '发现 2 处风险：cache.ts 竞态、api.ts 空值。', at: FAST.focusAt },
      points: pts(['cache.ts', 'api.ts']),
      pointColor: '#FFE45C',
      tags: tgs(['马上修', '别合并']).map((t) => ({ ...t, color: '#FF5CA8', textColor: '#FFFFFF' })),
      speed: 1.3,
      frame: { color: '#FFE45C' },
    },
  },
];

const SLOT = 270;
export const VARIANTS_DURATION = SLOT * VARIANTS.length;

export const ScreenExplainVariants: React.FC = () => (
  <AbsoluteFill style={{ background: '#000', WebkitFontSmoothing: 'antialiased' }}>
    {VARIANTS.map((v, i) => (
      <Sequence key={i} from={i * SLOT} durationInFrames={SLOT}>
        <AbsoluteFill style={{ background: v.bg ?? 'radial-gradient(ellipse at 50% 40%,#1A1D24,#050608 70%)' }}>
          <ScreenExplain {...v.props} delayFrames={12} />
          <Label>{v.label}</Label>
        </AbsoluteFill>
      </Sequence>
    ))}
  </AbsoluteFill>
);
