/** 都道府県の整理済み事業票の抽出器（コードは 13000 の形）。各ファイルの `entries` をここで合わせる。 */
import type { Entry } from '../../evaluations/expansion/batch9/i1-util';
import { entries as aichi } from './p-aichi';
import { entries as akita } from './p-akita';
import { entries as chiba } from './p-chiba';
import { entries as ehime } from './p-ehime';
import { entries as fukui } from './p-fukui';
import { entries as fukuoka } from './p-fukuoka';
import { entries as fukushima } from './p-fukushima';
import { entries as hiroshima } from './p-hiroshima';
import { entries as ibaraki } from './p-ibaraki';
import { entries as kagawa } from './p-kagawa';
import { entries as kagoshima } from './p-kagoshima';
import { entries as kumamoto } from './p-kumamoto';
import { entries as miyagi } from './p-miyagi';
import { entries as nagano } from './p-nagano';
import { entries as nagasaki } from './p-nagasaki';
import { entries as oita } from './p-oita';
import { entries as okinawa } from './p-okinawa';
import { entries as osaka } from './p-osaka';
import { entries as saga } from './p-saga';
import { entries as shiga } from './p-shiga';
import { entries as shimane } from './p-shimane';
import { entries as shizuoka } from './p-shizuoka';
import { entries as tochigi } from './p-tochigi';
import { entries as tokyo } from './p-tokyo';
import { entries as wakayama } from './p-wakayama';
import { entries as yamagata } from './p-yamagata';

export const prefectureExtractors: Record<string, Entry> = {
  ...aichi,
  ...akita,
  ...chiba,
  ...ehime,
  ...fukui,
  ...fukuoka,
  ...fukushima,
  ...hiroshima,
  ...ibaraki,
  ...kagawa,
  ...kagoshima,
  ...kumamoto,
  ...miyagi,
  ...nagano,
  ...nagasaki,
  ...oita,
  ...okinawa,
  ...osaka,
  ...saga,
  ...shiga,
  ...shimane,
  ...shizuoka,
  ...tochigi,
  ...tokyo,
  ...wakayama,
  ...yamagata,
};
