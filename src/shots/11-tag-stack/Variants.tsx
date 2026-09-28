/**
 * 11 · 标签堆叠 · 关键词色块跟着口播往下堆
 *
 * 画面一侧放 AI 视频、人物口播或截图，另一侧的彩色标签跟着口播一个一个冒出来往下堆。黄 = 要点、荧光绿 = 结论、红 = 警示、橙 = 指这里。适合列举几个关键词。
 *
 * 组件:src/kit/components/TagStack.tsx(TagStack)。本文件是它的变体演示,Studio 里选 composition「TagStackVariants」。
 * 左上角 / 底部的小字是变体说明;渲染时加 --props='{"clean":true}' 就不画。
 * 参考：秋芝《Claude Code 全解》4:56，逐帧复刻。
 */
import React from 'react';
import { AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame, getInputProps } from 'remotion';
import { TagStack, type TagStackProps } from '../../kit/components/TagStack';

// --props='{"clean":true}' 时不画调试角标,渲对外展示的干净版
const Label: React.FC<{ children: React.ReactNode; top?: boolean }> = (p) => (getInputProps().clean ? null : <LabelBox {...p} />);

const LabelBox: React.FC<{ children: React.ReactNode; top?: boolean }> = ({ children, top }) => (
  <div
    style={{
      position: 'absolute',
      left: 40,
      ...(top ? { top: 28 } : { bottom: 28 }),
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

// ── 中性占位主体 ──

/** 代码画的「AI 视频」:深色渐变 + 几团缓慢游动的光斑(帧驱动,确定性) */
const FakeAiVideo: React.FC<{ hue?: number }> = ({ hue = 265 }) => {
  const frame = useCurrentFrame();
  const blobs = [0, 1, 2, 3].map((k) => {
    const a = frame / 90 + k * 1.7;
    return {
      x: 700 + Math.cos(a) * (260 + k * 60) - k * 120,
      y: 520 + Math.sin(a * 1.3) * (180 + k * 30),
      r: 380 - k * 50,
      h: hue + k * 28,
    };
  });
  return (
    <AbsoluteFill style={{ background: `linear-gradient(135deg, hsl(${hue},45%,12%) 0%, hsl(${hue + 40},40%,22%) 100%)` }}>
      {blobs.map((b, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: b.x - b.r,
            top: b.y - b.r,
            width: b.r * 2,
            height: b.r * 2,
            borderRadius: '50%',
            background: `radial-gradient(circle, hsla(${b.h},90%,62%,0.55) 0%, hsla(${b.h},90%,50%,0) 70%)`,
          }}
        />
      ))}
      <div style={{ position: 'absolute', left: 520, top: 360, width: 360, height: 360, borderRadius: 60, border: '6px solid rgba(255,255,255,0.35)', rotate: `${frame * 0.4}deg` }} />
    </AbsoluteFill>
  );
};

/** 代码画的假界面:浅色窗口 + 侧栏 + 几张卡片 */
const FakeUi: React.FC = () => (
  <AbsoluteFill style={{ background: 'linear-gradient(160deg,#EEF2F7,#DCE4EE)', fontFamily: 'Noto Sans SC', fontWeight: 700 }}>
    <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: 64, background: '#FFFFFF', borderBottom: '2px solid #D5DCE6' }}>
      {['#FF5F57', '#FEBC2E', '#28C840'].map((c, i) => (
        <div key={c} style={{ position: 'absolute', left: 28 + i * 34, top: 22, width: 20, height: 20, borderRadius: 10, background: c }} />
      ))}
    </div>
    <div style={{ position: 'absolute', left: 0, top: 64, width: '22%', bottom: 0, background: '#F7F9FC', borderRight: '2px solid #D5DCE6' }}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} style={{ margin: '30px 28px 0', height: 26, borderRadius: 8, background: i === 1 ? '#C9D6EA' : '#E3E9F1' }} />
      ))}
    </div>
    <div style={{ position: 'absolute', left: '27%', top: '16%', fontSize: 54, color: '#1C2430' }}>今天要做什么?</div>
    {[0, 1, 2, 3].map((i) => (
      <div
        key={i}
        style={{ position: 'absolute', left: `${27 + (i % 2) * 34}%`, top: `${34 + Math.floor(i / 2) * 26}%`, width: '31%', height: '21%', borderRadius: 18, background: '#FFFFFF', boxShadow: '0 6px 20px rgba(30,50,80,0.12)' }}
      >
        <div style={{ margin: '28px 30px 0', width: 48, height: 48, borderRadius: 12, background: ['#7AA7FF', '#FFB36B', '#7ED9A6', '#C79BFF'][i] }} />
        <div style={{ margin: '22px 30px 0', height: 22, width: '70%', borderRadius: 8, background: '#E3E9F1' }} />
      </div>
    ))}
  </AbsoluteFill>
);

