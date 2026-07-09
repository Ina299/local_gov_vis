/**
 * 検索インデックス（apps/web/public/search-index.json）に読み仮名を付与する。
 * 総務省「全国地方公共団体コード」Excel のカナ列（半角カタカナ）を
 * ひらがな（yomi）とローマ字（roma）に変換して各エントリへ書き込む。
 * 「かわさき」「kawasaki」のようなIME確定前・ローマ字の検索を可能にするため。
 *
 * search-index.json は import:municipal が再生成するため、その後に実行する
 * （update:all には組み込み済み）。
 *
 * 実行: npm run -w @local-gov/crawler import:yomi
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_PUBLIC = join(__dirname, '..', '..', '..', 'apps', 'web', 'public');

// 総務省 全国地方公共団体コード（ふりがな付き・令和6年1月1日版）
// https://www.soumu.go.jp/denshijiti/code.html
const CODE_XLSX_URL = 'https://www.soumu.go.jp/main_content/000925835.xlsx';

interface SearchEntry {
  code: string;
  name: string;
  prefCode?: string;
  prefName?: string;
  yomi?: string;
  roma?: string;
}

// ---- 半角カタカナ → ひらがな ----

const HALF_TO_HIRA: Record<string, string> = {
  ｱ: 'あ', ｲ: 'い', ｳ: 'う', ｴ: 'え', ｵ: 'お',
  ｶ: 'か', ｷ: 'き', ｸ: 'く', ｹ: 'け', ｺ: 'こ',
  ｻ: 'さ', ｼ: 'し', ｽ: 'す', ｾ: 'せ', ｿ: 'そ',
  ﾀ: 'た', ﾁ: 'ち', ﾂ: 'つ', ﾃ: 'て', ﾄ: 'と',
  ﾅ: 'な', ﾆ: 'に', ﾇ: 'ぬ', ﾈ: 'ね', ﾉ: 'の',
  ﾊ: 'は', ﾋ: 'ひ', ﾌ: 'ふ', ﾍ: 'へ', ﾎ: 'ほ',
  ﾏ: 'ま', ﾐ: 'み', ﾑ: 'む', ﾒ: 'め', ﾓ: 'も',
  ﾔ: 'や', ﾕ: 'ゆ', ﾖ: 'よ',
  ﾗ: 'ら', ﾘ: 'り', ﾙ: 'る', ﾚ: 'れ', ﾛ: 'ろ',
  ﾜ: 'わ', ｦ: 'を', ﾝ: 'ん',
  ｧ: 'ぁ', ｨ: 'ぃ', ｩ: 'ぅ', ｪ: 'ぇ', ｫ: 'ぉ',
  ｬ: 'ゃ', ｭ: 'ゅ', ｮ: 'ょ', ｯ: 'っ', ｰ: 'ー',
};

const DAKUTEN: Record<string, string> = {
  か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご',
  さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ',
  た: 'だ', ち: 'ぢ', つ: 'づ', て: 'で', と: 'ど',
  は: 'ば', ひ: 'び', ふ: 'ぶ', へ: 'べ', ほ: 'ぼ',
  う: 'ゔ',
};

const HANDAKUTEN: Record<string, string> = {
  は: 'ぱ', ひ: 'ぴ', ふ: 'ぷ', へ: 'ぺ', ほ: 'ぽ',
};

function halfKanaToHiragana(input: string): string {
  let out = '';
  for (const ch of input) {
    if (ch === 'ﾞ') {
      const prev = out.slice(-1);
      out = out.slice(0, -1) + (DAKUTEN[prev] ?? prev);
    } else if (ch === 'ﾟ') {
      const prev = out.slice(-1);
      out = out.slice(0, -1) + (HANDAKUTEN[prev] ?? prev);
    } else {
      out += HALF_TO_HIRA[ch] ?? ch;
    }
  }
  return out;
}

// ---- ひらがな → ローマ字（ヘボン式ベース） ----

const ROMA: Record<string, string> = {
  きゃ: 'kya', きゅ: 'kyu', きょ: 'kyo', ぎゃ: 'gya', ぎゅ: 'gyu', ぎょ: 'gyo',
  しゃ: 'sha', しゅ: 'shu', しょ: 'sho', じゃ: 'ja', じゅ: 'ju', じょ: 'jo',
  ちゃ: 'cha', ちゅ: 'chu', ちょ: 'cho', にゃ: 'nya', にゅ: 'nyu', にょ: 'nyo',
  ひゃ: 'hya', ひゅ: 'hyu', ひょ: 'hyo', びゃ: 'bya', びゅ: 'byu', びょ: 'byo',
  ぴゃ: 'pya', ぴゅ: 'pyu', ぴょ: 'pyo', みゃ: 'mya', みゅ: 'myu', みょ: 'myo',
  りゃ: 'rya', りゅ: 'ryu', りょ: 'ryo',
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', を: 'o', ん: 'n', ゔ: 'vu',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o', ー: '',
};

function hiraganaToRomaji(hira: string): string {
  let out = '';
  let i = 0;
  while (i < hira.length) {
    if (hira[i] === 'っ') {
      // 促音: 次の音の子音を重ねる（ちゃ行は t を置く: さっちょん → satchon）
      const next = ROMA[hira.slice(i + 1, i + 3)] ?? ROMA[hira[i + 1]] ?? '';
      out += next.startsWith('ch') ? 't' : next.charAt(0);
      i += 1;
      continue;
    }
    const two = ROMA[hira.slice(i, i + 2)];
    if (two !== undefined) {
      out += two;
      i += 2;
      continue;
    }
    out += ROMA[hira[i]] ?? '';
    i += 1;
  }
  return out;
}

async function main(): Promise<void> {
  const indexPath = join(WEB_PUBLIC, 'search-index.json');
  const entries: SearchEntry[] = JSON.parse(readFileSync(indexPath, 'utf-8'));

  console.log('団体コード表をダウンロード中...');
  const res = await fetch(CODE_XLSX_URL);
  if (!res.ok) throw new Error(`ダウンロード失敗: ${res.status} ${CODE_XLSX_URL}`);
  const wb = XLSX.read(Buffer.from(await res.arrayBuffer()));

  // コード（都道府県2桁/市区町村5桁）→ ひらがな読み。政令市の区シートも取り込む
  const yomiByCode = new Map<string, string>();
  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1 });
    for (const row of rows.slice(1)) {
      const [code6, , muniName, prefKana, muniKana] = row as Array<string | undefined>;
      if (!code6 || !/^\d{6}$/.test(String(code6))) continue;
      if (muniName && muniKana) {
        yomiByCode.set(String(code6).slice(0, 5), halfKanaToHiragana(String(muniKana)));
      } else if (!muniName && prefKana) {
        yomiByCode.set(String(code6).slice(0, 2), halfKanaToHiragana(String(prefKana)));
      }
    }
  }

  let patched = 0;
  const missing: string[] = [];
  for (const entry of entries) {
    const yomi = yomiByCode.get(entry.code);
    if (yomi) {
      entry.yomi = yomi;
      entry.roma = hiraganaToRomaji(yomi);
      patched++;
    } else {
      missing.push(`${entry.code} ${entry.name}`);
    }
  }

  writeFileSync(indexPath, JSON.stringify(entries));
  console.log(`読み仮名を付与: ${patched}/${entries.length}件`);
  if (missing.length > 0) {
    console.warn(`読み仮名なし: ${missing.length}件\n  ${missing.slice(0, 10).join('\n  ')}`);
  }
  // 政令市の区名変更や合併でコード表と突合できない場合に気づけるように
  if (patched / entries.length < 0.99) {
    throw new Error('読み仮名の付与率が99%を下回りました。コード表のURL・レイアウトを確認してください。');
  }
}

main();
