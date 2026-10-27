import type { DiscoveryResult } from './CatalogDiscoveryService';

/** Cursor for a single query. Shared discovery/cache stays in CatalogDiscoveryService. */
export class CatalogPaginationSession {
  private page = 0;
  private pending = false;
  private exhausted = false;
  private retryAt = 0;
  constructor(private discover: (page: number) => Promise<DiscoveryResult>, private now = Date.now) {}

  async loadNext(): Promise<DiscoveryResult | null> {
    if (this.pending || this.exhausted || this.now() < this.retryAt) return null;
    this.pending = true;
    try {
      const result = await this.discover(this.page + 1);
      if (!result.isPartial) this.page = result.page;
      this.exhausted = !result.hasMore;
      this.retryAt = result.isPartial ? this.now() + 3000 : 0;
      return result;
    } catch (error) {
      this.retryAt = this.now() + 3000;
      throw error;
    } finally { this.pending = false; }
  }
}
