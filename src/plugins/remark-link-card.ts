import fs from 'node:fs';
import path from 'node:path';

/**
 * 単独行に貼られたURLを、OGP情報を使ったリンクカードに変換する remark プラグイン。
 * ビルド時にOGPを取得し、`.astro/link-card-cache.json` にキャッシュする。
 */

// --- mdast の最小限の型定義（@types/mdast への依存を避けるためローカルに持つ）---
interface MdText {
  type: 'text';
  value: string;
}
interface MdLink {
  type: 'link';
  url: string;
  children: MdNode[];
}
interface MdHtml {
  type: 'html';
  value: string;
}
interface MdParent {
  type: string;
  children: MdNode[];
}
type MdNode = MdText | MdLink | MdHtml | MdParent | { type: string; [key: string]: unknown };

interface Root {
  type: 'root';
  children: MdNode[];
}

interface Ogp {
  title: string;
  description: string;
  image: string;
  host: string;
}

const CACHE_DIR = path.join(process.cwd(), '.astro');
const CACHE_FILE = path.join(CACHE_DIR, 'link-card-cache.json');
const FETCH_TIMEOUT = 8000;

let cache: Record<string, Ogp> | null = null;

const loadCache = (): Record<string, Ogp> => {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  } catch {
    cache = {};
  }
  return cache!;
};

const saveCache = (): void => {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch {
    // キャッシュ書き込み失敗はビルドを止めない
  }
};

const escapeHtml = (str = ''): string =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const decodeEntities = (str = ''): string =>
  str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&apos;/g, "'");

const metaContent = (html: string, key: string): string => {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*?content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*?(?:property|name)=["']${key}["']`, 'i'),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return decodeEntities(m[1]).trim();
  }
  return '';
};

const fetchOgp = async (url: string): Promise<Ogp | null> => {
  const store = loadCache();
  if (store[url]) return store[url];

  let data: Ogp | null = null;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkCardBot/1.0; +https://astro.build)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if (res.ok) {
      const html = await res.text();
      const finalUrl = res.url || url;
      const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title =
        metaContent(html, 'og:title') ||
        (titleTag ? decodeEntities(titleTag[1]).trim() : '') ||
        new URL(finalUrl).hostname;
      const description = metaContent(html, 'og:description') || metaContent(html, 'description');
      let image = metaContent(html, 'og:image');
      if (image) {
        try {
          image = new URL(image, finalUrl).href;
        } catch {
          image = '';
        }
      }
      data = {
        title,
        description,
        image,
        host: new URL(finalUrl).hostname.replace(/^www\./, ''),
      };
    }
  } catch {
    data = null;
  }

  if (data) {
    store[url] = data;
    saveCache();
  }
  return data;
};

const cardHtml = (url: string, ogp: Ogp): string => {
  const favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(ogp.host)}&sz=64`;
  const image = ogp.image
    ? `<div class="link-card__image"><img src="${escapeHtml(ogp.image)}" alt="" loading="lazy" /></div>`
    : '';
  const description = ogp.description
    ? `<div class="link-card__description">${escapeHtml(ogp.description)}</div>`
    : '';
  return `<a class="link-card" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
  <div class="link-card__text">
    <div class="link-card__title">${escapeHtml(ogp.title)}</div>
    ${description}
    <div class="link-card__meta">
      <img class="link-card__favicon" src="${favicon}" alt="" width="16" height="16" loading="lazy" />
      <span class="link-card__host">${escapeHtml(ogp.host)}</span>
    </div>
  </div>
  ${image}
</a>`;
};

/** Spotify の URL なら埋め込みプレーヤーの HTML を返す。そうでなければ null。 */
const spotifyEmbed = (url: string): string | null => {
  const m = url.match(
    /^https?:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(track|album|playlist|artist|show|episode)\/([a-zA-Z0-9]+)/
  );
  if (!m) return null;
  const [, type, id] = m;
  // track / episode はコンパクト表示、それ以外は大きめ
  const height = type === 'track' || type === 'episode' ? 152 : 352;
  const src = `https://open.spotify.com/embed/${type}/${id}?utm_source=generator`;
  return `<iframe class="spotify-embed" src="${src}" width="100%" height="${height}" style="border-radius:12px" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
};

/** paragraph が「単独の裸URL」だけを含むなら、そのURLを返す。そうでなければ null。 */
const bareUrl = (node: MdNode): string | null => {
  const parent = node as MdParent;
  if (parent.type !== 'paragraph' || parent.children?.length !== 1) return null;
  const child = parent.children[0] as MdLink;
  if (child.type !== 'link') return null;
  if (child.children.length !== 1 || child.children[0].type !== 'text') return null;
  const text = (child.children[0] as MdText).value.trim();
  if (text !== child.url) return null;
  if (!/^https?:\/\//.test(child.url)) return null;
  return child.url;
};

const remarkLinkCard = () => {
  return async (tree: Root): Promise<void> => {
    const targets: { index: number; url: string }[] = [];
    for (let i = 0; i < tree.children.length; i++) {
      const url = bareUrl(tree.children[i]);
      if (!url) continue;
      // Spotify は OGP 取得せず埋め込みプレーヤーに変換
      const embed = spotifyEmbed(url);
      if (embed) {
        tree.children[i] = { type: 'html', value: embed } as MdHtml;
        continue;
      }
      targets.push({ index: i, url });
    }
    if (targets.length === 0) return;

    const results = await Promise.all(
      targets.map(async (t) => ({ ...t, ogp: await fetchOgp(t.url) }))
    );

    for (const { index, url, ogp } of results) {
      if (!ogp) continue; // 取得失敗時はそのままリンクを残す
      tree.children[index] = { type: 'html', value: cardHtml(url, ogp) } as MdHtml;
    }
  };
};

export default remarkLinkCard;
