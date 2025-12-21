import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, getDocs, deleteDoc, doc, orderBy, updateDoc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Label } from '../../components/ui/label';
import { Calendar as CalendarIcon, Filter, LayoutGrid, List as ListIcon, Search, Plus, MoreHorizontal, Clock, User, ShoppingCart, Printer } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import CalendarView from './CalendarView';
import BookingInvoice from '../../components/BookingInvoice';
import PetPaymentModal from '../../components/PetPaymentModal';
import { DateRangePicker } from '../../components/DateRangePicker';

const Bookings = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { customers } = useData();
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [bookingToDelete, setBookingToDelete] = useState(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [viewMode, setViewMode] = useState('list'); // 'list', 'board', 'calendar'
    const [filterServiceType, setFilterServiceType] = useState('all'); // Default to all

    const [filterStatus, setFilterStatus] = useState('all'); // Status Filter
    const [dateRange, setDateRange] = useState({ from: undefined, to: undefined }); // Smart Date Picker State
    const [pets, setPets] = useState([]);
    const [staffList, setStaffList] = useState([]); // Staff
    const [invoiceData, setInvoiceData] = useState(null); // { booking, transaction, customer }

    // Payment Modal State
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    const [paymentBooking, setPaymentBooking] = useState(null);

    // Assign Groomer State
    const [isAssignOpen, setIsAssignOpen] = useState(false);
    const [selectedBookingForAssign, setSelectedBookingForAssign] = useState(null);
    const [selectedGroomerId, setSelectedGroomerId] = useState('');

    const storeId = user?.storeId;
    const [dataStoreId, setDataStoreId] = useState(storeId);

    // Reset state when storeId changes (Render-time update pattern)
    if (storeId !== dataStoreId) {
        setDataStoreId(storeId);
        setLoading(true);
        setBookings([]);
    }

    const handlePrintInvoice = async (booking) => {
        try {
            // Find linked transaction if any
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

            // Get store data for header (from user context or data context)
            const store = { name: 'Pet Care Store', address: '', phone: '' }; // Should fetch real store data

            setInvoiceData({
                booking,
                transaction,
                customer,
                store: store
            });

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
        // Loading state is handled by the render-time check above

        // Real-time listener for Bookings
        const bookingsQ = query(collection(db, 'bookings'), where('storeId', '==', storeId), orderBy('startDate', 'desc'));

        const unsubscribeBookings = onSnapshot(bookingsQ, (snapshot) => {
            const bookingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setBookings(bookingsData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching bookings:", error);
            setLoading(false);
        });

        // Fetch static data (Pets & Staff) - usually changes less often, can keep as getDocs or make real-time if needed.
        // For performance, keeping these as single fetch unless user requests otherwise.
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
            setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));

            // Sync Room Status
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

    const filteredBookings = bookings.filter(booking => {
        const petName = getPetName(booking.petId).toLowerCase();
        const ownerName = getOwnerName(booking.ownerId).toLowerCase();
        const search = searchTerm.toLowerCase();
        const matchesSearch = petName.includes(search) || ownerName.includes(search);

        const matchesType = filterServiceType === 'all'
            ? true
            : booking.serviceType === filterServiceType;

        const matchesDate = viewMode === 'calendar' ? true : (
            (!dateRange?.from || !dateRange?.to) ? true :
                (new Date(booking.startDate) >= new Date(dateRange.from) && new Date(booking.startDate) <= new Date(dateRange.to))
        );

        const matchesStatus = filterStatus === 'all'
            ? true
            : booking.status === filterStatus;

        return matchesSearch && matchesType && matchesDate && matchesStatus;
    });

    const getStatusLabel = (status) => {
        switch (status) {
            case 'pending': return 'Terdaftar / Menunggu';
            case 'processing': return 'Sedang Proses';
            case 'confirmed': return 'Terdaftar'; // Hotel
            case 'checked_in': return 'Check-In'; // Hotel
            case 'checked_out': return 'Check-Out / Selesai'; // Hotel
            case 'completed': return 'Selesai'; // Grooming
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

    const groomingColumns = [
        { id: 'pending', label: 'Terdaftar' },
        { id: 'processing', label: 'Proses' },
        { id: 'completed', label: 'Selesai' },
    ];

    const hotelColumns = [
        { id: 'confirmed', label: 'Terdaftar' },
        { id: 'checked_in', label: 'Check-In' },
        { id: 'checked_out', label: 'Check-Out' },
    ];

    const allColumns = [
        ...groomingColumns,
        ...hotelColumns.filter(c => !groomingColumns.some(gc => gc.id === c.id))
    ];

    const visibleColumns = filterServiceType === 'grooming' || filterServiceType === 'clinic' ? groomingColumns :
        filterServiceType === 'hotel' ? hotelColumns :
            allColumns;

    const handleDragStart = (e, bookingId) => {
        e.dataTransfer.setData("bookingId", bookingId);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = async (e, newStatus) => {
        e.preventDefault();
        const bookingId = e.dataTransfer.getData("bookingId");

        if (bookingId) {
            const booking = bookings.find(b => b.id === bookingId);
            if (booking && booking.status !== newStatus) {
                await handleStatusChange(bookingId, newStatus);
            }
        }
    };

    const KanbanColumn = ({ status, label, items }) => (
        <div
            className="flex flex-col gap-4 min-w-[300px] w-full bg-slate-50/50 p-4 rounded-xl border border-slate-100 transition-colors hover:bg-slate-100/50"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, status)}
        >
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm text-slate-700 uppercase tracking-wider">{label}</h3>
                <Badge variant="secondary" className="bg-white">{items.length}</Badge>
            </div>
            <div className="flex flex-col gap-3 h-full">
                {items.length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-lg">
                        Tidak ada data
                    </div>
                )}
                {items.map(booking => (
                    <div
                        key={booking.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, booking.id)}
                        className="cursor-grab active:cursor-grabbing"
                    >
                        <Card className="shadow-sm hover:shadow-md transition-all border-slate-200 hover:border-indigo-300">
                            <CardContent className="p-3">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div className="font-semibold">{getPetName(booking.petId)}</div>
                                        <div className="text-xs text-muted-foreground">{getOwnerName(booking.ownerId)}</div>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-6 w-6">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Ubah Status</DropdownMenuLabel>

                                            {(booking.serviceType === 'grooming' || booking.serviceType === 'clinic') && (
                                                <>
                                                    <DropdownMenuItem onClick={() => handleAssignGroomer(booking)}>
                                                        <User className="mr-2 h-4 w-4" />
                                                        {booking.groomerName ? `Ganti: ${booking.groomerName}` : 'Pilih Dokter/Groomer'}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => handleStatusChange(booking.id, 'pending')}>Terdaftar</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleStatusChange(booking.id, 'processing')}>Proses</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleStatusChange(booking.id, 'completed')}>Selesai</DropdownMenuItem>
                                                </>
                                            )}

                                            {booking.serviceType === 'hotel' && (
                                                <>
                                                    <DropdownMenuItem onClick={() => handleStatusChange(booking.id, 'confirmed')}>Terdaftar</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleStatusChange(booking.id, 'checked_in')}>Check-In</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleStatusChange(booking.id, 'checked_out')}>Check-Out</DropdownMenuItem>
                                                </>
                                            )}

                                            <DropdownMenuSeparator />
                                            {booking.paymentStatus !== 'paid' && (
                                                <DropdownMenuItem onClick={() => handleCheckout(booking)} className="text-indigo-600 font-medium">
                                                    <ShoppingCart className="mr-2 h-4 w-4" />
                                                    Bayar Tagihan
                                                </DropdownMenuItem>
                                            )}
                                            <DropdownMenuItem onClick={() => navigate(`/pet-care/bookings/edit/${booking.id}`)}>Edit Reservasi</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handlePrintInvoice(booking)}>
                                                <Printer className="mr-2 h-4 w-4" />
                                                Cetak Invoice
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(booking)}>Hapus</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                <div className="space-y-1 mb-3">
                                    <div className="flex items-center gap-2 text-xs text-slate-600">
                                        <CalendarIcon className="h-3 w-3" />
                                        {format(new Date(booking.startDate), 'dd MMM', { locale: idLocale })}
                                        {booking.serviceType === 'hotel' && booking.endDate && ` - ${format(new Date(booking.endDate), 'dd MMM', { locale: idLocale })}`}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-600">
                                        <Clock className="h-3 w-3" />
                                        {booking.startTime}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <Badge variant="outline" className="text-xs font-normal">
                                        {booking.serviceType === 'hotel' ? 'Hotel' : booking.serviceType === 'clinic' ? 'Klinik' : 'Grooming'}
                                    </Badge>
                                    {booking.groomerName && (
                                        <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full flex items-center">
                                            <User className="h-3 w-3 mr-1" />
                                            {booking.groomerName}
                                        </span>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                ))}
            </div>
        </div >
    );

    const renderContent = () => {
        if (viewMode === 'calendar') {
            return (
                <div className="flex-1 h-full overflow-hidden">
                    <CalendarView bookings={filteredBookings} onSelectBooking={(b) => navigate(`/pet-care/bookings/edit/${b.id}`)} />
                </div>
            );
        }

        if (viewMode === 'board') {
            return (
                <div className="flex-1 overflow-x-auto pb-4">
                    <div className="flex gap-4 h-full min-w-max">
                        {visibleColumns.map(col => (
                            <KanbanColumn
                                key={col.id}
                                status={col.id}
                                label={col.label}
                                items={filteredBookings.filter(b => b.status === col.id)}
                            />
                        ))}
                    </div>
                </div>
            );
        }

        // Default List View
        return (
            <Card className="flex-1 overflow-hidden flex flex-col">
                <CardContent className="p-0 flex-1 overflow-auto">
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
                                        Belum ada reservasi.
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
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => handleStatusChange(booking.id, 'pending')}>Terdaftar</DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleStatusChange(booking.id, 'processing')}>Proses</DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleStatusChange(booking.id, 'completed')}>Selesai</DropdownMenuItem>
                                                        </>
                                                    )}

                                                    {booking.serviceType === 'hotel' && (
                                                        <>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => handleStatusChange(booking.id, 'confirmed')}>Terdaftar</DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleStatusChange(booking.id, 'checked_in')}>Check-In</DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleStatusChange(booking.id, 'checked_out')}>Check-Out</DropdownMenuItem>
                                                        </>
                                                    )}

                                                    <DropdownMenuSeparator />
                                                    {booking.paymentStatus !== 'paid' && (
                                                        <DropdownMenuItem onClick={() => handleCheckout(booking)} className="text-indigo-600 font-medium">
                                                            <ShoppingCart className="mr-2 h-4 w-4" />
                                                            Bayar Tagihan
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuItem onClick={() => handlePrintInvoice(booking)}>
                                                        <Printer className="mr-2 h-4 w-4" />
                                                        Cetak Invoice
                                                    </DropdownMenuItem>
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
        );
    };
    return (
        <div className="p-6 w-full space-y-6 h-[calc(100vh-4rem)] flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Daftar Reservasi</h1>
                    <p className="text-muted-foreground">Jadwal kedatangan dan booking pelanggan.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={() => navigate('/pet-care/bookings/add')}>
                        <Plus className="mr-2 h-4 w-4" />
                        Buat Reservasi
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="all" value={filterServiceType} onValueChange={setFilterServiceType} className="flex-1 flex flex-col overflow-hidden">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4 shrink-0">
                    <TabsList>
                        <TabsTrigger value="all">Semua</TabsTrigger>
                        <TabsTrigger value="hotel">Pet Hotel</TabsTrigger>
                        <TabsTrigger value="grooming">Grooming</TabsTrigger>
                        <TabsTrigger value="clinic">Klinik</TabsTrigger>
                    </TabsList>

                    <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto items-center">
                        {/* Date Filter */}
                        {viewMode !== 'calendar' && (
                            <DateRangePicker
                                date={dateRange}
                                setDate={setDateRange}
                            />
                        )}

                        {/* Status Filter */}
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger className="w-[180px] bg-white">
                                <Filter className="w-4 h-4 mr-2" />
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Status</SelectItem>
                                <SelectItem value="pending">Terdaftar</SelectItem>
                                <SelectItem value="processing">Sedang Proses</SelectItem>
                                <SelectItem value="checked_in">Check-In</SelectItem>
                                <SelectItem value="checked_out">Check-Out</SelectItem>
                                <SelectItem value="completed">Selesai</SelectItem>
                                <SelectItem value="cancelled">Dibatalkan</SelectItem>
                            </SelectContent>
                        </Select>

                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Cari nama hewan..."
                                className="pl-8 bg-white"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        {/* View Mode Toggle */}
                        <div className="flex bg-slate-100 p-1 rounded-lg border">
                            <Button
                                variant={viewMode === 'board' ? 'white' : 'ghost'}
                                size="sm"
                                className={`h-8 px-3 ${viewMode === 'board' ? 'bg-white shadow-sm' : ''}`}
                                onClick={() => setViewMode('board')}
                            >
                                <LayoutGrid className="h-4 w-4 mr-2" />
                                Board
                            </Button>
                            <Button
                                variant={viewMode === 'list' ? 'white' : 'ghost'}
                                size="sm"
                                className={`h-8 px-3 ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}
                                onClick={() => setViewMode('list')}
                            >
                                <ListIcon className="h-4 w-4 mr-2" />
                                List
                            </Button>
                            <Button
                                variant={viewMode === 'calendar' ? 'white' : 'ghost'}
                                size="sm"
                                className={`h-8 px-3 ${viewMode === 'calendar' ? 'bg-white shadow-sm' : ''}`}
                                onClick={() => setViewMode('calendar')}
                            >
                                <CalendarIcon className="h-4 w-4 mr-2" />
                                Kalender
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden">
                    <TabsContent value="all" className="h-full mt-0">
                        {renderContent()}
                    </TabsContent>
                    <TabsContent value="hotel" className="h-full mt-0">
                        {renderContent()}
                    </TabsContent>
                    <TabsContent value="grooming" className="h-full mt-0">
                        {renderContent()}
                    </TabsContent>
                    <TabsContent value="clinic" className="h-full mt-0">
                        {renderContent()}
                    </TabsContent>
                </div>
            </Tabs>


            <ConfirmDialog
                isOpen={isDeleteOpen}
                onClose={() => setIsDeleteOpen(false)}
                onConfirm={confirmDelete}
                title="Hapus Reservasi"
                description="Apakah Anda yakin ingin menghapus reservasi ini?"
                confirmText="Hapus"
                variant="destructive"
            />

            {
                invoiceData && (
                    <BookingInvoice
                        booking={invoiceData.booking}
                        transaction={invoiceData.transaction}
                        customer={invoiceData.customer}
                        store={invoiceData.store}
                        onClose={() => setInvoiceData(null)}
                    />
                )
            }

            <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Pilih Groomer / Staff</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Pilih Staff</Label>
                            <Select value={selectedGroomerId} onValueChange={setSelectedGroomerId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih Staff..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {staffList.map(s => (
                                        <SelectItem key={s.id} value={s.id}>{s.name || s.email} ({s.role})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAssignOpen(false)}>Batal</Button>
                        <Button onClick={saveGroomerAssignment} disabled={!selectedGroomerId}>Simpan</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <PetPaymentModal
                isOpen={isPaymentOpen}
                onClose={() => setIsPaymentOpen(false)}
                booking={paymentBooking}
                onSuccess={handlePaymentSuccess}
            />
        </div >
    );
};

export default Bookings;
