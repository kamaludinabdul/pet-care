import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import { Loader2, Download, TrendingUp, DollarSign, CreditCard } from 'lucide-react';
import { utils, writeFile } from 'xlsx';
import { DateRangePicker } from '../../components/DateRangePicker';

const PetProfitReport = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [transactions, setTransactions] = useState([]);

    // Date Filter State
    const [dateRange, setDateRange] = useState({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date())
    });

    useEffect(() => {
        fetchTransactions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.storeId]); // Initial load, and distinct manual refresh

    const fetchTransactions = async () => {
        if (!user?.storeId) return;
        setLoading(true);
        try {
            // Fetch transactions for the date range
            // Note: Firestore text search/range query limitations might require client-side filtering if composite index missing
            // We'll fetch by storeId and type, then filter by date client-side for simplicity unless data is huge
            const q = query(
                collection(db, 'transactions'),
                where('storeId', '==', user.storeId),
                where('type', '==', 'pet_service')
            );

            const snap = await getDocs(q);
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Client-side date filtering
            const start = dateRange.from ? new Date(dateRange.from).setHours(0, 0, 0, 0) : new Date(0); // Default to epoch if null
            const end = dateRange.to ? new Date(dateRange.to).setHours(23, 59, 59, 999) : new Date().setHours(23, 59, 59, 999);

            const filtered = docs.filter(t => {
                const d = new Date(t.date || t.createdAt?.toDate());
                return d >= start && d <= end && t.status === 'paid';
            });

            // Sort by date desc
            filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

            setTransactions(filtered);
        } catch (error) {
            console.error("Error fetching report:", error);
        } finally {
            setLoading(false);
        }
    };

    // Calculation Logic
    const calculateMetrics = () => {
        let totalRevenue = 0;
        let totalCost = 0;

        transactions.forEach(t => {
            totalRevenue += Number(t.total || 0);

            // Calculate Cost from items (Capital + Commissions)
            if (t.items && Array.isArray(t.items)) {
                t.items.forEach(item => {
                    const qty = Number(item.qty || 1);
                    const capital = Number(item.capitalPrice || 0);
                    let commissions = 0;

                    if (item.commissionDetails && Array.isArray(item.commissionDetails)) {
                        commissions = item.commissionDetails.reduce((sum, c) => sum + Number(c.fee || 0), 0);
                    } else {
                        commissions = Number(item.fee || 0);
                    }

                    totalCost += (capital * qty) + commissions;
                });
            }
        });

        const grossProfit = totalRevenue - totalCost;
        const margin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

        return { totalRevenue, totalCost, grossProfit, margin };
    };

    const metrics = calculateMetrics();

    const handleExportExcel = () => {
        const wb = utils.book_new();

        // Summary Sheet
        const summaryData = [
            ['Laporan Laba Rugi (Profit & Loss)'],
            ['Periode', `${format(new Date(dateRange.from), 'dd MMM yyyy', { locale: id })} - ${format(new Date(dateRange.to), 'dd MMM yyyy', { locale: id })}`],
            [''],
            ['Total Pendapatan (Omzet)', metrics.totalRevenue],
            ['Total Modal (HPP)', metrics.totalCost],
            ['Laba Kotor (Gross Profit)', metrics.grossProfit],
            ['Margin Laba', `${metrics.margin.toFixed(2)}%`]
        ];
        const wsSummary = utils.aoa_to_sheet(summaryData);
        utils.book_append_sheet(wb, wsSummary, "Ringkasan");

        // Detail Sheet
        const detailData = transactions.map(t => {
            let itemCost = 0;
            if (t.items) {
                t.items.forEach(i => {
                    const capital = Number(i.capitalPrice || 0) * Number(i.qty || 1);
                    let comm = 0;
                    if (i.commissionDetails) {
                        comm = i.commissionDetails.reduce((sum, c) => sum + Number(c.fee || 0), 0);
                    } else {
                        comm = Number(i.fee || 0);
                    }
                    itemCost += capital + comm;
                });
            }
            const profit = (t.total || 0) - itemCost;

            return {
                Tanggal: format(new Date(t.date), 'dd/MM/yyyy HH:mm'),
                'ID Transaksi': t.id,
                'Metode Bayar': t.paymentMethod,
                'Total Bayar': t.total,
                'Total Modal': itemCost,
                'Laba': profit
            };
        });
        const wsDetail = utils.json_to_sheet(detailData);
        utils.book_append_sheet(wb, wsDetail, "Detail Transaksi");

        writeFile(wb, `Laporan_Laba_${format(dateRange.from, 'yyyy-MM-dd')}_${format(dateRange.to, 'yyyy-MM-dd')}.xlsx`);
    };

    return (
        <div className="p-6 space-y-6 w-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Laporan Laba Rugi</h1>
                    <p className="text-slate-500">Analisa pendapatan dan keuntungan bersih dari layanan & penjualan.</p>
                </div>
                <Button onClick={handleExportExcel} variant="outline" className="gap-2">
                    <Download className="h-4 w-4" />
                    Export Excel
                </Button>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-end">
                    <div className="w-full md:w-auto z-50">
                        <Label className="mb-2 block">Periode Laporan</Label>
                        <DateRangePicker
                            date={dateRange}
                            setDate={setDateRange}
                        />
                    </div>
                    <Button onClick={fetchTransactions} disabled={loading} className="w-full md:w-auto">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Tampilkan Laporan
                    </Button>
                </CardContent>
            </Card>

            {/* Cards Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-blue-50 border-blue-100">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-blue-600 flex items-center gap-2">
                            <DollarSign className="h-4 w-4" /> Total Pendapatan
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-900">Rp {metrics.totalRevenue.toLocaleString('id-ID')}</div>
                    </CardContent>
                </Card>
                <Card className="bg-orange-50 border-orange-100">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-orange-600 flex items-center gap-2">
                            <CreditCard className="h-4 w-4" /> Total Modal (HPP)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-900">Rp {metrics.totalCost.toLocaleString('id-ID')}</div>
                    </CardContent>
                </Card>
                <Card className="bg-green-50 border-green-100">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-green-600 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" /> Laba Bersih
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-900">Rp {metrics.grossProfit.toLocaleString('id-ID')}</div>
                        <p className="text-xs text-green-600 mt-1">Margin: {metrics.margin.toFixed(1)}%</p>
                    </CardContent>
                </Card>
            </div>

            {/* Table Detail */}
            <Card>
                <CardHeader>
                    <CardTitle>Rincian Transaksi</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tanggal</TableHead>
                                <TableHead>Info Transaksi</TableHead>
                                <TableHead className="text-right">Pendapatan</TableHead>
                                <TableHead className="text-right">Modal</TableHead>
                                <TableHead className="text-right">Laba</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                                        Tidak ada data transaksi pada periode ini.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                transactions.map(t => {
                                    let cost = 0;
                                    if (t.items) {
                                        t.items.forEach(i => {
                                            const capital = Number(i.capitalPrice || 0) * Number(i.qty || 1);
                                            let comm = 0;
                                            if (i.commissionDetails) {
                                                comm = i.commissionDetails.reduce((sum, c) => sum + Number(c.fee || 0), 0);
                                            } else {
                                                comm = Number(i.fee || 0);
                                            }
                                            cost += capital + comm;
                                        });
                                    }
                                    const profit = (t.total || 0) - cost;

                                    return (
                                        <TableRow key={t.id}>
                                            <TableCell>{format(new Date(t.date), 'dd MMM yyyy HH:mm', { locale: id })}</TableCell>
                                            <TableCell>
                                                <div className="font-medium">#{t.id.slice(0, 8)}</div>
                                                <div className="text-xs text-slate-500">{t.paymentMethod.toUpperCase()}</div>
                                            </TableCell>
                                            <TableCell className="text-right">Rp {t.total.toLocaleString('id-ID')}</TableCell>
                                            <TableCell className="text-right text-slate-500">Rp {cost.toLocaleString('id-ID')}</TableCell>
                                            <TableCell className="text-right font-medium text-green-600">Rp {profit.toLocaleString('id-ID')}</TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};

export default PetProfitReport;
