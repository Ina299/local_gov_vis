import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, project } from '../shared';
import { municipality, rating } from './g4-util';

/** Kamakura 行政評価シート【個表】 in the newer pdftotext layout (総務-03/04); cost and indicator tables are column-shuffled. */
function kamakuraSheet(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  const heading = t.match(/^令和６年（(\d{4})年）度行政評価シート【個表】\n/);
  const h = t.match(/\n評価対象事業\n(総務-\d+)\n\n([^\n]+)\n/);
  const done = t.match(/\n2 令和５年（2023年）度に実施した事業の概要\n([\s\S]*?)\n\n?3 事業を構成する/);
  if (input.format !== 'pdf' || !heading || !h || !done) return [];
  const consistent = heading[1] === '2024';
  const p = project(input, h[1], h[2], consistent ? 2024 : null, h[0].slice(1), h.index! + 1);
  p.projectCode = h[1]; p.evaluatedFiscalYear = 2023; p.activities = done[1].trim();
  const box = t.match(/\(３\) 総合評価\n[\s\S]*?(?=【今後の方針】|\n【参考】)/);
  if (box) {
    const picks = [...box[0].matchAll(/■ (拡充|改善・変更|現状維持|縮小|休止・廃止)/g)];
    if (picks.length === 1) p.ratings.push(rating(input, 'self', '総合評価', picks[0][1], '拡充／改善・変更／現状維持／縮小／休止・廃止', picks[0][0], box.index! + picks[0].index!));
  }
  p.warnings.push('事業の概要・総合評価の選択のみ収録。主管課と関連課の欄が抽出で並び替わり対応が確定できないため所管課は未設定。事業費・人件費・最小事業の表は段組みが崩れて列の対応が確定できないため未収録。視点別評価・指標は未構造化。');
  if (!consistent) p.warnings.push(`表題が「令和６年（${heading[1]}年）度」と和暦・西暦で食い違うため評価年度は未設定。対象実績年度は本文の令和5年度。`);
  return [p];
}

/** Chikusei 外部評価結果: per business, the committee members' vote counts for progress and next-year direction. */
function chikuseiExternal(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (input.sourceId !== '1aa79b413eb5301e7a12331e' || !t.includes('外部評価委員から各事業に対するコメントを記載')) return [];
  const starts = [...t.matchAll(/■ 評価対象事業[０-９\d]+\n([^\n]+)\n/g)];
  return starts.flatMap((m, k) => {
    const seg = t.slice(m.index!, starts[k + 1]?.index ?? t.length);
    const progress = seg.match(/順調である\n\n(\d+)\n\n概ね順調である\n\n(\d+)\n\n順調でない\n\n(\d+)\n/);
    const next = seg.match(/拡充\n\n(\d+)\n\n見直し\n\n(\d+)\n\n現行どおり\n\n(\d+)\n\n縮小\n\n(\d+)\n\n休止・廃止・終了\n\n(\d+)\n/);
    const p = project(input, m[1], m[1], null, m[0], m.index!);
    p.projectCode = null;
    if (progress) p.ratings.push(rating(input, 'external', '進捗状況（外部評価委員の評価件数）',
      `順調である ${progress[1]}／概ね順調である ${progress[2]}／順調でない ${progress[3]}`, null, progress[0], m.index! + progress.index!));
    if (next) p.ratings.push(rating(input, 'external', '来年度の方向性（外部評価委員の評価件数）',
      `拡充 ${next[1]}／見直し ${next[2]}／現行どおり ${next[3]}／縮小 ${next[4]}／休止・廃止・終了 ${next[5]}`, null, next[0], m.index! + next.index!));
    p.warnings.push('外部評価委員会（筑西市総合振興審議会）の各選択肢の評価件数を原文の選択肢名のまま収録。○印の位置は抽出で崩れているため委員会としての最終判定は未収録。表題（令和８年度）と公表ページ（令和７年度実施）で年度表記が異なるため評価年度は未設定。');
    return [p];
  });
}

export const kamakura = municipality('14204', kamakuraSheet);
export const chikusei = municipality('08227', chikuseiExternal);
