import test from 'node:test';
import assert from 'node:assert/strict';
import {fields,sections} from '../src/evaluations/enrichment/assignment4';

test('purpose includes wrapped prose before a middle-row Tomakomai label',()=>{
 const text='事務事業評価（主要事業レビュー）\n事務事業番号 101\n事業名 保育事業 担当部署 教育課\n事業費計(A+B) 1 2 3 公平性 効率性\n児童を養育する家庭が\n事業の目的 一時的に保育できない時に支援する。\n事業の内容\nSDGs17の目標\n一時的な保育を提供する。\n指標名 単位\n';
 const block=sections('01213',text)[0],f=fields('01213',block);
 assert.equal(f.find(f=>f.field==='purpose')?.value,'児童を養育する家庭が\n事業の目的 一時的に保育できない時に支援する。');
 assert.equal(f.find(f=>f.field==='activities')?.value,'一時的な保育を提供する。');
 for(const q of f)assert.equal(text.slice(q.start,q.start+q.quote.length),q.quote);
});
test('Niihama outcome stops before forward-looking advice and next project',()=>{
 const text='I 基礎情報 事後評価 2024 00001_01\n細事業名 一つ目\n成果 総合評価（令和6年度） A\n支援を実施した。今後は改善が必要である。\n令和6年度事務事業評価表\nI 基礎情報 事後評価 2024 00002_01\n細事業名 二つ目\n成果 総合評価（令和6年度） B\n今後は支援を実施する予定である。';
 const s=sections('38205',text);assert.equal(s.length,2);
 assert.equal(fields('38205',s[0]).find(f=>f.field==='outcomes')?.value,'支援を実施した。');
 assert.equal(fields('38205',s[1]).some(f=>f.field==='outcomes'),false);
});
test('interrupted label-only fragments are not standalone purpose or activity',()=>{
 assert.deepEqual(fields('31202',{start:0,text:'目的 大山の事業を継続・\n（実施理由） 発展させる。\nR6実施内容\n活動した。'}),[]);
 assert.deepEqual(fields('02446',{start:0,text:'ＡＬ\n事業内容 Ｔの各小中学校への派遣、保育料\nの支援。'}),[]);
 assert.equal(fields('05434',{start:0,text:'地域の理解を\n事業の目的\n深める。\n事業の内容 講演をする。\n事業の対象 住民'}).some(f=>f.field==='purpose'),false);
});
test('Musashino activities preserve first line before an interleaved heading',()=>{
 const f=fields('13203',{start:0,text:'事業の目的\n（施策の目的を受\nけて事業として達\n市民の意見を把握する。\n成したい成果）\n①手紙の受付\n事業概要等 ②市民との対話\n③意識調査\n■実績と成果\n別の成果欄'});
 assert.equal(f.find(x=>x.field==='purpose')?.value,'市民の意見を把握する。');
 assert.equal(f.find(x=>x.field==='activities')?.value,'①手紙の受付\n事業概要等 ②市民との対話\n③意識調査');
});
