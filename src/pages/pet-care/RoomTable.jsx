
import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Search, Filter, Edit, Trash2 } from 'lucide-react';

const RoomTable = ({ rooms, bookings, onEdit, onDelete }) => {
    const [filterStatus, setFilterStatus] = useState('all'); // all, available, occupied
    const [searchTerm, setSearchTerm] = useState('');

    const getRoomStatus = (room) => {
        // 1. Trust Room Status first (to match Header Occupancy %)
        if (room.status === 'occupied') {
            // Try to find booking by ID
            let booking = bookings.find(b => b.id === room.currentOccupantId);

            // If not found by ID, look for any active booking for this room
            if (!booking) {
                booking = bookings.find(b => {
                    const isValidStatus = b.status === 'checked_in' || b.status === 'confirmed';
                    const isRoomMatch = b.items?.some(item => String(item.id) === String(room.id));
                    // Check date overlap for confirmed bookings to be sure it's valid for TODAY
                    const today = new Date();
                    const start = new Date(b.startDate);
                    const end = new Date(b.endDate);
                    const isTodayInrange = today >= start && today <= end;

                    return isValidStatus && isRoomMatch && isTodayInrange;
                });
            }

            return { status: 'occupied', booking: booking || null };
        }

        // 2. Fallback: Check for 'checked_in' bookings even if room says available (Self-healing)
        const activeBooking = bookings.find(b => {
            if (b.status !== 'checked_in') return false;
            return b.items?.some(item => String(item.id) === String(room.id));
        });

        if (activeBooking) {
            return { status: 'occupied', booking: activeBooking };
        }

        return { status: 'available', booking: null };
    };

    const filteredRooms = rooms.filter(room => {
        const { status, booking } = getRoomStatus(room);
        const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (booking && booking.petName?.toLowerCase().includes(searchTerm.toLowerCase()));

        if (filterStatus === 'all') return matchesSearch;
        return matchesSearch && status === filterStatus;
    });

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari kamar / tamu..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="w-full sm:w-48">
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger>
                            <SelectValue placeholder="Filter Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Status</SelectItem>
                            <SelectItem value="available">Tersedia</SelectItem>
                            <SelectItem value="occupied">Terisi</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="rounded-md border bg-white">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nama Kamar</TableHead>
                            <TableHead>Tipe</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Tamu Saat Ini</TableHead>
                            <TableHead>Check-In</TableHead>
                            <TableHead>Check-Out</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredRooms.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    Tidak ada kamar yang sesuai filter.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredRooms.map(room => {
                                const { status, booking } = getRoomStatus(room);
                                return (
                                    <TableRow key={room.id}>
                                        <TableCell className="font-medium">{room.name}</TableCell>
                                        <TableCell>{room.type}</TableCell>
                                        <TableCell>
                                            <Badge variant={status === 'available' ? 'outline' : 'default'} className={
                                                status === 'available' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-indigo-600'
                                            }>
                                                {status === 'available' ? 'Tersedia' : 'Terisi'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {booking ? (
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{booking.petName}</span>
                                                    <span className="text-xs text-muted-foreground">Owner: {booking.customer?.name}</span>
                                                </div>
                                            ) : '-'}
                                        </TableCell>
                                        <TableCell>
                                            {booking ? (
                                                <span className="text-xs">{new Date(booking.startDate).toLocaleDateString('id-ID')}</span>
                                            ) : '-'}
                                        </TableCell>
                                        <TableCell>
                                            {booking ? (
                                                <span className={`text-xs font-medium ${new Date(booking.endDate) < new Date() ? 'text-red-500' : ''}`}>
                                                    {new Date(booking.endDate).toLocaleDateString('id-ID')}
                                                </span>
                                            ) : '-'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => onEdit(room)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => onDelete(room)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="text-xs text-muted-foreground">
                Total Kamar: {rooms.length} | Tersedia: {rooms.filter(r => getRoomStatus(r).status === 'available').length} | Terisi: {rooms.filter(r => getRoomStatus(r).status === 'occupied').length}
            </div>
        </div>
    );
};

export default RoomTable;
