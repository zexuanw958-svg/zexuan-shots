/**
 * 18 · 像素关卡地图 · 章节进度过关转场
 *
 * 黑底像素轨道上每章一个圆点：绿 = 讲完、红旗 = 正在讲、白 = 还没讲。「过关」时小人原地跑、地图左移一格，旧旗拔起飞走、新旗落下弹一下，当前章节名挂在头顶。适合长视频多章节，像闯关。
 *
 * 组件:src/kit/components/PixelLevelMap.tsx(PixelLevelMap)。本文件是它的变体演示,Studio 里选 composition「PixelLevelMapVariants」。
 * 左上角 / 底部的小字是变体说明;渲染时加 --props='{"clean":true}' 就不画。
 * 参考：秋芝《Claude Code 全解》29:33，逐帧复刻。
 */
import React from 'react';
import { AbsoluteFill, Sequence, getInputProps } from 'remotion';
import { PixelLevelMap, type PixelAvatarState, type PixelLevelMapProps } from '../../kit/components/PixelLevelMap';

// --props='{"clean":true}' 时不画调试角标,渲对外展示的干净版
const Label: React.FC<{ children: React.ReactNode; top?: boolean }> = (p) => (getInputProps().clean ? null : <LabelBox {...p} />);

const LabelBox: React.FC<{ children: React.ReactNode; top?: boolean }> = ({ children, top }) => (
  <div
    style={{
      position: 'absolute',
      left: 40,
      ...(top ? { top: 32 } : { bottom: 32 }),
      padding: '8px 18px',
      borderRadius: 10,
      background: 'rgba(40,40,48,.85)',
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

// ── 变体里的「另一个占位形象」:代码画的小机器人,演示 avatar 传渲染函数、按动作阶段自己换帧 ──
const R_P = 14;
const R_COLORS: Record<string, string> = {
  K: '#15171C',
  M: '#C9D1DC',
  m: '#8B96A6',
  V: '#2AD4C5',
  A: '#FFCB3D',
  a: '#6B5A2A',
  W: '#3B4250',
  G: '#2A2A30',
};
const ROBOT_BASE = [
  '.......KK.......',
  '.......Aa.......',
  '.......KK.......',
  '...KKKKKKKKKK...',
  '..KMMMMMMMMMMK..',
  '..KMKKKKKKKKMK..',
  '..KMKVVKKVVKMK..',
  '..KMKVVKKVVKMK..',
  '..KMKKKKKKKKMK..',
  '..KMMMMMMMMMMK..',
  '...KKKKKKKKKK...',
  '....KmmmmmmK....',
  '..KKMMMMMMMMKK..',
  '.KMKMMWWWWMMKMK.',
  '.KMKMMWVVWMMKMK.',
  '.KMKMMWWWWMMKMK.',
  '.KKKMMMMMMMMKKK.',
  '....KmmmmmmK....',
  '....KWK..KWK....',
  '....KWK..KWK....',
  '...KWWK..KWWK...',
  '...KKKK..KKKK...',
  '..GGGGGGGGGGGG..',
];
const paintRows = (grid: string[], rows: Array<[number, string]>) =>
  grid.map((row, i) => {
    const o = rows.find(([r]) => r === i);
    return o ? o[1] : row;
  });
const ROBOT_RUN_A = paintRows(ROBOT_BASE, [
  [18, '...KWK....KWK...'],
  [19, '..KWK......KWK..'],
  [20, '.KWWK......KWWK.'],
  [21, '.KKKK......KKKK.'],
]);
const ROBOT_CHEER = paintRows(ROBOT_BASE, [
  [1, '.......AA.......'],
  [9, 'K.KMMMMMMMMMMK.K'],
  [10, 'MK.KKKKKKKKKK.KM'],
  [11, 'KMK.KmmmmmmK.KMK'],
  [12, '.KMKMMMMMMMMKMK.'],
  [13, '..KKMMWWWWMMKK..'],
  [14, '....MMWVVWMM....'],
  [15, '....MMWWWWMM....'],
  [16, '....MMMMMMMM....'],
]);
const RobotAvatar = (s: PixelAvatarState) => {
  const grid = s.phase === 'cheer' ? ROBOT_CHEER : s.phase === 'run' && s.runStep % 2 === 0 ? ROBOT_RUN_A : ROBOT_BASE;
  const w = grid[0].length * R_P;
  const h = grid.length * R_P;
  // 跑步时整只上下跳一格(整像素),其余不动
  const hop = s.phase === 'run' && s.runStep % 2 === 1 ? -R_P : 0;
  const paths = (keep: (ch: string) => boolean) => {
    const by: Record<string, string> = {};
    grid.forEach((row, y) =>
      row.split('').forEach((ch, x) => {
        if (!R_COLORS[ch] || !keep(ch)) return;
        by[R_COLORS[ch]] = (by[R_COLORS[ch]] ?? '') + `M${x * R_P} ${y * R_P}h${R_P}v${R_P}h${-R_P}Z`;
      }),
    );
    return Object.entries(by).map(([c, d]) => <path key={c} d={d} fill={c} />);
  };
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" style={{ position: 'absolute', left: (240 - w) / 2, top: 376 - h - 8 }}>
      {paths((ch) => ch === 'G')}
      <g transform={hop ? `translate(0 ${hop})` : undefined}>{paths((ch) => ch !== 'G')}</g>
    </svg>
  );
};

type Variant = { label: string; duration: number; props: PixelLevelMapProps };

const VARIANTS: Variant[] = [
  {
    label: '原结构 · 换章节名(4 章,第 2 章 → 第 3 章)',
    duration: 110,
    props: { chapters: ['装好环境', '基础对话', '写个网页', '上线部署'], startChapter: 1, advanceAt: [20] },
  },
  {
    label: '5 章 · 从第 1 章出发',
    duration: 110,
    props: { chapters: ['注册', '充值', '第一个项目', 'Skill', '自动化'], startChapter: 0, advanceAt: [20] },
  },
  {
    label: '12 章 · 间距调到 300(一屏看到更多关)',
    duration: 110,
    props: {
      chapters: ['安装', '登录', '对话', '文件', '命令', '记忆', '个性化', 'Skill', 'MCP', '子代理', 'Hook', '收尾'],
      startChapter: 6,
      advanceAt: [20],
      spacing: 300,
    },
  },
  {
    label: '连续两次转场 · 第 1 章 → 第 2 章 → 第 3 章',
    duration: 180,
    props: { chapters: ['认识 CC', '装好', '第一次对话', '写代码', '上线'], startChapter: 0, advanceAt: [15, 95] },
  },
  {
    label: '换配色 · neon 赛博蓝紫',
    duration: 110,
    props: { chapters: ['入门', '掌握&管理', '个性化', '进阶'], startChapter: 1, advanceAt: [20], palette: 'neon' },
  },
  {
    label: '小人槽位 · 换成另一个占位形象(代码画的小机器人)',
    duration: 110,
    props: { chapters: ['入门', '掌握&管理', '个性化', '进阶'], startChapter: 1, advanceAt: [20], avatar: RobotAvatar },
  },
  {
    label: '暖纸配色 paper + speed 1.3 更利落',
    duration: 100,
    props: { chapters: ['选题', '写稿', '拍摄', '剪辑', '发布'], startChapter: 2, advanceAt: [20], palette: 'paper', speed: 1.3 },
  },
];

export const VARIANTS_DURATION = VARIANTS.reduce((a, v) => a + v.duration, 0);
const STARTS = VARIANTS.reduce<number[]>((acc, v, i) => [...acc, i === 0 ? 0 : acc[i - 1] + VARIANTS[i - 1].duration], []);

export const PixelLevelMapVariants: React.FC = () => (
  <AbsoluteFill style={{ background: '#000', WebkitFontSmoothing: 'antialiased' }}>
    {VARIANTS.map((v, i) => (
      <Sequence key={v.label} from={STARTS[i]} durationInFrames={v.duration} layout="none">
        <PixelLevelMap {...v.props} />
        <Label>{`${i + 1}/${VARIANTS.length}  ${v.label}`}</Label>
      </Sequence>
    ))}
  </AbsoluteFill>
);
