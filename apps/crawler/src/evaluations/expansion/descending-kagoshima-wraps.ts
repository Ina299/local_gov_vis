import type {LayoutReview} from './descending-layouts-r2';
import {type CachedInput,evidence,project} from './shared';
/** Explicit official-link-label association, independently verified against cached metadata.
 * PDF titleBasis=official_link_label: 事務事業評価結果(141~161
 * Landing page has this unique divided-report label immediately under its R7 evaluation result heading.
 * No year is inferred from the PDF's two-year future implementation-plan scope.
 */
export function reviewKagoshimaWraps(i:CachedInput,inputs:CachedInput[]):LayoutReview|null{
 if(i.municipalityCode!=='46201'||i.sourceId!=='433454cefae4630ce2be53d4'||i.format!=='pdf')return null;
 const r:LayoutReview={projects:[],units:[],status:'reviewed_wrapped_business_list',reason:'Eleven wraps complement959 existing single-line records; prior values untouched',proofs:[]};
 const page=inputs.find(p=>p.municipalityCode===i.municipalityCode&&p.sourceId==='90564b06cf22e175be276861'&&p.format==='html'&&!p.truncated),year='令和7年度の事務事業評価結果は下記のとおりです。',label='事務事業評価結果(141~161\n)（PDF：671KB）';
 if(i.truncated||!i.sourceUrl.endsWith('/documents/r7hyoukap141-161.pdf')||!page?.text.includes(year)||!page.text.includes(label)||page.text.split(label).length!==2){r.status='source_year_association_hold';r.reason='Need complete hash-verified official R7 landing page and unique exact divided-report label; PDF plan years alone are insufficient';return r;}
 for(const row of wrappedRows){const u={start:row.start,name:row.name,status:'held',reason:'Reviewed complete row literal differs'};r.units.push(u);if(i.text.slice(row.start,row.start+row.raw.length)!==row.raw)continue;const p=project(i,String(row.num),row.name,2025,row.raw,row.start);p.evaluatedFiscalYear=null;p.evidence.push(evidence(page,year),evidence(page,label));p.warnings.push('既存959行に含まれない折返し11行。評価年度は同一資料の公式リンクラベルを持つ保存済み公表ページの明示「令和7年度」で確認。PDFの令和7〜8年度計画期間を実施年度と推測しない。担当課・費用・評価値は今回追加しない。');r.projects.push(p);u.status='supported';u.reason='Literal wrap and exact official-link-label/annual landing-page association';}
 r.proofs=[year,label];return r;
}
const wrappedRows = [
  {
    "num": 25,
    "name": "職員研修事業（職場研修の充実、基本研修及び専門研修等の充実、中堅職員マインドアップ研修）",
    "start": 1441,
    "raw": "職員研修事業（職場研修の充実、基本研修及び専門研修等の充実、\n25 総務局 人事課 Ｄ 縮小\n中堅職員マインドアップ研修）"
  },
  {
    "num": 112,
    "name": "セーフコミュニティ促進事業",
    "start": 4617,
    "raw": "安心安全課・こども政策課\n112 セーフコミュニティ促進事業 危機管理局 Ｆ 廃止 セーフコミュニティの取組の基盤やノウハウ等が蓄積されたため\n・長寿支援課・保健体育課"
  },
  {
    "num": 145,
    "name": "地域の魅力・活力共創事業",
    "start": 5842,
    "raw": "地域づくり推進課・\n145 地域の魅力・活力共創事業 市民局 吉田・桜島・喜入・松元・郡山総務市民課 Ｂ 見直し"
  },
  {
    "num": 211,
    "name": "地域まつり支援事業",
    "start": 8318,
    "raw": "吉田・桜島・喜入・松元・郡山\n211 地域まつり支援事業 市民局 Ａ 継続\n総務市民課"
  },
  {
    "num": 272,
    "name": "衛生処理施設等運転管理費・鹿児島市地域下水道事業（包括的民間委託分）",
    "start": 10468,
    "raw": "衛生処理施設等運転管理費・鹿児島市地域下水道事業（包括的民\n272 環境局 南部清掃工場 Ａ 継続\n間委託分）"
  },
  {
    "num": 317,
    "name": "高齢者保健福祉計画及び介護保険事業計画策定管理事業【介護保険特別会計】",
    "start": 12139,
    "raw": "高齢者保健福祉計画及び介護保険事業計画策定管理事業【介護保\n317 健康福祉局 長寿支援課 Ｂ 見直し\n険特別会計】"
  },
  {
    "num": 326,
    "name": "介護予防・日常生活支援総合事業（介護予防・生活支援サービス事業）【介護保険特別会計】",
    "start": 12609,
    "raw": "介護予防・日常生活支援総合事業（介護予防・生活支援サービス事\n326 健康福祉局 長寿あんしん課 Ｂ 見直し\n業）【介護保険特別会計】"
  },
  {
    "num": 786,
    "name": "国民宿舎レインボー桜島の管理運営（桜島観光施設特別会計繰出金）",
    "start": 29635,
    "raw": "国民宿舎レインボー桜島の管理運営（桜島観光施設特別会計繰出\n786 観光交流局 観光振興課 Ａ 継続\n金）"
  },
  {
    "num": 803,
    "name": "鹿児島市スポーツ振興協会負担金（JFA全日本U-12サッカー選手権大会開催支援事業）",
    "start": 30264,
    "raw": "鹿児島市スポーツ振興協会負担金（JFA全日本U-12サッカー選手権\n803 観光交流局 スポーツ課 Ａ 継続\n大会開催支援事業）"
  },
  {
    "num": 812,
    "name": "鹿児島市スポーツ振興協会負担金(南日本小学生バレーボール大会の開催)",
    "start": 30721,
    "raw": "鹿児島市スポーツ振興協会負担金(南日本小学生バレーボール大会\n812 観光交流局 スポーツ課 Ａ 継続\nの開催)"
  },
  {
    "num": 813,
    "name": "鹿児島市スポーツ振興協会負担金(南日本Ｕ－１２サッカー大会の開催)",
    "start": 30778,
    "raw": "鹿児島市スポーツ振興協会負担金(南日本Ｕ－１２サッカー大会の開\n813 観光交流局 スポーツ課 Ａ 継続\n催)"
  }
];
