import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Trash2, MessageCircle, Save } from 'lucide-react'; // Import icons
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, orderBy, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { generateWhatsAppLink } from '../utils/whatsapp';

const ActivityLogModal = ({ booking, isOpen, onClose }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({
        eating: 'lahap',
        mood: 'ceria',
        poop: 'normal',
        notes: ''
    });

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const q = query(
                collection(db, 'activity_logs'),
                where('bookingId', '==', booking.id),
                orderBy('timestamp', 'desc')
            );
            const snapshot = await getDocs(q);
            setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
            console.error("Error fetching activity logs:", error);
        } finally {
            setLoading(false);
        }
    }, [booking?.id]);

    useEffect(() => {
        if (isOpen) {
            fetchLogs();
        }
    }, [isOpen, fetchLogs, booking]);

    const handleSave = async () => {
        try {
            await addDoc(collection(db, 'daily_logs'), {
                bookingId: booking.id,
                petName: booking.petName,
                ownerPhone: booking.activePhone || booking.customer?.phone || '',
                createdAt: Timestamp.now(),
                date: new Date().toISOString(),
                ...form
            });
            setForm({ eating: 'lahap', mood: 'ceria', poop: 'normal', notes: '' });
            fetchLogs();
        } catch (error) {
            console.error("Error saving log:", error);
            alert("Gagal menyimpan log");
        }
    };

    const handleSendWA = (log) => {
        const dateStr = format(log.createdAt.toDate(), 'dd MMM HH:mm', { locale: id });
        const msg = `Halo Kak, update harian untuk *${booking.petName}* (${dateStr}):\n\n` +
            `🍽 Makan: ${log.eating}\n` +
            `✨ Mood: ${log.mood}\n` +
            `💩 Pup: ${log.poop}\n` +
            `${log.notes ? `📝 Catatan: ${log.notes}\n` : ''}` +
            `\nTerima kasih! 🐾`;

        const phone = booking.activePhone || booking.customer?.phone;
        const link = generateWhatsAppLink(phone, msg);
        window.open(link, '_blank');
    };

    const handleDelete = async (logId) => {
        if (!confirm('Hapus log ini?')) return;
        try {
            await deleteDoc(doc(db, 'daily_logs', logId));
            fetchLogs();
        } catch (error) {
            console.error("Error deleting log:", error);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Daily Activity Log: {booking?.petName}</DialogTitle>
                    <DialogDescription>Catat aktivitas harian anabul selama menginap.</DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    {/* Form Section */}
                    <div className="space-y-4 border p-4 rounded-lg bg-slate-50 h-fit">
                        <h3 className="font-semibold text-sm text-slate-900 border-b pb-2">Catat Aktivitas Baru</h3>

                        <div className="space-y-2">
                            <Label>Nafsu Makan</Label>
                            <Select value={form.eating} onValueChange={v => setForm({ ...form, eating: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="lahap">Lahap (Habis)</SelectItem>
                                    <SelectItem value="sisa_sedikit">Sisa Sedikit</SelectItem>
                                    <SelectItem value="sisa_banyak">Sisa Banyak</SelectItem>
                                    <SelectItem value="tidak_makan">Tidak Makan</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Mood / Kondisi</Label>
                            <Select value={form.mood} onValueChange={v => setForm({ ...form, mood: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ceria">Example: Ceria / Aktif</SelectItem>
                                    <SelectItem value="tenang">Tenang / Santai</SelectItem>
                                    <SelectItem value="takut">Takut / Pemalu</SelectItem>
                                    <SelectItem value="agresif">Agresif</SelectItem>
                                    <SelectItem value="lemas">Lemas / Sakit</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Buang Air (Pup/Pee)</Label>
                            <Select value={form.poop} onValueChange={v => setForm({ ...form, poop: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="normal">Normal (Bagus)</SelectItem>
                                    <SelectItem value="lembek">Lembek / Diare</SelectItem>
                                    <SelectItem value="keras">Keras / Sembelit</SelectItem>
                                    <SelectItem value="tidak_pup">Belum Pup</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Catatan Tambahan</Label>
                            <Textarea
                                placeholder="Misal: Sudah dimandikan, obat sudah diminum..."
                                value={form.notes}
                                onChange={e => setForm({ ...form, notes: e.target.value })}
                                rows={3}
                            />
                        </div>

                        <Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={handleSave}>
                            <Save className="h-4 w-4 mr-2" />
                            Simpan Log
                        </Button>
                    </div>

                    {/* Timeline Section */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-sm text-slate-900 border-b pb-2">Riwayat Log</h3>
                        {loading ? <p className="text-sm text-slate-500">Memuat...</p> : logs.length === 0 ? (
                            <p className="text-sm text-slate-500 italic">Belum ada catatan aktivitas.</p>
                        ) : (
                            <div className="space-y-4 pr-1 max-h-[400px] overflow-y-auto">
                                {logs.map(log => (
                                    <div key={log.id} className="bg-white border rounded-lg p-3 text-sm shadow-sm relative group">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-bold text-indigo-600">
                                                {log.createdAt?.seconds
                                                    ? format(log.createdAt.toDate(), 'dd MMM HH:mm', { locale: id })
                                                    : 'Just now'}
                                            </span>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-green-600 hover:bg-green-50" onClick={() => handleSendWA(log)} title="Kirim WA">
                                                    <MessageCircle className="h-3 w-3" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDelete(log.id)}>
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-slate-700 mb-2">
                                            <div>🍽 {log.eating}</div>
                                            <div>✨ {log.mood}</div>
                                            <div>💩 {log.poop}</div>
                                        </div>
                                        {log.notes && <p className="text-slate-500 italic border-t pt-2 mt-1">{log.notes}</p>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ActivityLogModal;