const Speaker: React.FC = () => (
  <OffthreadVideo src={staticFile('demo/speaker-placeholder.mp4')} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
);

/** 变体 7 的口播示意条:模拟口播念到哪儿 */
const SpokenLine: React.FC<{ words: Array<[number, string]> }> = ({ words }) => {
  const frame = useCurrentFrame();
  const said = words.filter(([at]) => frame >= at).map(([, w]) => w).join('');
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 890, display: 'flex', justifyContent: 'center' }}>
      <span style={{ fontFamily: 'SmileySansV1', fontSize: 50, color: '#FFFFFF', background: 'rgba(0,0,0,0.8)', padding: '6px 12px', borderRadius: 9, whiteSpace: 'pre' }}>
        {said || ' '}
      </span>
    </div>
  );
};

type Variant = { label: string; props: TagStackProps; extra?: React.ReactNode; slot?: number };

const VARIANTS: Variant[] = [
  {
    label: '原样式换词:全屏 AI 视频 + 右侧 6 个绿标签',
    props: { subject: <FakeAiVideo />, tags: ['写脚本', '剪视频', '做封面', '配字幕', '写标题', '回评论'], firstAt: 12 },
  },
  {
    label: '2 个标签 · 左侧人物面板 · 居中对齐',
    props: { subject: <Speaker />, subjectLayout: 'panel', align: 'center', tags: ['会说人话', '不装腔'], firstAt: 20, stagger: 30 },
  },
  {
    label: '7 个标签 · 自动缩小不压字幕带',
    props: { subject: <FakeAiVideo hue={200} />, tags: ['读文件', '改代码', '跑测试', '查报错', '写文档', '提交代码', '开 PR'], firstAt: 12, stagger: 18 },
  },
  {
    label: '主体换成截图 / 假界面(面板)',
    props: { subject: <Img src={staticFile('demo/app-screenshot-wide.png')} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />, subjectLayout: 'panel', tags: ['换皮肤', '换背景', '换字体'], firstAt: 16, align: 'center' },
  },
  {
    label: '主体在右 · 标签站左(暗渐变自动翻到左边)',
    props: { subject: <Speaker />, subjectSide: 'right', tags: ['先装好', '再登录', '最后提问'], firstAt: 14 },
  },
  {
    label: '颜色语义混用:黄=要点 绿=结论 红=警示 橙=指这里',
    props: {
      subject: <FakeUi />,
      tags: [
        { text: '要点:先备份', tone: 'point' },
        { text: '能直接用', tone: 'positive' },
        { text: '别删系统盘', tone: 'warn' },
        { text: '点这里', tone: 'here' },
      ],
      firstAt: 12,
    },
  },
  {
    label: '按口播手动时刻(at 对准念到的词)',
    props: {
      subject: <FakeAiVideo hue={320} />,
      tags: [
        { text: '查资料', at: 18 },
        { text: '做表格', at: 44 },
        { text: '写报告', at: 58 },
        { text: '发邮件', at: 110 },
      ],
    },
    extra: <SpokenLine words={[[10, '它能帮你'], [18, '查资料、'], [44, '做表格、'], [58, '写报告,'], [80, '甚至……'], [110, '发邮件']]} />,
  },
];

const SLOT = 210;
export const VARIANTS_DURATION = SLOT * VARIANTS.length;

export const TagStackVariants: React.FC = () => (
  <AbsoluteFill style={{ background: '#0B0B0D' }}>
    {VARIANTS.map((v, i) => (
      <Sequence key={v.label} from={i * SLOT} durationInFrames={SLOT} layout="none">
        <TagStack {...v.props} />
        {v.extra}
        <Label>{`${i + 1}/${VARIANTS.length}  ${v.label}`}</Label>
      </Sequence>
    ))}
  </AbsoluteFill>
);
