/**
 * Cache Manager untuk anti delay
 * Mengurangi beban dengan caching [citation:8]
 */

const NodeCache = require('node-cache');

class CacheManager {
  constructor(options = {}) {
    this.groupCache = new NodeCache({
      stdTTL: options.groupTTL || 300, // 5 menit
      checkperiod: 60,
      useClones: false
    });
    
    this.contactCache = new NodeCache({
      stdTTL: options.contactTTL || 600, // 10 menit
      checkperiod: 120
    });
    
    this.messageCache = new NodeCache({
      stdTTL: options.messageTTL || 60, // 1 menit
      checkperiod: 30,
      maxKeys: options.maxMessageCache || 1000
    });
    
    this.mediaCache = new NodeCache({
      stdTTL: options.mediaTTL || 300, // 5 menit
      checkperiod: 60,
      maxKeys: options.maxMediaCache || 500
    });
  }

  // Group methods
  async getGroup(jid, fetcher) {
    const cached = this.groupCache.get(jid);
    if (cached) return cached;
    
    try {
      const metadata = await fetcher(jid);
      this.groupCache.set(jid, metadata);
      return metadata;
    } catch (error) {
      return null;
    }
  }

  setGroup(jid, metadata) {
    this.groupCache.set(jid, metadata);
  }

  invalidateGroup(jid) {
    this.groupCache.del(jid);
  }

  // Contact methods
  async getContact(jid, fetcher) {
    const cached = this.contactCache.get(jid);
    if (cached) return cached;
    
    try {
      const contact = await fetcher(jid);
      this.contactCache.set(jid, contact);
      return contact;
    } catch (error) {
      return null;
    }
  }

  // Message methods
  cacheMessage(key, message) {
    this.messageCache.set(JSON.stringify(key), message);
  }

  getCachedMessage(key) {
    return this.messageCache.get(JSON.stringify(key));
  }

  // Media methods
  cacheMedia(url, data) {
    this.mediaCache.set(url, data);
  }

  getCachedMedia(url) {
    return this.mediaCache.get(url);
  }

  // Clear methods
  clearGroupCache() {
    this.groupCache.flushAll();
  }

  clearContactCache() {
    this.contactCache.flushAll();
  }

  clearMessageCache() {
    this.messageCache.flushAll();
  }

  clearMediaCache() {
    this.mediaCache.flushAll();
  }

  clearAll() {
    this.groupCache.flushAll();
    this.contactCache.flushAll();
    this.messageCache.flushAll();
    this.mediaCache.flushAll();
  }

  // Stats
  getStats() {
    return {
      group: this.groupCache.getStats(),
      contact: this.contactCache.getStats(),
      message: this.messageCache.getStats(),
      media: this.mediaCache.getStats()
    };
  }
}

module.exports = CacheManager;
