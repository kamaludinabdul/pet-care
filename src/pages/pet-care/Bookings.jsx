import React, { useState, useEffect } from 'react';
import { getAccessToken } from '../../services/ezvizService';
import { db } from '../../firebase';
import { collection, query, where, getDocs, deleteDoc, doc, orderBy, updateDoc, onSnapshot, getDoc, addDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { usePOS } from '../../context/POSContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Label } from '../../components/ui/label';
import { Calendar as CalendarIcon, Filter, Search, Plus, MoreHorizontal, Clock, User, ShoppingCart, Printer, MessageSquare, Video, Link as LinkIcon, Copy, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../../components/ConfirmDialog';
import { Badge } from '../../components/ui/badge';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import BookingInvoice from '../../components/BookingInvoice';
import PetPaymentModal from '../../components/PetPaymentModal';

// --- Main Component ---

const Bookings = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { storeId } = user;

    // CCTV Link State
    const [cctvLink, setCctvLink] = useState(null);
    const [isCctvDialogOpen, setIsCctvDialogOpen] = useState(false);
    const [cctvCopied, setCctvCopied] = useState(false);

    const { customers } = usePOS();
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [bookingToDelete, setBookingToDelete] = useState(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    // Filters
    const [filterServiceType, setFilterServiceType] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');

    const [pets, setPets] = useState([]);
    const [staffList, setStaffList] = useState([]);
    const [invoiceData, setInvoiceData] = useState(null);

    // Payment Modal State
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    const [paymentBooking, setPaymentBooking] = useState(null);

    // Assign Groomer State
    const [isAssignOpen, setIsAssignOpen] = useState(false);
    const [selectedBookingForAssign, setSelectedBookingForAssign] = useState(null);
    const [selectedGroomerId, setSelectedGroomerId] = useState('');

    const [dataStoreId, setDataStoreId] = useState(storeId);

    if (storeId !== dataStoreId) {
        setDataStoreId(storeId);
        setLoading(true);
        setBookings([]);
    }

    const handlePrintInvoice = async (booking) => {
        try {
            let transaction = null;
            if (booking.status === 'completed' || booking.status === 'checked_out') {
                const q = query(
                    collection(db, 'transactions'),
                    where('bookingId', '==', booking.id),
                    where('storeId', '==', storeId)
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
        }
    };

    const handleCheckout = (booking) => {
        setPaymentBooking(booking);
        setIsPaymentOpen(true);
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

            setBookings(prev => prev.map(b => b.id === selectedBookingForAssign.id ? { ...b, groomerId: selectedGroomerId, groomerName } : b));
            setIsAssignOpen(false);
            setSelectedBookingForAssign(null);
        } catch (error) {
            console.error("Error assigning groomer:", error);
        }
    };

    const handlePaymentSuccess = () => {
        window.location.reload();
    };

    useEffect(() => {
        if (!storeId) return;
        const bookingsQ = query(collection(db, 'bookings'), where('storeId', '==', storeId), orderBy('startDate', 'desc'));

        const unsubscribeBookings = onSnapshot(bookingsQ, (snapshot) => {
            const bookingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setBookings(bookingsData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching bookings:", error);
            setLoading(false);
        });

        const fetchStaticData = async () => {
            try {
                const petsQ = query(collection(db, 'pets'), where('storeId', '==', storeId));
                const petsSnap = await getDocs(petsQ);
                setPets(petsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

                const staffQ = query(collection(db, 'users'), where('storeId', '==', storeId));
                const staffSnap = await getDocs(staffQ);
                setStaffList(staffSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            } catch (err) {
                console.error("Error fetching static data:", err);
            }
        };

        fetchStaticData();
        return () => unsubscribeBookings();
    }, [storeId]);

    const getPetName = (petId) => {
        const pet = pets.find(p => p.id === petId);
        return pet ? pet.name : 'Unknown Pet';
    };

    const getOwnerName = (ownerId) => {
        const customer = customers.find(c => c.id === ownerId);
        return customer ? customer.name : 'Unknown Owner';
    };

    const handleDelete = (booking) => {
        setBookingToDelete(booking);
        setIsDeleteOpen(true);
    };

    const confirmDelete = async () => {
        if (!bookingToDelete) return;
        try {
            await deleteDoc(doc(db, 'bookings', bookingToDelete.id));
            setBookings(prev => prev.filter(b => b.id !== bookingToDelete.id));
            setIsDeleteOpen(false);
        } catch (error) {
            console.error("Error deleting booking:", error);
        }
    };

    const handleStatusChange = async (bookingId, newStatus) => {
        try {
            await updateDoc(doc(db, 'bookings', bookingId), { status: newStatus });

            // Sync Hotel Room Status
            const booking = bookings.find(b => b.id === bookingId);
            if (booking && booking.serviceType === 'hotel' && booking.roomId) {
                const roomRef = doc(db, 'rooms', booking.roomId);
                if (newStatus === 'checked_out') {
                    await updateDoc(roomRef, { status: 'available', currentOccupantId: null });
                } else if (newStatus === 'checked_in' || newStatus === 'confirmed') {
                    await updateDoc(roomRef, { status: 'occupied', currentOccupantId: bookingId });
                } else if (newStatus === 'cancelled') {
                    await updateDoc(roomRef, { status: 'available', currentOccupantId: null });
                }
            }
        } catch (error) {
            console.error("Error updating status:", error);
        }
    };

    const handleGenerateCCTV = async (booking) => {
        if (!booking.roomId) {
            alert("Booking ini tidak memiliki data kamar.");
            return;
        }


        try {
            // Check if room has camera
            const roomRef = doc(db, 'rooms', booking.roomId);
            const roomSnap = await getDoc(roomRef);

            if (!roomSnap.exists()) {
                alert("Data kamar tidak ditemukan.");
                return;
            }

            const roomData = roomSnap.data();
            if (!roomData.cameraSerial) {
                alert(`Kamar "${roomData.name}" belum terhubung dengan CCTV. Silakan setting di menu Ketersediaan Kamar.`);
                return;
            }

            // Fetch EZVIZ Access Token
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
                        } else {
                            console.warn("EZVIZ Token Error:", tokenResponse);
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to fetch EZVIZ token:", err);
                // Continue anyway, but stream might not work for private devices
            }

            // Check existing token
            const tokensQ = query(
                collection(db, 'cctv_tokens'),
                where('bookingId', '==', booking.id)
            );
            const tokensSnap = await getDocs(tokensQ);

            let token = '';

            if (!tokensSnap.empty) {
                // Use existing token
                const data = tokensSnap.docs[0].data();
                token = data.token;

                // Update expiry if needed (extend to current checkout date)
                await updateDoc(doc(db, 'cctv_tokens', tokensSnap.docs[0].id), {
                    validUntil: booking.endDate,
                    ezvizToken: ezvizToken || data.ezvizToken // Update token if new one fetched
                });
            } else {
                // Generate new token
                token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

                await addDoc(collection(db, 'cctv_tokens'), {
                    token,
                    bookingId: booking.id,
                    roomId: booking.roomId,
                    storeId: booking.storeId,
                    ezvizToken,
                    createdAt: new Date().toISOString(),
                    validUntil: booking.endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // Default 7 days if no end date
                });
            }

            // Generate full URL
            const url = `${window.location.origin}/cctv/${token}`;
            setCctvLink(url);
            setIsCctvDialogOpen(true);
            setCctvCopied(false);

        } catch (error) {
            console.error("Error generating CCTV link:", error);
            alert("Gagal membuat link CCTV.");
        }
    };

    const copyToClipboard = () => {
        if (cctvLink) {
            navigator.clipboard.writeText(cctvLink);
            setCctvCopied(true);
            setTimeout(() => setCctvCopied(false), 2000);
        }
    };


    const filteredBookings = bookings.filter(booking => {
        const petName = getPetName(booking.petId).toLowerCase();
        const ownerName = getOwnerName(booking.ownerId).toLowerCase();
        const search = searchTerm.toLowerCase();
        const matchesSearch = petName.includes(search) || ownerName.includes(search);

        const matchesType = filterServiceType === 'all'
            ? true
            : booking.serviceType === filterServiceType;

        const matchesStatus = filterStatus === 'all'
            ? true
            : booking.status === filterStatus;

        return matchesSearch && matchesType && matchesStatus;
    });

    const getStatusLabel = (status) => {
        switch (status) {
            case 'pending': return 'Terdaftar';
            case 'processing': return 'Sedang Proses';
            case 'confirmed': return 'Terdaftar';
            case 'checked_in': return 'Check-In';
            case 'checked_out': return 'Check-Out';
            case 'completed': return 'Selesai';
            case 'cancelled': return 'Batal';
            default: return status;
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'processing': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'confirmed': return 'bg-green-100 text-green-800 border-green-200';
            case 'checked_in': return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'checked_out':
            case 'completed': return 'bg-gray-100 text-gray-800 border-gray-200';
            case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Bookings Admin</h1>
                    <p className="text-muted-foreground">Kelola semua reservasi dan booking secara terpusat.</p>
                </div>
                <Button onClick={() => navigate('/pet-care/bookings/new')} className="bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="mr-2 h-4 w-4" />
                    Booking Baru
                </Button>
            </div>

            <Card>
                <CardHeader className="pb-3 border-b">
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                        <div className="flex items-center gap-2 w-full md:w-auto text-muted-foreground">
                            <ListIcon className="w-5 h-5 text-indigo-600" />
                            <h3 className="font-semibold text-slate-800">Daftar Reservasi</h3>
                        </div>
                        <div className="flex flex-wrap gap-2 w-full md:w-auto">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Cari Pet / Owner..."
                                    className="pl-9 w-full md:w-[250px]"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Select value={filterServiceType} onValueChange={setFilterServiceType}>
                                <SelectTrigger className="w-[140px]">
                                    <SelectValue placeholder="Semua Layanan" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Layanan</SelectItem>
                                    <SelectItem value="grooming">Grooming</SelectItem>
                                    <SelectItem value="hotel">Pet Hotel</SelectItem>
                                    <SelectItem value="clinic">Klinik</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={filterStatus} onValueChange={setFilterStatus}>
                                <SelectTrigger className="w-[140px]">
                                    <SelectValue placeholder="Semua Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Status</SelectItem>
                                    <SelectItem value="pending">Terdaftar</SelectItem>
                                    <SelectItem value="checked_in">Check-In</SelectItem>
                                    <SelectItem value="completed">Selesai</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tanggal</TableHead>
                                <TableHead>Hewan</TableHead>
                                <TableHead>Layanan</TableHead>
                                <TableHead>Pemilik</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8">Memuat...</TableCell>
                                </TableRow>
                            ) : filteredBookings.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        Data tidak ditemukan.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredBookings.map((booking) => (
                                    <TableRow key={booking.id}>
                                        <TableCell>
                                            <div className="flex flex-col text-sm">
                                                <div className="flex items-center gap-2 font-medium">
                                                    <CalendarIcon className="h-3 w-3" />
                                                    {format(new Date(booking.startDate), 'dd MMM yyyy', { locale: idLocale })}
                                                </div>
                                                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                                                    <Clock className="h-3 w-3" />
                                                    {booking.startTime || '-'}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium">{getPetName(booking.petId)}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{booking.serviceType === 'hotel' ? 'Hotel' : booking.serviceType === 'clinic' ? 'Klinik' : 'Grooming'}</Badge>
                                        </TableCell>
                                        <TableCell>{getOwnerName(booking.ownerId)}</TableCell>
                                        <TableCell>
                                            <Badge className={getStatusColor(booking.status)}>
                                                {getStatusLabel(booking.status)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => navigate(`/pet-care/bookings/edit/${booking.id}`)}>Detail / Edit</DropdownMenuItem>

                                                    {(booking.serviceType === 'grooming' || booking.serviceType === 'clinic') && (
                                                        <>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => handleAssignGroomer(booking)}>
                                                                <User className="mr-2 h-4 w-4" />
                                                                {booking.groomerName ? `Ganti: ${booking.groomerName}` : 'Pilih Dokter/Groomer'}
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}

                                                    {booking.serviceType === 'hotel' && booking.roomId && (
                                                        <DropdownMenuItem onClick={() => handleGenerateCCTV(booking)}>
                                                            <Video className="mr-2 h-4 w-4" />
                                                            Link CCTV
                                                        </DropdownMenuItem>
                                                    )}

                                                    <DropdownMenuSeparator />
                                                    {booking.paymentStatus !== 'paid' && (
                                                        <DropdownMenuItem onClick={() => handleCheckout(booking)} className="text-indigo-600">
                                                            <ShoppingCart className="mr-2 h-4 w-4" />
                                                            Bayar
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuItem onClick={() => handlePrintInvoice(booking)}>
                                                        <Printer className="mr-2 h-4 w-4" />
                                                        Invoice
                                                    </DropdownMenuItem>

                                                    {booking.status !== 'cancelled' && (
                                                        <DropdownMenuItem className="text-red-500" onClick={() => handleStatusChange(booking.id, 'cancelled')}>
                                                            Batalkan Reservasi
                                                        </DropdownMenuItem>
                                                    )}

                                                    <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(booking)}>Hapus</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Modals */}
            <ConfirmDialog
                isOpen={isDeleteOpen}
                onClose={() => setIsDeleteOpen(false)}
                onConfirm={confirmDelete}
                title="Hapus Reservasi"
                message="Apakah Anda yakin ingin menghapus reservasi ini? Data yang dihapus tidak dapat dikembalikan."
            />

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

            <PetPaymentModal
                isOpen={isPaymentOpen}
                onClose={() => setIsPaymentOpen(false)}
                booking={paymentBooking}
                onSuccess={handlePaymentSuccess}
            />

            <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Pilih Petugas / Dokter</DialogTitle>
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

            <Dialog open={isCctvDialogOpen} onOpenChange={setIsCctvDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Link CCTV Publik</DialogTitle>
                    </DialogHeader>
                    <div className="flex items-center space-x-2 my-4">
                        <Input value={cctvLink || ''} readOnly className="select-all" />
                        <Button size="icon" onClick={copyToClipboard}>
                            {cctvCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
};

export default Bookings;
