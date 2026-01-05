import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Plus, Search, Edit, Trash2, Home, ChevronLeft, ChevronRight, Calculator, Calendar as CalendarIcon, List as ListIcon, Camera } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import ConfirmDialog from '../../components/ConfirmDialog';
import { Badge } from '../../components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
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
    const [filterStatus, setFilterStatus] = useState('all');

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        type: 'Standard',
        capacity: 1,
        price: 0,
        cameraSerial: '',
        cameraChannel: 1
    });

    const [devices, setDevices] = useState([]);

    const [activeTab, setActiveTab] = useState('grid'); // Default to grid for management
    const [bookings, setBookings] = useState([]);
    const [viewDate, setViewDate] = useState(new Date());

    const storeId = user?.storeId;

    useEffect(() => {
        fetchRooms();
        fetchBookings();
        fetchDevices();
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const fetchDevices = async () => {
        if (!storeId) return;
        try {
            const q = query(collection(db, 'cctv_devices'), where('storeId', '==', storeId));
            const querySnapshot = await getDocs(q);
            setDevices(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
            console.error("Error fetching CCTV devices:", error);
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
            name: formData.name,
            type: formData.type,
            capacity: parseInt(formData.capacity),
            price: parseInt(formData.price),
            storeId,
            cameraSerial: formData.cameraSerial || null,
            cameraChannel: formData.cameraSerial ? parseInt(formData.cameraChannel || 1) : null,
        };

        try {
            if (currentRoom) {
                // Update
                const roomRef = doc(db, 'rooms', currentRoom.id);
                await updateDoc(roomRef, {
                    ...submitData,
                    updatedAt: new Date().toISOString(),
                });
                setIsEditOpen(false);
            } else {
                // Create
                await addDoc(collection(db, 'rooms'), {
                    ...submitData,
                    createdAt: new Date().toISOString(),
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
            price: room.price,
            cameraSerial: room.cameraSerial || '',
            cameraChannel: room.cameraChannel || 1
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
            cameraSerial: '',
            cameraChannel: 1
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
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-100 border border-blue-300 rounded"></div> Terisi</div>
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
                                    if (booking) {
                                        return (
                                            <Popover key={day.toString()}>
                                                <PopoverTrigger asChild>
                                                    <div
                                                        className="w-10 flex-shrink-0 border-r bg-blue-100 hover:bg-blue-200 cursor-pointer border-blue-200 transition-colors"
                                                    />
                                                </PopoverTrigger>
                                                <PopoverContent className="w-64 p-3 font-sans text-sm">
                                                    <div className="space-y-2">
                                                        <h4 className="font-semibold leading-none border-b pb-2">Detail Reservasi</h4>
                                                        <div className="grid grid-cols-3 gap-1">
                                                            <span className="text-muted-foreground text-xs col-span-1">Hewan:</span>
                                                            <span className="font-medium col-span-2 capitalize">{booking.petName}</span>

                                                            <span className="text-muted-foreground text-xs col-span-1">Pemilik:</span>
                                                            <span className="font-medium col-span-2 capitalize">{booking.ownerName}</span>

                                                            <span className="text-muted-foreground text-xs col-span-1">Masuk:</span>
                                                            <span className="col-span-2">{format(parseISO(booking.startDate), 'dd MMM yyyy', { locale: idLocale })}</span>

                                                            <span className="text-muted-foreground text-xs col-span-1">Keluar:</span>
                                                            <span className="col-span-2">{booking.endDate ? format(parseISO(booking.endDate), 'dd MMM yyyy', { locale: idLocale }) : '-'}</span>
                                                        </div>
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        );
                                    }
                                    return (
                                        <div
                                            key={day.toString()}
                                            className="w-10 flex-shrink-0 border-r text-center bg-transparent"
                                        >
                                            {/* Empty */}
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

    const filteredRooms = rooms.filter(room => {
        const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            room.type.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'all'
            ? true
            : (room.status || 'available') === filterStatus;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="p-6 w-full space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Ketersediaan Kamar</h1>
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
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filter Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Status</SelectItem>
                                <SelectItem value="available">Tersedia</SelectItem>
                                <SelectItem value="occupied">Terisi</SelectItem>
                                <SelectItem value="maintenance">Maintenance</SelectItem>
                            </SelectContent>
                        </Select>
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
                                                        <div>
                                                            <div className="font-medium">{room.name}</div>
                                                            <div className="text-xs text-slate-500">{room.type}</div>
                                                            {room.cameraSerial && (
                                                                <div className="flex items-center gap-1 mt-1 text-[10px] text-indigo-600 bg-indigo-50 w-fit px-1.5 py-0.5 rounded">
                                                                    <Camera className="h-3 w-3" />
                                                                    {devices.find(d => d.serialNumber === room.cameraSerial)?.name || room.cameraSerial}
                                                                    {room.cameraChannel > 1 && ` (Ch ${room.cameraChannel})`}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell><Badge variant="outline">{room.type}</Badge></TableCell>
                                                <TableCell>{room.capacity} Hewan</TableCell>
                                                <TableCell>Rp {room.price.toLocaleString()}</TableCell>
                                                <TableCell>
                                                    {room.status === 'occupied' ? (
                                                        <Badge className="bg-blue-100 text-blue-800 border-blue-200">Terisi</Badge>
                                                    ) : room.status === 'maintenance' ? (
                                                        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Maintenance</Badge>
                                                    ) : (
                                                        <Badge className="bg-green-100 text-green-800 border-green-200">Tersedia</Badge>
                                                    )}
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

                        <div className="space-y-4 pt-4 border-t">
                            <h4 className="font-medium text-sm flex items-center gap-2">
                                <Camera className="h-4 w-4" />
                                Integrasi CCTV (Opsional)
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="cameraSerial">Pilih Device CCTV</Label>
                                    <Select
                                        value={formData.cameraSerial}
                                        onValueChange={(value) => setFormData(prev => ({ ...prev, cameraSerial: value === 'none' ? '' : value }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Pilih camera..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Tidak ada</SelectItem>
                                            {devices.map(device => (
                                                <SelectItem key={device.id} value={device.serialNumber}>
                                                    {device.name} ({device.serialNumber})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="cameraChannel">Channel No.</Label>
                                    <Input
                                        id="cameraChannel"
                                        name="cameraChannel"
                                        type="number"
                                        min="1"
                                        disabled={!formData.cameraSerial}
                                        value={formData.cameraChannel}
                                        onChange={handleInputChange}
                                    />
                                    <p className="text-[10px] text-muted-foreground">Channel 1 untuk camera standalone.</p>
                                </div>
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
