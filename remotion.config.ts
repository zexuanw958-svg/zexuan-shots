import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
// 字体较多,放宽 delayRender 默认超时(fonts.ts 自己还有 45 秒 × 3 次重试)
Config.setDelayRenderTimeoutInMilliseconds(120000);
// 16 号卷页(PageCurlTransition)是 WebGL2 着色器,渲染时要开 angle
Config.setChromiumOpenGlRenderer('angle');
