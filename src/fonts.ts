/**
 * fonts.ts — 全部字体在这里注册,index.ts 顶层 import 触发;delayRender 等字体到位再截帧。
 *
 * 两类字体:
 *   1. 随仓库分发(SIL OFL 1.1,许可原文在 public/fonts/*-OFL.txt):
 *      思源黑体 Noto Sans SC、Space Mono、得意黑 v2.0.1 / v1.1.1、IBM Plex Sans JP、抖音美好体。
 *   2. 可选字体(授权不允许或不确定能二次分发,仓库里不带):
 *      把字体文件按 OPTIONAL 表里的文件名放进 public/fonts/extra/ 就会自动用上;
 *      没放就回退到表里的开源字体,画面照样能渲,只是字形和原片不一样。
 *      下载地址与授权见 public/fonts/extra/README.md。
 */
import { continueRender, delayRender, staticFile } from 'remotion';

type Face = { family: string; src: string; desc?: FontFaceDescriptors };

const url = (file: string) => `url('${staticFile(file)}')`;
const NOTO_700 = 'fonts/NotoSansSC-sc-700.woff2';
const NOTO_800 = 'fonts/NotoSansSC-sc-800.woff2';
const SMILEY = 'fonts/SmileySans-Oblique-v2.0.1.ttf';
const MONO_700 = 'fonts/SpaceMono-latin-700.woff2';

const BUNDLED: Face[] = [
  { family: 'Noto Sans SC', src: url(NOTO_700), desc: { weight: '700' } },
  { family: 'Noto Sans SC', src: url('fonts/NotoSansSC-latin-700.woff2'), desc: { weight: '700' } },
  { family: 'Noto Sans SC', src: url(NOTO_800), desc: { weight: '800' } },
  { family: 'Noto Sans SC', src: url('fonts/NotoSansSC-latin-800.woff2'), desc: { weight: '800' } },
  { family: 'Space Mono', src: url('fonts/SpaceMono-latin-400.woff2'), desc: { weight: '400' } },
  { family: 'Space Mono', src: url(MONO_700), desc: { weight: '700' } },
  // 得意黑两个版本:v1.1.1 的「报」「写」等字形和 v2.0.1 不同,按原片对齐时用到哪版就注册哪版
  { family: 'SmileySans', src: url(SMILEY) },
  { family: 'SmileySansV1', src: url('fonts/SmileySans-Oblique-v1.1.1.ttf') },
  { family: 'IBM Plex Sans JP', src: url('fonts/IBMPlexSansJP-Medium.ttf'), desc: { weight: '500' } },
  { family: 'DouyinSans', src: url('fonts/DouyinSansBold.ttf') },
];

/** 可选字体:先找 public/fonts/extra/<file>,找不到用 fallback 那个开源字体顶上(同一个字体名,代码不用改) */
const OPTIONAL: Array<{ family: string; file: string; fallback: string; desc?: FontFaceDescriptors; local?: string[] }> = [
  { family: 'WenYueXinQingNian', file: 'WenYueXinQingNian.ttf', fallback: SMILEY },
  { family: 'AlibabaPuHuiTi', file: 'AlibabaPuHuiTi-3-105-Heavy.ttf', fallback: NOTO_800 },
  { family: 'AlimamaFangYuanTi', file: 'AlimamaFangYuanTiVF.ttf', fallback: NOTO_800, desc: { weight: '200 700' } },
  { family: 'HXBZhenShuai', file: 'HXBZhenShuai.otf', fallback: SMILEY },
  { family: 'PangMenZhengDao', file: 'PangMenZhengDaoBiaoTiTi.ttf', fallback: SMILEY },
  { family: 'AaHouDiHei', file: 'AaHouDiHei.ttf', fallback: NOTO_800 },
  { family: 'HelloFontIDYouQiTi', file: 'HelloFontID-YouQiTi-subset.ttf', fallback: NOTO_800 },
  // 下面几个是 macOS 系统字体:Mac 上直接用本机的(local),其他系统回退
  { family: 'SFPro770', file: 'SFProDisplay-wght770-opsz68.ttf', fallback: NOTO_800, desc: { weight: '700' } },
  { family: 'SFProText', file: 'SFProText-Regular-opsz17.ttf', fallback: NOTO_700, desc: { sizeAdjust: '98.75%' } as FontFaceDescriptors },
  { family: 'PingFangSC-Regular', file: 'PingFangSC-Regular.ttf', fallback: NOTO_700, local: ['PingFangSC-Regular'] },
  { family: 'PingFangSC-Semibold', file: 'PingFangSC-Semibold.ttf', fallback: NOTO_700, local: ['PingFangSC-Semibold'] },
  { family: 'MenloBold', file: 'Menlo-Bold.ttf', fallback: MONO_700, local: ['Menlo-Bold'] },
  { family: 'AvenirNextHeavy', file: 'AvenirNext-Heavy.ttf', fallback: NOTO_800, desc: { weight: '800' }, local: ['AvenirNext-Heavy', 'Avenir Next Heavy'] },
];

const faces: Face[] = [
  ...BUNDLED,
  ...OPTIONAL.map((o) => ({
    family: o.family,
    // FontFace 的 src 按顺序试:本机字体 → extra/ 里的文件 → 开源兜底
    src: [...(o.local ?? []).map((n) => `local('${n}')`), url(`fonts/extra/${o.file}`), url(o.fallback)].join(', '),
    desc: o.desc,
  })),
];

const handle = delayRender('Loading fonts', { retries: 3, timeoutInMilliseconds: 45000 });

Promise.allSettled(
  faces.map((f) =>
    new FontFace(f.family, f.src, f.desc).load().then((loaded) => {
      (document.fonts as unknown as { add: (x: FontFace) => void }).add(loaded);
    }),
  ),
).then(() => continueRender(handle));
