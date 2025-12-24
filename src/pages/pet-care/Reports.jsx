import React, { useState, useEffect } from 'react';
import { useStores } from '../../context/StoresContext';
import { db } from '../../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Download, FileText, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

import { DateRangePicker } from '../../components/DateRangePicker';

const Reports = () => {
    const { activeStoreId } = useStores();

    const [dateRange, setDateRange] = useState({
        from: new Date(),
        to: new Date()
    });

    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({
        total: 0,
        hotel: 0,
        grooming: 0,
        medical: 0
    });

    useEffect(() => {
        const fetchReports = async () => {
            if (!activeStoreId || !dateRange?.from) return;
            setLoading(true);
            try {
                // Ensure endDate includes the full day
                const end = new Date(dateRange.to || dateRange.from);
                end.setHours(23, 59, 59, 999);
                const start = new Date(dateRange.from);
                start.setHours(0, 0, 0, 0);

                const q = query(
                    collection(db, 'transactions'),
                    where('storeId', '==', activeStoreId),
                    where('date', '>=', start.toISOString()),
                    where('date', '<=', end.toISOString()),
                    orderBy('date', 'desc')
                );

                const snap = await getDocs(q);
                const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

                // Process Stats
                let total = 0;
                let hotel = 0;
                let grooming = 0;
                let medical = 0;

                const processedData = data.filter(t => {
                    return t.type === 'pet_service' || t.items?.some(i => i.type === 'service' || i.type === 'pet_service' || i.isPetService || i.type === 'medicine');
                });

                processedData.forEach(t => {
                    const relevantItems = t.items?.filter(i =>
                        i.type === 'service' ||
                        i.type === 'pet_service' ||
                        i.isPetService ||
                        i.type === 'medicine' ||
                        (t.medicalRecordId && i.type === 'manual') // Include manual items in medical records
                    ) || [];

                    const transactionTotal = relevantItems.reduce((sum, i) => sum + (i.total || 0), 0);
                    total += transactionTotal;

                    if (t.medicalRecordId) {
                        medical += transactionTotal;
                    } else if (t.bookingId) {
                        // Check items to distinguish Hotel vs Grooming
                        relevantItems.forEach(i => {
                            const name = i.name.toLowerCase();
                            if (name.includes('hotel') || i.name.startsWith('Hotel')) {
                                hotel += i.total || 0;
                            } else {
                                grooming += i.total || 0;
                            }
                        });
                    } else {
                        // Fallback for ad-hoc transactions
                        relevantItems.forEach(i => {
                            const name = i.name.toLowerCase();
                            if (i.type === 'medicine' || name.includes('konsultasi') || name.includes('dokter')) {
                                medical += i.total || 0;
                            } else if (name.includes('hotel')) {
                                hotel += i.total || 0;
                            } else {
                                grooming += i.total || 0;
                            }
                        });
                    }
                });

                setTransactions(processedData);
                setStats({ total, hotel, grooming, medical });

            } catch (error) {
                console.error("Error fetching reports:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchReports();
    }, [activeStoreId, dateRange]);

    const handleExport = () => {
        const headers = ["Tanggal", "ID Transaksi", "Pelanggan", "Item", "Total", "Metode"];
        const rows = transactions.map(t => [
            format(new Date(t.date), 'yyyy-MM-dd HH:mm'),
            t.id,
            t.customerName || 'Guest',
            t.items.map(i => `${i.name} (${i.qty})`).join('; '),
            t.total,
            t.paymentMethod
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `laporan_pet_care_${format(dateRange.from, 'yyyy-MM-dd')}_${format(dateRange.to || dateRange.from, 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const formatCurrency = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Laporan Keuangan</h1>
                    <p className="text-muted-foreground">Analisis pendapatan layanan Pet Care.</p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                    <DateRangePicker
                        date={dateRange}
                        setDate={setDateRange}
                        className="w-full sm:w-[300px]"
                    />
                    <Button variant="outline" onClick={handleExport} className="w-full sm:w-auto">
                        <Download className="mr-2 h-4 w-4" />
                        Export
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Total Pendapatan</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900">{formatCurrency(stats.total)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Hotel</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{formatCurrency(stats.hotel)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Grooming</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-pink-600">{formatCurrency(stats.grooming)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Klinik / Medis</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.medical)}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Riwayat Transaksi</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tanggal</TableHead>
                                <TableHead>ID</TableHead>
                                <TableHead>Pelanggan</TableHead>
                                <TableHead>Layanan / Item</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8">Memuat data...</TableCell>
                                </TableRow>
                            ) : transactions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Tidak ada transaksi pada periode ini.</TableCell>
                                </TableRow>
                            ) : (
                                transactions.map(t => (
                                    <TableRow key={t.id}>
                                        <TableCell>{format(new Date(t.date), 'dd MMM HH:mm', { locale: idLocale })}</TableCell>
                                        <TableCell className="font-mono text-xs">{t.id.slice(0, 8)}</TableCell>
                                        <TableCell>{t.customerName}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                {t.items?.filter(i => i.type === 'service' || i.type === 'pet_service' || i.isPetService || i.type === 'medicine').map((i, idx) => (
                                                    <span key={idx} className="text-xs bg-slate-100 px-2 py-0.5 rounded w-fit">
                                                        {i.name} ({i.qty})
                                                    </span>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">{formatCurrency(t.total)}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};

export default Reports;
