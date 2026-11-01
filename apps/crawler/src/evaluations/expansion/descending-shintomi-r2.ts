import type {LayoutReview} from './descending-layouts-r2';
import {type CachedInput,project,evidence} from './shared';
const books:Record<string,{fy:number;year:string;count:number}>={
'bfcd5b51524f77ef00404c73':{fy:2020,year:'令和２年度',count:148},
'030a43b54a357a1af75b0cae':{fy:2025,year:'令和７年度',count:166},
'0b2035cecbe5cb033b6426b0':{fy:2024,year:'令和 6 年度',count:153},
'a2ef15c59e5cfc5c64720cee':{fy:2023,year:'令和５年度',count:155},
'f9b28711961dffbdc3690e5f':{fy:2021,year:'令和３年度',count:157}};
const wraps:[string,string,string][]=[
["生産性向上特別措置法に基づく先端設備等導入計画を策定した事業所に","\n対する固定資産税の減免","対する固定資産税の減免"],["誘致企業に対し、新富町企業立地促進条例等に基づく財政支援や減免措置","\n等の活用","等の活用"],["指定管理者制度の活用による、管理団体のアイデアを生かした取り組み","\nの推進","の推進"],

['ＪＡみやざき児湯地区本部によるトレーニングハウスの施設整備、営農指導のため','\n産業振興課\nの支援','の支援'],
['生産性向上特別措置法に基づく先端設備等導入計画を策定した事業所に対する','\n産業振興課\n固定資産税の減免','固定資産税の減免'],
['誘致企業に対し、新富町企業立地促進条例等に基づく財政支援や減免措置等の活','\n総合政策課\n用','用'],
['誘致企業に対し、新富町企業立地促進条例等に基づく財政支援や減免措置等の','\n総合政策課\n活用','活用'],
['社会福祉協議会や民間事業所との連携による介護予防・日常生活支援総合事業の','\nあんしん\n充実','充実'],
['社会福祉協議会や民間事業所との連携による介護予防・日常生活支援総合事業の','\n福祉課\n充実','充実'],
['ゴミ出しが困難でありながら十分な支援を得られない高齢者への生活支援体制','\nの整備','の整備']];
export function reviewShintomiR2(input:CachedInput):LayoutReview|null{
 const book=books[input.sourceId];if(input.municipalityCode!=='45402'||!book)return null;
 const r:LayoutReview={projects:[],units:[],status:'reviewed_annual_implementation_units',reason:'Numbered operational implementation items in annual verification books, not policy chapters or KPI tables. Names and explicit target years only; no claim of successful execution or per-item numerical alignment.',proofs:[book.year,'実施計画書の検証']};
 if(input.truncated||input.format!=='pdf'||!input.text.slice(0,150).includes(book.year)||!input.text.slice(0,150).includes('実施計画書の検証')){r.status='annual_identity_hold';r.reason='Complete pinned annual verification book required';return r;}
 const pattern=book.fy<=2021?/^(?:[①-⑳㉑-㉟]|2[1-9]) ([^\n]+)$/gm:/^[①-⑳㉑-㉟] ([^\n]+)$/gm;
 const heads=[...input.text.matchAll(pattern)];
 if(heads.length!==book.count||(book.fy===2020?(input.text.match(/^検証$/gm)??[]).length!==29:(input.text.match(/【検証】/g)??[]).length!==book.count)){r.status='layout_boundary_hold';r.reason='Numbered item and verification count changed; must review source boundaries';return r;}
 for(const h of heads){const start=h.index!;let name=h[1],raw=h[0];const w=wraps.find(([prefix,suffix])=>prefix===name&&input.text.slice(start+h[0].length).startsWith(suffix));
 if(w){name+=w[2];raw+=w[1];}else if(wraps.some(([prefix])=>prefix===name)){r.units.push({start,name,status:'held',reason:'Known wrapped title lacks its exact suffix/department boundary'});continue;}
 const p=project(input,'annual-action-'+book.fy+'-'+start,name,null,raw,start);p.projectCode=null;p.evaluatedFiscalYear=book.fy;p.evidence.push(evidence(input,book.year),evidence(input,'実施計画書の検証'));p.warnings.push('総合戦略の政策章・KPIではなく、年度別実施計画検証の丸数字付き個別実施項目。原典の活動単位を保持し、複合項目を分割しない。名称・対象年度のみ収録。未実施や未達成を成功実績に読み替えず、配置が前後する検証本文・評価記号・費用は個別欄へ転記しない。評価実施年度は推定しない。');r.projects.push(p);r.units.push({start,name,status:'supported',reason:'Literal numbered implementation title in explicit annual verification scope; figures and outcome fields omitted'});
 }return r;
}
