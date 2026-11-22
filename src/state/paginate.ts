export interface PageOf<T> {
  items: T[];
  /** Matching items before pagination. */
  total: number;
  page: number;
  pageCount: number;
  /** 1-based index of the first item on the page (0 when empty). */
  from: number;
  to: number;
}

/** Slices one page. A page past the end clamps to the last page. */
export function paginate<T>(matching: T[], requestedPage: number, perPage: number): PageOf<T> {
  const pageCount = Math.max(1, Math.ceil(matching.length / perPage));
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  const start = (page - 1) * perPage;
  const items = matching.slice(start, start + perPage);
  return { items, total: matching.length, page, pageCount, from: items.length ? start + 1 : 0, to: start + items.length };
}
