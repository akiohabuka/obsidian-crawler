import { requestUrl } from "obsidian";

export async function fetchOgpImage(pageUrl: string): Promise<string> {
  const res = await requestUrl({ url: pageUrl, throw: false });
  if (res.status !== 200) return "";
  const doc = new DOMParser().parseFromString(res.text, "text/html");
  return doc.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? "";
}

export interface BookDetails {
  thumbnail: string;
  publishedAt: string;
  price: string;
  toc: string;
}

export async function fetchOReillyBookDetails(bookUrl: string): Promise<BookDetails> {
  const res = await requestUrl({ url: bookUrl, throw: false });
  if (res.status !== 200) return { thumbnail: "", publishedAt: "", price: "", toc: "" };

  const doc = new DOMParser().parseFromString(res.text, "text/html");

  const thumbnail =
    doc.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? "";

  const publishedAt =
    doc.querySelector('[itemprop="datePublished"]')?.getAttribute("content") ?? "";

  const priceMatch = res.text.match(/([\d,]+円)/);
  const price = priceMatch ? priceMatch[1] : "";

  const toc = doc.querySelector("#toc pre")?.textContent?.trim() ?? "";

  return { thumbnail, publishedAt, price, toc };
}

export interface RSSItem {
  title: string;
  url: string;
  publishedAt: string;
  description: string;
}

function getElementText(el: Element, ...selectors: string[]): string {
  for (const sel of selectors) {
    const found = el.querySelector(sel);
    if (!found) continue;
    // Atom の <link href="..."> 対応
    if (found.tagName.toLowerCase() === "link" && !found.textContent?.trim()) {
      return found.getAttribute("href") ?? "";
    }
    const text = found.textContent?.trim();
    if (text) return text;
  }
  return "";
}

export async function fetchFeedTitle(feedUrl: string): Promise<string> {
  const res = await requestUrl({ url: feedUrl, throw: false });
  if (res.status !== 200) throw new Error(`フィード取得エラー (${res.status})`);

  const doc = new DOMParser().parseFromString(res.text, "application/xml");
  return (
    getElementText(doc.documentElement, "channel > title, feed > title, title") ||
    feedUrl
  );
}

export async function fetchRecentRSSItems(feedUrl: string): Promise<RSSItem[]> {
  const res = await requestUrl({ url: feedUrl, throw: false });
  if (res.status !== 200) throw new Error(`フィード取得エラー (${res.status})`);

  const doc = new DOMParser().parseFromString(res.text, "application/xml");
  const since = new Date();
  since.setMonth(since.getMonth() - 1);

  // RSS 2.0 → <item>、Atom → <entry>
  const nodes = Array.from(doc.querySelectorAll("item, entry"));

  const items: RSSItem[] = [];
  for (const node of nodes) {
    const title = getElementText(node, "title");
    const url = getElementText(node, "link");
    const publishedAt = getElementText(node, "pubDate, published, updated, dc\\:date");
    const description = getElementText(node, "description, summary, content, content\\:encoded");

    if (publishedAt && new Date(publishedAt) < since) continue;

    items.push({ title: title || "無題", url, publishedAt, description });
  }

  return items;
}
