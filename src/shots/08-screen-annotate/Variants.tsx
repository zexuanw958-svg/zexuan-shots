/**
 * 08 · 录屏标注 · 橙框 + 小箭头 + 荧光笔
 *
 * 讲软件界面时，跟着口播在录屏上「啪」地套橙色虚线框、升起橙底小标签；要点按钮时框上落一个小箭头；念原文时用黄色荧光笔把那句话刷出来。
 *
 * 组件:src/kit/components/ScreenAnnotate.tsx(ScreenAnnotate)。本文件是它的变体演示,Studio 里选 composition「ScreenAnnotateVariants」。
 * 左上角 / 底部的小字是变体说明;渲染时加 --props='{"clean":true}' 就不画。
 * 参考：秋芝《Claude Code 全解》录屏标注手法（全片 40 次以上），箭头逐帧实测。
 */
import React from 'react';
import { AbsoluteFill, Sequence, getInputProps } from 'remotion';
import { ScreenAnnotate, type ScreenAnnotateProps } from '../../kit/components/ScreenAnnotate';

// --props='{"clean":true}' 时不画调试角标,渲对外展示的干净版
const Tag: React.FC<{ children: React.ReactNode; top?: boolean }> = (p) => (getInputProps().clean ? null : <TagBox {...p} />);

