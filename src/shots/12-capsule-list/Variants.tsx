/**
 * 12 · 编号胶囊清单 → 证据页
 *
 * 黑底标题硬切出来，几行「彩色编号胶囊 + 空槽」整组升起，每条字闪几下落定；最后清单压暗，一张证据截图滑上来，荧光笔划出关键那句。适合「第一、第二……」逐条讲，再点进某条看证据。
 *
 * 组件:src/kit/components/CapsuleList.tsx(CapsuleList)。本文件是它的变体演示,Studio 里选 composition「CapsuleListVariants」。
 * 左上角 / 底部的小字是变体说明;渲染时加 --props='{"clean":true}' 就不画。
 * 参考：秋芝《40 分钟学会 Codex》19:42「自动记忆原则」，逐帧复刻。
 */
import React from 'react';
import { AbsoluteFill, Sequence, staticFile, getInputProps } from 'remotion';
import { CapsuleList, type CapsuleListProps } from '../../kit/components/CapsuleList';

// --props='{"clean":true}' 时不画调试角标,渲对外展示的干净版
const Label: React.FC<{ children: React.ReactNode }> = (p) => (getInputProps().clean ? null : <LabelBox {...p} />);

const LabelBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      position: 'absolute',
      left: 40,
      bottom: 24,
      padding: '8px 18px',
      borderRadius: 10,
      background: 'rgba(40,40,40,.75)',
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

// ── 变体 ──

/** 代码画的假界面(设置页),1400×820,第 4 行是荧光笔要划的那句 */
const FakeSettings: React.FC = () => {
  const rows = [
    ['自动保存', '每 5 分钟'],
    ['历史记录', '保留 30 天'],
    ['同步范围', '仅本机'],
    ['记忆文件', '请勿手动编辑,改动会被覆盖'],
    ['导出格式', 'Markdown'],
  ];
  return (
    <div style={{ width: '100%', height: '100%', background: '#F7F7F8', fontFamily: 'Noto Sans SC', color: '#1F2328' }}>
      <div style={{ height: 64, background: '#E9E9EC', display: 'flex', alignItems: 'center', gap: 14, paddingLeft: 26 }}>
        {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
          <div key={c} style={{ width: 20, height: 20, borderRadius: 10, background: c }} />
        ))}
        <div style={{ marginLeft: 30, fontSize: 28, fontWeight: 700, color: '#555' }}>设置 · 记忆</div>
      </div>
      <div style={{ display: 'flex', height: 756 }}>
        <div style={{ width: 300, background: '#EFEFF2', padding: '30px 0' }}>
          {['通用', '记忆', '外观', '快捷键', '账户'].map((x, i) => (
            <div key={x} style={{ fontSize: 30, fontWeight: 700, padding: '18px 40px', background: i === 1 ? '#DADAE0' : undefined }}>
              {x}
            </div>
          ))}
        </div>
        <div style={{ flex: 1, padding: '34px 50px' }}>
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', height: 118, alignItems: 'center', borderBottom: '2px solid #E2E2E6', fontSize: 34, fontWeight: 700 }}>
              <div style={{ width: 230, color: '#6A6F76' }}>{k}</div>
              <div>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

type Variant = { label: string; duration: number; props: CapsuleListProps };

/** 变体里节奏压紧:第 i 条 at = 24 + 22·i,证据页在最后一条落定后 25 帧 */
const quick = (n: number, withEvidence: boolean) => {
  const at = (i: number) => 24 + 22 * i;
  const evAt = at(n - 1) + 15 + 25;
  return { at, evAt, hlAt: evAt + 36, duration: withEvidence ? evAt + 36 + 23 + 40 : at(n - 1) + 15 + 55 };
};

const q2 = quick(2, true);
const q3 = quick(3, false);
const q5 = quick(5, true);
const q4 = quick(4, true);
const q6 = quick(6, false);

