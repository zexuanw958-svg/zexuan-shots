/**
 * 17 · 问号目录 + 卷页切进录屏
 *
 * 本章目录里讲过的显示文字，没讲的显示「???」，问号一个接一个弹出，讲到哪条就出橙框和箭头，还能当场翻绿揭晓；接着新画面（录屏）像一页纸从窗口右下角卷进来，0.5 秒落平。适合章节目录和从 B-roll 切进录屏。
 *
 * 组件:src/kit/components/QuestionToc.tsx(QuestionToc + CurlIntoScreen + SectionOpener)。本文件是它的变体演示,Studio 里选 composition「QuestionTocVariants」。
 * 左上角 / 底部的小字是变体说明;渲染时加 --props='{"clean":true}' 就不画。
 * 参考：秋芝《Claude Code 全解》6:53 小节开头，逐帧复刻。
 */
import React from 'react';
import { AbsoluteFill, Sequence, staticFile, getInputProps } from 'remotion';
import { QuestionToc } from '../../kit/components/QuestionToc';
import { CurlIntoScreen } from '../../kit/components/CurlIntoScreen';
import { SectionOpener, QiuzhiDotGrid, sectionOpenerDurationInFrames } from '../../kit/components/SectionOpener';

// --props='{"clean":true}' 时不画调试角标,渲对外展示的干净版
const Label: React.FC<{ children: React.ReactNode; top?: boolean }> = (p) => (getInputProps().clean ? null : <LabelBox {...p} />);

const LabelBox: React.FC<{ children: React.ReactNode; top?: boolean }> = ({ children, top }) => (
  <div
    style={{
      position: 'absolute',
      right: 40,
      ...(top ? { top: 32 } : { bottom: 32 }),
      padding: '8px 18px',
      borderRadius: 10,
      background: 'rgba(40,40,40,.85)',
      color: '#FFFFFF',
      fontFamily: 'Noto Sans SC',
      fontWeight: 700,
      fontSize: 30,
      zIndex: 10,
    }}
  >
    {children}
  </div>
);

// ───────────── Variants(不含秋芝画面) ─────────────
/** 代码画的假录屏界面:浏览器窗 + 侧栏 + 代码块 */
const FakeScreen: React.FC<{ title?: string }> = ({ title = 'docs.example.dev / 安装指南' }) => (
  <AbsoluteFill style={{ background: '#FBFAF7', fontFamily: 'Noto Sans SC', color: '#2A2825' }}>
    <div style={{ height: 70, background: '#EFEDE8', display: 'flex', alignItems: 'center', gap: 14, padding: '0 28px' }}>
      {['#E8665A', '#F2BE4F', '#62C554'].map((c) => (
        <div key={c} style={{ width: 20, height: 20, borderRadius: 10, background: c }} />
      ))}
      <div style={{ marginLeft: 30, flex: 1, height: 40, borderRadius: 20, background: '#FFFFFF', fontSize: 22, lineHeight: '40px', paddingLeft: 24, color: '#6E6A60' }}>{title}</div>
    </div>
    <div style={{ position: 'absolute', left: 0, top: 70, bottom: 0, width: 330, background: '#F4F2EE', padding: 34 }}>
      {['快速开始', '安装', '配置', '常见问题', '更新日志'].map((t, i) => (
        <div key={t} style={{ fontSize: 26, fontWeight: 700, margin: '0 0 26px', padding: '8px 14px', borderRadius: 8, background: i === 1 ? '#E6E2DA' : undefined }}>{t}</div>
      ))}
    </div>
    <div style={{ position: 'absolute', left: 390, top: 120, right: 70 }}>
      <div style={{ fontSize: 50, fontWeight: 800, marginBottom: 26 }}>一行命令安装</div>
      <div style={{ fontSize: 26, color: '#6E6A60', marginBottom: 30 }}>macOS、Linux、WSL 都可以直接用:</div>
      <div style={{ background: '#1F1E1C', color: '#E6E1D6', fontFamily: 'Space Mono', fontSize: 28, borderRadius: 14, padding: '26px 30px' }}>
        <span style={{ color: '#E07B39' }}>$</span> curl -fsSL https://example.dev/install.sh | bash
      </div>
      <div style={{ fontSize: 26, color: '#6E6A60', margin: '34px 0 22px' }}>Windows PowerShell:</div>
      <div style={{ background: '#1F1E1C', color: '#E6E1D6', fontFamily: 'Space Mono', fontSize: 28, borderRadius: 14, padding: '26px 30px' }}>
        <span style={{ color: '#E07B39' }}>&gt;</span> irm https://example.dev/install.ps1 | iex
      </div>
    </div>
  </AbsoluteFill>
);

