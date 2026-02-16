/**
 * Button Builder untuk mendukung semua jenis button
 * Support: Quick Reply, URL, Copy, Call, List, Product, Poll, Native Flow
 */

class ButtonBuilder {
  /**
   * Create quick reply buttons
   */
  static createQuickReplyButtons(buttons) {
    return buttons.map((btn, index) => ({
      buttonId: btn.id || `btn_${index}`,
      buttonText: { displayText: btn.text },
      type: 1
    }));
  }

  /**
   * Create interactive buttons (WhatsApp Business support) [citation:1][citation:4]
   */
  static createInteractiveButtons(buttons) {
    return buttons.map(btn => {
      switch (btn.type) {
        case 'url':
          return {
            name: 'cta_url',
            buttonParamsJson: JSON.stringify({
              display_text: btn.text,
              url: btn.url
            })
          };
        case 'copy':
          return {
            name: 'cta_copy',
            buttonParamsJson: JSON.stringify({
              display_text: btn.text,
              copy_code: btn.copyCode || btn.text,
              id: btn.id || 'copy_id'
            })
          };
        case 'call':
          return {
            name: 'cta_call',
            buttonParamsJson: JSON.stringify({
              display_text: btn.text,
              phone_number: btn.phoneNumber
            })
          };
        case 'quick_reply':
        default:
          return {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
              display_text: btn.text,
              id: btn.id || `id_${Date.now()}`
            })
          };
      }
    });
  }

  /**
   * Create button message dengan berbagai tipe (image, video, text) [citation:4]
   */
  static createButtonMessage(content, buttons, options = {}) {
    const baseButtons = this.createQuickReplyButtons(buttons);
    
    let message = {
      text: content,
      footer: options.footer || '',
      buttons: baseButtons,
      headerType: options.headerType || 1,
      viewOnce: options.viewOnce || false
    };

    // Add media jika ada
    if (options.image) {
      message = {
        image: options.image,
        caption: content,
        footer: options.footer || '',
        buttons: baseButtons,
        headerType: 4,
        viewOnce: options.viewOnce || false
      };
    } else if (options.video) {
      message = {
        video: options.video,
        caption: content,
        footer: options.footer || '',
        buttons: baseButtons,
        headerType: 4,
        viewOnce: options.viewOnce || false
      };
    }

    return message;
  }

  /**
   * Create interactive message dengan AI icon support [citation:1][citation:4]
   */
  static createInteractiveMessage(options = {}) {
    const {
      text,
      title,
      footer,
      buttons = [],
      image,
      video,
      document,
      ai = false,
      externalAdReply
    } = options;

    const interactiveButtons = this.createInteractiveButtons(buttons);
    
    let message = {
      text: text || '',
      title: title || '',
      footer: footer || '',
      interactiveButtons,
      ai // Support AI icon [citation:4]
    };

    // Add media
    if (image) {
      message.image = image;
      message.caption = text || '';
    } else if (video) {
      message.video = video;
      message.caption = text || '';
    } else if (document) {
      message.document = document;
      message.mimetype = options.mimetype || 'application/pdf';
      message.fileName = options.fileName || 'document.pdf';
      message.caption = text || '';
    }

    // External Ad Reply
    if (externalAdReply) {
      message.contextInfo = {
        externalAdReply: {
          title: externalAdReply.title || '',
          body: externalAdReply.body || '',
          mediaType: externalAdReply.mediaType || 1,
          thumbnailUrl: externalAdReply.thumbnailUrl,
          sourceUrl: externalAdReply.sourceUrl,
          showAdAttribution: externalAdReply.showAdAttribution || true
        }
      };
    }

    return message;
  }

  /**
   * Create list message (single select)
   */
  static createListMessage(title, description, footer, buttonText, sections) {
    const listMessage = {
      text: description,
      footer: footer,
      title: title,
      buttonText: buttonText,
      sections: sections.map(section => ({
        title: section.title,
        rows: section.rows.map(row => ({
          title: row.title,
          description: row.description,
          rowId: row.id || `row_${Date.now()}`
        }))
      }))
    };

    return { list: listMessage };
  }

  /**
   * Create poll message [citation:1]
   */
  static createPollMessage(question, options, selectableCount = 1) {
    return {
      poll: {
        name: question,
        values: options,
        selectableCount: selectableCount
      }
    };
  }

  /**
   * Create product message [citation:5]
   */
  static createProductMessage(product, buttons = []) {
    const {
      title,
      description,
      thumbnail,
      productId,
      retailerId,
      url,
      priceAmount,
      currencyCode = 'IDR'
    } = product;

    const productButtons = buttons.map(btn => ({
      name: btn.type || 'cta_url',
      buttonParamsJson: JSON.stringify({
        display_text: btn.text,
        url: btn.url,
        ...btn.params
      })
    }));

    return {
      productMessage: {
        title,
        description,
        thumbnail: { url: thumbnail },
        productId: productId || `prod_${Date.now()}`,
        retailerId: retailerId || 'retailer_1',
        url,
        body: description,
        footer: product.footer || '',
        priceAmount1000: priceAmount * 1000,
        currencyCode,
        buttons: productButtons
      }
    };
  }

  /**
   * Create album message (multiple images/videos) [citation:1][citation:5]
   */
  static createAlbumMessage(mediaItems, caption = '') {
    return {
      albumMessage: mediaItems.map(item => ({
        image: item.image ? { url: item.image } : undefined,
        video: item.video ? { url: item.video } : undefined,
        caption: item.caption || caption
      }))
    };
  }

  /**
   * Create native flow message (advanced interactive) [citation:5]
   */
  static createNativeFlowMessage(options = {}) {
    const {
      header,
      title,
      footer,
      image,
      buttons = [],
      messageParams = {}
    } = options;

    return {
      interactiveMessage: {
        header: header || '',
        title: title || '',
        footer: footer || '',
        image: image ? { url: image } : undefined,
        nativeFlowMessage: {
          messageParamsJson: JSON.stringify(messageParams),
          buttons: buttons.map(btn => ({
            name: btn.name || 'single_select',
            buttonParamsJson: JSON.stringify(btn.params || {})
          }))
        }
      }
    };
  }
}

module.exports = ButtonBuilder;
