import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Plus, Search, Edit, Trash2, Home, ChevronLeft, ChevronRight, Calculator, Calendar as CalendarIcon, List as ListIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import ConfirmDialog from '../../components/ConfirmDialog';
import { Badge } from '../../components/ui/badge';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval, isSameDay, addMonths, subMonths, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const Rooms = () => {
    const { user } = useAuth();
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [currentRoom, setCurrentRoom] = useState(null);
    const [roomToDelete, setRoomToDelete] = useState(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        type: 'Standard',
        capacity: 1,
        price: 0,
    });

    const [activeTab, setActiveTab] = useState('list'); // 'list' or 'calendar'
    const [bookings, setBookings] = useState([]);
    const [viewDate, setViewDate] = useState(new Date());

    const storeId = user?.storeId;

    useEffect(() => {
        fetchRooms();
        fetchBookings();
    }, [storeId]);

    const fetchRooms = async () => {
        if (!storeId) return;
        setLoading(true);
        try {
            const q = query(collection(db, 'rooms'), where('storeId', '==', storeId));
            const querySnapshot = await getDocs(q);
            const roomData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort by name
            roomData.sort((a, b) => a.name.localeCompare(b.name));
            setRooms(roomData);
        } catch (error) {
            console.error("Error fetching rooms:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchBookings = async () => {
        if (!storeId) return;
        try {
            const q = query(collection(db, 'bookings'),
                where('storeId', '==', storeId),
                where('serviceType', '==', 'hotel'),
                where('status', 'in', ['confirmed', 'checked_in', 'pending'])
            );
            const snap = await getDocs(q);
            setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (error) {
            console.error("Error fetching bookings:", error);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSelectChange = (value) => {
        setFormData(prev => ({ ...prev, type: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!storeId) return;

        // Parse numbers
        const submitData = {
            ...formData,
            capacity: parseInt(formData.capacity) || 0,
            price: parseFloat(formData.price) || 0,
        };

        try {
            if (currentRoom) {
                // Update
                const roomRef = doc(db, 'rooms', currentRoom.id);
                await updateDoc(roomRef, {
                    ...submitData,
                    updatedAt: new Date(),
                });
                setIsEditOpen(false);
            } else {
                // Create
                await addDoc(collection(db, 'rooms'), {
                    ...submitData,
                    storeId,
                    createdAt: new Date(),
                    status: 'available'
                });
                setIsAddOpen(false);
            }
            fetchRooms();
            resetForm();
        } catch (error) {
            console.error("Error saving room:", error);
        }
    };

    const handleEdit = (room) => {
        setCurrentRoom(room);
        setFormData({
            name: room.name,
            type: room.type,
            capacity: room.capacity,
            price: room.price
        });
        setIsEditOpen(true);
    };

    const handleDelete = (room) => {
        setRoomToDelete(room);
        setIsDeleteOpen(true);
    };

    const confirmDelete = async () => {
        if (!roomToDelete) return;
        try {
            await deleteDoc(doc(db, 'rooms', roomToDelete.id));
            setRooms(prev => prev.filter(r => r.id !== roomToDelete.id));
            setIsDeleteOpen(false);
        } catch (error) {
            console.error("Error deleting room:", error);
        }
    };

    const resetForm = () => {
        setCurrentRoom(null);
        setFormData({
            name: '',
            type: 'Standard',
            capacity: 1,
            price: 0,
        });
    };

    const getOccupancy = (room, date) => {
        return bookings.find(b => {
            if (b.roomId !== room.id) return false;
            // Date Logic
            const start = parseISO(b.startDate);
            const end = b.endDate ? parseISO(b.endDate) : start;
            return isWithinInterval(date, { start, end });
        });
    };

    const CalendarView = () => {
        const startDate = startOfMonth(viewDate);
        const endDate = endOfMonth(viewDate);
        const days = eachDayOfInterval({ start: startDate, end: endDate });

        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between bg-white p-4 rounded-lg border shadow-sm">
                    <div className="flex items-center gap-4">
                        <h2 className="text-lg font-semibold capitalize">
                            {format(viewDate, 'MMMM yyyy', { locale: idLocale })}
                        </h2>
                        <div className="flex gap-1">
                            <Button variant="outline" size="icon" onClick={() => setViewDate(subMonths(viewDate, 1))}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setViewDate(new Date())}>
                                Hari Ini
                            </Button>
                            <Button variant="outline" size="icon" onClick={() => setViewDate(addMonths(viewDate, 1))}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    <div className="flex gap-3 text-sm">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div> Tersedia</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div> Terisi</div>
                    </div>
                </div>

                <div className="bg-white rounded-lg border shadow-sm overflow-x-auto">
                    <div className="min-w-max">
                        {/* Header Row */}
                        <div className="flex border-b">
                            <div className="w-48 p-3 font-semibold text-sm bg-slate-50 sticky left-0 z-10 border-r">Kamar / Tanggal</div>
                            {days.map(day => (
                                <div key={day.toString()} className={`w-10 flex-shrink-0 p-2 text-center text-xs border-r ${isSameDay(day, new Date()) ? 'bg-indigo-50 text-indigo-700 font-bold' : ''}`}>
                                    <div className="font-semibold">{format(day, 'd')}</div>
                                    <div className="text-slate-400 text-[10px]">{format(day, 'EE', { locale: idLocale })}</div>
                                </div>
                            ))}
                        </div>

                        {/* Room Rows */}
                        {rooms.map(room => (
                            <div key={room.id} className="flex border-b hover:bg-slate-50">
                                <div className="w-48 p-3 text-sm font-medium bg-white sticky left-0 z-10 border-r flex flex-col justify-center">
                                    <span>{room.name}</span>
                                    <span className="text-xs text-muted-foreground">{room.type}</span>
                                </div>
                                {days.map(day => {
                                    const booking = getOccupancy(room, day);
                                    return (
                                        <div
                                            key={day.toString()}
                                            className={`w-10 flex-shrink-0 border-r transition-colors ${booking
                                                ? 'bg-red-100 hover:bg-red-200 cursor-pointer border-red-200'
                                                : 'text-center'
                                                }`}
                                            title={booking ? `Booked by: ${booking.ownerId || 'Unknown'}` : 'Available'}
                                        >
                                            {/* Could show partial bar or icon */}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const filteredRooms = rooms.filter(room =>
        room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        room.type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-4 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Kamar Hotel</h1>
                    <p className="text-muted-foreground">Kelola data kamar dan cek ketersediaan.</p>
                </div>
                {activeTab === 'list' && (
                    <Button onClick={() => { resetForm(); setIsAddOpen(true); }}>
                        <Plus className="mr-2 h-4 w-4" />
                        Tambah Kamar
                    </Button>
                )}
            </div>

            <div className="flex items-center gap-2 border-b">
                <button
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'list' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    onClick={() => setActiveTab('list')}
                >
                    <div className="flex items-center gap-2">
                        <ListIcon className="h-4 w-4" />
                        Daftar Kamar
                    </div>
                </button>
                <button
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'calendar' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    onClick={() => setActiveTab('calendar')}
                >
                    <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4" />
                        Kalender Ketersediaan
                    </div>
                </button>
            </div>

            {activeTab === 'list' ? (
                <>
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Cari kamar..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                    </div>
                    <Card>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nama Kamar</TableHead>
                                        <TableHead>Tipe</TableHead>
                                        <TableHead>Kapasitas</TableHead>
                                        <TableHead>Harga / Malam</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8">Memuat data...</TableCell>
                                        </TableRow>
                                    ) : filteredRooms.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                Belum ada data kamar.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredRooms.map((room) => (
                                            <TableRow key={room.id}>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-2 bg-slate-100 rounded-lg">
                                                            <Home className="h-4 w-4 text-slate-500" />
                                                        </div>
                                                        {room.name}
                                                    </div>
                                                </TableCell>
                                                <TableCell><Badge variant="outline">{room.type}</Badge></TableCell>
                                                <TableCell>{room.capacity} Hewan</TableCell>
                                                <TableCell>Rp {room.price.toLocaleString()}</TableCell>
                                                <TableCell>
                                                    <Badge className="bg-green-100 text-green-800 border-green-200">
                                                        Tersedia
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="ghost" size="icon" onClick={() => handleEdit(room)}>
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(room)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </>
            ) : (
                <CalendarView />
            )}

            {/* Add/Edit Dialog */}
            <Dialog open={isAddOpen || isEditOpen} onOpenChange={(open) => {
                if (!open) {
                    setIsAddOpen(false);
                    setIsEditOpen(false);
                    resetForm();
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{currentRoom ? 'Edit Kamar' : 'Tambah Kamar Baru'}</DialogTitle>
                        <DialogDescription>
                            Isi detail informasi kamar di bawah ini.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nama Kamar</Label>
                            <Input id="name" name="name" placeholder="Contoh: Room A1" value={formData.name} onChange={handleInputChange} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="type">Tipe Kamar</Label>
                            <Select value={formData.type} onValueChange={handleSelectChange}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih tipe" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Standard">Standard</SelectItem>
                                    <SelectItem value="VIP">VIP</SelectItem>
                                    <SelectItem value="VVIP">VVIP</SelectItem>
                                    <SelectItem value="Cat Condo">Cat Condo</SelectItem>
                                    <SelectItem value="Dog Kennel">Dog Kennel</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="capacity">Kapasitas</Label>
                                <Input id="capacity" name="capacity" type="number" min="1" value={Number.isNaN(formData.capacity) ? '' : formData.capacity} onChange={handleInputChange} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="price">Harga / Malam</Label>
                                <Input id="price" name="price" type="number" min="0" value={Number.isNaN(formData.price) ? '' : formData.price} onChange={handleInputChange} required />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="submit">{currentRoom ? 'Simpan Perubahan' : 'Buat Kamar'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                isOpen={isDeleteOpen}
                onClose={() => setIsDeleteOpen(false)}
                onConfirm={confirmDelete}
                title="Hapus Kamar"
                description={`Apakah Anda yakin ingin menghapus kamar "${roomToDelete?.name}"?`}
                confirmText="Hapus"
                variant="destructive"
            />
        </div>
    );
};

export default Rooms;
