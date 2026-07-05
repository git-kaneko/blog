import type { PostFilter } from "./utils/posts";

export interface SiteConfig {
  title: string;
  slogan: string;
  description?: string;
  site: string;
  timezone: string; // 記事の公開日を判定するタイムゾーン (IANA名, 例: "Asia/Tokyo")
  social: {
    github?: string;
    linkedin?: string;
    email?: string;
    x?: string;
    rss?: boolean;
  };
  homepage: PostFilter;
  googleAnalysis?: string;
  search?: boolean;
}

export const siteConfig: SiteConfig = {
  site: "https://blog.osakananeko.com/", // your site url
  timezone: "Asia/Tokyo", // 記事の公開日時を判定する基準タイムゾーン
  title: "シンシログ",
  slogan: "A fresh page for everyday notes",
  description: "",
  social: {
    github: "https://github.com/git-kaneko", // leave empty if you don't want to show the github
    // linkedin: "https://www.linkedin.com/in/someone/", // leave empty if you don't want to show the linkedin
    // email: "example@gmail.com", // leave empty if you don't want to show the email
    // TODO: ダークモード対応
    x: "https://x.com/neko2g2",
    rss: true, // set this to false if you don't want to provide an rss feed
  },
  homepage: {
    maxPosts: 5,
    tags: [],
    excludeTags: [],
  },
  googleAnalysis: "G-ZM5S1G3JNR", // your google analysis id
  search: true, // set this to false if you don't want to provide a search feature
};
