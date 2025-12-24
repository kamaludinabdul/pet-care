/**
 * Generates a WhatsApp link for sending messages.
 * @param {string} phoneNumber - The phone number (e.g., '08123456789' or '628123456789').
 * @param {string} message - The message content.
 * @returns {string} - The full WhatsApp URL.
 */
export const generateWhatsAppLink = (phoneNumber, message) => {
    if (!phoneNumber) return '';

    // sanitize phone number: remove non-digits
    let cleanNumber = phoneNumber.replace(/\D/g, '');

    // Ensure it starts with 62 for Indonesia if it starts with 0
    if (cleanNumber.startsWith('0')) {
        cleanNumber = '62' + cleanNumber.substring(1);
    }

    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
};

/**
 * Formats a currency value for display in messages.
 * @param {number} value 
 * @returns {string}
 */
export const formatCurrencyWA = (value) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
};

/**
 * Generates an Invoice Message template.
 * @param {object} params
 * @returns {string}
 */
export const generateInvoiceMessage = ({ customerName, invoiceNumber, totalAmount, items, storeName, link }) => {
    const header = `Halo Kak ${customerName},\n\nTerima kasih telah mempercayakan perawatan anabul di *${storeName || 'Pet Care'}*.\n\nBerikut adalah rincian tagihan Anda:\nNo. Invoice: *${invoiceNumber}*\n`;

    // Simple item list (max 5 items to avoid too long msg)
    const itemsList = items.slice(0, 5).map(item => `- ${item.name} (${item.qty}x)`).join('\n');
    const moreItems = items.length > 5 ? `\n...dan ${items.length - 5} item lainnya` : '';

    const footer = `\n\nTotal Tagihan: *${formatCurrencyWA(totalAmount)}*\n\n${link ? `Lihat detail invoice: ${link}\n` : ''}Terima kasih! 🐾`;

    return `${header}\n${itemsList}${moreItems}${footer}`;
};