const TagBox: React.FC<{ children: React.ReactNode; top?: boolean }> = ({ children, top }) => (
  <div
    style={{
      position: 'absolute',
      left: 40,
      ...(top ? { top: 32 } : { bottom: 32 }),
      padding: '8px 18px',
      borderRadius: 10,
      background: 'rgba(0,0,0,.62)',
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

// ─────────────── 变体用假界面(代码画,不含任何原片画面) ───────────────

const MONO = 'Space Mono, Noto Sans SC';
const SANS = 'Noto Sans SC';

/** 假 IDE:窗口 (100,70) 1720×880;左文件树 / 中编辑器 / 下终端 / 右 AI 面板 */
export const IDE = { x: 100, y: 70, w: 1720, h: 880, side: 300, right: 1260, termTop: 560 };
const FILES = ['src', '  components', '    Header.tsx', '    Button.tsx', '  pages', '    index.tsx', '    about.tsx', '  utils.ts', 'public', 'package.json', 'README.md', '.env.local'];
const CODE: Array<Array<[string, string]>> = [
  [['import', '#C586C0'], [' React ', '#D4D4D4'], ['from', '#C586C0'], [" 'react'", '#CE9178']],
  [['import', '#C586C0'], [' { Button } ', '#D4D4D4'], ['from', '#C586C0'], [" './Button'", '#CE9178']],
  [['', '']],
  [['export const', '#569CD6'], [' Header', '#DCDCAA'], [' = () => {', '#D4D4D4']],
  [['  const', '#569CD6'], [' [open, setOpen] = ', '#D4D4D4'], ['useState', '#DCDCAA'], ['(false)', '#D4D4D4']],
  [['  return', '#C586C0'], [' (', '#D4D4D4']],
  [['    <header', '#4EC9B0'], [' className=', '#9CDCFE'], ['"top-bar"', '#CE9178'], ['>', '#4EC9B0']],
  [['      <Logo', '#4EC9B0'], [' size=', '#9CDCFE'], ['{32}', '#D4D4D4'], [' />', '#4EC9B0']],
  [['      <Button', '#4EC9B0'], [' onClick=', '#9CDCFE'], ['{() => setOpen(!open)}', '#D4D4D4'], ['>', '#4EC9B0']],
  [['        菜单', '#D4D4D4']],
  [['      </Button>', '#4EC9B0']],
  [['    </header>', '#4EC9B0']],
  [['  )', '#D4D4D4']],
  [['}', '#D4D4D4']],
];
const TERM = ['$ npm run dev', '  ready - started server on 0.0.0.0:3000', '  event - compiled client and server successfully', '$ claude', '> 帮我把 Header 改成响应式'];

export const FakeIDE: React.FC = () => (
  <div style={{ position: 'absolute', left: IDE.x, top: IDE.y, width: IDE.w, height: IDE.h, borderRadius: 16, overflow: 'hidden', background: '#1E1F24', boxShadow: '0 30px 80px rgba(0,0,0,.5)' }}>
    <div style={{ height: 40, background: '#2A2B31', display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 18 }}>
      {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
        <div key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />
      ))}
      <div style={{ marginLeft: 620, color: '#8B8D96', fontFamily: SANS, fontSize: 18 }}>my-website — Header.tsx</div>
    </div>
    <div style={{ position: 'absolute', left: 0, top: 40, width: IDE.side, bottom: 0, background: '#18191D', paddingTop: 14 }}>
      {FILES.map((f, i) => (
        <div key={f} style={{ height: 38, display: 'flex', alignItems: 'center', paddingLeft: 22 + (f.length - f.trimStart().length) * 9, color: i === 2 ? '#FFFFFF' : '#B7B9C2', background: i === 2 ? '#2C4A7A' : undefined, fontFamily: MONO, fontSize: 19 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, marginRight: 10, background: f.includes('.') ? '#5B9BD5' : '#D9A441' }} />
          {f.trim()}
        </div>
      ))}
    </div>
    <div style={{ position: 'absolute', left: IDE.side, top: 40, width: IDE.right - IDE.side, height: IDE.termTop - 40, paddingTop: 16 }}>
      {CODE.map((line, i) => (
        <div key={i} style={{ height: 34, display: 'flex', fontFamily: MONO, fontSize: 20, whiteSpace: 'pre' }}>
          <span style={{ width: 56, textAlign: 'right', color: '#5A5D66', marginRight: 22 }}>{i + 1}</span>
          {line.map(([t, c], j) => (
            <span key={j} style={{ color: c }}>{t}</span>
          ))}
        </div>
      ))}
    </div>
    <div style={{ position: 'absolute', left: IDE.side, top: IDE.termTop, width: IDE.right - IDE.side, bottom: 0, background: '#141518', borderTop: '1px solid #33353C', padding: '18px 24px' }}>
      <div style={{ color: '#8B8D96', fontFamily: SANS, fontSize: 17, marginBottom: 10 }}>终端</div>
      {TERM.map((t, i) => (
        <div key={i} style={{ height: 34, color: t.startsWith('$') ? '#7EE787' : t.startsWith('>') ? '#F0C674' : '#B7B9C2', fontFamily: MONO, fontSize: 19, whiteSpace: 'pre' }}>{t}</div>
      ))}
    </div>
    <div style={{ position: 'absolute', left: IDE.right, top: 40, right: 0, bottom: 0, background: '#1A1B20', borderLeft: '1px solid #33353C', padding: 24 }}>
      <div style={{ color: '#E6E6E6', fontFamily: SANS, fontWeight: 700, fontSize: 22, marginBottom: 20 }}>AI 助手</div>
      {['帮我看看这个组件哪里能优化', '可以把按钮抽出来单独复用,并给 Header 加上移动端折叠菜单。', '好,直接改吧'].map((m, i) => (
        <div key={i} style={{ marginBottom: 16, marginLeft: i % 2 === 0 ? 90 : 0, padding: '12px 16px', borderRadius: 12, background: i % 2 === 0 ? '#2C4A7A' : '#2A2B31', color: '#E6E6E6', fontFamily: SANS, fontSize: 19, lineHeight: 1.5 }}>{m}</div>
      ))}
      <div style={{ position: 'absolute', left: 24, right: 24, bottom: 24, height: 56, borderRadius: 12, border: '1px solid #3A3C44', color: '#6B6E78', fontFamily: SANS, fontSize: 18, display: 'flex', alignItems: 'center', paddingLeft: 16 }}>输入问题…</div>
    </div>
  </div>
);

/** 假设置弹窗(浅色):有一个「打开项目」按钮给箭头指 */
export const DLG = { x: 560, y: 250, w: 800, h: 520, btn: { x: 1080, y: 680, w: 240, h: 60 } };
export const FakeDialog: React.FC = () => (
  <AbsoluteFill style={{ background: 'linear-gradient(135deg,#DDE3EC,#C9D2DF)' }}>
    <div style={{ position: 'absolute', left: DLG.x, top: DLG.y, width: DLG.w, height: DLG.h, borderRadius: 18, background: '#FFFFFF', boxShadow: '0 30px 80px rgba(40,50,70,.25)' }}>
      <div style={{ padding: '36px 44px', fontFamily: SANS }}>
        <div style={{ fontSize: 34, fontWeight: 800, color: '#1D2129' }}>欢迎使用</div>
        <div style={{ fontSize: 22, color: '#6B7280', marginTop: 14 }}>从一个文件夹开始你的第一个项目</div>
        {['最近打开', '  my-website', '  notes-app', '  demo-2026'].map((t, i) => (
          <div key={t} style={{ fontSize: 21, fontWeight: i === 0 ? 700 : 400, color: i === 0 ? '#1D2129' : '#3B5BDB', marginTop: i === 0 ? 34 : 12, whiteSpace: 'pre' }}>{t}</div>
        ))}
      </div>
    </div>
    <div style={{ position: 'absolute', left: DLG.btn.x - 270, top: DLG.btn.y, width: DLG.btn.w, height: DLG.btn.h, borderRadius: 10, border: '1.5px solid #C9CDD4', background: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontSize: 22, color: '#1D2129' }}>取消</div>
    <div style={{ position: 'absolute', left: DLG.btn.x, top: DLG.btn.y, width: DLG.btn.w, height: DLG.btn.h, borderRadius: 10, background: '#3B5BDB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontWeight: 700, fontSize: 22, color: '#FFF' }}>打开项目</div>
  </AbsoluteFill>
);

/** 假文档页(浅色):纯中文行,字号 34 → 每字 34px 宽,荧光笔矩形能按字数算 */
export const DOC = { x: 260, y: 150, w: 1400, fs: 34, lh: 64, textX: 340, textY: 330 };
const DOC_LINES = [
  '使用须知',
  '一、请不要把密钥直接写进代码里，改用环境变量保存。',
  '二、每次改动前先让助手说明计划，确认后再动手。',
  '三、改完以后记得跑一遍测试，别只看页面能不能打开。',
  '四、遇到报错把完整信息贴给它，不要只说「坏了」。',
];
export const docLineRect = (i: number, fromChar: number, chars: number) => ({
  x: DOC.textX + fromChar * DOC.fs - 4,
  y: DOC.textY + i * DOC.lh + 6,
  w: chars * DOC.fs + 8,
  h: DOC.lh - 12,
});
export const FakeDoc: React.FC = () => (
  <AbsoluteFill style={{ background: '#E9EBEF' }}>
    <div style={{ position: 'absolute', left: DOC.x, top: DOC.y, width: DOC.w, height: 780, borderRadius: 14, background: '#FFFFFF', boxShadow: '0 20px 60px rgba(0,0,0,.12)' }}>
      <div style={{ height: 56, borderBottom: '1px solid #E5E6EB', display: 'flex', alignItems: 'center', paddingLeft: 24, gap: 10 }}>
        {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
          <div key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />
        ))}
        <div style={{ marginLeft: 20, height: 34, width: 700, borderRadius: 17, background: '#F2F3F5', color: '#86909C', fontFamily: SANS, fontSize: 17, display: 'flex', alignItems: 'center', paddingLeft: 18 }}>docs.example.com/guide</div>
      </div>
    </div>
    {DOC_LINES.map((t, i) => (
      <div key={i} style={{ position: 'absolute', left: DOC.textX, top: i === 0 ? DOC.textY - 100 : DOC.textY + (i - 1) * DOC.lh, height: DOC.lh, lineHeight: `${DOC.lh}px`, fontFamily: SANS, fontWeight: i === 0 ? 800 : 700, fontSize: i === 0 ? 44 : DOC.fs, color: '#1D2129', whiteSpace: 'pre' }}>{t}</div>
    ))}
  </AbsoluteFill>
);

/** 假手机录屏(竖屏,原始 1080×2340),放进横屏画布时按 space 缩放 */
const PHONE = { srcW: 1080, srcH: 2340, scale: 0.4, x: 744, y: 72 };
const PHONE_ROWS = ['Wi-Fi', '蓝牙', '通知', '声音与触感', '专注模式', '屏幕使用时间', '通用', '辅助功能', '隐私与安全'];
const FakePhone: React.FC = () => (
  <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 40%, #3B4150 0%, #1C1F26 100%)' }}>
    <div style={{ position: 'absolute', left: PHONE.x, top: PHONE.y, width: PHONE.srcW, height: PHONE.srcH, scale: `${PHONE.scale}`, transformOrigin: '0 0', borderRadius: 110, overflow: 'hidden', background: '#F2F2F7', boxShadow: '0 0 0 18px #0E0F12' }}>
      <div style={{ padding: '170px 60px 0', fontFamily: SANS }}>
        <div style={{ fontSize: 96, fontWeight: 800, color: '#111' }}>设置</div>
        <div style={{ marginTop: 40, height: 110, borderRadius: 30, background: '#E3E3E8', color: '#8E8E93', fontSize: 44, display: 'flex', alignItems: 'center', paddingLeft: 40 }}>搜索</div>
        <div style={{ marginTop: 50, borderRadius: 36, background: '#FFF', overflow: 'hidden' }}>
          {PHONE_ROWS.map((t, i) => (
            <div key={t} style={{ height: 150, display: 'flex', alignItems: 'center', paddingLeft: 40, borderTop: i ? '2px solid #E5E5EA' : undefined, fontSize: 50, color: '#111' }}>
              <div style={{ width: 76, height: 76, borderRadius: 18, marginRight: 36, background: ['#0A84FF', '#0A84FF', '#FF3B30', '#FF2D55', '#5E5CE6', '#5E5CE6', '#8E8E93', '#0A84FF', '#0A84FF'][i] }} />
              {t}
              <div style={{ marginLeft: 'auto', marginRight: 40, color: '#C7C7CC' }}>›</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </AbsoluteFill>
);
/** 手机坐标(原始像素):第 4 行「声音与触感」、第 6 行「屏幕使用时间」 */
const phoneRow = (i: number) => ({ x: 60, y: 170 + 144 + 40 + 110 + 50 + i * 150, w: 960, h: 150 });

// ─────────────── 变体 ───────────────
type Variant = { label: string; bg: React.ReactNode; props: ScreenAnnotateProps };

const SIDE = { x: IDE.x + 6, y: IDE.y + 46, w: IDE.side - 12, h: IDE.h - 52 };
const EDITOR = { x: IDE.x + IDE.side + 6, y: IDE.y + 46, w: IDE.right - IDE.side - 12, h: IDE.termTop - 52 };
const TERMR = { x: IDE.x + IDE.side + 6, y: IDE.y + IDE.termTop + 6, w: IDE.right - IDE.side - 12, h: IDE.h - IDE.termTop - 12 };
const CHAT = { x: IDE.x + IDE.right + 6, y: IDE.y + 46, w: IDE.w - IDE.right - 12, h: IDE.h - 52 };

const VARIANTS: Variant[] = [
  {
    label: '单框:框住文件树(硬切出现)',
    bg: <FakeIDE />,
    props: { annotations: [{ type: 'box', at: 0.4, rect: SIDE }] },
  },
  {
    label: '框 + 小箭头 + 标签:「点这里」',
    bg: <FakeDialog />,
    props: {
      annotations: [
        {
          type: 'box',
          at: 0.4,
          rect: { x: DLG.btn.x - 12, y: DLG.btn.y - 12, w: DLG.btn.w + 24, h: DLG.btn.h + 24 },
          arrow: true,
          label: { text: '点这里打开', place: 'below', at: 1.1 },
        },
      ],
    },
  },
  {
    label: '荧光笔:扫一行 → 再扫两行(逐行)',
    bg: <FakeDoc />,
    props: {
      annotations: [
        { type: 'highlight', at: 0.4, rect: docLineRect(0, 2, 23) },
        { type: 'highlight', at: 2.0, rect: [docLineRect(1, 2, 19), docLineRect(2, 2, 22)] },
      ],
    },
  },
  {
    label: '三个标注按口播卡点先后出,段尾一起硬切',
    bg: <FakeIDE />,
    props: {
      annotations: [
        { type: 'box', at: 0.3, until: 4.8, rect: SIDE, label: { text: '全部文件', at: 0.8 } },
        { type: 'box', at: 1.6, until: 4.8, rect: EDITOR, label: { text: '手动改代码', place: 'top-left', at: 2.0 } },
        { type: 'box', at: 2.9, until: 4.8, rect: TERMR, label: { text: '终端', place: 'top-left', at: 3.3 } },
      ],
    },
  },
  {
    label: '换颜色:蓝框 + 绿框(框 / 标签 / 箭头跟着变)',
    bg: <FakeIDE />,
    props: {
      annotations: [
        { type: 'box', at: 0.4, rect: CHAT, color: '#2F7BFF', label: { text: 'AI 助手', place: 'bottom' }, arrow: { side: 'left', at: 0.4 } },
        { type: 'box', at: 1.8, rect: TERMR, color: '#18A058', label: { text: '在这里跑命令', place: 'top-left', at: 2.2 } },
      ],
    },
  },
  {
    label: '竖屏录屏:按原始像素标注,自动缩放(size 0.8)',
    bg: <FakePhone />,
    props: {
      space: { x: PHONE.x, y: PHONE.y, scale: PHONE.scale },
      size: 0.8,
      annotations: [
        { type: 'box', at: 0.4, rect: phoneRow(3), arrow: { side: 'right' }, label: { text: '改提示音', place: 'above', at: 1.0 } },
        { type: 'highlight', at: 2.4, rect: { x: 60 + 40 + 76 + 36, y: phoneRow(5).y + 40, w: 6 * 50 + 10, h: 70 } },
      ],
    },
  },
  {
    label: '独立箭头四个方向 + speed 0.7(更沉)',
    bg: <FakeDialog />,
    props: {
      speed: 0.7,
      annotations: [
        { type: 'arrow', at: 0.3, tip: { x: DLG.btn.x + DLG.btn.w / 2, y: DLG.btn.y - 8 }, direction: 'down' },
        { type: 'arrow', at: 0.9, tip: { x: DLG.btn.x + DLG.btn.w / 2, y: DLG.btn.y + DLG.btn.h + 8 }, direction: 'up' },
        { type: 'arrow', at: 1.5, tip: { x: DLG.btn.x - 8, y: DLG.btn.y + DLG.btn.h / 2 }, direction: 'right', color: '#2F7BFF' },
        { type: 'arrow', at: 2.1, tip: { x: DLG.btn.x + DLG.btn.w + 8, y: DLG.btn.y + DLG.btn.h / 2 }, direction: 'left', color: '#18A058' },
      ],
    },
  },
];

export const SLOT = 150;
export const VARIANTS_DURATION = SLOT * VARIANTS.length;

export const ScreenAnnotateVariants: React.FC = () => (
  <AbsoluteFill style={{ background: '#16151A', WebkitFontSmoothing: 'antialiased' }}>
    {VARIANTS.map((v, i) => (
      <Sequence key={v.label} from={i * SLOT} durationInFrames={SLOT} layout="none">
        <AbsoluteFill style={{ background: '#2B2E36' }} />
        {v.bg}
        <ScreenAnnotate {...v.props} />
        <Tag>{`${i + 1}/${VARIANTS.length}  ${v.label}`}</Tag>
      </Sequence>
    ))}
  </AbsoluteFill>
);
