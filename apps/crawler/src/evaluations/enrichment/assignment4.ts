/** Source-bound, null-only enrichment candidates. No edits to published assets. */
export interface Slice {start:number;text:string;code?:string;name?:string}
export interface Field {field:'purpose'|'activities'|'outcomes';value:string;start:number;quote:string}
export function sections(code:string,text:string):Slice[]{
 const patterns:Record<string,RegExp>={
 '35207':/^事務事業評価シート 【№[０-９]+】$/gm,
 '13107':/^令和８年度 事務事業評価シート No\. \d+$/gm,
 '38205':/^I 基礎情報 事後評価 2024 (\d{5}_\d{2})$/gm,
 '08210':/^令和７年度 事務事業評価シート（令和６年度実績）.*$/gm,
 '01213':/^事務事業評価（主要事業レビュー）$/gm,
 '13203':/^事務事業評価シート （評価対象年度：令和 7 年度）$/gm,
 '08217':/^令和７年度分 重点事業マネジメントシート$/gm,
 '31202':/^令和７年度 事務事業評価票[^\n]*$/gm,
 '02446':/^事務事業名 .+ 番 号 \d+$/gm,
 '05434':/^事務事業名 .+ 担当課名 .+$/gm,
 '07213':/^部 長 課 長 係 長 担当者$/gm,
 };
 const rx=patterns[code];if(!rx)return [];
 const heads=[...text.matchAll(rx)];return heads.map((h,i)=>{let raw=text.slice(h.index,heads[i+1]?.index??text.length);let projectCode:string|undefined,name:string|undefined;
 if(code==='35207'){projectCode=h[0].match(/№([０-９]+)/)?.[1].normalize('NFKC');name=raw.match(/^事務事業 (.+?) 担当課/m)?.[1];}
 if(code==='13107'){projectCode=h[0].match(/No\. (\d+)/)?.[1];name=raw.match(/^事 業 名 (.+)$/m)?.[1];}
 if(code==='38205'){projectCode=h[1];name=raw.match(/細事業名 (.+)/)?.[1];raw=raw.replace(/\n令和6年度事務事業評価表\s*$/,'');}
 if(code==='01213'){projectCode=raw.match(/事務事業番号 (\d+)/)?.[1];name=raw.match(/^事業名 (.+?) 担当部署/m)?.[1];}
 if(code==='13203'){projectCode=raw.match(/No\.\n(\d+)/)?.[1]??raw.match(/業 (\d+)\n/)?.[1];name=raw.match(/^事業名 (.+?) 所管課/m)?.[1];}
 if(code==='08210')name=raw.match(/^事務事業名 (.+?) \S+(?:課|室|局|館|センター)$/m)?.[1];
 if(code==='08217')name=raw.match(/^重点事業名 (.+)$/m)?.[1];
 if(code==='31202')projectCode=raw.match(/整理番号 (\d+)/)?.[1];
 if(code==='02446')name=raw.match(/^事務事業名 (.+) 番 号/m)?.[1];
 if(code==='05434')name=raw.match(/^事務事業名 (.+?) 担当課名/m)?.[1];
 if(code==='07213')name=raw.match(/^事業名 (.+?) 担当課/m)?.[1];
 return {start:h.index,text:raw,code:projectCode,name};});
}
export function fields(code:string,s:Slice):Field[]{
 const out:Field[]=[];
 const take=(field:Field['field'],rx:RegExp)=>{const m=rx.exec(s.text);if(!m||!m[1]?.trim())return;const value=m[1].trim();if(value.length<5||value.length>5000)return;out.push({field,value,quote:m[0],start:s.start+m.index});};
 if(code==='35207')take('activities',/^１ 事務事業の概要\n([\s\S]+?)\n２ 事務事業のコスト/m);
 if(code==='13107'){
  take('purpose',/^主管課 [^\n]+\n([\s\S]+?)\n[^\n]+\n対 象 者/m);
  take('activities',/^実施基準 [^\n]+\n([\s\S]+?)\n開始年度/m);
  const a=out.find(x=>x.field==='activities');if(a&&!a.value.includes('事業内容'))out.splice(out.indexOf(a),1);
 }
 if(code==='38205'){
  take('activities',/^事\n手 段\n務 ([\s\S]+?)\n（どうやって）/m);
  take('purpose',/^目 的 ([\s\S]+?)\n（どんな状態にしたいのか）/m);
  take('outcomes',/^成果 総合評価（令和6年度）[^\n]*\n([\s\S]+)$/m);
 }
 if(code==='08210'){
  take('purpose',/^目的 ([\s\S]+?)\n内容 /m);
  take('activities',/^内容 ([\s\S]+?)\n種別 /m);
 }
 if(code==='01213'){
  take('purpose',/^事業費計\(A\+B\)[^\n]*公平性 効率性\n([\s\S]+?)\n事業の内容/m);
  take('activities',/^事業の内容\n(?:SDGs17の目標\n)?([\s\S]+?)\n指標名 /m);
 }
 if(code==='13203'){
  take('purpose',/^事業の目的\n([\s\S]+?)\n成したい成果）/m);
  take('activities',/^成したい成果）\n([\s\S]+?)\n■実績と成果/m);
  const a=out.find(x=>x.field==='activities');if(a&&!a.value.includes('事業概要等'))out.splice(out.indexOf(a),1);
  // Purpose and outcome row labels interrupt the prose; do not rearrange the columns.
 }
 if(code==='08217')take('purpose',/^事業目的・概要\n([\s\S]+?)\nR6 R7 R8 R9/m);
 if(code==='31202'){
  // Row labels interrupt purpose and implementation prose; omit until full-cell boundaries are certain.
 }
 if(code==='02446'){
  // The label falls in the middle of wrapped prose, so a label-following line is not a complete cell.
 }
 if(code==='05434'){
  take('purpose',/^事業の目的 ([^\n]+)\n事業の内容/m);
  take('activities',/^事業の内容 ([\s\S]+?)\n事業の対象/m);
  take('outcomes',/^事業の効果等 ([^\n]*。)\n/m);
 }
 if(code==='07213')take('purpose',/^目的と方針 ([\s\S]+?)\n事業概要/m);
 // General evaluation prose sometimes moves from completed work to plans. Keep only
 // complete initial sentences with explicit past-tense result wording, stopping at future advice.
 if(code==='38205'){
  const o=out.find(x=>x.field==='outcomes');if(o){
   const sentences=o.value.match(/[^。]*。/g)??[];let value='';
   for(const sentence of sentences){if(/今後|引き続き|必要|課題|予定|見込み|努めてい|していく|図ってい|求められ/.test(sentence))break;value+=sentence;}
   value=value.trim();if(!value||!/(?:した|できた|なった|あった|された|している|できている|図られた|つながった)。/.test(value))out.splice(out.indexOf(o),1);else o.value=value;
  }
 }
 for(const f of out){f.value=f.value.replace(/^(?:事業の目的 |事業概要等 |（施策の目的を受\nけて事業として達\n)/,'').replace(/\n事業内容$/,'').trim();}
 return out;
}
