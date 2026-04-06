// PHASE 5: Request Deduplication
// Prevents multiple identical API calls from executing simultaneously
// If the same request is made while one is in progress, returns the existing promise

class RequestDeduplicator {
  private pendingRequests = new Map<string, Promise<any>>();

  async fetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    // If request is already in progress, return the existing promise
    if (this.pendingRequests.has(key)) {
      console.log(`🔄 Deduplicating request: ${key}`);
      return this.pendingRequests.get(key)!;
    }

    // Create new promise and store it
    const promise = fetcher()
      .finally(() => {
        // Clean up after request completes (success or failure)
        this.pendingRequests.delete(key);
      });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  // Clear all pending requests (useful for cleanup)
  clear() {
    this.pendingRequests.clear();
  }

  // Get count of pending requests (useful for debugging)
  getPendingCount(): number {
    return this.pendingRequests.size;
  }
}

export const requestDeduplicator = new RequestDeduplicator();

