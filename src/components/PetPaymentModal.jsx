import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Plus, Trash2, Calculator, Loader2, Printer, CheckCircle } from 'lucide-react';
import { format, differenceInCalendarDays, eachDayOfInterval, isSaturday, isSunday } from 'date-fns';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import BookingInvoice from './BookingInvoice';
import MedicalInvoice from './MedicalInvoice';

const PetPaymentModal = ({ isOpen, onClose, booking, medicalRecord, onSuccess }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState('input'); // 'input' | 'success'
    const [transactionId, setTransactionId] = useState(null);
    const [savedTransaction, setSavedTransaction] = useState(null);
    const [staffList, setStaffList] = useState([]);

    // Fetch Staff List
    useEffect(() => {
        const fetchStaff = async () => {
            if (!user?.storeId) return;
            try {
                // Ideally filter by role, but for now fetch all to be safe
                const q = query(collection(db, 'users'), where('storeId', '==', user.storeId));
                const snap = await getDocs(q);
                // Filter client side if needed, or assume all in 'users' are staff-like
                setStaffList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (err) {
                console.error("Error fetching staff", err);
            }
        };
        fetchStaff();
    }, [user?.storeId]);

    // Transaction State
    const [items, setItems] = useState([]);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [notes, setNotes] = useState('');

    // Hotel Commission State
    const [weekdayStaff, setWeekdayStaff] = useState({ staff1: null, staff2: null });
    const [weekendStaff, setWeekendStaff] = useState({}); // { 'yyyy-mm-dd': staffId }
    const [stayDays, setStayDays] = useState([]);

    useEffect(() => {
        if (isOpen && booking && booking.serviceType === 'hotel' && booking.startDate && booking.endDate) {
            try {
                const start = new Date(booking.startDate);
                const end = new Date(booking.endDate);
                // Fix: ensure valid interval. If start > end, just use start.
                if (start <= end) {
                    const days = eachDayOfInterval({ start, end: new Date(end.setDate(end.getDate() - 1)) }); // Exclude checkout day for night count usually? Or include?
                    // "5000/hari/hewan". Usually per night. Let's assume inclusive of start, exclusive of end (nights).
                    // If start=1, end=2, that's 1 night.
                    // Implementation: differenceInCalendarDays is nights.
                    // eachDayOfInterval inclusive.
                    // Let's stick to "Nights" logic for fees.
                    // Generate array of "Nights". 
                    // Night 1: Date X.
                    const nightsCount = differenceInCalendarDays(new Date(booking.endDate), new Date(booking.startDate));
                    const nightDates = [];
                    for (let i = 0; i < nightsCount; i++) {
                        const d = new Date(booking.startDate);
                        d.setDate(d.getDate() + i);
                        nightDates.push(d);
                    }
                    setStayDays(nightDates);
                }
            } catch (e) {
                console.error("Error generating dates", e);
                setStayDays([]);
            }
        } else {
            setStayDays([]);
        }
    }, [isOpen, booking]);

    // Initialize Items from Props
    useEffect(() => {
        if (isOpen) {
            const initialItems = [];

            if (booking) {
                // Determine Service Item
                let name = booking.serviceType === 'hotel' ? 'Pet Hotel' : 'Grooming Service';
                let price = booking.totalPrice || 0;
                let qty = 1;
                let fee = 0;
                let staffId = booking.groomerId || null;

                if (booking.serviceType === 'hotel' && booking.startDate && booking.endDate) {
                    const nights = differenceInCalendarDays(new Date(booking.endDate), new Date(booking.startDate)) || 1;
                    name = `Pet Hotel (${nights} Malam)`;
                    qty = 1;
                }

                initialItems.push({
                    name,
                    price: price,
                    qty: qty,
                    fee: fee,
                    staffId: staffId,
                    type: 'service',
                    id: 'main-service'
                });
            } else if (medicalRecord) {
                // Medical Record Base Fee
                initialItems.push({
                    name: `Konsultasi & Pemeriksaan (${medicalRecord.diagnosis || 'Umum'})`,
                    price: 50000,
                    qty: 1,
                    type: 'service',
                    fee: 0,
                    staffId: medicalRecord.doctorId || user.uid,
                    id: 'consultation-fee'
                });
                if (medicalRecord.prescriptions && medicalRecord.prescriptions.length > 0) {
                    medicalRecord.prescriptions.forEach((p, idx) => {
                        initialItems.push({
                            name: p.name,
                            price: Number(p.price) || 0,
                            qty: Number(p.qty) || 1,
                            discount: Number(p.discount || 0),
                            fee: Number(p.fee || 0),
                            staffId: medicalRecord.doctorId || user.uid,
                            type: 'medicine',
                            id: `med-${idx}-${Date.now()}`
                        });
                    });
                }
                // Add Medical Services (Rontgen, USG, etc)
                if (medicalRecord.services && medicalRecord.services.length > 0) {
                    medicalRecord.services.forEach((s, idx) => {
                        const price = Number(s.price) || 0;
                        const qty = 1;
                        const discount = Number(s.discount) || 0;

                        initialItems.push({
                            name: s.name,
                            price: price,
                            qty: qty,
                            discount: discount,
                            fee: Number(s.fee) || 0, // Doctor Commission
                            feeParamedic: Number(s.feeParamedic) || 0, // Paramedic Commission
                            staffId: medicalRecord.doctorId || user.uid, // The Doctor
                            paramedicId: medicalRecord.paramedicId || null, // The Paramedic
                            type: 'service',
                            capitalPrice: Number(s.capitalPrice || 0),
                            id: `service-${idx}-${Date.now()}`
                        });
                    });
                }
            }

            setItems(initialItems);
            setStep('input');
            setTransactionId(null);
            setSavedTransaction(null);
        }
    }, [isOpen, booking, medicalRecord]);

    const handleAddItem = () => {
        setItems([...items, { name: '', price: 0, qty: 1, type: 'manual', id: Date.now() }]);
    };

    const handleUpdateItem = (index, field, value) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const handleRemoveItem = (index) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };

    const grandTotal = items.reduce((sum, item) => {
        const itemTotal = (Number(item.price) * Number(item.qty)) - (Number(item.discount || 0));
        return sum + itemTotal;
    }, 0);

    const handleProcessPayment = async () => {
        if (!user?.storeId) return;
        setLoading(true);
        try {
            if (!user || !user.id) {
                console.error("User not authenticated or missing ID", user);
                throw new Error("Sesi pengguna tidak valid. Silakan login ulang.");
            }

            // 1. Create Transaction Record
            const transactionData = {
                storeId: user.storeId,
                date: new Date().toISOString(),
                createdAt: serverTimestamp(),
                createdBy: user.id, // Validated above
                customer: {
                    id: booking?.ownerId || medicalRecord?.ownerId || 'guest',
                    name: booking?.ownerName || medicalRecord?.ownerName || 'Guest Customer'
                },
                items: items.map(i => {
                    const itemData = {
                        name: i.name || 'Item Tanpa Nama',
                        price: Number(i.price || 0),
                        qty: Number(i.qty || 1),
                        discount: Number(i.discount || 0),
                        fee: Number(i.fee || 0),
                        feeParamedic: Number(i.feeParamedic || 0),
                        staffId: i.staffId || null,
                        paramedicId: i.paramedicId || null,
                        total: (Number(i.price || 0) * Number(i.qty || 1)) - Number(i.discount || 0),
                        type: i.type || 'manual',
                        capitalPrice: Number(i.capitalPrice || 0)
                    };

                    // Attach Commission Allocation for Hotel Service
                    if (stayDays.length > 0 && i.id === 'main-service') {
                        const commissionDetails = stayDays.map(date => {
                            const dateStr = format(date, 'yyyy-MM-dd');
                            const isWeekend = isSaturday(date) || isSunday(date);
                            const feePerAnimal = 5000;

                            if (isWeekend) {
                                const dedicatedStaffId = weekendStaff[dateStr];
                                return [{
                                    date: dateStr,
                                    staffId: dedicatedStaffId,
                                    fee: feePerAnimal,
                                    role: 'weekend_duty'
                                }];
                            } else {
                                // Weekday Split
                                return [
                                    { date: dateStr, staffId: weekdayStaff.staff1, fee: feePerAnimal / 2, role: 'weekday_shared' },
                                    { date: dateStr, staffId: weekdayStaff.staff2, fee: feePerAnimal / 2, role: 'weekday_shared' }
                                ];
                            }
                        }).flat().filter(c => c.staffId); // Remove empty if any

                        itemData.commissionDetails = commissionDetails;
                        // Optional: Update main fee to be sum of commissions? 
                        // itemData.fee = commissionDetails.reduce((sum, c) => sum + c.fee, 0);
                    }

                    return itemData;
                }),
                total: Number(grandTotal || 0),
                paymentMethod: paymentMethod || 'cash',
                type: 'pet_service',
                status: 'paid',
                bookingId: booking?.id || null,
                medicalRecordId: medicalRecord?.id || null
            };

            // Basic Validation
            if (transactionData.items.length === 0) {
                throw new Error("Tidak ada item yang dipilih.");
            }
            if (!transactionData.storeId) {
                throw new Error("Store ID missing.");
            }

            const docRef = await addDoc(collection(db, 'transactions'), transactionData);
            setTransactionId(docRef.id);
            setSavedTransaction({ id: docRef.id, ...transactionData });

            // 2. Update Source Document Status
            if (booking?.id) {
                await updateDoc(doc(db, 'bookings', booking.id), {
                    status: booking.serviceType === 'hotel' ? 'checked_out' : 'completed',
                    paymentStatus: 'paid',
                    transactionId: docRef.id
                });
            }
            if (medicalRecord?.id) {
                await updateDoc(doc(db, 'medical_records', medicalRecord.id), {
                    paymentStatus: 'paid',
                    transactionId: docRef.id
                });
            }

            setStep('success');
            if (onSuccess) onSuccess();

        } catch (error) {
            console.error("Payment Error:", error);
            alert("Gagal memproses pembayaran. Coba lagi.");
        } finally {
            setLoading(false);
        }
    };

    const [showInvoice, setShowInvoice] = useState(false);

    if (showInvoice && savedTransaction) {
        if (medicalRecord) {
            return (
                <MedicalInvoice
                    record={medicalRecord}
                    transaction={savedTransaction}
                    store={user?.store ? { ...user.store } : null} // Pass store if available or rely on internal logic
                    customer={{ name: savedTransaction.customer?.name || medicalRecord.ownerName }}
                    onClose={() => {
                        setShowInvoice(false);
                        onClose();
                    }}
                />
            );
        }

        return (
            <BookingInvoice
                booking={booking || {}}
                transaction={savedTransaction}
                customer={{ name: 'Pelanggan' }}
                startPrinting={true}
                onClose={() => {
                    setShowInvoice(false);
                    onClose();
                }}
            />
        );
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Checkout & Pembayaran</DialogTitle>
                    <DialogDescription>
                        {booking ? `Pembayaran untuk Reservasi: ${booking.serviceType === 'hotel' ? 'Pet Hotel' : 'Grooming'}` : 'Pembayaran Layanan Medis'}
                    </DialogDescription>
                </DialogHeader>

                {step === 'input' ? (
                    <div className="space-y-6">
                        {/* Item List */}
                        <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                            <div className="flex font-medium text-sm text-slate-500 border-b pb-2 gap-2">
                                <div className="flex-[2] min-w-[200px]">Deskripsi Item</div>
                                <div className="w-16 text-center">Qty</div>
                                <div className="w-28 text-right">Harga</div>
                                <div className="w-40 text-center">Staff (Fee)</div>
                                <div className="w-24 text-right">Diskon</div>
                                <div className="w-32 text-right">Total</div>
                                <div className="w-10"></div>
                            </div>

                            {items.map((item, idx) => (
                                <div key={item.id} className="flex items-center gap-2">
                                    <Input
                                        value={item.name}
                                        onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                                        placeholder="Nama Layanan / Barang"
                                        className="flex-[2] min-w-[200px]"
                                    />
                                    <Input
                                        type="number"
                                        value={item.qty}
                                        onChange={(e) => handleUpdateItem(idx, 'qty', Number(e.target.value))}
                                        className="w-16 text-center"
                                        min="1"
                                    />
                                    <Input
                                        type="number"
                                        value={item.price}
                                        onChange={(e) => handleUpdateItem(idx, 'price', Number(e.target.value))}
                                        className="w-28 text-right"
                                        min="0"
                                    />

                                    <div className="w-40 px-1 relative">
                                        <Select
                                            value={item.staffId || 'unassigned'}
                                            onValueChange={(val) => handleUpdateItem(idx, 'staffId', val === 'unassigned' ? null : val)}
                                        >
                                            <SelectTrigger className="h-9 text-xs">
                                                <SelectValue placeholder="Pilih Staff" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="unassigned">- Staff -</SelectItem>
                                                {staffList.map(s => (
                                                    <SelectItem key={s.id} value={s.id}>{s.name || s.email}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <div className="absolute -bottom-4 left-0 text-[10px] text-slate-400 w-full text-center">
                                            {item.fee ? `Fee: ${item.fee.toLocaleString()}` : ''}
                                        </div>
                                    </div>

                                    <div className="w-24 text-right text-red-500 font-medium">
                                        {item.discount > 0 ? `-${item.discount.toLocaleString()}` : '-'}
                                    </div>
                                    <div className="w-32 text-right font-medium">
                                        {((item.price * item.qty) - (item.discount || 0)).toLocaleString('id-ID')}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleRemoveItem(idx)}
                                        className="text-red-500 hover:text-red-700 w-10 flex-shrink-0"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}

                            <Button variant="outline" size="sm" onClick={handleAddItem} className="w-full border-dashed">
                                <Plus className="h-4 w-4 mr-2" />
                                Tambah Item Tambahan (Obat, Snack, dll)
                            </Button>
                        </div>

                        {/* Commission Config for Hotel */}
                        {stayDays.length > 0 && (
                            <div className="bg-slate-50 p-4 rounded-lg space-y-4 border mb-4">
                                <h4 className="font-semibold text-sm flex items-center gap-2">
                                    <Calculator className="h-4 w-4" />
                                    Alokasi Komisi Staff (Hotel)
                                </h4>

                                {/* Weekday Defaults */}
                                <div className="space-y-2">
                                    <Label className="text-xs text-slate-500">Staff Weekday (Senin - Jumat) - Shared Fee</Label>
                                    <div className="flex gap-2">
                                        <Select value={weekdayStaff.staff1 || ''} onValueChange={v => setWeekdayStaff(prev => ({ ...prev, staff1: v }))}>
                                            <SelectTrigger className="bg-white"><SelectValue placeholder="Staff 1" /></SelectTrigger>
                                            <SelectContent>
                                                {staffList.map(s => <SelectItem key={s.id} value={s.id}>{s.name || s.email}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <div className="flex items-center text-slate-400">+</div>
                                        <Select value={weekdayStaff.staff2 || ''} onValueChange={v => setWeekdayStaff(prev => ({ ...prev, staff2: v }))}>
                                            <SelectTrigger className="bg-white"><SelectValue placeholder="Staff 2" /></SelectTrigger>
                                            <SelectContent>
                                                {staffList.map(s => <SelectItem key={s.id} value={s.id}>{s.name || s.email}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* Weekend Overrides */}
                                <div className="space-y-2 border-t pt-2">
                                    <Label className="text-xs text-slate-500">Jadwal Weekend (Sabtu & Minggu)</Label>
                                    {stayDays.filter(d => isSaturday(d) || isSunday(d)).length === 0 ? (
                                        <p className="text-xs text-slate-400 italic">Tidak ada hari weekend dalam durasi ini.</p>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-2">
                                            {stayDays.map((date, idx) => {
                                                const dateStr = format(date, 'yyyy-MM-dd');
                                                if (!isSaturday(date) && !isSunday(date)) return null;
                                                return (
                                                    <div key={idx} className="space-y-1">
                                                        <Label className="text-[10px] text-slate-500">{format(date, 'EEEE, dd MMM')}</Label>
                                                        <Select
                                                            value={weekendStaff[dateStr] || ''}
                                                            onValueChange={v => setWeekendStaff(prev => ({ ...prev, [dateStr]: v }))}
                                                        >
                                                            <SelectTrigger className="h-8 text-xs bg-white"><SelectValue placeholder="Pilih Staff Jaga" /></SelectTrigger>
                                                            <SelectContent>
                                                                {staffList.map(s => <SelectItem key={s.id} value={s.id}>{s.name || s.email}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Summary & Payment Method */}
                        <div className="grid grid-cols-2 gap-8 border-t pt-4">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Metode Pembayaran</Label>
                                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="cash">Tunai (Cash)</SelectItem>
                                            <SelectItem value="transfer">Transfer Bank</SelectItem>
                                            <SelectItem value="qris">QRIS</SelectItem>
                                            <SelectItem value="debit">Kartu Debit</SelectItem>
                                            <SelectItem value="credit">Kartu Kredit</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Catatan (Opsional)</Label>
                                    <Input
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Catatan transaksi..."
                                    />
                                </div>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                                <div className="flex justify-between text-sm text-slate-600">
                                    <span>Subtotal</span>
                                    <span>Rp {grandTotal.toLocaleString('id-ID')}</span>
                                </div>
                                <div className="flex justify-between text-sm text-slate-600">
                                    <span>Pajak (0%)</span>
                                    <span>Rp 0</span>
                                </div>
                                <div className="border-t pt-3 flex justify-between items-center">
                                    <span className="font-bold text-lg">Total</span>
                                    <span className="font-bold text-xl text-indigo-600">
                                        Rp {grandTotal.toLocaleString('id-ID')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="py-8 flex flex-col items-center justify-center space-y-4 text-center">
                        <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                            <CheckCircle className="h-8 w-8" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-900">Pembayaran Berhasil!</h3>
                            <p className="text-slate-500">Transaksi telah disimpan.</p>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    {step === 'input' ? (
                        <>
                            <Button variant="outline" onClick={onClose} disabled={loading}>Batal</Button>
                            <Button onClick={handleProcessPayment} disabled={loading || items.length === 0} className="bg-indigo-600 hover:bg-indigo-700">
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Proses Pembayaran
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" onClick={onClose}>Tutup</Button>
                            <Button onClick={() => setShowInvoice(true)} className="gap-2">
                                <Printer className="h-4 w-4" />
                                Cetak Struk
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog >
    );
};

export default PetPaymentModal;
