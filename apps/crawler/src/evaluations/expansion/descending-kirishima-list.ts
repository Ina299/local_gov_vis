import type {LayoutReview} from './descending-layouts-r2';
import {type CachedInput,evidence,project} from './shared';
export function reviewKirishimaList(i:CachedInput):LayoutReview|null{
 if(i.municipalityCode!=='46218'||i.format!=='pdf'||!['2bb4f71ef759abdb53d761f7','6bd9f8b083db0c6dc7c62665'].includes(i.sourceId))return null;
 const r:LayoutReview={projects:[],units:[],status:'reviewed_execution_list',reason:'Each numbered source row inventoried; inline complete names supported, wrapped column names require explicit reconstruction',proofs:[]};
 const year=/^令和([０-９]+)年度に公表する令和([０-９]+)年度に実施した事務事業の一覧（課別）/.exec(i.text);
 if(i.truncated||!year){r.status='identity_hold';r.reason='Complete annual execution-list title absent';return r;}
 const heads=[...i.text.matchAll(/^(?:きょうどう|しんらい|くらし|やさしさ|はぐくみ|にぎわい)（/gm)];
 const blocks=heads.map((h,n)=>{const start=h.index!,rawBody=i.text.slice(start,heads[n+1]?.index??i.text.length);let body=rawBody;
  for(const [prefix,suffix]of [['市民環境部スポーツ・文化振興','課'],['保健福祉部こども・くらし相談セ','ンター']]){
   if(body.includes(prefix+' ')&&new RegExp('^'+suffix+' ','m').test(body))body=body.replace(prefix+' ','').replace(new RegExp('^'+suffix+' ','m'),'').replace(/^(\d+) /m,'$1 '+prefix+suffix+' ');
  }
  body=body.replace(/^(\d+) (保健福祉部こども・くらし相談センター)\n([^\n]+[↑→↓×] [↑→↓×])$/gm,'$1 $2 $3');
  const rows=[...body.matchAll(/^(\d+) ([^\s]+)(?: ([^\n]*?))? ([↑→↓×]) ([↑→↓×])$/gm)];return {start,body,rawBody,rows};});
 const clean=(s:string)=>s.replace(/^令和[^\n]+$|^＜[^\n]+$|^事業 コスト$|^No\. [^\n]+$|^方向性 方向性$|^\d+ ページ$/gm,'').split(/\s+/).filter(Boolean);
 const templates=new Map<string,string[]>();for(const t of reviewedTemplates){const a=t.split(/\s+/);templates.set([...a].sort().join("\n"),a);}
 for(const {body,rows}of blocks){if(rows.length!==1)continue;const m=rows[0],tail=(m[3]??'').split(' ').at(-1)!;if(!completeName(tail))continue;const other=clean(body.replace(m[0],(m[3]??'').slice(0,(m[3]??'').length-tail.length)));if(other.some(t=>!columnTokens.has(t)))continue;templates.set([...other].sort().join('\n'),other);}
 for(const {start,body,rawBody,rows}of blocks){
  const u={start,name:undefined as string|undefined,status:'layout_pending',reason:'No uniquely verified non-name-column template; wrapped title still needs explicit source-bound review'};r.units.push(u);
  if(rows.length!==1){u.reason='Numbered row/direction boundaries not unique in the policy block';continue;}
  const m=rows[0];if(i.sourceId==='2bb4f71ef759abdb53d761f7'&&['44','45'].includes(m[1])){
   const prefix='公共施設照明ＬＥＤ・',prior=blocks.find(b=>b.rows[0]?.[1]==='44');
   if(!prior?.rawBody.endsWith(prefix+'\n')||!i.text.includes('再生可能エネルギー')||!body.includes(m[1]==='44'?'財政計画事務':'設備等整備管理事')){u.reason='Reviewed cross-boundary literal differs';continue;}
   const name=m[1]==='44'?'財政計画事務':prefix+'再生可能エネルギー設備等整備管理事業',p=project(i,'list-'+m[1],name,null,rawBody,start);p.projectCode=null;p.department=m[2];p.evaluatedFiscalYear=2025;p.evidence.push(evidence(i,year[0],0));if(m[1]==='45')p.evidence.push(evidence(i,prefix,prior.start+prior.rawBody.indexOf(prefix)));p.warnings.push('44/45行境界の名称先頭「公共施設照明ＬＥＤ・」を原文位置で別途保持した個別照合。金額や矢印評価は未採用。');r.projects.push(p);u.name=name;u.status='supported';u.reason='Explicit cross-row prefix mapping, separate literal evidence preserved';continue;
  }const tokens=clean(body.replace(m[0],m[3]??'')),possibilities=new Set<string>();
  for(const template of templates.values()){
   const counts=new Map<string,number>();for(const t of template)counts.set(t,(counts.get(t)??0)+1);
   const residual:string[]=[];for(const t of tokens){const c=counts.get(t)??0;if(c)counts.set(t,c-1);else residual.push(t);}
   if([...counts.values()].some(Boolean)||residual.some(t=>template.includes(t)))continue;
   const name=residual.join('');if(residual.length<=6&&completeName(name))possibilities.add(name);
  }
  if(possibilities.size!==1){u.reason=possibilities.size?'Multiple non-name-column templates produce differing titles':'No matching complete non-name-column template; requires manual title/column review';continue;}
  const name=[...possibilities][0],p=project(i,'list-'+m[1],name,null,rawBody,start);p.projectCode=null;p.department=m[2];p.evaluatedFiscalYear=2018+Number(year[2].normalize('NFKC'));p.evidence.push(evidence(i,year[0],0));p.warnings.push('実施事務事業一覧の名称と明示実施年度のみ。同冊子の名称が一行で完結する行で検証した非名称3列の完全一致テンプレートを照合し、残る名称断片を原順序で連結。名称との重複語や複数の復元候補は不採用。公表年度・項番・矢印を評価年度・事業コード・数値評価に転用しない。');r.projects.push(p);u.name=name;u.status='supported';u.reason='Exactly one complete non-name-column template leaves a bounded business title; no overlapping template/title tokens';
 }r.proofs=[year[0]];return r;
}

