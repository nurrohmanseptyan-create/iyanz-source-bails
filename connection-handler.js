/**
 * Connection Handler untuk anti disconnect
 * Mengimplementasikan reconnect logic yang stabil [citation:3][citation:7][citation:10]
 */

const { DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');

class ConnectionHandler {
  constructor(sock, options = {}) {
    this.sock = sock;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 50;
    this.reconnectInterval = options.reconnectInterval || 3000;
    this.stableWaitTime = options.stableWaitTime || 10000; // 10 detik
    this.undoRetries = new Map();
    this.retries = new Map();
    this.sessionId = options.sessionId || `session_${Date.now()}`;
  }

  handleConnectionUpdate(update) {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      this.emit('qr', qr);
    }

    if (connection === 'connecting') {
      console.log('🔄 Connecting to WhatsApp...');
    }

    if (connection === 'close') {
      this.handleDisconnect(lastDisconnect);
    }

    if (connection === 'open') {
      this.handleConnected();
    }
  }

  handleDisconnect(lastDisconnect) {
    const error = lastDisconnect?.error;
    const statusCode = error instanceof Boom ? error.output.statusCode : 500;
    const reason = statusCode;

    console.log(`❌ Disconnected: ${DisconnectReason[reason] || 'Unknown'}`);

    // Logout cases - jangan reconnect [citation:10]
    if (
      reason === DisconnectReason.loggedOut ||
      reason === DisconnectReason.badSession ||
      !this.shouldReconnect(this.sessionId)
    ) {
      this.retries.delete(this.sessionId);
      this.emit('logout', { reason });
      return;
    }

    // Reconnect cases
    const reconnectInterval =
      reason === DisconnectReason.restartRequired ||
      reason === DisconnectReason.timedOut
        ? 0
        : this.reconnectInterval;

    // Cek apakah perlu retry
    const undoRetries = this.undoRetries.get(this.sessionId);
    if (undoRetries) {
      console.log('⚠️ Connection unstable, preparing retry...');
      clearTimeout(undoRetries);
    }

    setTimeout(() => {
      this.attemptReconnect(reason);
    }, reconnectInterval);
  }

  handleConnected() {
    console.log('✅ Connected successfully');
    
    // Tunggu sampai koneksi stabil sebelum reset retry counter [citation:10]
    const timer = setTimeout(() => {
      console.log('✅ Connection stable, resetting retry counter');
      this.retries.delete(this.sessionId);
    }, this.stableWaitTime);
    
    this.undoRetries.set(this.sessionId, timer);
    this.emit('connected');
  }

  shouldReconnect(sessionId) {
    const attempts = this.retries.get(sessionId) || 0;
    
    // Batasi jumlah reconnect attempts
    if (attempts >= this.maxReconnectAttempts) {
      console.log(`⚠️ Max reconnect attempts (${this.maxReconnectAttempts}) reached`);
      return false;
    }
    
    return true;
  }

  attemptReconnect(reason) {
    const attempts = (this.retries.get(this.sessionId) || 0) + 1;
    this.retries.set(this.sessionId, attempts);
    
    console.log(`🔄 Reconnect attempt ${attempts}/${this.maxReconnectAttempts}`);
    this.emit('reconnecting', { reason, attempt: attempts });
    
    // Panggil fungsi reconnect
    if (this.sock?.connect) {
      this.sock.connect();
    }
  }

  emit(event, data) {
    if (this.sock?.ev) {
      this.sock.ev.emit(`connection::${event}`, data);
    }
  }

  cleanup() {
    for (const timer of this.undoRetries.values()) {
      clearTimeout(timer);
    }
    this.undoRetries.clear();
    this.retries.clear();
  }
}

module.exports = ConnectionHandler;
