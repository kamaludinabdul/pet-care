import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useStores } from '../context/StoresContext';
import PetCareWidget from './pet-care/PetCareWidget';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Activity, Calendar, FileText, Home, User, Scissors, Wallet } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';
import { id } from 'date-fns/locale';

const Dashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { activeStoreId } = useStores();
    const [stats, setStats] = useState({
        occupancyRate: 0,
        occupiedRooms: 0,
        totalRooms: 0,
        todaysIncome: 0,
        activeGuests: 0,
        upcomingBookings: [],
        cashFlowData: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!activeStoreId) {
                console.log("Dashboard: No activeStoreId, skipping fetch");
                return;
            }

            console.log(`Dashboard: Fetching data for store ${activeStoreId}`);
            setLoading(true);

            // Initialize default stats
            let newStats = {
                occupancyRate: 0,
                occupiedRooms: 0,
                totalRooms: 0,
                todaysIncome: 0,
                activeGuests: 0,
                upcomingBookings: [],
                cashFlowData: []
            };

            try {
                // 1. Fetch Rooms for Occupancy
                try {
                    const roomsQ = query(collection(db, 'rooms'), where('storeId', '==', activeStoreId));
                    const roomsSnap = await getDocs(roomsQ);
                    const rooms = roomsSnap.docs.map(doc => doc.data());
                    const totalRooms = rooms.length;
                    const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
                    newStats.occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;
                    newStats.occupiedRooms = occupiedRooms;
                    newStats.totalRooms = totalRooms;
                } catch (err) {
                    console.error("Dashboard: Error fetching ROOMS:", err);
                }

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const todayIso = today.toISOString();
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);

                // 2. Fetch Today's Transactions for Income
                try {
                    const salesQ = query(
                        collection(db, 'transactions'),
                        where('storeId', '==', activeStoreId),
                        where('date', '>=', todayIso),
                        orderBy('date', 'desc')
                    );
                    const salesSnap = await getDocs(salesQ);
                    newStats.todaysIncome = salesSnap.docs
                        .map(doc => doc.data())
                        .filter(t => t.items?.some(i => i.type === 'service' || i.isPetService))
                        .reduce((sum, t) => sum + (t.total || 0), 0);
                } catch (err) {
                    console.error("Dashboard: Error fetching INCOME (transactions):", err);
                }

                // 3. Fetch Active & Upcoming Bookings
                try {
                    const bookingsQ = query(
                        collection(db, 'bookings'),
                        where('storeId', '==', activeStoreId),
                        where('status', 'in', ['checked_in', 'confirmed', 'pending'])
                    );
                    const bookingsSnap = await getDocs(bookingsQ);
                    const allBookings = bookingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                    newStats.activeGuests = allBookings.filter(b => b.status === 'checked_in').length;

                    newStats.upcomingBookings = allBookings
                        .filter(b => {
                            const d = new Date(b.startDate);
                            // 48h window
                            return d >= today && d < new Date(tomorrow.getTime() + 86400000);
                        })
                        .sort((a, b) => new Date(a.startDate + 'T' + a.startTime) - new Date(b.startDate + 'T' + b.startTime))
                        .slice(0, 5);
                } catch (err) {
                    console.error("Dashboard: Error fetching BOOKINGS:", err);
                }

                // 4. Fetch Cash Flow (Last 6 Months)
                try {
                    const startMonth = subMonths(new Date(), 5);
                    const months = eachMonthOfInterval({ start: startMonth, end: new Date() });
                    const startStr = format(startOfMonth(startMonth), 'yyyy-MM-dd');

                    const expHistoryQ = query(
                        collection(db, 'expenses'),
                        where('storeId', '==', activeStoreId),
                        where('date', '>=', startStr),
                        orderBy('date', 'desc')
                    );
                    const expHistorySnap = await getDocs(expHistoryQ);
                    const expenses = expHistorySnap.docs.map(d => d.data());

                    const chartData = [];
                    for (const monthDate of months) {
                        const monthLabel = format(monthDate, 'MMM', { locale: id });
                        const mStart = startOfMonth(monthDate);
                        const mEnd = endOfMonth(monthDate);

                        const monthExpenses = expenses
                            .filter(e => {
                                const d = new Date(e.date);
                                return d >= mStart && d <= mEnd && e.type !== 'income';
                            })
                            .reduce((sum, e) => sum + Number(e.amount), 0);

                        chartData.push({
                            name: monthLabel,
                            expenses: monthExpenses
                        });
                    }
                    newStats.cashFlowData = chartData;
                } catch (err) {
                    console.error("Dashboard: Error fetching EXPENSES:", err);
                }

                setStats(newStats);

            } catch (error) {
                console.error("Dashboard: Critical error in fetchDashboardData:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [activeStoreId]);

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
    };

    return (
        <div className="p-6 space-y-6">
            <header className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
                <p className="text-slate-500">Ringkasan aktivitas Pet Hotel & Grooming hari ini.</p>
            </header>

            {/* Main Stats Widgets */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Pendapatan (Hari Ini)</CardTitle>
                        <Activity className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loading ? '...' : formatCurrency(stats.todaysIncome)}</div>
                        <p className="text-xs text-muted-foreground">dari layanan Pet Care</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tingkat Hunian Hotel</CardTitle>
                        <Home className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loading ? '...' : `${stats.occupancyRate}%`}</div>
                        <p className="text-xs text-muted-foreground">{stats.occupiedRooms} dari {stats.totalRooms} kandang terisi</p>
                        {/* Simple Progress Bar */}
                        <div className="w-full bg-slate-100 h-2 mt-2 rounded-full overflow-hidden">
                            <div className="bg-blue-600 h-full transition-all duration-500" style={{ width: `${stats.occupancyRate}%` }} />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tamu Aktif</CardTitle>
                        <User className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loading ? '...' : stats.activeGuests}</div>
                        <p className="text-xs text-muted-foreground">Ekor (Sedang Check-In)</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Booking Mendatang</CardTitle>
                        <Calendar className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loading ? '...' : stats.upcomingBookings.length}</div>
                        <p className="text-xs text-muted-foreground">Jadwal hari ini & besok</p>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Activity / Quick Actions Section */}
            <div className="grid gap-6 md:grid-cols-3">
                <div className="col-span-2 space-y-6">
                    <PetCareWidget />

                    <Card>
                        <CardHeader>
                            <CardTitle>Jadwal Mendatang (Next 48h)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <p className="text-sm text-slate-500">Memuat jadwal...</p>
                            ) : stats.upcomingBookings.length === 0 ? (
                                <p className="text-sm text-slate-500 py-4">Tidak ada jadwal dalam 48 jam ke depan.</p>
                            ) : (
                                <div className="space-y-4">
                                    {stats.upcomingBookings.map((booking, idx) => (
                                        <div key={idx} className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                                            <div className="flex items-center gap-3">
                                                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${booking.serviceType === 'hotel' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'}`}>
                                                    {booking.serviceType === 'hotel' ? <Home className="h-5 w-5" /> : <Scissors className="h-5 w-5" />}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm text-slate-900">
                                                        {booking.serviceType === 'hotel' ? 'Pet Hotel' : 'Grooming'}
                                                        <span className="text-slate-400 mx-1">•</span>
                                                        {booking.startTime}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {new Date(booking.startDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <Badge variant={booking.status === 'confirmed' ? 'default' : 'secondary'}>
                                                    {booking.status === 'confirmed' ? 'Confirmed' : booking.status}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Pengeluaran Bulanan</CardTitle>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            {loading ? (
                                <div className="h-full flex items-center justify-center text-slate-400">Loading chart...</div>
                            ) : (
                                <div className="h-full w-full min-h-[300px]" style={{ height: 300 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={stats.cashFlowData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis
                                                fontSize={12}
                                                tickLine={false}
                                                axisLine={false}
                                                tickFormatter={(value) => `Rp${value / 1000}k`}
                                            />
                                            <Tooltip
                                                cursor={{ fill: 'transparent' }}
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        return (
                                                            <div className="bg-white p-2 border rounded shadow-sm text-xs">
                                                                <p className="font-bold">{payload[0].payload.name}</p>
                                                                <p className="text-red-600">Rp {Number(payload[0].value).toLocaleString('id-ID')}</p>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-col gap-4">
                    <h3 className="font-semibold text-slate-900">Quick Actions</h3>
                    <button
                        onClick={() => navigate('/pet-care/bookings/add')}
                        className="p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-500 hover:shadow-md transition-all text-left group"
                    >
                        <Calendar className="h-6 w-6 text-indigo-600 mb-2 group-hover:scale-110 transition-transform" />
                        <h3 className="font-semibold text-slate-900">Booking Baru</h3>
                        <p className="text-xs text-slate-500 mt-1">Buat reservasi hotel/grooming</p>
                    </button>
                    <button
                        onClick={() => navigate('/pet-care/medical-records/add')}
                        className="p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-500 hover:shadow-md transition-all text-left group"
                    >
                        <FileText className="h-6 w-6 text-emerald-600 mb-2 group-hover:scale-110 transition-transform" />
                        <h3 className="font-semibold text-slate-900">Rekam Medis</h3>
                        <p className="text-xs text-slate-500 mt-1">Catat kesehatan hewan</p>
                    </button>
                    <button
                        onClick={() => navigate('/pet-care/daily-log')}
                        className="p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-500 hover:shadow-md transition-all text-left group"
                    >
                        <Activity className="h-6 w-6 text-pink-500 mb-2 group-hover:scale-110 transition-transform" />
                        <h3 className="font-semibold text-slate-900">Daily Log (Hotel)</h3>
                        <p className="text-xs text-slate-500 mt-1">Catat aktivitas harian</p>
                    </button>
                    <button
                        onClick={() => navigate('/pet-care/cash-flow')}
                        className="p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-500 hover:shadow-md transition-all text-left group"
                    >
                        <Wallet className="h-6 w-6 text-orange-500 mb-2 group-hover:scale-110 transition-transform" />
                        <h3 className="font-semibold text-slate-900">Catat Pengeluaran</h3>
                        <p className="text-xs text-slate-500 mt-1">Input biaya operasional</p>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