const VARIANTS: Variant[] = [
  {
    label: '原结构换词 · 2 条 + 截图证据 + 荧光笔',
    duration: q2.duration,
    props: {
      title: '心态稳住的两条规矩',
      items: [
        { text: '先深呼吸', at: q2.at(0) },
        { text: '再拆小任务', at: q2.at(1) },
      ],
      evidence: {
        src: staticFile('demo/ui-card.jpg'),
        aspect: 1600 / 1053,
        at: q2.evAt,
        highlightAt: q2.hlAt,
        highlight: { x: 0.4375, y: 0.44, width: 0.305, height: 0.052, relative: true },
      },
    },
  },
  {
    label: '2 条 · 证据换成视频(录屏平移)',
    duration: q2.duration + 30,
    props: {
      title: '为什么要开自动记忆',
      items: [
        { text: '省掉重复交代', at: q2.at(0) },
        { text: '换电脑也能接着聊', at: q2.at(1) },
      ],
      evidence: { src: staticFile('demo/ui-clip.mp4'), type: 'video', aspect: 16 / 9, at: q2.evAt, radius: 18 },
    },
  },
  {
    label: '3 条 · 只有清单,没有证据页',
    duration: q3.duration,
    props: {
      title: '三个判断标准',
      items: [
        { text: '能不能复现', at: q3.at(0) },
        { text: '有没有官方出处', at: q3.at(1) },
        { text: '花不花钱', at: q3.at(2) },
      ],
    },
  },
  {
    label: '5 条 · 自动缩放 + 截图证据',
    duration: q5.duration,
    props: {
      title: '上手前先检查五件事',
      items: [
        { text: '账号已登录', at: q5.at(0) },
        { text: '额度够用', at: q5.at(1) },
        { text: '项目目录选对', at: q5.at(2) },
        { text: '权限开到只读', at: q5.at(3) },
        { text: '先让它读说明文档再动手', at: q5.at(4) },
      ],
      evidence: {
        src: staticFile('demo/ui-card.jpg'),
        aspect: 1600 / 1053,
        at: q5.evAt,
        highlightAt: q5.hlAt,
        highlight: { x: 0.6, y: 0.594, width: 0.104, height: 0.032, relative: true },
      },
    },
  },
  {
    label: '4 条 · 证据换成代码画的假界面',
    duration: q4.duration,
    props: {
      title: '记忆文件的四个坑',
      items: [
        { text: '会被自动覆盖', at: q4.at(0) },
        { text: '不跨设备同步', at: q4.at(1) },
        { text: '过期会清理', at: q4.at(2) },
        { text: '别手动改', at: q4.at(3) },
      ],
      evidence: {
        content: <FakeSettings />,
        box: { x: 260, y: 130, width: 1400, height: 820 },
        radius: 16,
        shadow: '0 20px 60px rgba(0,0,0,.45)',
        at: q4.evAt,
        highlightAt: q4.hlAt,
        highlight: { x: 572, y: 486, width: 470, height: 52 },
      },
    },
  },
  {
    label: '换配色 · 纸底墨字 · 6 条 · 编号 A–F',
    duration: q6.duration,
    props: {
      title: '六种常见报错',
      background: '#F6F0E5',
      textColor: '#1C1B17',
      strokeColor: '#1C1B17',
      titleColor: '#1C1B17',
      digitColor: '#1C1B17',
      palette: ['#E07B39', '#4B8A80', '#E8C15A', '#D98A7A', '#8FB3A9', '#C9A77C'],
      items: ['网络超时', '额度不足', '权限被拒', '文件太大', '格式不对', '模型不可用'].map((text, i) => ({
        text,
        label: 'ABCDEF'[i],
        at: q6.at(i),
      })),
    },
  },
];

export const VARIANT_STARTS = VARIANTS.reduce<number[]>((acc, v, i) => [...acc, i === 0 ? 0 : acc[i - 1] + VARIANTS[i - 1].duration], []);
export const VARIANTS_DURATION = VARIANTS.reduce((a, v) => a + v.duration, 0);

export const CapsuleListVariants: React.FC = () => (
  <AbsoluteFill style={{ background: '#000', WebkitFontSmoothing: 'antialiased' }}>
    {VARIANTS.map((v, i) => (
      <Sequence key={v.label} from={VARIANT_STARTS[i]} durationInFrames={v.duration} layout="none">
        <CapsuleList {...v.props} />
        <Label>{`${i + 1}/${VARIANTS.length}  ${v.label}`}</Label>
      </Sequence>
    ))}
  </AbsoluteFill>
);
