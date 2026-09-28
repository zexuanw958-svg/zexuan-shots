/* theme.ts — 泽轩604 的视觉 token(本仓库只用到颜色和字体两组)。
 * 键名说明:colors.blue* 是历史键名,实际是主强调「泽轩橙 #E07B39」;colors.orange* 实际是辅助 teal。
 * 字体的加载在 src/fonts.ts;这里只是字体名。
 */
/* ───────────────────────── 颜色(泽轩定版)─────────────────────────
 * 配色纪律(剪辑标准第 3 节):暖纸底 + 墨字 + 弱化灰 + 单一橙强调 + 少量 teal 辅助。
 * 不做一整片单色;禁纯黑/冷黑底。
 */
export const colors = {
  // 浅色主题背景 = 暖纸(纸底舞台定版色)
  bgCream: '#F6F0E5',
  // 浅色渐变的浅端(比暖纸略亮)
  bgCreamTo: '#FBF7EE',
  // 浅底 backdrop 上缓慢游走的三团光斑颜色(暖纸同族,略深)
  creamClouds: ['#EDE5D6', '#F1EADC', '#F4EEE2'],
  // 中性
  chrome: '#1C1B17',      // 顶部细黑条 / 视频 chrome(= 墨)
  ink: '#1C1B17',         // 主文字 = 墨(定版)
  ink2: '#3E3B34',        // 次级文字 / 数值
  inkMuted: '#6E6A60',    // 注脚 / 弱化灰
  surface: '#FDFAF2',     // 实色卡面(白纸质感)
  backcard: '#EFE9DC',    // 叠层卡(卡后那张,比纸底略深)
  white: '#ffffff',
  // 强调(见文件头"键名说明")
  blue: '#E07B39',        // 【主强调角色】泽轩橙:命名/主体/当前对象/数值高亮
  blueStrong: '#C9662A',  // 橙·深(按压/描边态)
  blueSoft: '#F7E6D7',    // 橙·极淡(行/格淡底)
  orange: '#4B8A80',      // 【辅助强调角色】teal:次要标注,克制使用
  orangeStrong: '#3A6F67',// teal·深
  peach: '#E4EFEC',       // teal·极淡(列高亮淡底)
  // 泽轩特有
  cream: '#FFF9E3',       // 奶白发光字专用。⚠️ 坑:只能放深色底,压暖纸上几乎隐形
} as const;

/* ───────────────────────── 字体(泽轩定版;fonts.ts 已注册加载)───────────────────────── */
export const fonts = {
  zh: 'Noto Sans SC',           // 中文正文 / 卡片文案(自托管 woff2,700/800)
  display: 'AlimamaFangYuanTi', // 大字爆出层 = 阿里妈妈方圆体 VF(定版:wght 700 + 奶白微发光)
  chunky: 'HXBNanShen',         // 白纸卡标题 / 手写风列表 = 胡晓波男神体(定版)
  serif: 'Songti SC',           // 衬线点缀(过渡方案:系统宋体;AnthropicSerif 文件到位后换)
  smiley: 'SmileySans',         // 得意黑 SmileySans-Oblique:秋芝镜头类字效专用(2026-09-23 解禁;出片工程 fonts.ts 自行加载)
  mono: 'Space Mono',           // 注脚 / 指标名 / 序号 / 技术小字(自托管 woff2)
  /** @deprecated 旧组件用的西文别名,现指向 display(方圆体) */
  sans: 'AlimamaFangYuanTi',
} as const;
// 注:得意黑 Remotion 里可用(泽轩 2026-09-23 解禁,秋芝镜头类字效用它;真源:剪辑标准第 2 节)。
