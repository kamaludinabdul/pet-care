import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Calendar, CheckCircle, Clock, LogOut, Scissors, Hourglass, PlayCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { startOfDay, endOfDay, isWithinInterval, parseISO, isSameDay } from 'date-fns';

const PetCareWidget = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [stats, setStats] = useState({
        hotel: {
            checkIns: 0,
            checkOuts: 0,
            activeGuests: 0
        },
        grooming: {
            waiting: 0,
            inProgress: 0,
            finished: 0
        }
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            if (!user?.storeId) return;

            try {
                const todayStart = startOfDay(new Date());
                const todayEnd = endOfDay(new Date());
                const today = new Date();

                // Fetch Hotel Bookings
                const qHotel = query(
                    collection(db, 'bookings'),
                    where('storeId', '==', user.storeId),
                    where('serviceType', '==', 'hotel'),
                    where('status', 'in', ['confirmed', 'checked_in', 'pending'])
                );

                // Fetch Grooming Bookings (All for today)
                // Note: Index might be needed for storeId + serviceType + date
                // For now, client-side filter for simplicity if volume is low, or separate simple query
                const qGrooming = query(
                    collection(db, 'bookings'),
                    where('storeId', '==', user.storeId),
                    where('serviceType', '==', 'grooming')
                    // We'll filter date in memory to avoid complex compound index for now
                );

                const [hotelSnap, groomingSnap] = await Promise.all([
                    getDocs(qHotel),
                    getDocs(qGrooming)
                ]);

                // Process Hotel
                let hCheckIns = 0;
                let hCheckOuts = 0;
                let hActive = 0;

                hotelSnap.docs.forEach(d => {
                    const b = d.data();
                    const startDate = parseISO(b.startDate);
                    const endDate = parseISO(b.endDate);

                    if (isWithinInterval(startDate, { start: todayStart, end: todayEnd })) hCheckIns++;
                    if (isWithinInterval(endDate, { start: todayStart, end: todayEnd })) hCheckOuts++;
                    if (b.status === 'checked_in') hActive++;
                });

                // Process Grooming
                let gWaiting = 0;
                let gInProgress = 0;
                let gFinished = 0;

                groomingSnap.docs.forEach(d => {
                    const b = d.data();
                    const bookingDate = parseISO(b.startDate); // Grooming usually single date start

                    if (isSameDay(bookingDate, today)) {
                        if (b.status === 'confirmed' || b.status === 'pending') gWaiting++;
                        if (b.status === 'checked_in') gInProgress++;
                        if (b.status === 'checked_out') gFinished++;
                    }
                });

                setStats({
                    hotel: { checkIns: hCheckIns, checkOuts: hCheckOuts, activeGuests: hActive },
                    grooming: { waiting: gWaiting, inProgress: gInProgress, finished: gFinished }
                });

            } catch (error) {
                console.error("Error fetching pet care stats:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [user?.storeId]);

    return (
        <Card className="col-span-1 md:col-span-2 lg:col-span-4 border-none shadow-md overflow-hidden">
            <CardHeader className="pb-4 bg-white border-b border-slate-100">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Calendar className="h-6 w-6 text-indigo-600" />
                        Aktivitas Hari Ini
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={() => navigate('/bookings')}>
                        Lihat Calendar
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                    {/* Hotel Section */}
                    <div className="p-6 bg-gradient-to-br from-indigo-50/50 via-white to-white">
                        <h3 className="font-semibold text-indigo-900 mb-4 flex items-center gap-2">
                            <Clock className="h-4 w-4" /> Pet Hotel
                        </h3>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm text-center">
                                <p className="text-2xl font-bold text-indigo-600">{loading ? '-' : stats.hotel.checkIns}</p>
                                <p className="text-xs text-muted-foreground mt-1">Check-in</p>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm text-center">
                                <p className="text-2xl font-bold text-orange-500">{loading ? '-' : stats.hotel.checkOuts}</p>
                                <p className="text-xs text-muted-foreground mt-1">Check-out</p>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm text-center">
                                <p className="text-2xl font-bold text-green-600">{loading ? '-' : stats.hotel.activeGuests}</p>
                                <p className="text-xs text-muted-foreground mt-1">Active</p>
                            </div>
                        </div>
                    </div>

                    {/* Grooming Section */}
                    <div className="p-6 bg-gradient-to-br from-pink-50/50 via-white to-white">
                        <h3 className="font-semibold text-pink-900 mb-4 flex items-center gap-2">
                            <Scissors className="h-4 w-4" /> Grooming Queue
                        </h3>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-white p-3 rounded-xl border border-pink-100 shadow-sm text-center">
                                <p className="text-2xl font-bold text-slate-600">{loading ? '-' : stats.grooming.waiting}</p>
                                <p className="text-xs text-muted-foreground mt-1 flex justify-center items-center gap-1">
                                    <Hourglass className="h-3 w-3" /> Menunggu
                                </p>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-pink-100 shadow-sm text-center">
                                <p className="text-2xl font-bold text-pink-600">{loading ? '-' : stats.grooming.inProgress}</p>
                                <p className="text-xs text-muted-foreground mt-1 flex justify-center items-center gap-1">
                                    <PlayCircle className="h-3 w-3" /> Proses
                                </p>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-pink-100 shadow-sm text-center">
                                <p className="text-2xl font-bold text-green-600">{loading ? '-' : stats.grooming.finished}</p>
                                <p className="text-xs text-muted-foreground mt-1 flex justify-center items-center gap-1">
                                    <CheckCircle className="h-3 w-3" /> Selesai
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default PetCareWidget;
