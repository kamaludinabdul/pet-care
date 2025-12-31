import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Activity, Calendar, Search } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useStores } from '../../context/StoresContext';
import { Badge } from '../../components/ui/badge';
import ActivityLogModal from '../../components/ActivityLogModal';

const DailyLog = () => {
    const { activeStoreId } = useStores();
    const [guests, setGuests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBooking, setSelectedBooking] = useState(null);

    useEffect(() => {
        if (!activeStoreId) return;
        fetchActiveGuests();
    }, [activeStoreId, fetchActiveGuests]);

    const fetchActiveGuests = React.useCallback(async () => {
        setLoading(true);
        try {
            // Fetch checked_in and confirmed bookings
            // Fetch ONLY checked_in bookings (active guests)
            const q = query(
                collection(db, 'bookings'),
                where('storeId', '==', activeStoreId),
                where('status', '==', 'checked_in'),
                where('serviceType', '==', 'hotel')
            );
            const snap = await getDocs(q);
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            setGuests(data);
        } catch (error) {
            console.error("Error fetching guests:", error);
        } finally {
            setLoading(false);
        }
    }, [activeStoreId]);

    const filteredGuests = guests.filter(g =>
        (g.petName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (g.customer?.name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Daily Activity Log</h1>
                    <p className="text-slate-500">Catat dan pantau aktivitas harian tamu hotel.</p>
                </div>
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Cari nama hewan..."
                        className="pl-9"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <p>Memuat data tamu...</p>
                ) : filteredGuests.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-slate-500 border-2 border-dashed rounded-xl">
                        <Activity className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p>Tidak ada tamu hotel yang sedang Check-In saat ini.</p>
                    </div>
                ) : (
                    filteredGuests.map(guest => (
                        <Card key={guest.id} className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-indigo-500" onClick={() => setSelectedBooking(guest)}>
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-lg font-bold text-slate-900">{guest.petName}</CardTitle>
                                        <p className="text-sm text-slate-500">{guest.petType} • {guest.petBreed || '-'}</p>
                                    </div>
                                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-0">
                                        Room {guest.items?.[0]?.name?.split('Room ')?.[1] || '?'}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3 text-sm">
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <Calendar className="h-4 w-4" />
                                        <span>Check-In: {new Date(guest.startDate).toLocaleDateString('id-ID')}</span>
                                    </div>
                                    <div className="text-xs text-slate-400">
                                        Owner: {guest.customer?.name}
                                    </div>
                                    <Button className="w-full mt-2 bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300">
                                        <Activity className="h-4 w-4 mr-2" />
                                        Buka Log Aktivitas
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {selectedBooking && (
                <ActivityLogModal
                    booking={selectedBooking}
                    isOpen={!!selectedBooking}
                    onClose={() => setSelectedBooking(null)}
                />
            )}
        </div>
    );
};

export default DailyLog;
