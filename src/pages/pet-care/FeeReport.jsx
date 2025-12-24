
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import { Printer, Download, Filter, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Badge } from '../../components/ui/badge';
import { DateRangePicker } from '../../components/DateRangePicker';

const FeeReport = () => {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState([]);
    const [staffList, setStaffList] = useState([]);

    // Filters
    const [dateRange, setDateRange] = useState({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date())
    });
    const [selectedRole, setSelectedRole] = useState('all');

    const fetchStaff = async () => {
        if (!user?.storeId) return;
        try {
            const q = query(collection(db, 'users'), where('storeId', '==', user.storeId));
            const snap = await getDocs(q);
            setStaffList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error("Error fetching staff", err);
        }
    };

    const fetchFees = async () => {
        if (!user?.storeId || !dateRange?.from || !dateRange?.to) return;
        try {
            // Ensure end date covers the full day
            const endDate = new Date(dateRange.to);
            endDate.setHours(23, 59, 59, 999);

            const q = query(
                collection(db, 'transactions'),
                where('storeId', '==', user.storeId),
                where('date', '>=', dateRange.from.toISOString()),
                where('date', '<=', endDate.toISOString())
            );

            const snap = await getDocs(q);
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Process Items to find Fees
            let processed = [];

            docs.forEach(trx => {
                if (trx.items && Array.isArray(trx.items)) {
                    trx.items.forEach(item => {
                        // 0. New Granular Commission Logic (Hotel)
                        if (item.commissionDetails && Array.isArray(item.commissionDetails) && item.commissionDetails.length > 0) {
                            item.commissionDetails.forEach(comm => {
                                const staff = staffList.find(s => s.id === comm.staffId);
                                processed.push({
                                    trxId: trx.id,
                                    trxDate: comm.date ? new Date(comm.date).toISOString() : trx.date, // Use specific date if available
                                    trxNumber: (trx.id || '').slice(0, 8).toUpperCase(),
                                    itemName: `${item.name} (${format(new Date(comm.date), 'dd MMM')})`,
                                    staffId: comm.staffId,
                                    staffName: staff ? (staff.name || staff.email) : 'Unknown',
                                    staffRole: staff ? (staff.role || 'staff') : 'unknown',
                                    fee: Number(comm.fee),
                                    discount: 0, // Discount usually on total price, not fee
                                    netFee: Number(comm.fee)
                                });
                            });
                            // Skip standard logic below for this item if detailed commissions exist
                            return;
                        }

                        // 1. Regular Staff Fee
                        if (item.fee && item.fee > 0) {
                            const staff = staffList.find(s => s.id === item.staffId);
                            processed.push({
                                trxId: trx.id,
                                trxDate: trx.date, // Use the specific date for hotel items
                                trxNumber: (trx.id || '').slice(0, 8).toUpperCase(),
                                itemName: item.name,
                                staffId: item.staffId,
                                staffName: staff ? (staff.name || staff.email) : (item.staffName || 'Unassigned Staff'),
                                staffRole: staff ? (staff.role || 'staff') : 'unknown',
                                fee: Number(item.fee),
                                discount: Number(item.discount || 0),
                                netFee: Number(item.fee) - Number(item.discount || 0)
                            });
                        }

                        // 2. Paramedic Fee (if any)
                        if ((item.feeParamedic && item.feeParamedic > 0)) {
                            const paramedic = staffList.find(s => s.id === item.paramedicId);
                            processed.push({
                                trxId: trx.id,
                                trxDate: trx.date,
                                trxNumber: (trx.id || '').slice(0, 8).toUpperCase(),
                                itemName: `${item.name} (Paramedis)`,
                                staffId: item.paramedicId,
                                staffName: paramedic ? (paramedic.name || paramedic.email) : 'Unknown Paramedis',
                                staffRole: 'paramedis', // Force role or use user role
                                fee: Number(item.feeParamedic),
                                discount: 0, // Discount usually applied to main price/doctor. Assumption: Paramedic gets full fee.
                                netFee: Number(item.feeParamedic)
                            });
                        }
                    });
                }
            });

            // Client-side Sort
            processed.sort((a, b) => new Date(b.trxDate) - new Date(a.trxDate));
            setTransactions(processed);

        } catch (error) {
            console.error("Error fetching fees:", error);
        }
    };

    useEffect(() => {
        fetchStaff();
    }, [user?.storeId]);

    useEffect(() => {
        if (staffList.length > 0) {
            fetchFees();
        }
    }, [dateRange, user?.storeId, staffList]);

    const filteredData = transactions.filter(t => {
        if (selectedRole && selectedRole !== 'all') {
            return t.staffRole === selectedRole;
        }
        return true;
    });

    // Grouping by Role for Summary
    const summaryByRole = filteredData.reduce((acc, curr) => {
        const role = curr.staffRole;
        if (!acc[role]) acc[role] = 0;
        acc[role] += curr.netFee;
        return acc;
    }, {});

    const totalFee = filteredData.reduce((sum, item) => sum + item.netFee, 0);

    const handlePrint = () => {
        window.print();
    };

    const handleExport = () => {
        const wb = XLSX.utils.book_new();

        // Detailed Sheet
        const wsDetail = XLSX.utils.json_to_sheet(filteredData.map(item => ({
            'Tanggal': format(new Date(item.trxDate), 'dd/MM/yyyy HH:mm'),
            'No Transaksi': item.trxNumber,
            'Layanan': item.itemName,
            'Staff': item.staffName,
            'Role': item.staffRole,
            'Fee Awal': item.fee,
            'Diskon': item.discount,
            'Net Fee': item.netFee
        })));
        XLSX.utils.book_append_sheet(wb, wsDetail, "Detail Komisi");

        // Summary Sheet
        const summaryData = Object.entries(summaryByRole).map(([role, total]) => ({
            'Role': role.toUpperCase(),
            'Total Komisi': total
        }));
        const wsSummary = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan");

        const fileName = `Laporan_Komisi_${format(dateRange.from, 'yyyy-MM-dd')}_${format(dateRange.to, 'yyyy-MM-dd')}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    const getRoleBadge = (role) => {
        switch (role) {
            case 'dokter': return <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200">Dokter</Badge>;
            case 'paramedis': return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200">Paramedis</Badge>;
            case 'groomer': return <Badge className="bg-pink-100 text-pink-700 hover:bg-pink-200">Groomer</Badge>;
            default: return <Badge variant="outline">{role}</Badge>;
        }
    };

    return (
        <div className="p-6 space-y-6 w-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Laporan Komisi</h1>
                    <p className="text-muted-foreground">Analisa detail pendapatan komisi per staff & role.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handlePrint}>
                        <Printer className="mr-2 h-4 w-4" />
                        Cetak
                    </Button>
                    <Button variant="outline" onClick={handleExport}>
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                        Export Excel
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:hidden">
                <Card className="bg-slate-900 text-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Total Komisi</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Rp {totalFee.toLocaleString('id-ID')}</div>
                        <p className="text-xs text-slate-400 mt-1">
                            {dateRange?.from && dateRange?.to ? (
                                `${format(dateRange.from, 'dd MMM')} - ${format(dateRange.to, 'dd MMM yyyy')} `
                            ) : '-'}
                        </p>
                    </CardContent>
                </Card>
                {/* Dynamic Cards per Role */}
                {Object.entries(summaryByRole).map(([role, total]) => (
                    <Card key={role}>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground capitalize">Komisi {role}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Rp {total.toLocaleString('id-ID')}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Header Filters */}
            <Card className="print:shadow-none print:border-none mb-6">
                <CardHeader className="bg-slate-50/50 border-b print:bg-white print:border-none print:px-0 py-4">
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-center print:hidden">
                        <div className="flex items-center gap-2">
                            <DateRangePicker
                                date={dateRange}
                                setDate={setDateRange}
                            />
                        </div>
                        <div className="flex items-center gap-2 w-full md:w-64">
                            <Select value={selectedRole} onValueChange={setSelectedRole}>
                                <SelectTrigger className="bg-white">
                                    <SelectValue placeholder="Semua Role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Role</SelectItem>
                                    <SelectItem value="dokter">Dokter Hewan</SelectItem>
                                    <SelectItem value="paramedis">Paramedis</SelectItem>
                                    <SelectItem value="groomer">Groomer</SelectItem>
                                    <SelectItem value="staff">Staff/Kasir</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Grouped by Staff */}
            <div className="space-y-4">
                {Object.entries(
                    filteredData.reduce((acc, item) => {
                        const key = item.staffId || 'unknown';
                        if (!acc[key]) {
                            acc[key] = {
                                staffName: item.staffName,
                                staffRole: item.staffRole,
                                totalFee: 0,
                                items: []
                            };
                        }
                        acc[key].items.push(item);
                        acc[key].totalFee += item.netFee;
                        return acc;
                    }, {})
                )
                    .sort(([, a], [, b]) => b.totalFee - a.totalFee)
                    .map(([staffId, group]) => (
                        <Card key={staffId} className="overflow-hidden">
                            <CardHeader className="bg-slate-50 border-b py-3">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                                            {group.staffName.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-bold text-lg">{group.staffName}</div>
                                            <div className="flex items-center gap-2">
                                                {getRoleBadge(group.staffRole)}
                                                <span className="text-xs text-slate-500">{group.items.length} Transaksi</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm text-slate-500">Total Komisi</div>
                                        <div className="text-xl font-bold text-green-700">Rp {group.totalFee.toLocaleString('id-ID')}</div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50/50">
                                            <TableHead>Tanggal</TableHead>
                                            <TableHead>No. TRX</TableHead>
                                            <TableHead>Layanan / Item</TableHead>
                                            <TableHead className="text-right">Fee</TableHead>
                                            <TableHead className="text-right text-red-500">Potongan</TableHead>
                                            <TableHead className="text-right font-bold">Net</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {group.items.map((item, idx) => (
                                            <TableRow key={`${item.trxId} -${idx} `}>
                                                <TableCell className="text-xs text-slate-500">
                                                    {format(new Date(item.trxDate), 'dd/MM/yyyy HH:mm')}
                                                </TableCell>
                                                <TableCell className="font-mono text-xs">{item.trxNumber}</TableCell>
                                                <TableCell>{item.itemName}</TableCell>
                                                <TableCell className="text-right text-slate-500 text-sm">Rp {item.fee.toLocaleString('id-ID')}</TableCell>
                                                <TableCell className="text-right text-red-500 text-sm">
                                                    {item.discount > 0 ? `- Rp ${item.discount.toLocaleString('id-ID')} ` : '-'}
                                                </TableCell>
                                                <TableCell className="text-right font-medium">Rp {item.netFee.toLocaleString('id-ID')}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    ))}
            </div>
        </div>
    );
};

export default FeeReport;
