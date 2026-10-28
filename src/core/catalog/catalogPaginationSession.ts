import type { DiscoveryResult } from './CatalogDiscoveryService';

/** Cursor for a single query. Shared discovery/cache stays in CatalogDiscoveryService. */
export class CatalogPaginationSession {
  private page = 0;
  private pending = false;
  private exhausted = false;
  private retryAt = 0;
  private now: () => number = Date.now;

  constructor(
    private discover: (page: number) => Promise<DiscoveryResult>,
    initialPageOrNow?: number | (() => number),
    nowFn?: () => number
  ) {
    if (typeof initialPageOrNow === 'function') {
      this.now = initialPageOrNow;
      this.page = 0;
    } else {
      this.page = typeof initialPageOrNow === 'number' ? initialPageOrNow : 0;
      if (nowFn) this.now = nowFn;
    }
  }

  getPage(): number {
    return this.page;
  }

  setPage(page: number): void {
    this.page = page;
  }

  isExhausted(): boolean {
    return this.exhausted;
  }

  isPending(): boolean {
    return this.pending;
  }

  getRetryAt(): number {
    return this.retryAt;
  }

  reset(initialPage = 0): void {
    this.page = initialPage;
    this.pending = false;
    this.exhausted = false;
    this.retryAt = 0;
  }

  async loadNext(): Promise<DiscoveryResult | null> {
    if (this.pending || this.exhausted || this.now() < this.retryAt) return null;
    this.pending = true;
    try {
      const result = await this.discover(this.page + 1);
      if (!result.isPartial) {
        this.page = result.page;
        this.exhausted = !result.hasMore;
      }
      this.retryAt = result.isPartial ? this.now() + 3000 : 0;
      return result;
    } catch (error) {
      this.retryAt = this.now() + 3000;
      throw error;
    } finally { this.pending = false; }
  }
}
