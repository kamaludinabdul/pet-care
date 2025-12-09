import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, getDocs, deleteDoc, doc, orderBy, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Calendar as CalendarIcon, Filter, Layers, LayoutGrid, List as ListIcon, Search, Plus, X, Stethoscope, Scissors, Home, ShoppingCart, Edit, Trash2, Clock, MoreHorizontal } from 'lucide-react';
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
import HotelCalendar from './HotelCalendar';



const Bookings = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { customers } = useData();
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [bookingToDelete, setBookingToDelete] = useState(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [viewMode, setViewMode] = useState('board'); // 'list' or 'board'
    const [filterServiceType, setFilterServiceType] = useState('grooming'); // Default to grooming as requested
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]); // Default Today
    const [pets, setPets] = useState([]);
    const storeId = user?.storeId;

    useEffect(() => {
        const fetchData = async () => {
            if (!storeId) return;
            setLoading(true);
            try {
                // Fetch all bookings for the store, sort by date desc
                // Optimization: We could filter by date here if data grows large.
                // For now, client-side filter is fine for MVP.
                const bookingsQ = query(collection(db, 'bookings'), where('storeId', '==', storeId), orderBy('startDate', 'desc'));
                const bookingsSnap = await getDocs(bookingsQ);
                const bookingsData = bookingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setBookings(bookingsData);

                const petsQ = query(collection(db, 'pets'), where('storeId', '==', storeId));
                const petsSnap = await getDocs(petsQ);
                const petsData = petsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setPets(petsData);

            } catch (error) {
                console.error("Error fetching bookings:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
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

        const matchesDate = selectedDate
            ? booking.startDate === selectedDate
            : true;

        return matchesSearch && matchesType && matchesDate;
    });

    const getStatusColor = (status) => {
        switch (status) {
            case 'confirmed': return 'bg-green-100 text-green-800 border-green-200';
            case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'checked_in': return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'checked_out':
            case 'completed': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'confirmed': return 'Terkonfirmasi';
            case 'pending': return 'Menunggu';
            case 'checked_in': return 'Check-In';
            case 'checked_out': return 'Selesai / Out';
            case 'completed': return 'Selesai';
            case 'cancelled': return 'Batal';
            default: return status;
        }
    };

    const handleDragStart = (e, bookingId) => {
        e.dataTransfer.setData("bookingId", bookingId);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e) => {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = async (e, newStatus) => {
        e.preventDefault();
        const bookingId = e.dataTransfer.getData("bookingId");

        if (bookingId) {
            // Find the booking to ensure we aren't dropping on same status (optimistic check)
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
                                            <DropdownMenuItem onClick={() => handleStatusChange(booking.id, 'pending')}>Menunggu</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleStatusChange(booking.id, 'confirmed')}>Konfirmasi</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleStatusChange(booking.id, 'checked_in')}>Check-In</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleStatusChange(booking.id, 'checked_out')}>Selesai</DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => navigate(`/pet-care/bookings/edit/${booking.id}`)}>Edit Reservasi</DropdownMenuItem>
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
                                        {booking.serviceType === 'hotel' ? 'Hotel' : 'Grooming'}
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                ))}
            </div>
        </div>
    );

    const columns = [
        { id: 'pending', label: 'Menunggu' },
        { id: 'confirmed', label: 'Terkonfirmasi' },
        { id: 'checked_in', label: 'Check-In' },
        { id: 'checked_out', label: 'Selesai' },
    ];

    // Helper to group cancelled into its own or ignore? Let's show cancelled at end or separate?
    // Let's add Cancelled column for completeness or filter them out?
    // Commonly Kanban hides Cancelled/Done, but for now let's show all but maybe filter logic.

    return (
        <div className="p-4 space-y-6 h-[calc(100vh-4rem)] flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Reservasi & Booking</h1>
                    <p className="text-muted-foreground">Kelola jadwal grooming dan penitipan hewan.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={() => navigate('/pet-care/bookings/add')}>
                        <Plus className="mr-2 h-4 w-4" />
                        Buat Reservasi
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-4 shrink-0">
                {/* Service Filter Tabs */}
                <div className="flex bg-slate-100 p-1 rounded-lg border">
                    <button
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${filterServiceType === 'all' ? 'bg-white text-foreground shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                        onClick={() => setFilterServiceType('all')}
                    >
                        Semua
                    </button>
                    <button
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${filterServiceType === 'grooming' ? 'bg-white text-foreground shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                        onClick={() => setFilterServiceType('grooming')}
                    >
                        Grooming
                    </button>
                    <button
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${filterServiceType === 'hotel' ? 'bg-white text-foreground shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                        onClick={() => setFilterServiceType('hotel')}
                    >
                        Pet Hotel
                    </button>
                </div>

                <div className="h-6 w-px bg-slate-200" />

                <div className="flex bg-slate-100 p-1 rounded-lg border">
                    <Button
                        variant={viewMode === 'board' ? 'white' : 'ghost'}
                        size="sm"
                        className={`h-7 px-3 ${viewMode === 'board' ? 'bg-white shadow-sm' : ''}`}
                        onClick={() => setViewMode('board')}
                    >
                        <LayoutGrid className="h-4 w-4 mr-2" />
                        Board
                    </Button>
                    <Button
                        variant={viewMode === 'list' ? 'white' : 'ghost'}
                        size="sm"
                        className={`h-7 px-3 ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}
                        onClick={() => setViewMode('list')}
                    >
                        <ListIcon className="h-4 w-4 mr-2" />
                        List
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
                <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-auto"
                />
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari hewan atau pemilik..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                    />
                </div>
            </div>



            {viewMode === 'board' ? (
                filterServiceType === 'hotel' ? (
                    <div className="flex-1 h-full overflow-hidden">
                        <HotelCalendar bookings={filteredBookings} getPetName={getPetName} />
                    </div>
                ) : (
                    <div className="flex-1 overflow-x-auto pb-4">
                        <div className="flex gap-4 h-full min-w-max">
                            {columns.map(col => (
                                <KanbanColumn
                                    key={col.id}
                                    status={col.id}
                                    label={col.label}
                                    items={filteredBookings.filter(b => b.status === col.id)}
                                />
                            ))}
                        </div>
                    </div>
                )
            ) : (
                <Card>
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
                                                <Badge variant="outline">{booking.serviceType === 'hotel' ? 'Hotel' : 'Grooming'}</Badge>
                                            </TableCell>
                                            <TableCell>{getOwnerName(booking.ownerId)}</TableCell>
                                            <TableCell>
                                                <Badge className={getStatusColor(booking.status)}>
                                                    {getStatusLabel(booking.status)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => navigate(`/pet-care/bookings/edit/${booking.id}`)}
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                        onClick={() => handleDelete(booking)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                    {booking.status === 'checked_in' && (
                                                        <Button
                                                            variant="default"
                                                            size="sm"
                                                            className="w-full bg-green-600 hover:bg-green-700 h-7 text-xs mt-2"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigate(`/pos?bookingId=${booking.id}`);
                                                            }}
                                                        >
                                                            <ShoppingCart className="h-3 w-3 mr-1" />
                                                            Checkout / Bayar
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            <ConfirmDialog
                isOpen={isDeleteOpen}
                onClose={() => setIsDeleteOpen(false)}
                onConfirm={confirmDelete}
                title="Hapus Reservasi"
                description="Apakah Anda yakin ingin menghapus reservasi ini?"
                confirmText="Hapus"
                variant="destructive"
            />
        </div>
    );
};

export default Bookings;
