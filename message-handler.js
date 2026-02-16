/**
 * Message Handler untuk fast respon
 * Optimasi processing untuk mengurangi delay [citation:2][citation:9]
 */

const NodeCache = require('node-cache');

class MessageHandler {
  constructor(options = {}) {
    this.processedMessages = new NodeCache({
      stdTTL: options.messageTTL || 300, // 5 menit
      checkperiod: 60,
      maxKeys: options.maxCacheSize || 10000
    });
    
    this.pendingMessages = new Map();
    this.processingQueue = [];
    this.isProcessing = false;
  }

  /**
   * Handle incoming messages dengan prioritasi
   */
  async handleMessage(message, handler) {
    const messageId = message.key?.id;
    
    // Cek duplikat
    if (this.processedMessages.has(messageId)) {
      return null;
    }
    
    // Tandai sebagai diproses
    this.processedMessages.set(messageId, true);
    
    // Queue dengan prioritas
    const priority = this.getMessagePriority(message);
    this.queueMessage({ message, handler, priority });
    
    // Proses queue
    return this.processQueue();
  }

  /**
   * Tentukan prioritas pesan
   */
  getMessagePriority(message) {
    // Pesan dari kontak tersimpan prioritas tinggi
    if (message.key?.participant) {
      return 1;
    }
    
    // Pesan group prioritas medium
    if (message.key?.remoteJid?.includes('@g.us')) {
      return 2;
    }
    
    // Pesan broadcast/status prioritas rendah
    if (message.key?.remoteJid === 'status@broadcast') {
      return 3;
    }
    
    return 2; // Default medium
  }

  queueMessage(item) {
    this.processingQueue.push(item);
    // Sort by priority
    this.processingQueue.sort((a, b) => a.priority - b.priority);
  }

  async processQueue() {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      while (this.processingQueue.length > 0) {
        const item = this.processingQueue.shift();
        
        // Process dengan timeout
        await Promise.race([
          item.handler(item.message),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Handler timeout')), 5000)
          )
        ]);
      }
    } catch (error) {
      console.error('Message processing error:', error);
    } finally {
      this.isProcessing = false;
      
      // Check if new items arrived while processing
      if (this.processingQueue.length > 0) {
        setImmediate(() => this.processQueue());
      }
    }
  }

  /**
   * Kirim pesan dengan retry logic [citation:8]
   */
  async sendMessageWithRetry(sock, jid, content, options = {}, maxRetries = 3) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const result = await sock.sendMessage(jid, content, {
          ...options,
          // Optimasi untuk fast respon
          waitForAck: true,
          timeoutMs: 10000
        });
        
        return result;
      } catch (error) {
        lastError = error;
        
        if (i < maxRetries - 1) {
          // Exponential backoff
          const delay = 1000 * Math.pow(2, i);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  cleanup() {
    this.processedMessages.close();
    this.pendingMessages.clear();
    this.processingQueue = [];
    this.isProcessing = false;
  }
}

module.exports = MessageHandler;
