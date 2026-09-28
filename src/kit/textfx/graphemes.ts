/**
 * graphemes.ts — 逐字分割(grapheme cluster 级)。
 *
 * 用 Intl.Segmenter 而不是上游的 Array.from(移植边界,调研报告难点 3):
 * Array.from 按码点拆,会把组合 emoji(👨‍👩‍👧)、变体选择符、组合附标拆碎;
 * Segmenter 按「用户感知的字」拆,CJK/emoji/西文都安全。
 * 运行环境:Remotion 渲染跑在 Chrome(≥87 有 Segmenter),枚举跑在 Node(≥16 有),无需兜底。
 */

/** grapheme 分割是 locale 无关的(UAX #29),传 undefined 用默认 locale 即可,逐帧确定 */
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** 把文本拆成用户感知的字的数组("泽轩👨‍👩‍👧" → ['泽','轩','👨‍👩‍👧']) */
export const splitGraphemes = (text: string): string[] =>
  Array.from(segmenter.segment(text), (s) => s.segment);
