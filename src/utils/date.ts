export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

import { siteConfig } from '../config';

// Date を指定タイムゾーンでの YYYY-MM-DD 文字列にする (en-CA は YYYY-MM-DD 形式)
function toYmd(date: Date, timeZone: string): string {
  return date.toLocaleDateString('en-CA', { timeZone });
}

export function isPublished(date: Date): boolean {
  const tz = siteConfig.timezone;
  // フロントマターの date は UTC 0時として読み込まれるため、その日付部分(UTC基準)を取り出す。
  const postYmd = toYmd(date, 'UTC');
  // 現在時刻はサイトのタイムゾーンでの日付に変換して比較する。
  const todayYmd = toYmd(new Date(), tz);
  return postYmd <= todayYmd;
}