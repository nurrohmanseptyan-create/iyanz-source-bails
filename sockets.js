/**
 * Socket Baileys yang dimodifikasi
 * Fitur: Anti delay, Fast respon, Connection stability
 */

const {
  default: makeWASocketOriginal,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const NodeCache = require('node-cache');
const pino = require('pino');
const EventEmitter = require('events');

// Cache untuk group metadata (mengurangi delay) [citation:8]
const groupCache = new NodeCache({
  stdTTL: 5 * 60, // 5 menit
  useClones: false,
  checkperiod: 60
});

// Cache untuk pesan (fast respon)
const messageCache = new NodeCache({
  stdTTL: 60, // 1 menit
  useClones: false,
  maxKeys: 1000
});

// Logger dengan level error saja untuk performa
const logger = pino({ level: 'error' });

class EnhancedWASocket extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.sock = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = config.maxReconnectAttempts || 50;
    this.reconnectInterval = config.reconnectInterval || 3000;
    this.keepAliveInterval = null;
    this.pingInterval = null;
  }

  async connect() {
    try {
      const { version, isLatest } = await fetchLatestBaileysVersion();
      console.log(`📱 Using WA v${version.join('.')}, isLatest: ${isLatest}`);

      const { state, saveCreds } = await useMultiFileAuthState(
        this.config.authFolder || 'auth_info'
      );

      // Konfigurasi socket dengan optimasi performa [citation:2][citation:9]
      const sock = makeWASocketOriginal({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        printQRInTerminal: this.config.printQRInTerminal || false,
        browser: this.config.browser || Browsers.ubuntu('iyanz-bot'),
        
        // Optimasi untuk anti delay [citation:6]
        markOnlineOnConnect: this.config.markOnlineOnConnect || false,
        
        // Cache group metadata untuk mengurangi delay [citation:8]
        cachedGroupMetadata: async (jid) => {
          const cached = groupCache.get(jid);
          if (cached) return cached;
          
          try {
            const metadata = await sock.groupMetadata(jid);
            groupCache.set(jid, metadata);
            return metadata;
          } catch (error) {
            return null;
          }
        },
        
        // Get message untuk retry system & decrypt poll votes [citation:8]
        getMessage: async (key) => {
          const cached = messageCache.get(JSON.stringify(key));
          if (cached) return cached;
          
          // Implementasi sesuai kebutuhan
          return null;
        },
        
        // Sync full history untuk history lengkap [citation:8]
        syncFullHistory: this.config.syncFullHistory || true,
        
        // Generate high quality link preview
        generateHighQualityLinkPreview: true,
        
        // Option tambahan untuk stabilitas [citation:10]
        shouldIgnoreJid: (jid) => {
          // Ignore status broadcast untuk performa
          return jid === 'status@broadcast';
        },
        
        // Default message options
        defaultQueryTimeoutMs: 10000,
        
        // Keep alive settings [citation:7]
        keepAliveIntervalMs: 30000,
        retryRequestDelayMs: 1000,
        maxMsgRetryCount: 5
      });

      // Store reference
      this.sock = sock;
      
      // Setup connection handler
      this.setupConnectionHandler(saveCreds);
      
      // Setup keep alive [citation:3][citation:7]
      this.setupKeepAlive();
      
      // Setup ping untuk fast respon
      this.setupPingInterval();

      return sock;
    } catch (error) {
      console.error('Connection error:', error);
      this.handleReconnect();
    }
  }

  setupConnectionHandler(saveCreds) {
    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && this.config.qrCallback) {
        this.config.qrCallback(qr);
      }

      if (connection === 'close') {
        const shouldReconnect = this.shouldReconnect(lastDisconnect);
        
        if (shouldReconnect) {
          console.log('🔄 Connection closed, reconnecting...');
          this.handleReconnect();
        } else {
          console.log('❌ Connection closed permanently');
          this.emit('disconnected', lastDisconnect);
        }
      } else if (connection === 'open') {
        console.log('✅ Connection opened successfully');
        this.reconnectAttempts = 0;
        this.emit('connected');
        
        // Set online status
        if (this.config.markOnlineOnConnect) {
          this.sock.sendPresenceUpdate('available');
        }
      }
    });

    // Update credentials
    this.sock.ev.on('creds.update', saveCreds);
    
    // Update group cache saat ada perubahan [citation:8]
    this.sock.ev.on('groups.update', async ([event]) => {
      if (event.id) {
        try {
          const metadata = await this.sock.groupMetadata(event.id);
          groupCache.set(event.id, metadata);
        } catch (error) {}
      }
    });
    
    this.sock.ev.on('group-participants.update', async (event) => {
      if (event.id) {
        try {
          const metadata = await this.sock.groupMetadata(event.id);
          groupCache.set(event.id, metadata);
        } catch (error) {}
      }
    });
    
    // Cache messages untuk fast respon
    this.sock.ev.on('messages.upsert', ({ messages }) => {
      for (const msg of messages) {
        if (msg.key) {
          messageCache.set(JSON.stringify(msg.key), msg.message);
        }
      }
    });
  }

  shouldReconnect(lastDisconnect) {
    const error = lastDisconnect?.error;
    const statusCode = error instanceof Boom ? error.output.statusCode : 500;
    
    // Jangan reconnect jika logged out [citation:10]
    if (statusCode === DisconnectReason.loggedOut) {
      return false;
    }
    
    // Batasi jumlah reconnect attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return false;
    }
    
    return true;
  }

  handleReconnect() {
    this.reconnectAttempts++;
    
    // Exponential backoff [citation:2]
    const delay = Math.min(
      this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts),
      30000 // Max 30 detik
    );
    
    setTimeout(() => {
      console.log(`🔄 Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      this.connect();
    }, delay);
  }

  setupKeepAlive() {
    // Keep alive untuk mencegah disconnect [citation:3][citation:7]
    this.keepAliveInterval = setInterval(() => {
      if (this.sock?.ws?.readyState === 1) { // WebSocket OPEN
        this.sock.ws.ping();
      }
    }, 25000); // 25 detik
  }

  setupPingInterval() {
    // Ping untuk fast respon
    this.pingInterval = setInterval(async () => {
      try {
        if (this.sock?.user) {
          // Kirim presence update untuk menjaga koneksi tetap aktif
          await this.sock.sendPresenceUpdate('available');
        }
      } catch (error) {
        // Ignore error
      }
    }, 60000); // 1 menit
  }

  cleanup() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
  }
}

// Factory function dengan semua optimasi
const makeWASocket = (config = {}) => {
  const enhanced = new EnhancedWASocket(config);
  enhanced.connect();
  return enhanced;
};

module.exports = {
  default: makeWASocket,
  EnhancedWASocket
};
