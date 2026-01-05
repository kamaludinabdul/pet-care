import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { collection, query, where, updateDoc, doc, onSnapshot, getDoc, addDoc, getDocs } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { usePOS } from '../../../context/POSContext';
import { Button } from '../../../components/ui/button';
import { LayoutGrid, Calendar as CalendarIcon, Grid, Copy, Check } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { toast } from 'sonner';

import CalendarView from '../CalendarView';
import HotelRoomCard from '../../../components/pet-care/HotelRoomCard';
import HotelBookingModal from '../../../components/pet-care/HotelBookingModal';
import BookingInvoice from '../../../components/BookingInvoice';
import { getAccessToken } from '../../../services/ezvizService';

const ServiceHotel = () => {
    const { user } = useAuth();
    const { customers } = usePOS();
    const [rooms, setRooms] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal States
    const [selectedRoomForCheckIn, setSelectedRoomForCheckIn] = useState(null);
    const [cctvLink, setCctvLink] = useState('');
    const [isCctvDialogOpen, setIsCctvDialogOpen] = useState(false);
    const [cctvCopied, setCctvCopied] = useState(false);

    // Invoice State
    const [invoiceData, setInvoiceData] = useState(null);

    useEffect(() => {
        if (!user?.storeId) return;

        // 1. Fetch Rooms
        const qRooms = query(collection(db, 'rooms'), where('storeId', '==', user.storeId));
        const unsubscribeRooms = onSnapshot(qRooms, (snapshot) => {
            const roomData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setRooms(roomData.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })));
            setLoading(false);
        }, (error) => {
            console.error("Error fetching rooms:", error);
            setLoading(false);
        });

        // 2. Fetch Active/Recent Hotel Bookings
        const qBookings = query(
            collection(db, 'bookings'),
            where('storeId', '==', user.storeId),
            where('serviceType', '==', 'hotel')
        );

        const unsubscribeBookings = onSnapshot(qBookings, (snapshot) => {
            const bookingData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setBookings(bookingData);
        }, (error) => {
            console.error("Error fetching bookings:", error);
        });

        return () => {
            unsubscribeRooms();
            unsubscribeBookings();
        };
    }, [user?.storeId]);

    // Handle Check In
    const handleCheckIn = (room) => {
        setSelectedRoomForCheckIn(room);
    };

    // Handle Check Out
    const handleCheckOut = async (room, booking) => {
        if (!window.confirm(`Konfirmasi Check-out untuk ${booking?.petName || room.name}?`)) return;

        try {
            await updateDoc(doc(db, 'rooms', room.id), {
                status: 'available',
                currentOccupantId: null,
                currentBookingId: null
            });

            if (booking) {
                await updateDoc(doc(db, 'bookings', booking.id), {
                    status: 'completed',
                    checkoutTime: new Date().toISOString()
                });
            }

            toast.success('Check-out berhasil');
        } catch (error) {
            console.error("Error checking out:", error);
            toast.error("Gagal melakukan check-out");
        }
    };

    // Handle Print Invoice
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

    // Handle Share CCTV
    const handleShareCCTV = async (booking) => {
        if (!booking || !booking.roomId) {
            toast.error("Data booking tidak valid untuk CCTV");
            return;
        }

        const toastId = toast.loading('Membuat link CCTV...');

        try {
            const room = rooms.find(r => r.id === booking.roomId);
            if (!room) throw new Error("Room not found");
            if (!room.cameraSerial) {
                toast.dismiss(toastId);
                toast.error("Kamar ini tidak memiliki CCTV");
                return;
            }

            let ezvizToken = '';
            try {
                const settingsRef = doc(db, 'cctv_settings', booking.storeId);
                const settingsSnap = await getDoc(settingsRef);

                if (settingsSnap.exists()) {
                    const settings = settingsSnap.data();
                    if (settings.appKey && settings.appSecret) {
                        const tokenResponse = await getAccessToken(settings.appKey, settings.appSecret);
                        if (tokenResponse.code === '200' && tokenResponse.data) {
                            ezvizToken = tokenResponse.data.accessToken;
                        }
                    }
                }
            } catch (err) {
                console.warn("Token fetch warning:", err);
            }

            const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

            await addDoc(collection(db, 'cctv_tokens'), {
                token,
                bookingId: booking.id,
                roomId: booking.roomId,
                storeId: booking.storeId,
                ezvizToken,
                createdAt: new Date().toISOString(),
                validUntil: booking.endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            });

            const url = `${window.location.origin}/cctv/${token}`;
            setCctvLink(url);
            setIsCctvDialogOpen(true);
            toast.dismiss(toastId);
            toast.success("Link CCTV siap!");

        } catch (error) {
            console.error("Error generating CCTV:", error);
            toast.dismiss(toastId);
            toast.error("Gagal membuat link CCTV");
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(cctvLink);
        setCctvCopied(true);
        setTimeout(() => setCctvCopied(false), 2000);
        toast.success("Link disalin!");
    };


    const getRoomBooking = (room) => {
        if (!room.currentBookingId) return null;
        return bookings.find(b => b.id === room.currentBookingId);
    };

    const totalRooms = rooms.length;
    const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

    return (
        <div className="p-6 space-y-6 h-[calc(100vh-64px)] overflow-y-auto">
            {/* Header Stats */}
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Pet Hotel Board</h1>
                    <p className="text-sm text-muted-foreground">Monitor status kamar dan tamu hotel.</p>
                </div>
                <div className="flex gap-8 px-6">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-slate-900">{totalRooms}</div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">Total</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{totalRooms - occupiedRooms}</div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">Available</div>
                    </div>
                    <div className="text-center border-l pl-8">
                        <div className="text-2xl font-bold text-indigo-600">{occupancyRate}%</div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">Occupancy</div>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="monitor" className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="monitor" className="flex items-center gap-2">
                        <Grid className="w-4 h-4" />
                        Room Monitor
                    </TabsTrigger>
                    <TabsTrigger value="calendar" className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4" />
                        Calendar Schedule
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="monitor" className="mt-0">
                    {rooms.length === 0 && !loading ? (
                        <div className="text-center py-12 border-2 border-dashed rounded-xl text-slate-400 bg-slate-50/50">
                            <LayoutGrid className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p>Belum ada data kamar.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 auto-rows-fr">
                            {rooms.map(room => (
                                <div key={room.id} className="min-h-[220px]">
                                    <HotelRoomCard
                                        room={room}
                                        booking={getRoomBooking(room)}
                                        onCheckIn={handleCheckIn}
                                        onCheckOut={handleCheckOut}
                                        onShareCCTV={handleShareCCTV}
                                        onPrintInvoice={handlePrintInvoice}
                                        onViewDetails={(b) => console.log("View details", b)}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="calendar">
                    <CalendarView bookings={bookings} onSelectBooking={(b) => console.log("Selected", b)} />
                </TabsContent>
            </Tabs>

            {/* Quick Booking Modal */}
            <HotelBookingModal
                room={selectedRoomForCheckIn}
                isOpen={!!selectedRoomForCheckIn}
                onClose={() => setSelectedRoomForCheckIn(null)}
                storeId={user?.storeId}
                onSuccess={() => {
                    setSelectedRoomForCheckIn(null);
                }}
            />

            {/* CCTV Link Dialog */}
            <Dialog open={isCctvDialogOpen} onOpenChange={setIsCctvDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Link CCTV Publik</DialogTitle>
                        <DialogDescription>
                            Bagikan link ini kepada customer untuk melihat hewan peliharaan mereka.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex items-center space-x-2 my-4">
                        <Input value={cctvLink} readOnly className="select-all" />
                        <Button size="icon" onClick={copyToClipboard}>
                            {cctvCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Invoice Dialog */}
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
        </div>
    );
};

export default ServiceHotel;
