import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { collection, query, where, orderBy, updateDoc, doc, onSnapshot, getDocs } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { usePOS } from '../../../context/POSContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Label } from '../../../components/ui/label';
import { Scissors, CheckCircle, Clock, Calendar, Printer, User } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { toast } from 'sonner';

import BookingInvoice from '../../../components/BookingInvoice';

const KanbanColumn = ({ title, status, colorClass, icon: Icon, items, onStatusUpdate, onPrintInvoice, onAssignGroomer }) => ( // eslint-disable-line no-unused-vars
    <div className={`flex flex-col gap-4 min-w-[300px] flex-1 bg-slate-50/50 p-4 rounded-xl border border-slate-100 ${colorClass}`}>
        <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Icon className="w-4 h-4" />
                {title}
            </h3>
            <Badge variant="secondary" className="bg-white translate-y-px shadow-sm">{items.length}</Badge>
        </div>
        <div className="flex flex-col gap-3 h-full">
            {items.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-lg bg-white/50">
                    Kosong
                </div>
            )}
            {items.map(task => (
                <Card key={task.id} className="shadow-sm hover:shadow-md transition-all border-slate-200 relative group">
                    <CardContent className="p-3">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <div className="font-semibold">{task.petName}</div>
                                <div className="text-xs text-muted-foreground">{task.serviceName}</div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <div className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {task.startDate ? format(new Date(task.startDate), 'dd MMM', { locale: idLocale }) : '-'}
                                    {task.startTime && ` • ${task.startTime}`}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-slate-400 hover:text-indigo-600"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onAssignGroomer(task);
                                        }}
                                        title="Pilih Groomer"
                                    >
                                        <User className="w-3 h-3" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-slate-400 hover:text-indigo-600"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onPrintInvoice(task);
                                        }}
                                        title="Cetak Invoice"
                                    >
                                        <Printer className="w-3 h-3" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {task.groomerName && (
                            <div className="text-xs text-indigo-600 mb-3 flex items-center gap-1">
                                <Scissors className="w-3 h-3" />
                                {task.groomerName}
                            </div>
                        )}

                        <div className="flex gap-2 mt-2">
                            {status === 'pending' && (
                                <Button size="sm" className="w-full h-8 text-xs bg-indigo-600 hover:bg-indigo-700" onClick={() => onStatusUpdate(task.id, 'processing')}>
                                    Mulai
                                </Button>
                            )}
                            {status === 'processing' && (
                                <Button size="sm" className="w-full h-8 text-xs bg-green-600 hover:bg-green-700" onClick={() => onStatusUpdate(task.id, 'completed')}>
                                    Selesai
                                </Button>
                            )}
                            {status === 'completed' && (
                                <div className="w-full text-center text-xs text-green-600 font-medium py-1 bg-green-50 rounded">
                                    Selesai
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    </div >
);

const ServiceGrooming = () => {
    const { user } = useAuth();
    const { customers } = usePOS();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [invoiceData, setInvoiceData] = useState(null);

    // Staff Assignment
    const [staffList, setStaffList] = useState([]);
    const [isAssignOpen, setIsAssignOpen] = useState(false);
    const [selectedBookingForAssign, setSelectedBookingForAssign] = useState(null);
    const [selectedGroomerId, setSelectedGroomerId] = useState('');

    useEffect(() => {
        if (!user?.storeId) return;

        // Fetch Staff
        const fetchStaff = async () => {
            const staffQ = query(collection(db, 'users'), where('storeId', '==', user.storeId));
            const staffSnap = await getDocs(staffQ);
            setStaffList(staffSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        };
        fetchStaff();

        // Show all active grooming tasks (pending/processing) regardless of date
        // Plus today's completed for recap
        const q = query(
            collection(db, 'bookings'),
            where('storeId', '==', user.storeId),
            where('serviceType', '==', 'grooming'),
            orderBy('startDate', 'asc')
        );

        const startOfDay = new Date().toISOString().split('T')[0];

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allTasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

            // Filter: show pending/processing (any date) + completed today only
            const filtered = allTasks.filter(task => {
                if (task.status === 'pending' || task.status === 'processing' || task.status === 'confirmed') {
                    return true; // Show all active
                }
                if (task.status === 'completed' && task.startDate >= startOfDay) {
                    return true; // Show today's completed
                }
                return false;
            });

            setTasks(filtered);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching grooming tasks:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user?.storeId]);

    const updateStatus = async (bookingId, newStatus) => {
        try {
            await updateDoc(doc(db, 'bookings', bookingId), { status: newStatus });
            setTasks(prev => prev.map(t => t.id === bookingId ? { ...t, status: newStatus } : t));
        } catch (error) {
            console.error("Error updating status:", error);
            toast.error("Gagal update status");
        }
    };

    const handlePrintInvoice = async (booking) => {
        try {
            let transaction = null;
            if (booking.status === 'completed' || booking.status === 'checked_out') {
                const q = query(
                    collection(db, 'transactions'),
                    where('bookingId', '==', booking.id),
                    where('storeId', '==', user.storeId)
                );
                const snap = await getDocs(q);
                if (!snap.empty) {
                    transaction = { id: snap.docs[0].id, ...snap.docs[0].data() };
                }
            }

            const customer = customers.find(c => c.id === booking.ownerId);
            const store = { name: 'Pet Care Store', address: '', phone: '' };

            setInvoiceData({ booking, transaction, customer, store });
        } catch (error) {
            console.error("Error preparing invoice:", error);
            toast.error("Gagal memuat invoice");
        }
    };

    const handleAssignGroomer = (booking) => {
        setSelectedBookingForAssign(booking);
        setSelectedGroomerId(booking.groomerId || '');
        setIsAssignOpen(true);
    };

    const saveGroomerAssignment = async () => {
        if (!selectedBookingForAssign) return;
        try {
            const groomer = staffList.find(s => s.id === selectedGroomerId);
            const groomerName = groomer ? (groomer.name || groomer.email) : '';

            await updateDoc(doc(db, 'bookings', selectedBookingForAssign.id), {
                groomerId: selectedGroomerId,
                groomerName: groomerName
            });

            // Local state update optimized (snapshot will catch it too, but for instant UI)
            setTasks(prev => prev.map(t => t.id === selectedBookingForAssign.id ? { ...t, groomerId: selectedGroomerId, groomerName } : t));

            setIsAssignOpen(false);
            setSelectedBookingForAssign(null);
            toast.success("Petugas berhasil dipilih");
        } catch (error) {
            console.error("Error assigning groomer:", error);
            toast.error("Gagal memilih petugas");
        }
    };

    return (
        <div className="p-6 h-[calc(100vh-4rem)] flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Grooming Station</h1>
                    <p className="text-muted-foreground">Proses layanan grooming hari ini.</p>
                </div>
            </div>

            <div className="flex-1 overflow-x-auto pb-4">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-slate-500">Memuat...</div>
                    </div>
                ) : (
                    <div className="flex gap-4 h-full min-w-max">
                        <KanbanColumn
                            title="Perlu Dikerjakan"
                            status="pending"
                            items={tasks.filter(t => t.status === 'pending' || t.status === 'confirmed')}
                            colorClass="border-t-4 border-t-slate-400"
                            icon={Clock}
                            onStatusUpdate={updateStatus}
                            onPrintInvoice={handlePrintInvoice}
                            onAssignGroomer={handleAssignGroomer}
                        />
                        <KanbanColumn
                            title="Sedang Proses"
                            status="processing"
                            items={tasks.filter(t => t.status === 'processing')}
                            colorClass="border-t-4 border-t-indigo-500"
                            icon={Scissors}
                            onStatusUpdate={updateStatus}
                            onPrintInvoice={handlePrintInvoice}
                            onAssignGroomer={handleAssignGroomer}
                        />
                        <KanbanColumn
                            title="Selesai"
                            status="completed"
                            items={tasks.filter(t => t.status === 'completed')}
                            colorClass="border-t-4 border-t-green-500"
                            icon={CheckCircle}
                            onStatusUpdate={updateStatus}
                            onPrintInvoice={handlePrintInvoice}
                            onAssignGroomer={handleAssignGroomer}
                        />
                    </div>
                )}
            </div>

            <Dialog open={!!invoiceData} onOpenChange={(open) => !open && setInvoiceData(null)}>
                <DialogContent className="max-w-3xl h-[90vh] overflow-y-auto">
                    {invoiceData && <BookingInvoice
                        booking={invoiceData.booking}
                        transaction={invoiceData.transaction}
                        customer={invoiceData.customer}
                        store={invoiceData.store}
                    />}
                </DialogContent>
            </Dialog>

            <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Pilih Petugas Grooming</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <Label className="mb-2 block">Pilih Staff</Label>
                        <Select value={selectedGroomerId} onValueChange={setSelectedGroomerId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Pilih Staff..." />
                            </SelectTrigger>
                            <SelectContent>
                                {staffList.map(staff => (
                                    <SelectItem key={staff.id} value={staff.id}>
                                        {staff.name} ({staff.role})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAssignOpen(false)}>Batal</Button>
                        <Button onClick={saveGroomerAssignment}>Simpan</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ServiceGrooming;
