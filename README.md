# zexuan-shots

泽轩604 的 Remotion 字效 / 镜头模板，一共 18 个。都是照秋芝《Claude Code 全解》《Codex 全解》里的镜头**逐帧量出来的**：动作曲线、节奏和几何尺寸都是实测值，不是凭手感调的。每个都做成了带参数的组件，可以换字、换素材、调速度。

在线预览（每个镜头的变体合集）：[且曼镜头库 · 字体特效](https://qieman-shots.pages.dev/#/?tag=字体特效)

## 跑起来

```bash
npm install
npm run dev        # 打开 Remotion Studio，左侧 text-fx / shots 两个文件夹，每个 composition 是一个模板的变体合集
npx remotion render ZoomTrailVariants out/zoom-trail.mp4 --props='{"clean":true}'   # 导出；clean = 不画左上角的变体说明
```

需要 Node 18+。第一次渲染时 Remotion 会自动下载无头 Chrome。

## 模板清单

| # | composition | 组件 | 效果 | 口播里什么时候用 |
|---|---|---|---|---|
| 01 | `ZoomTrailVariants` | `textfx/ZoomTrailPop` | 大字过冲爆开 + 径向残影 | 开场定调、口号、情绪词 |
| 02 | `CharFlickerVariants` | `textfx/CharFlickerIn` | 逐字模糊白光乱闪后落定 | 副标题、角标小字 |
| 03 | `ChapterTitleVariants` | `textfx/ChapterTitleFx` | 白光入场，换标题时金光扫过 | 进新章节、换话题 |
| 04 | `TermBurstVariants` | `textfx/TermBurst` | 字距炸开收拢冲入 + 绿标签滑出 | 第一次出现的术语、英文全称 |
| 05 | `DataBarsVariants` | `components/DataBars` | 压暗 + 条形生长 + 数字浮现 | 百分比、前后对比、倍数、金额 |
| 06 | `GlowTitleVariants` | `textfx/GlowTitleIn` | 黑底标题去模糊、收拢、发光 | 章节大标题 |
| 07 | `WordPopVariants` | `textfx/WordPopSequence` | 一串词按节奏逐个滑入弹一下 | 列举、概念组装（X = A + B + C） |
| 08 | `ScreenAnnotateVariants` | `components/ScreenAnnotate` | 录屏上的橙色虚线框 + 小箭头 + 荧光笔 | 讲软件界面、「点这里」、念原文 |
| 09 | `ScreenExplainVariants` | `components/ScreenExplain` | 录屏抠出一块放大，英文变中文 + 标注 | 解释 AI 输出的意思 |
| 10 | `GrowingSequenceVariants` | `components/GrowingSequence` | 时序图 / 流程图一步步长出来 | 链路长的工作原理 |
| 11 | `TagStackVariants` | `components/TagStack` | 关键词色块跟着口播往下堆 | 列举几个关键词 |
| 12 | `CapsuleListVariants` | `components/CapsuleList` | 编号胶囊清单 → 证据截图页 | 「第一、第二」逐条讲再看证据 |
| 13 | `MindmapReviewVariants` / `MindmapReviewPortrait` | `components/MindmapReview` | 思维导图描线长出分支卡（横 / 竖屏） | 「我们回顾一下」 |
| 14 | `SplitCompareVariants` | `components/SplitCompare` | 分屏对比卡，聚焦一侧 | A 和 B、以前和现在 |
| 15 | `EvidenceToGraphVariants` | `components/EvidenceToGraph` | 截图里的一句话长成动画节点图 | 从实拍截图切进动画讲解 |
| 16 | `SampleCarouselVariants` | `components/SampleCarousel` + `PageCurlTransition` | 卷页飞入 + 样片轮播（卷页可单独当转场） | 从多个案例里挑一个演示 |
| 17 | `QuestionTocVariants` | `components/QuestionToc` + `CurlIntoScreen` + `SectionOpener` | 问号悬念目录 + 卷页切进录屏 | 章节目录、从 B-roll 切进录屏 |
| 18 | `PixelLevelMapVariants` | `components/PixelLevelMap` | 像素关卡地图，过关推进 | 长视频多章节进度 |

组件都在 `src/kit/` 下。**每个组件文件开头都有用法示例，参数的中文说明写在 props 类型上**；`src/shots/NN-*/Variants.tsx` 是对应的变体演示，照着改最快。

## 用到自己的片子里

把需要的组件文件（连同它 import 的 `graphemes.ts` / `theme.ts` 等）拷进你的 Remotion 工程，直接当组件用：

```tsx
import { ZoomTrailPop } from './kit/textfx/ZoomTrailPop';

<Sequence from={30} durationInFrames={60}>
  <ZoomTrailPop text="保姆级" fontSize={560} color="#FCF7C2" fontFamily="SmileySansV1" />
</Sequence>
```

也可以把这句话交给 Claude Code / Codex：

> 克隆 https://github.com/zexuanw958-svg/zexuan-shots ，读 README，用 `TermBurst` 模板把「Model Context Protocol / 模型上下文协议」做成一段，改完用 remotion studio 给我看，不要导出。

几点要注意：

- 曲线按 30fps 原片量的，组件内部会按你工程的 fps 换算，60fps 也能用。
- 几何默认按 1920×1080 画布，别的尺寸按比例缩放；位置按素材算，不要写死原片坐标。
- 16 号卷页用了 WebGL，渲染要开 `Config.setChromiumOpenGlRenderer('angle')`（本仓库的 `remotion.config.ts` 已经开了）。

## 字体

**仓库自带**（SIL OFL 1.1，许可原文在 `public/fonts/`）：思源黑体 Noto Sans SC、Space Mono、得意黑 v2.0.1 和 v1.1.1、IBM Plex Sans JP、抖音美好体。得意黑两个版本有几个字形不同，01、02、04、08、11、15 这 6 个模板是按 v1.1.1 对齐原片的，所以用 `SmileySansV1` 这个字体名。

**可选字体**：原片还用了几款字体，它们的授权不允许或不确定能二次分发，仓库里不带。你有授权的话，按 [`public/fonts/extra/README.md`](public/fonts/extra/README.md) 里的文件名放进 `public/fonts/extra/` 就会自动用上；不放也能正常渲染，会回退到开源字体，只是字形和原片不一样。

## 注释里的几个说法

组件注释保留了复刻时的量测依据，方便你判断哪些值能动：

- **原片帧号 fNNN / 案例 NN / 交付 NN / 内部复刻案例 qz-…**：我们内部复刻流程里的案例编号，数值都是在那段原片上量的。
- **工序③ / ④ / ⑦b**：复刻流程的步骤，③是逐帧取证，④是逐帧拟合，⑦b 是全片比对后的修正。
- **坑 Z1**：动画落定后要把恒等的 `transform` / `filter` 清掉，不然编码后字会轻微「呼吸」。
- **坑 Z6**：hooks 一律放在组件顶层、早退之前，不能放进条件分支（React #310）。
- **坑 Z7**：白光 / 奶白发光字只能放深色底，浅底上几乎看不见。

## 目录

```
src/
  Root.tsx            每个模板注册成一个 composition
  fonts.ts            全部字体注册（自带 + 可选）
  kit/textfx/         7 个文字特效组件
  kit/components/     14 个镜头组件
  kit/theme.ts        颜色和字体 token
  shots/NN-*/         每个模板的变体演示
public/
  fonts/              开源字体 + OFL 许可原文；extra/ 放可选字体
  demo/               占位截图、占位口播、示例图标（都是代码生成的，换成你自己的）
  ph/                 16 号样片轮播用的占位视频和封面（ffmpeg / 代码生成）
```

## 许可

代码按 [MIT](LICENSE) 开源：可以免费使用、修改、分发和商用，分发代码或它的主要部分时保留版权声明和许可全文。字体按各自的 OFL 许可。参考来源、第三方与素材的边界见 [NOTICE.md](NOTICE.md)。
