// ESC/POS Command Constants
const ESC = '\x1B';
const GS = '\x1D';
const INIT = ESC + '@';
const CUT = GS + 'V' + '\x41' + '\x00';
const BOLD_ON = ESC + 'E' + '\x01';
const BOLD_OFF = ESC + 'E' + '\x00';
const ALIGN_LEFT = ESC + 'a' + '\x00';
const ALIGN_CENTER = ESC + 'a' + '\x01';
const ALIGN_RIGHT = ESC + 'a' + '\x02';

let connectedDevice = null;
let characteristic = null;

export const printerService = {
    isConnected: () => !!connectedDevice && !!characteristic,

    getDeviceName: () => connectedDevice ? connectedDevice.name : null,

    connect: async () => {
        try {
            if (!navigator.bluetooth) {
                throw new Error('Web Bluetooth API not supported in this browser.');
            }

            console.log('Requesting Bluetooth Device...');
            const device = await navigator.bluetooth.requestDevice({
                filters: [
                    { services: ['000018f0-0000-1000-8000-00805f9b34fb'] } // Standard UUID for many thermal printers
                ],
                optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
            });

            console.log('Connecting to GATT Server...');
            const server = await device.gatt.connect();

            console.log('Getting Service...');
            const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');

            console.log('Getting Characteristic...');
            const characteristics = await service.getCharacteristics();
            if (characteristics.length === 0) throw new Error('No characteristics found');

            // Find a writable characteristic
            let writeChar = null;
            for (const char of characteristics) {
                if (char.properties.write || char.properties.writeWithoutResponse) {
                    writeChar = char;
                    console.log('Found writable characteristic:', char.uuid);
                    break;
                }
            }

            if (!writeChar) {
                // Fallback to first characteristic if no writable found
                writeChar = characteristics[0];
                console.warn('No writable characteristic found, using first one');
            }

            characteristic = writeChar;
            connectedDevice = device;

            device.addEventListener('gattserverdisconnected', () => {
                console.log('Printer disconnected');
                connectedDevice = null;
                characteristic = null;
            });

            return { success: true, name: device.name };
        } catch (error) {
            console.error('Connection failed', error);
            return { success: false, error: error.message };
        }
    },

    disconnect: () => {
        if (connectedDevice) {
            connectedDevice.gatt.disconnect();
            connectedDevice = null;
            characteristic = null;
        }
    },

    // Simple text encoder
    encode: (text) => {
        const encoder = new TextEncoder();
        return encoder.encode(text);
    },

    printReceipt: async (transaction, storeConfig, bookingData) => {
        if (!characteristic) {
            throw new Error('Printer not connected');
        }

        try {
            const encoder = new TextEncoder();
            let commands = INIT;

            // Helper to add text

            const addLine = (text) => commands += text + '\n';

            // Header
            commands += ALIGN_CENTER;
            commands += BOLD_ON + (storeConfig.name || 'Pet Care Store') + '\n' + BOLD_OFF;
            if (storeConfig.address) addLine(storeConfig.address);
            if (storeConfig.phone) addLine(storeConfig.phone);
            commands += '\n';

            // Transaction Info/Booking Info
            commands += ALIGN_LEFT;
            addLine(`Date: ${new Date().toLocaleString('id-ID')}`);
            if (transaction?.cashier) addLine(`Cashier: ${transaction.cashier}`);
            if (bookingData?.id) addLine(`Booking #: ${bookingData.id.slice(0, 8)}`);
            addLine('-'.repeat(32)); // Assuming 58mm (32 chars)

            // Items - could come from transaction or booking details
            const items = transaction?.items || (bookingData ? [{
                name: bookingData.serviceType === 'hotel' ? 'Pet Hotel' : 'Grooming',
                qty: 1,
                price: bookingData.totalPrice || 0,
                total: bookingData.totalPrice || 0
            }] : []);

            items.forEach(item => {
                addLine(item.name);
                const price = item.price || 0;
                const total = item.total || 0;
                const qtyPrice = `${item.qty} x ${price.toLocaleString()}`;
                const totalStr = total.toLocaleString();
                // Simple spacing calculation
                const spaces = 32 - qtyPrice.length - totalStr.length;
                addLine(qtyPrice + ' '.repeat(Math.max(1, spaces)) + totalStr);
            });

            addLine('-'.repeat(32));

            // Totals
            commands += ALIGN_RIGHT;
            const total = transaction?.total || bookingData?.totalPrice || 0;
            // addLine(`Subtotal: ${total.toLocaleString()}`); // Simplified for MVP

            commands += BOLD_ON;
            addLine(`TOTAL: ${total.toLocaleString()}`);
            commands += BOLD_OFF;

            // Payment Info
            if (transaction) {
                const paymentMethodText = transaction.paymentMethod === 'cash' ? 'Tunai' :
                    transaction.paymentMethod === 'qris' ? 'QRIS' : 'Non-Tunai';
                addLine(`${paymentMethodText}: ${(transaction.cashAmount || transaction.total).toLocaleString()}`);
                if (transaction.change > 0) {
                    addLine(`Kembalian: ${transaction.change.toLocaleString()}`);
                }
            } else {
                addLine('Tagihan (Belum Lunas)');
            }

            // Footer
            commands += ALIGN_CENTER;
            commands += '\n';
            addLine(storeConfig.receiptFooter || 'Terima Kasih');
            commands += '\n\n\n\n\n'; // More line feeds to ensure content is printed before cut

            // Send in chunks to avoid Bluetooth buffer overflow
            const data = encoder.encode(commands);
            const chunkSize = 512; // Send 512 bytes at a time

            for (let i = 0; i < data.length; i += chunkSize) {
                const chunk = data.slice(i, Math.min(i + chunkSize, data.length));
                await characteristic.writeValue(chunk);
                // Small delay between chunks to avoid overwhelming the printer
                if (i + chunkSize < data.length) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }

            // Wait a bit before sending cut command to ensure all data is printed
            await new Promise(resolve => setTimeout(resolve, 200));
            await characteristic.writeValue(encoder.encode(CUT));

            return { success: true };
        } catch (error) {
            console.error('Print failed', error);
            return { success: false, error: error.message };
        }
    },

    // Virtual printer logic same as original but maybe tailored?
    // Keeping simple for now to save space, but essential for debugging.
    printVirtual: async (commands) => {
        console.log("Virtual Print", commands);
        return { success: true };
    }
};
