import React, { useRef } from 'react';
import { X, Printer, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import { version } from '../../package.json';

const ReceiptModal = ({ isOpen, onClose, transaction, store }) => {
    const receiptRef = useRef(null);

    if (!isOpen || !transaction) return null;

    const handlePrint = () => {
        const receiptWindow = window.open('', '_blank', 'width=400,height=600');
        const isStandardPaper = store?.printerPaperSize === '80mm'; // Default to 58mm if not set

        // Calculate totals
        const subtotal = transaction.subtotal || transaction.total; // Fallback if subtotal not saved
        const tax = transaction.tax || 0;
        const serviceCharge = transaction.serviceCharge || 0;
        const finalTotal = transaction.total;

        const html = `
            <html>
                <head>
                    <title>Receipt #${transaction.id}</title>
                    <style>
                        body { font-family: 'Courier New', monospace; padding: 20px; width: ${isStandardPaper ? '80mm' : '58mm'}; margin: 0 auto; }
                        .header { text-align: center; margin-bottom: 20px; }
                        .store-name { font-size: 1.2em; font-weight: bold; margin-bottom: 5px; }
                        .divider { border-top: 1px dashed #000; margin: 10px 0; }
                        .item { display: flex; justify-content: space-between; margin-bottom: 3px; }
                        .totals { margin-top: 20px; display: flex; flex-direction: column; align-items: flex-end; }
                        .total-row { display: flex; justify-content: space-between; width: 100%; font-weight: bold; margin-top: 5px; }
                        .footer { text-align: center; margin-top: 30px; font-size: 10px; color: #666; }
                        .text-right { text-align: right; }
                        .watermark {
                            position: fixed;
                            top: 50%;
                            left: 50%;
                            transform: translate(-50%, -50%) rotate(-45deg);
                            font-size: 4rem;
                            font-weight: bold;
                            color: rgba(255, 0, 0, 0.2);
                            border: 8px solid rgba(255, 0, 0, 0.2);
                            padding: 10px 40px;
                            z-index: 9999;
                            pointer-events: none;
                            text-transform: uppercase;
                        }
                    </style>
                </head>
                <body>
                    ${transaction.status === 'cancelled' ? '<div class="watermark">CANCELLED</div>' : ''}
                    <div class="header">
                        ${store?.logo ? `<img src="${store.logo}" style="max-height: 50px; margin-bottom: 10px;" />` : ''}
                        <div class="store-name">${store?.name || 'Store'}</div>
                        <div>${store?.address || ''}</div>
                        <div>${store?.phone || ''}</div>
                        <div class="divider"></div>
                        <div>${store?.receiptHeader || ''}</div>
                        <div style="margin-top: 10px; font-size: 0.9em; color: #555;">
                            ${new Date(transaction.date).toLocaleString('id-ID')} | Cashier: ${transaction.cashier || 'Staff'}
                        </div>
                        ${transaction.customerName ? `
                        <div style="margin-top: 5px; font-size: 0.9em; font-weight: bold;">
                            Pelanggan: ${transaction.customerName}
                        </div>
                        ${transaction.pointsEarned > 0 ? `
                        <div style="font-size: 0.8em; color: #555;">
                            Poin Didapat: +${transaction.pointsEarned}
                        </div>
                        ` : ''}
                        ` : ''}
                    </div>
                    
                    <div class="divider"></div>
                    <div class="items">
                        ${transaction.items ? transaction.items.map(item => `
                            <div class="item">
                                <span>${item.name} x${item.qty}</span>
                                <span>${(item.price * item.qty).toLocaleString()}</span>
                            </div>
                        `).join('') : '<div>No items</div>'}
                    </div>
                    <div class="divider"></div>

                    <div class="totals">
                        <div class="total-row" style="font-weight: normal;">
                            <span>Subtotal</span>
                            <span>${subtotal.toLocaleString()}</span>
                        </div>
                        ${transaction.discount > 0 ? `
                        <div class="total-row" style="font-weight: normal; color: red;">
                            <span>Discount</span>
                            <span>-${transaction.discount.toLocaleString()}</span>
                        </div>
                        ` : ''}
                        ${tax > 0 ? `
                        <div class="total-row" style="font-weight: normal;">
                            <span>Tax</span>
                            <span>${tax.toLocaleString()}</span>
                        </div>
                        ` : ''}
                        ${serviceCharge > 0 ? `
                        <div class="total-row" style="font-weight: normal;">
                            <span>Service</span>
                            <span>${serviceCharge.toLocaleString()}</span>
                        </div>
                        ` : ''}
                        <div class="total-row" style="font-size: 1.2em;">
                            <span>TOTAL</span>
                            <span>${finalTotal.toLocaleString()}</span>
                        </div>
                    </div>

                    <div class="footer">
                        <div class="divider"></div>
                        ${store?.receiptFooter || 'Terima Kasih'}
                        <div style="margin-top: 5px; font-size: 8px; color: #aaa;">KULA v${version}</div>
                    </div>
                    <script>
                        window.onload = function() { window.print(); window.close(); }
                    </script>
                </body>
            </html>
        `;
        receiptWindow.document.write(html);
        receiptWindow.document.close();
    };

    const handleDownload = async () => {
        if (receiptRef.current) {
            try {
                const canvas = await html2canvas(receiptRef.current, {
                    scale: 2,
                    backgroundColor: '#ffffff'
                });
                const image = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.href = image;
                link.download = `receipt-${transaction.id}.png`;
                link.click();
            } catch (error) {
                console.error('Error generating receipt image:', error);
                alert('Gagal mengunduh gambar struk.');
            }
        }
    };

    // Calculate totals for display
    const subtotal = transaction.subtotal || transaction.total;
    const tax = transaction.tax || 0;
    const serviceCharge = transaction.serviceCharge || 0;
    const finalTotal = transaction.total;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-semibold">Detail Struk</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 bg-gray-50 flex justify-center">
                    {/* Receipt Preview Area */}
                    <div
                        id="receipt-preview"
                        ref={receiptRef}
                        className="bg-white p-6 shadow-sm w-[80mm] min-h-[100mm] text-sm font-mono relative"
                        style={{ color: '#000' }}
                    >
                        {(transaction.status === 'cancelled' || transaction.status === 'void') && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-45 z-10 flex flex-col items-center justify-center pointer-events-none">
                                <div className="border-[6px] border-red-500/30 text-red-500/30 text-5xl font-bold px-4 py-2 uppercase tracking-widest">
                                    CANCELLED
                                </div>
                                {(transaction.voidReason || transaction.cancelReason) && (
                                    <div className="mt-4 bg-red-50/90 border border-red-200 text-red-600 px-3 py-1 rounded text-sm font-medium text-center shadow-sm max-w-[250px]">
                                        <span className="text-xs text-red-400 block uppercase tracking-wider mb-0.5">Alasan</span>
                                        {transaction.voidReason || transaction.cancelReason}
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="text-center mb-4">
                            {store?.logo && (
                                <div className="flex justify-center mb-2">
                                    <img src={store.logo} alt="Store Logo" className="h-12 object-contain" />
                                </div>
                            )}
                            <div className="font-bold text-lg">{store?.name || 'Store Name'}</div>
                            <div className="text-xs text-gray-500">{store?.address}</div>
                            <div className="text-xs text-gray-500">{store?.phone}</div>
                            <div className="border-b border-dashed border-gray-300 my-2"></div>
                            <div className="text-xs">{store?.receiptHeader}</div>
                        </div>

                        <div className="flex justify-between text-xs text-gray-500 mb-2">
                            <span>{new Date(transaction.date).toLocaleString('id-ID')}</span>
                            <span>{transaction.cashier || 'Staff'}</span>
                        </div>

                        {transaction.customerName && (
                            <div className="text-center mb-2">
                                <div className="font-bold text-sm">Pelanggan: {transaction.customerName}</div>
                                {transaction.pointsEarned > 0 && (
                                    <div className="text-xs text-gray-500">Poin: +{transaction.pointsEarned}</div>
                                )}
                            </div>
                        )}

                        <div className="space-y-2 mb-4">
                            {transaction.items && transaction.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between text-xs">
                                    <span className="flex-1 text-left">{item.name} x{item.qty}</span>
                                    <span className="text-right">{(item.price * item.qty).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>

                        <div className="border-b border-dashed border-gray-300 my-2"></div>

                        <div className="space-y-1">
                            <div className="flex justify-between">
                                <span>Subtotal</span>
                                <span>{subtotal.toLocaleString()}</span>
                            </div>
                            {transaction.discount > 0 && (
                                <div className="flex justify-between text-red-500">
                                    <span>Discount</span>
                                    <span>-{transaction.discount.toLocaleString()}</span>
                                </div>
                            )}
                            {tax > 0 && (
                                <div className="flex justify-between text-gray-500">
                                    <span>Tax</span>
                                    <span>{tax.toLocaleString()}</span>
                                </div>
                            )}
                            {serviceCharge > 0 && (
                                <div className="flex justify-between text-gray-500">
                                    <span>Service</span>
                                    <span>{serviceCharge.toLocaleString()}</span>
                                </div>
                            )}
                            <div className="flex justify-between font-bold text-lg mt-2">
                                <span>TOTAL</span>
                                <span>{finalTotal.toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="border-b border-dashed border-gray-300 my-4"></div>

                        <div className="text-center text-[10px] text-slate-400">
                            <p>{store?.receiptFooter || "Terima Kasih"}</p>
                            <p className="mt-2 text-[8px] text-slate-300">KULA v{version}</p>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t flex gap-3 justify-end bg-white">
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                        <Printer size={16} />
                        Cetak
                    </button>
                    <button
                        onClick={handleDownload}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                        <Download size={16} />
                        Simpan
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReceiptModal;
