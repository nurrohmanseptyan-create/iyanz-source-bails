/**
 * @iyanz-source/bails - Enhanced WhatsApp API
 * Fitur: Support All Button, Custom Pairing, Anti Delay, Fast Respon, Anti Disconnect
 */

const { default: makeWASocket } = require('./src/socket');
const {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
  Browsers
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const NodeCache = require('node-cache');
const { Boom } = require('@hapi/boom');

// Utils
const ConnectionHandler = require('./src/utils/connection-handler');
const MessageHandler = require('./src/utils/message-handler');
const CacheManager = require('./src/utils/cache-manager');
const ButtonBuilder = require('./lib/button-builder');

// Re-export untuk kemudahan penggunaan
module.exports = {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
  Browsers,
  ConnectionHandler,
  MessageHandler,
  CacheManager,
  ButtonBuilder,
  
  // Utility functions untuk button
  createButtonMessage: ButtonBuilder.createButtonMessage,
  createInteractiveMessage: ButtonBuilder.createInteractiveMessage,
  createListMessage: ButtonBuilder.createListMessage,
  createPollMessage: ButtonBuilder.createPollMessage,
  createProductMessage: ButtonBuilder.createProductMessage,
  
  // Helper untuk pairing
  requestCustomPairingCode: async (sock, phoneNumber, customCode) => {
    if (!sock.authState.creds.registered) {
      return await sock.requestPairingCode(phoneNumber, customCode);
    }
    return null;
  }
};

// Version info
module.exports.version = '2.7.0';