/** B-roll 卡:渐变底 + 大字 */
const BrollCard: React.FC = () => (
  <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 40% 35%, #F3B27A 0%, #C9662A 45%, #3A2416 100%)', justifyContent: 'center', alignItems: 'center' }}>
    <div style={{ fontFamily: 'AlimamaFangYuanTi', fontWeight: 800, fontSize: 150, color: '#FFF9E3', textShadow: '0 8px 40px rgba(0,0,0,.35)' }}>先把环境装好</div>
    <div style={{ fontFamily: 'Noto Sans SC', fontWeight: 700, fontSize: 44, color: '#FFF9E3', opacity: 0.8, marginTop: 30 }}>B-roll 占位卡</div>
  </AbsoluteFill>
);

const DarkPage: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill>
    <QiuzhiDotGrid />
    {children}
  </AbsoluteFill>
);

const FAST = { rowsAt: 8, noteAt: 30, highlightAt: 70, flipAt: 100 };

type Variant = { label: string; duration: number; node: React.ReactNode };

const OPENER_OPTS = { titleFrames: 36, tocFrames: 130, tailFrames: 40 };

const VARIANTS: Variant[] = [
  {
    label: '原结构换内容:配置 MCP · 方案A 揭晓',
    duration: 150,
    node: (
      <DarkPage>
        <QuestionToc
          header={{ text: '配置 MCP 服务器', icon: staticFile('demo/check-icon.svg') }}
          note="（Claude、Codex 都能用）"
          items={[{ label: '方案A：', answer: '改配置文件' }, { label: '方案B：' }]}
          current={0}
          timing={FAST}
        />
      </DarkPage>
    ),
  },
  {
    label: '3 条目录 · 点名第 1 条(不揭晓)',
    duration: 130,
    node: (
      <DarkPage>
        <QuestionToc
          header={{ text: '搞钱三步走', icon: staticFile('demo/check-icon.svg') }}
          items={[{ label: '第1步：' }, { label: '第2步：' }, { label: '第3步：' }]}
          current={0}
          flipCurrent={false}
          timing={{ ...FAST, highlightAt: 80 }}
        />
      </DarkPage>
    ),
  },
  {
    label: '6 条目录 · 无页眉 · 自动缩排',
    duration: 140,
    node: (
      <DarkPage>
        <QuestionToc
          items={['1', '2', '3', '4', '5', '6'].map((d) => ({ label: `技巧${d}：` }))}
          area={{ top: 90, bottom: 990 }}
          timing={{ rowsAt: 8 }}
          rowStaggerFrames={4}
        />
      </DarkPage>
    ),
  },
  {
    label: '讲到第 2 条:前 2 条显文字,其余问号',
    duration: 130,
    node: (
      <DarkPage>
        <QuestionToc
          header={{ text: 'Codex 四种用法', icon: staticFile('demo/check-icon.svg') }}
          items={[
            { label: '用法1：', answer: '网页版' },
            { label: '用法2：', answer: '命令行' },
            { label: '用法3：', answer: 'IDE 插件' },
            { label: '用法4：', answer: '云端任务' },
          ]}
          doneCount={2}
          current={1}
          timing={{ ...FAST, highlightAt: 75 }}
        />
      </DarkPage>
    ),
  },
  {
    label: '卷页单独当转场:B-roll 卡 → 假录屏(整屏卷)',
    duration: 70,
    node: (
      <Sequence from={24} layout="none">
        <CurlIntoScreen from={<BrollCard />} to={<FakeScreen />} window="full" frameFlash={false} />
      </Sequence>
    ),
  },
  {
    label: '三段整套:发光标题 → 问号目录 → 卷页进录屏',
    duration: sectionOpenerDurationInFrames(30, OPENER_OPTS),
    node: (
      <SectionOpener
        title={{ text: '装好环境', fontFamily: 'AlibabaPuHuiTi' }}
        toc={{
          header: { text: '装好开发环境', icon: staticFile('demo/check-icon.svg') },
          note: '（Mac、Win 通用）',
          items: [{ label: '方法1：', answer: '命令安装' }, { label: '方法2：' }],
          current: 0,
          timing: { rowsAt: 6, noteAt: 26, highlightAt: 60, flipAt: 95 },
        }}
        to={<FakeScreen />}
        {...OPENER_OPTS}
      />
    ),
  },
];

const OFFSETS = VARIANTS.reduce<number[]>((acc, v, i) => [...acc, (acc[i] ?? 0) + v.duration], [0]);
export const VARIANTS_DURATION = OFFSETS[OFFSETS.length - 1];

export const QuestionTocVariants: React.FC = () => (
  <AbsoluteFill style={{ background: '#000', WebkitFontSmoothing: 'antialiased' }}>
    {VARIANTS.map((v, i) => (
      <Sequence key={v.label} from={OFFSETS[i]} durationInFrames={v.duration} layout="none">
        {v.node}
        <Label>{`${i + 1}/${VARIANTS.length}  ${v.label}`}</Label>
      </Sequence>
    ))}
  </AbsoluteFill>
);
