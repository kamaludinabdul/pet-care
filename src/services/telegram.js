// Telegram Bot Configuration
const TELEGRAM_BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN || '';
// We might use store-specific chat ID if available, or env var as fallback
const TELEGRAM_CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID || '';

/**
 * Send a message to Telegram
 * @param {string} message - Message text (HTML)
 * @param {string} chatId - Target chat ID
 * @param {string} token - Bot token
 * @returns {Promise<boolean>}
 */
const sendMessage = async (message, chatId, token) => {
    if (!token || !chatId) {
        console.warn('Telegram credentials not configured');
        return false;
    }

    try {
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML',
            }),
        });

        const data = await response.json();
        return data.ok;
    } catch (error) {
        console.error('Error sending Telegram message:', error);
        return false;
    }
};

/**
 * Send Booking Notification
 * @param {Object} booking - Booking data
 * @param {Object} store - Store config (for token/chatId if customized)
 * @param {Object} customer - Customer data
 * @param {Object} pet - Pet data
 */
export const sendBookingNotification = async (booking, store, customer, pet) => {
    const token = store?.telegramBotToken || TELEGRAM_BOT_TOKEN;
    const chatId = store?.telegramChatId || TELEGRAM_CHAT_ID;

    if (!token || !chatId) return false;

    const dateStr = new Date(booking.startDate).toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    const typeLabel = booking.serviceType === 'hotel' ? '🏨 PET HOTEL' : '✂️ GROOMING';
    const statusEmoji = booking.status === 'confirmed' ? '✅' : '⏳';

    let message = `<b>${typeLabel} - NEW BOOKING ${statusEmoji}</b>\n\n`;
    message += `📅 <b>Tanggal:</b> ${dateStr}\n`;
    message += `⏰ <b>Waktu:</b> ${booking.startTime || '-'}\n`;
    if (booking.serviceType === 'hotel' && booking.endDate) {
        const endDateStr = new Date(booking.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' });
        message += `🏁 <b>Check-out:</b> ${endDateStr}\n`;
    }

    message += `\n👤 <b>Pelanggan:</b> ${customer?.name || 'Guest'}\n`;
    message += `🐾 <b>Hewan:</b> ${pet?.name || booking.petName} (${pet?.type || booking.petType})\n`;

    if (booking.roomName) {
        message += `🏠 <b>Ruangan:</b> ${booking.roomName}\n`;
    }

    if (booking.notes) {
        message += `📝 <b>Catatan:</b> ${booking.notes}\n`;
    }

    message += `\n<i>Mohon segera konfirmasi.</i>`;

    return sendMessage(message, chatId, token);
};

export default {
    sendBookingNotification
};
