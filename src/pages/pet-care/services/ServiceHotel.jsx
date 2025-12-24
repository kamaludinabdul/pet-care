import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { collection, query, where, updateDoc, doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { LayoutGrid, AlertCircle, CheckCircle, LogIn, LogOut, Calendar as CalendarIcon, Grid } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import CalendarView from '../CalendarView';
import RoomTable from '../RoomTable';

const ServiceHotel = () => {
    const { user } = useAuth();
    const [rooms, setRooms] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);

    const handleCheckOut = async (room) => {
        if (!window.confirm(`Check-out dari ruangan ${room.name}?`)) return;
        try {
            // Update Room to available
            await updateDoc(doc(db, 'rooms', room.id), {
                status: 'available',
                currentOccupantId: null
            });

            // Update Booking to completed if occupant ID exists
            if (room.currentOccupantId) {
                await updateDoc(doc(db, 'bookings', room.currentOccupantId), {
                    status: 'completed',
                    // paymentStatus: 'pending_payment' // Optional: if we want to track payments strictly
                });
            }
        } catch (error) {
            console.error("Error checking out:", error);
            alert("Gagal melakukan check-out.");
        }
    };

    useEffect(() => {
        if (!user?.storeId) return;

        // Fetch Rooms
        const qRooms = query(collection(db, 'rooms'), where('storeId', '==', user.storeId));
        const unsubscribeRooms = onSnapshot(qRooms, (snapshot) => {
            const roomData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setRooms(roomData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching rooms:", error);
            setLoading(false);
        });

        // Fetch Hotel Bookings for Calendar
        // fetching all hotel bookings for simplicity or date range if needed. 
        // For now, grabbing all future/recent might be better but let's grab all active/confirmed for validity.
        // CalendarView filters by date, so we can fetch a broader range or all.
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

    // Calculate Occupancy
    const totalRooms = rooms.length;
    const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Pet Hotel Monitoring</h1>
                    <p className="text-muted-foreground">Status ketersediaan dan okupansi kamar.</p>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold text-indigo-600">{occupancyRate}%</div>
                    <div className="text-xs text-muted-foreground">Okupansi Saat Ini</div>
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

                <TabsContent value="monitor">
                    <RoomTable
                        rooms={rooms}
                        bookings={bookings}
                        onEdit={(room) => console.log("Quick Edit Room", room)}
                        onDelete={(room) => console.log("Delete not allowed here", room)}
                        onStatusChange={handleCheckOut}
                    />
                </TabsContent>

                <TabsContent value="calendar">
                    <CalendarView bookings={bookings} onSelectBooking={(b) => console.log("Selected", b)} />
                </TabsContent>
            </Tabs>

            {
                rooms.length === 0 && !loading && (
                    <div className="text-center py-12 border-2 border-dashed rounded-xl text-slate-400">
                        <LayoutGrid className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>Belum ada data kamar / ruangan.</p>
                        <Button variant="link" className="mt-2 text-indigo-600">Tambah Kamar di Data Master</Button>
                    </div>
                )
            }
        </div >
    );
};

export default ServiceHotel;