// Reviewed non-project cells only. A residual unrecognised token blocks the whole title,
// preventing a wrapped prefix from being silently dropped.
const columnTokens=new Set(`きょうどう（市民とつく る協働と連携のまち づくり） しんらい（信頼される 行政経営によるまち くらし（みどりあふれ る快適で暮らし続け たいまちづくり） やさしさ（誰もが支え あいながら生き生き と暮らせるまちづく り） はぐくみ（社会を生き 抜く力と生涯を通じて 学びあう力を育むま ちづくり） にぎわい（産業の活 力あふれ、交流と賑 わいが生まれるまち
活力ある地域づくり の推進 市民活動の支援と協 働の推進 持続可能な行財政運 営の推進 効率的で適応力に富 んだ行政運営 市民の視点に立った 行政サービスの提供 市民と行政による情 報の相互活用 市民生活の安全性 の向上 防災基盤の整備と災 害復旧対策の推進 交通安全・防犯対策 健康づくりの推進と 医療体制の充実 拠点の整備 安心して子どもを産 み育てられる環境の 充実 妊娠期から乳幼児期 までの切れ目のない 支援の充実 質の高い医療体制 の確保 健康危機に備えた感 染症対策の強化 多様な学びを支援す る社会教育の充実 る学習環境の充実 立志と将来への希望 を育む学校教育の充 実 専門高校としての魅 力を高める高等学校 教育の充実 活力ある農・林・水産 業の振興 農林水産業の担い 手の育成・確保 議会運営への支援
快適生活の基盤づく りの推進 良質な住環境の整備 市職員の人材育成 共生する地域社会の 実現 道路ネットワークの 構築と道路施設の維 持 進 障がい者（児）への 福祉サービスや支援 体制の充実 生産基盤の整備と農 山漁村の振興 自然と共生する良好 な生活環境の形成 火災の予防と救急・ 救助体制の充実 多様な教育活動・支 援環境の充実 適正・公平な課税・収 納 環境保全意識の向 上 人権尊重・男女共同 人権教育・啓発の推 参画の推進と多文化 共生 地域特性を生かした 観光の推進 公有財産の適切な管 理と利活用 地球にやさしい循環 型社会の形成 高齢者が地域で自分 らしく暮らし続けられ る環境の充実 多様なニーズに応じ た子育て環境の充実 地域産業の活性化 創業支援と企業誘致 国内外の観光客の 誘致 歳入に見合った予算 編成と適正な予算執 行 地域旅客運送サービ バス交通の利便性向 スの持続可能な提供 上と効率的運行 デジタル技術を活用 した行政サービスの ごみの減量化・資源 化 ごみの適正な排出・ 処理 住民参加と互いに支 え合う地域福祉の推 介護予防の推進と高 齢者の生きがいづく りの充実 障がい者の自立と社 会参加の促進 自然環境の保全 農林水産業の稼ぐ力 健全な消費生活の推 観光素材の創出と活 用 市の魅力と価値を高 シティプロモーション める多角的施策の展 開 計画的な土地の活用 と良好な景観づくり 夢実現のための学力 の向上と個性を育む 教育の推進 豊かな心と健康な体 を育む支援体制の充 地域ぐるみで子ども の成長を支える体制 づくり 文化財の保存・継承 と活用`.split(/\s+/));

