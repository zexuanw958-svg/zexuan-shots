/**
 * Root.tsx — 18 个镜头模板,每个注册成一个 composition(都是 1920×1080 · 30fps 的变体合集,
 * 思维导图另有一个 1080×1920 竖屏版)。文件夹顺序 = 且曼镜头库上的编号。
 */
import React from 'react';
import { Composition, Folder } from 'remotion';
import { ZoomTrailVariants, VARIANTS_DURATION as D01 } from './shots/01-zoom-trail-pop/Variants';
import { CharFlickerVariants, VARIANTS_DURATION as D02 } from './shots/02-char-flicker-in/Variants';
import { ChapterTitleVariants, VARIANTS_DURATION as D03 } from './shots/03-chapter-title-fx/Variants';
import { TermBurstVariants, VARIANTS_DURATION as D04 } from './shots/04-term-burst/Variants';
import { DataBarsVariants, VARIANTS_DURATION as D05 } from './shots/05-data-bars/Variants';
import { GlowTitleVariants, VARIANTS_DURATION as D06 } from './shots/06-glow-title-in/Variants';
import { WordPopVariants, VARIANTS_DURATION as D07 } from './shots/07-word-pop-sequence/Variants';
import { ScreenAnnotateVariants, VARIANTS_DURATION as D08 } from './shots/08-screen-annotate/Variants';
import { ScreenExplainVariants, VARIANTS_DURATION as D09 } from './shots/09-screen-explain/Variants';
import { GrowingSequenceVariants, VARIANTS_DURATION as D10 } from './shots/10-growing-sequence/Variants';
import { TagStackVariants, VARIANTS_DURATION as D11 } from './shots/11-tag-stack/Variants';
import { CapsuleListVariants, VARIANTS_DURATION as D12 } from './shots/12-capsule-list/Variants';
import { MindmapReviewVariants, VARIANTS_DURATION as D13, MindmapReviewPortrait, PORTRAIT_DURATION } from './shots/13-mindmap-review/Variants';
import { SplitCompareVariants, VARIANTS_DURATION as D14 } from './shots/14-split-compare/Variants';
import { EvidenceToGraphVariants, VARIANTS_DURATION as D15 } from './shots/15-evidence-to-graph/Variants';
import { SampleCarouselVariants, VARIANTS_DURATION as D16 } from './shots/16-sample-carousel/Variants';
import { QuestionTocVariants, VARIANTS_DURATION as D17 } from './shots/17-question-toc/Variants';
import { PixelLevelMapVariants, VARIANTS_DURATION as D18 } from './shots/18-pixel-level-map/Variants';

const HD = { fps: 30, width: 1920, height: 1080 } as const;

export const RemotionRoot: React.FC = () => (
  <>
    <Folder name="text-fx">
      <Composition id="ZoomTrailVariants" component={ZoomTrailVariants} durationInFrames={D01} {...HD} />
      <Composition id="CharFlickerVariants" component={CharFlickerVariants} durationInFrames={D02} {...HD} />
      <Composition id="ChapterTitleVariants" component={ChapterTitleVariants} durationInFrames={D03} {...HD} />
      <Composition id="TermBurstVariants" component={TermBurstVariants} durationInFrames={D04} {...HD} />
      <Composition id="DataBarsVariants" component={DataBarsVariants} durationInFrames={D05} {...HD} />
      <Composition id="GlowTitleVariants" component={GlowTitleVariants} durationInFrames={D06} {...HD} />
      <Composition id="WordPopVariants" component={WordPopVariants} durationInFrames={D07} {...HD} />
    </Folder>
    <Folder name="shots">
      <Composition id="ScreenAnnotateVariants" component={ScreenAnnotateVariants} durationInFrames={D08} {...HD} />
      <Composition id="ScreenExplainVariants" component={ScreenExplainVariants} durationInFrames={D09} {...HD} />
      <Composition id="GrowingSequenceVariants" component={GrowingSequenceVariants} durationInFrames={D10} {...HD} />
      <Composition id="TagStackVariants" component={TagStackVariants} durationInFrames={D11} {...HD} />
      <Composition id="CapsuleListVariants" component={CapsuleListVariants} durationInFrames={D12} {...HD} />
      <Composition id="MindmapReviewVariants" component={MindmapReviewVariants} durationInFrames={D13} {...HD} />
      <Composition id="MindmapReviewPortrait" component={MindmapReviewPortrait} durationInFrames={PORTRAIT_DURATION} fps={30} width={1080} height={1920} />
      <Composition id="SplitCompareVariants" component={SplitCompareVariants} durationInFrames={D14} {...HD} />
      <Composition id="EvidenceToGraphVariants" component={EvidenceToGraphVariants} durationInFrames={D15} {...HD} />
      <Composition id="SampleCarouselVariants" component={SampleCarouselVariants} durationInFrames={D16} {...HD} />
      <Composition id="QuestionTocVariants" component={QuestionTocVariants} durationInFrames={D17} {...HD} />
      <Composition id="PixelLevelMapVariants" component={PixelLevelMapVariants} durationInFrames={D18} {...HD} />
    </Folder>
  </>
);
