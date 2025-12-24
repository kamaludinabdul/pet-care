import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Printer, X, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { generateInvoiceMessage, generateWhatsAppLink } from '../utils/whatsapp';

const MedicalInvoice = ({ record, transaction, store, customer, onClose }) => {
    const componentRef = useRef();

    const handlePrint = useReactToPrint({
        content: () => componentRef.current,
        documentTitle: `Invoice-Medis-${record.id}`,
    });

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return format(new Date(dateString), 'dd MMMM yyyy HH:mm', { locale: idLocale });
    };

    const handleWhatsApp = () => {
        const phone = customer?.phone || '';
        // Combine all items (Services + Prescriptions + Tx Items)
        const allItems = [
            ...(record.services || []).map(s => ({ name: s.name, qty: 1 })),
            ...(record.prescriptions || []).map(p => ({ name: p.name, qty: p.qty })),
            ...(transaction?.items?.filter(i => !i.isPetService && !record.services?.some(s => s.name === i.name)) || [])
        ];

        const message = generateInvoiceMessage({
            customerName: customer?.name || 'Pelanggan',
            invoiceNumber: record.recordNumber || record.id?.slice(0, 8).toUpperCase(),
            totalAmount: transaction?.total || record.totalCost || 0,
            items: allItems,
            storeName: store?.name,
            link: window.location.href // Or deep link if available
        });

        const link = generateWhatsAppLink(phone, message);
        window.open(link, '_blank');
    };

    const isPaid = record.status === 'completed' || record.status === 'paid' || transaction;

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

                <CardContent className="p-8" ref={componentRef}>
                    {/* Invoice Header */}
                    <div className="flex justify-between items-start mb-8 border-b pb-4">
                        <div>
                            <h1 className="text-2xl font-bold text-indigo-600 mb-1">{store?.name || 'Pet Care Clinic'}</h1>
                            <p className="text-sm text-slate-500 max-w-[250px]">{store?.address}</p>
                            <p className="text-sm text-slate-500">{store?.phone}</p>
                        </div>
                        <div className="text-right">
                            <h2 className="text-xl font-bold uppercase tracking-wide text-slate-400">Invoice Medis</h2>
                            <p className="font-medium">#{record.recordNumber || record.id?.slice(0, 8).toUpperCase()}</p>
                            <p className="text-sm text-slate-500">{formatDate(record.date)}</p>
                            {isPaid && <div className="mt-2 inline-block px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded uppercase">Lunas</div>}
                        </div>
                    </div>

                    {/* Customer & Pet Details */}
                    <div className="grid grid-cols-2 gap-8 mb-8">
                        <div>
                            <h3 className="text-sm font-bold text-slate-400 uppercase mb-2">Pasien / Pemilik:</h3>
                            <p className="font-semibold text-lg">{customer?.name || 'Tamu'}</p>
                            <p className="text-sm text-slate-600">{customer?.phone || '-'}</p>
                            <p className="text-sm text-slate-600">{customer?.address || '-'}</p>
                        </div>
                        <div className="text-right">
                            <h3 className="text-sm font-bold text-slate-400 uppercase mb-2">Detail Hewan:</h3>
                            <p className="font-semibold">{record.petName || 'Hewan Peliharaan'}</p>
                            <p className="text-sm text-slate-600">{record.petType} • {record.petBreed || '-'}</p>
                            {record.diagnosis && (
                                <div className="mt-2">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase">Diagnosis:</h4>
                                    <p className="text-sm text-slate-700 italic">{record.diagnosis}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Service Details Table */}
                    <table className="w-full mb-8">
                        <thead>
                            <tr className="border-b-2 border-slate-100">
                                <th className="text-left py-3 font-semibold text-slate-600">Layanan / Obat</th>
                                <th className="text-right py-3 font-semibold text-slate-600">Qty</th>
                                <th className="text-right py-3 font-semibold text-slate-600">Harga</th>
                                <th className="text-right py-3 font-semibold text-slate-600">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Medical Services */}
                            {record.services?.map((service, idx) => (
                                <tr key={`svc-${idx}`} className="border-b border-slate-50">
                                    <td className="py-2">
                                        <div className="font-medium text-slate-900">{service.name}</div>
                                        <div className="text-xs text-slate-500">Tindakan Medis</div>
                                    </td>
                                    <td className="text-right py-2 text-slate-600">1</td>
                                    <td className="text-right py-2 text-slate-600">
                                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(service.price || 0)}
                                    </td>
                                    <td className="text-right py-2 font-medium text-slate-900">
                                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(service.price || 0)}
                                    </td>
                                </tr>
                            ))}

                            {/* Prescriptions */}
                            {record.prescriptions?.map((med, idx) => (
                                <tr key={`med-${idx}`} className="border-b border-slate-50">
                                    <td className="py-2">
                                        <div className="font-medium text-slate-900">{med.name}</div>
                                        {med.instructions && <div className="text-xs text-slate-500">{med.instructions}</div>}
                                    </td>
                                    <td className="text-right py-2 text-slate-600">{med.qty || 1} {med.unit || ''}</td>
                                    <td className="text-right py-2 text-slate-600">
                                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(med.price || 0)}
                                    </td>
                                    <td className="text-right py-2 font-medium text-slate-900">
                                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format((med.price || 0) * (med.qty || 1))}
                                    </td>
                                </tr>
                            ))}

                            {/* Extra Items from Transaction if available */}
                            {transaction?.items?.filter(item =>
                                !item.isPetService &&
                                !record.services?.some(s => s.name === item.name) &&
                                !record.prescriptions?.some(p => p.name === item.name)
                            ).map((item, idx) => (
                                <tr key={`tx-${idx}`} className="border-b border-slate-50">
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
                                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(transaction?.total || record.totalCost || 0)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>

                    {/* Footer */}
                    <div className="text-center text-sm text-slate-400 mt-12 pt-8 border-t border-slate-100">
                        <p>{store?.receiptFooter || 'Semoga lekas sembuh! Terima kasih atas kepercayaannya.'}</p>
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

export default MedicalInvoice;