function completeName(s:string){return /^(?!事業$|事務$|業$|費$|運営事業$|支援事業$|管理事業$).{2,100}(?:事業|事務|事業費|業務)(?:（[^（）]+）)?$/.test(s);}

// Three source columns, transcribed from reviewed pending rows; these do not include business names.
const policies={
 k:'きょうどう（市民とつく る協働と連携のまち づくり）',
 s:'しんらい（信頼される 行政経営によるまち づくり）',
 c:'くらし（みどりあふれ る快適で暮らし続け たいまちづくり）',
 y:'やさしさ（誰もが支え あいながら生き生き と暮らせるまちづく り）',
 h:'はぐくみ（社会を生き 抜く力と生涯を通じて 学びあう力を育むま ちづくり）',
 n:'にぎわい（産業の活 力あふれ、交流と賑 わいが生まれるまち づくり）'};
const reviewedTemplates=[
 policies.n+' 地域特性を生かした 観光の推進 利便性の高い観光地 づくりの推進',
 policies.y+' 共生する地域社会の 実現 障がい者（児）への福 祉サービスや支援体 制の充実',
 policies.y+' 健康づくりの推進と 医療体制の充実 質の高い医療体制の 確保',
 policies.n+' 活力ある農・林・水産 業の振興 農林水産業の担い手 の育成・確保',
 policies.h+' 立志と将来への希望 を育む学校教育の充 実 夢実現のための学力 の向上と個性を育む 教育の推進',
 policies.k+' 市の魅力と価値を高 める多角的施策の展 開 広域的な連携の推進',
 policies.k+' 市の魅力と価値を高 める多角的施策の展 開 産官学との連携の推 進',
 policies.k+' 人権尊重・男女共同 参画の推進と多文化 共生 平和意識の醸成',
 policies.k+' 活力ある地域づくり の推進 中山間地域の活動 支援',
 policies.k+' 活力ある地域づくり の推進 移住定住の促進',
 policies.k+' 人権尊重・男女共同 参画の推進と多文化 共生 多文化共生の地域 づくり',
 policies.k+' 人権尊重・男女共同 参画の推進と多文化 共生 あらゆる分野におけ る男女共同参画の推 進',
 policies.s+' 持続可能な行財政運 営の推進 歳入に見合った予算 編成と適正な予算執 行',
 policies.c+' 地球にやさしい循環 型社会の形成 地球温暖化対策の 推進',
 policies.c+' 自然と共生する良好 な生活環境の形成 大気・音環境の保全',
 policies.c+' 快適生活の基盤づく りの推進 水の安定供給と適正 な排水処理',
 policies.y+' 安心して子どもを産 み育てられる環境の 充実 結婚を希望する人へ の支援',
 policies.y+' 共生する地域社会の 実現 生活困窮者等への 支援',
 policies.y+' 高齢者が地域で自分 らしく暮らし続けられ る環境の充実 高齢者の生活支援 サービスの充実',
 policies.y+' 共生する地域社会の 実現 社会保障制度の円 滑な運営',
 policies.y+' 健康づくりの推進と 医療体制の充実 質の高い医療体制 の確保',
 policies.y+' 安心して子どもを産 み育てられる環境の 充実 子育てに関する負担 軽減の推進',
 policies.n+' 地域旅客運送サービ スの持続可能な提供 の確保 総合的な公共交通の 連携の強化',
 policies.n+' 地域産業の活性化 地域を支える産業の 育成・支援',
 policies.n+' 地域産業の活性化 魅力的な就業環境と 担い手の確保',
 policies.n+' 地域産業の活性化 霧島ブランドの確立 と販路の拡大',
 policies.n+' 地域特性を生かした 観光の推進 利便性の高い観光 地づくりの推進',
 policies.h+' スポーツ・文化に親し む環境づくり スポーツに親しむ環 境づくりの推進',
 policies.h+' スポーツ・文化に親し む環境づくり 芸術文化に親しむ環 境づくりの推進',
 policies.h+' 多様な学びを支援す る社会教育の充実 生きる力を育む体 験・交流活動の充実',
 policies.h+' 立志と将来への希望 を育む学校教育の充 実 専門高校としての魅 力を高める高等学校 教育の充実',
];
