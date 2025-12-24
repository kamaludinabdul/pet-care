import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Printer, X, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { generateInvoiceMessage, generateWhatsAppLink } from '../utils/whatsapp';

const BookingInvoice = ({ booking, transaction, store, customer, onClose }) => {
    const componentRef = useRef();

    const handlePrint = useReactToPrint({
        content: () => componentRef.current,
        documentTitle: `Invoice-${booking.id}`,
    });

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return format(new Date(dateString), 'dd MMMM yyyy HH:mm', { locale: idLocale });
    };

    const handleWhatsApp = () => {
        const phone = customer?.phone || '';

        let items = [];
        if (booking.serviceType === 'hotel') {
            const days = Math.ceil((new Date(booking.endDate) - new Date(booking.startDate)) / (1000 * 60 * 60 * 24)) || 1;
            items.push({ name: `Pet Hotel (${days} Malam)`, qty: days });
        } else {
            items.push({ name: 'Grooming Service', qty: 1 });
        }

        // Add extra items from transaction
        if (transaction?.items) {
            items = [...items, ...transaction.items.filter(i => i.type !== 'service' && i.type !== 'pet_service')];
        }

        const message = generateInvoiceMessage({
            customerName: customer?.name || 'Pelanggan',
            invoiceNumber: booking.id?.slice(0, 8).toUpperCase(),
            totalAmount: transaction?.total || booking.totalPrice || 0,
            items: items,
            storeName: store?.name,
            link: window.location.href
        });

        const link = generateWhatsAppLink(phone, message);
        window.open(link, '_blank');
    };

    const isPaid = booking.status === 'completed' || booking.status === 'checked_out' || transaction;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <Card className="max-w-3xl w-full max-h-[90vh] overflow-y-auto relative">
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2"
                    onClick={onClose}
                >
                    <X className="h-4 w-4" />
                </Button>

                <CardContent className="p-0">
                    <div className="p-8" ref={componentRef}>
                        {/* Invoice Header */}
                        <div className="flex justify-between items-start mb-8 border-b pb-4">
                            <div className="flex gap-4 items-center">
                                {store?.logo && (
                                    <img src={store.logo} alt={store.name} className="h-16 w-16 object-contain rounded-lg border border-slate-100" />
                                )}
                                <div>
                                    <h1 className="text-2xl font-bold text-indigo-600 mb-1">{store?.name || 'Pet Care Store'}</h1>
                                    <p className="text-sm text-slate-500 max-w-[250px]">{store?.address}</p>
                                    <p className="text-sm text-slate-500">{store?.phone}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <h2 className="text-xl font-bold uppercase tracking-wide text-slate-400">Invoice</h2>
                                <p className="font-medium">#{booking.id?.slice(0, 8).toUpperCase()}</p>
                                <p className="text-sm text-slate-500">{formatDate(new Date())}</p>
                                {isPaid && <div className="mt-2 inline-block px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded uppercase">Lunas</div>}
                            </div>
                        </div>

                        {/* Customer & Pet Details */}
                        <div className="grid grid-cols-2 gap-8 mb-8">
                            <div>
                                <h3 className="text-sm font-bold text-slate-400 uppercase mb-2">Ditagihkan Kepada:</h3>
                                <p className="font-semibold text-lg">{customer?.name || 'Tamu'}</p>
                                <p className="text-sm text-slate-600">{customer?.phone || '-'}</p>
                                <p className="text-sm text-slate-600">{customer?.address || '-'}</p>
                            </div>
                            <div className="text-right">
                                <h3 className="text-sm font-bold text-slate-400 uppercase mb-2">Detail Hewan:</h3>
                                <p className="font-semibold">{booking.petName || 'Hewan Peliharaan'}</p>
                                <p className="text-sm text-slate-600">{booking.petType} • {booking.petBreed || '-'}</p>
                            </div>
                        </div>

                        {/* Service Details Table */}
                        <table className="w-full mb-8">
                            <thead>
                                <tr className="border-b-2 border-slate-100">
                                    <th className="text-left py-3 font-semibold text-slate-600">Layanan</th>
                                    <th className="text-right py-3 font-semibold text-slate-600">Durasi / Qty</th>
                                    <th className="text-right py-3 font-semibold text-slate-600">Harga</th>
                                    <th className="text-right py-3 font-semibold text-slate-600">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b border-slate-50">
                                    <td className="py-4">
                                        <div className="font-medium text-slate-900">
                                            {booking.serviceType === 'hotel' ? 'Pet Hotel' : 'Grooming'}
                                        </div>
                                        <div className="text-sm text-slate-500">
                                            {booking.serviceType === 'hotel'
                                                ? `${formatDate(booking.startDate)} - ${formatDate(booking.endDate)}`
                                                : formatDate(booking.startDate)}
                                        </div>
                                    </td>
                                    <td className="text-right py-4 text-slate-600">
                                        {booking.serviceType === 'hotel'
                                            ? (() => {
                                                const days = Math.ceil((new Date(booking.endDate) - new Date(booking.startDate)) / (1000 * 60 * 60 * 24)) || 1;
                                                return `${days} Malam`;
                                            })()
                                            : '1 Sesi'}
                                    </td>
                                    <td className="text-right py-4 text-slate-600">
                                        {/* Fallback price logic if itemized details aren't perfect */}
                                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(booking.totalPrice || 0)}
                                    </td>
                                    <td className="text-right py-4 font-medium text-slate-900">
                                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(booking.totalPrice || 0)}
                                    </td>
                                </tr>
                                {/* If transaction exists, show extra items */}
                                {transaction?.items?.filter(item => item.type !== 'service' && item.type !== 'pet_service').map((item, idx) => (
                                    <tr key={idx} className="border-b border-slate-50">
                                        <td className="py-2 text-slate-600">{item.name}</td>
                                        <td className="text-right py-2 text-slate-600">{item.qty}</td>
                                        <td className="text-right py-2 text-slate-600">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(item.price)}</td>
                                        <td className="text-right py-2 text-slate-900">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(item.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan="3" className="text-right py-4 font-semibold text-slate-600">Total</td>
                                    <td className="text-right py-4 font-bold text-xl text-indigo-600">
                                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(transaction?.total || booking.totalPrice || 0)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>

                        {/* Footer */}
                        <div className="text-center text-sm text-slate-400 mt-12 pt-8 border-t border-slate-100">
                            <p>{store?.receiptFooter || 'Terima kasih atas kunjungan Anda!'}</p>
                        </div>
                    </div>
                </CardContent>

                <div className="flex justify-end p-4 border-t bg-slate-50 gap-2">
                    <Button variant="outline" onClick={onClose}>Tutup</Button>
                    <Button
                        variant="outline"
                        onClick={handleWhatsApp}
                        className="flex gap-2 items-center border-green-600 text-green-600 hover:bg-green-50"
                    >
                        <MessageCircle className="h-4 w-4" />
                        Kirim WhatsApp
                    </Button>
                    <Button onClick={handlePrint} className="flex gap-2 items-center">
                        <Printer className="h-4 w-4" />
                        Cetak Invoice
                    </Button>
                </div>
            </Card>
        </div>
    );
};

export default BookingInvoice;
