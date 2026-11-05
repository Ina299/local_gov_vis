/** URL handler suffixes are not media types. Only saved, identity-matched
 * verified-byte PDF extraction can establish PDF format without reacquisition. */
export function cachedSourceFormat(source:{id:string;url:string;format:string;acquisition:{sourceSha256:string}}, asset:{sourceId:string;sourceUrl:string;sourceSha256:string;extractionMethod?:string}):'pdf'|'html'|'xlsx'|null {
 if(source.format==='pdf'||source.format==='html'||source.format==='xlsx')return source.format;
 if(asset.sourceId===source.id&&asset.sourceUrl===source.url&&asset.sourceSha256===source.acquisition.sourceSha256&&asset.extractionMethod==='pdftotext_from_verified_bytes')return 'pdf';
 if(asset.sourceId===source.id&&asset.sourceUrl===source.url&&asset.sourceSha256===source.acquisition.sourceSha256&&asset.extractionMethod==='visible_html_from_verified_bytes')return 'html';
 return null;
}
