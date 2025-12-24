import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Printer, X, Award } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const HealthCertificate = ({ record, store, customer, onClose }) => {
    const componentRef = useRef();

    const handlePrint = useReactToPrint({
        content: () => componentRef.current,
        documentTitle: `Sertifikat-Sehat-${record.petName}-${record.date}`,
    });

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return format(new Date(dateString), 'dd MMMM yyyy', { locale: idLocale });
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto relative">
                <Button variant="ghost" size="icon" className="absolute right-2 top-2 z-10" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>

                <div className="p-8 md:p-12 overflow-hidden relative" ref={componentRef}>
                    {/* Decorative Background/Border */}
                    <div className="absolute inset-0 border-[12px] border-double border-indigo-900 pointer-events-none m-4"></div>
                    <div className="absolute inset-0 opacity-[0.03] bg-[url('https://cdn-icons-png.flaticon.com/512/107/107831.png')] bg-center bg-no-repeat bg-contain pointer-events-none"></div>

                    <CardContent className="relative z-10 text-center space-y-8 min-h-[800px] flex flex-col justify-between">

                        {/* Header */}
                        <div className="space-y-4">
                            <div className="flex justify-center mb-4">
                                <Award className="h-20 w-20 text-yellow-500" />
                            </div>
                            <h1 className="text-4xl font-serif font-bold text-indigo-900 tracking-wide uppercase">Sertifikat Kesehatan</h1>
                            <p className="text-lg text-slate-500 font-serif italic">Health Certificate</p>
                            <div className="w-32 h-1 bg-indigo-900 mx-auto mt-4 rounded-full"></div>
                        </div>

                        {/* Content */}
                        <div className="grid grid-cols-2 gap-12 text-left px-12">
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wider mb-1">Nama Hewan (Name)</h3>
                                    <p className="text-2xl font-serif text-slate-800 border-b border-slate-300 pb-1">{record.petName || '-'}</p>
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wider mb-1">Jenis (Species/Breed)</h3>
                                    <p className="text-lg font-serif text-slate-800 border-b border-slate-300 pb-1">{record.petType} / {record.petBreed || '-'}</p>
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wider mb-1">Warna / Tanda (Color/Marking)</h3>
                                    <p className="text-lg font-serif text-slate-800 border-b border-slate-300 pb-1">{record.petColor || '-'}</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wider mb-1">Pemilik (Owner)</h3>
                                    <p className="text-2xl font-serif text-slate-800 border-b border-slate-300 pb-1">{customer?.name || '-'}</p>
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wider mb-1">Alamat (Address)</h3>
                                    <p className="text-lg font-serif text-slate-800 border-b border-slate-300 pb-1">{customer?.address || '-'}</p>
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wider mb-1">Telepon (Phone)</h3>
                                    <p className="text-lg font-serif text-slate-800 border-b border-slate-300 pb-1">{customer?.phone || '-'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Findings */}
                        <div className="bg-indigo-50/50 p-6 rounded-xl border border-indigo-100 mx-12 text-left">
                            <h3 className="text-center font-bold text-indigo-900 uppercase mb-4">Hasil Pemeriksaan (Examination Results)</h3>
                            <div className="space-y-2">
                                <p className="text-slate-700"><span className="font-semibold">Tanggal Periksa:</span> {formatDate(record.date)}</p>
                                <p className="text-slate-700"><span className="font-semibold">Berat Badan:</span> {record.weight || '-'} kg</p>
                                <p className="text-slate-700"><span className="font-semibold">Suhu Tubuh:</span> {record.temperature || '-'} °C</p>
                                <p className="text-slate-700 mt-4"><span className="font-semibold">Diagnosis / Catatan Medis:</span></p>
                                <p className="text-slate-800 italic ml-4">"{record.diagnosis || 'Sehat (Healthy)'}"</p>
                                {record.treatment && (
                                    <>
                                        <p className="text-slate-700 mt-2"><span className="font-semibold">Tindakan / Obat:</span></p>
                                        <p className="text-slate-800 italic ml-4">{record.treatment}</p>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Footer / Signature */}
                        <div className="pt-12 pb-8 px-12 flex justify-between items-end">
                            <div className="text-left max-w-xs">
                                <p className="font-bold text-lg text-indigo-900">{store?.name || 'Pet Care Clinic'}</p>
                                <p className="text-sm text-slate-500">{store?.address}</p>
                                <p className="text-sm text-slate-500">{store?.phone}</p>
                                <p className="text-xs text-slate-400 mt-2">Dicetak pada: {formatDate(new Date())}</p>
                            </div>

                            <div className="text-center ">
                                <div className="h-24 flex items-end justify-center mb-2">
                                    {/* Placeholder for Signature */}
                                    {/* <img src="/sig.png" className="h-16" alt="Signature" /> */}
                                </div>
                                <div className="border-t border-slate-900 w-48 mx-auto"></div>
                                <p className="font-bold text-indigo-900 mt-2">{record.doctorName || 'Drh. Dokter Hewan'}</p>
                                <p className="text-sm text-slate-500 uppercase">Veterinarian Signature</p>
                            </div>
                        </div>

                        <div className="text-[10px] text-slate-300 pb-2">
                            Authentic Health Certificate generated by Kula Pet Care System
                        </div>

                    </CardContent>
                </div>

                <div className="flex justify-end p-4 border-t bg-slate-50 gap-2">
                    <Button variant="outline" onClick={onClose}>Tutup</Button>
                    <Button onClick={handlePrint} className="bg-indigo-600 hover:bg-indigo-700">
                        <Printer className="h-4 w-4 mr-2" />
                        Cetak Sertifikat
                    </Button>
                </div>
            </Card>
        </div>
    );
};

export default HealthCertificate;
