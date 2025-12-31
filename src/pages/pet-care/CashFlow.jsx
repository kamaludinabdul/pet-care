import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, Timestamp, orderBy, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { DateRangePicker } from '../../components/DateRangePicker';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import { Plus, Trash2, TrendingUp, TrendingDown, Wallet, Loader2, Edit } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import ConfirmDialog from '../../components/ConfirmDialog';

const CashFlow = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [transactions, setTransactions] = useState([]); // Income
    const [expenses, setExpenses] = useState([]); // Outflow

    // Filters
    const [dateRange, setDateRange] = useState({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date())
    });

    // Add Expense State
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [newExpense, setNewExpense] = useState({
        description: '',
        amount: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        type: 'opex', // opex | capex | income
        category: 'general'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Delete State
    const [expenseToDelete, setExpenseToDelete] = useState(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    useEffect(() => {
        fetchData();
    }, [user?.storeId, dateRange, fetchData]);

    const fetchData = React.useCallback(async () => {
        if (!user?.storeId || !dateRange?.from || !dateRange?.to) return;
        setLoading(true);
        try {
            const startStr = format(dateRange.from, 'yyyy-MM-dd');
            const endStr = format(dateRange.to, 'yyyy-MM-dd');

            // 1. Fetch Income (Transactions)
            const trxQ = query(
                collection(db, 'transactions'),
                where('storeId', '==', user.storeId),
                where('type', '==', 'pet_service'),
            );
            const trxSnap = await getDocs(trxQ);
            const trxData = trxSnap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(t => {
                    const d = t.date ? new Date(t.date) : t.createdAt?.toDate();
                    const start = new Date(dateRange.from); start.setHours(0, 0, 0, 0);
                    const end = new Date(dateRange.to); end.setHours(23, 59, 59, 999);
                    return d >= start && d <= end && t.status === 'paid';
                });
            setTransactions(trxData);

            // 2. Fetch Expenses - Optimized Server-Side
            const expQ = query(
                collection(db, 'expenses'),
                where('storeId', '==', user.storeId),
                where('date', '>=', startStr),
                where('date', '<=', endStr),
                orderBy('date', 'desc')
            );
            const expSnap = await getDocs(expQ);
            const expData = expSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            setExpenses(expData);

        } catch (error) {
            console.error("Error fetching cash flow:", error);
        } finally {
            setLoading(false);
        }
    }, [user?.storeId, dateRange]);

    const handleSaveExpense = async () => {
        if (!newExpense.description || !newExpense.amount) return;
        setIsSubmitting(true);
        try {
            const expenseData = {
                storeId: user.storeId,
                description: newExpense.description,
                amount: Number(newExpense.amount),
                date: newExpense.date,
                type: newExpense.type,
                category: newExpense.category,
                updatedAt: Timestamp.now()
            };

            if (editingId) {
                await updateDoc(doc(db, 'expenses', editingId), expenseData);
            } else {
                await addDoc(collection(db, 'expenses'), {
                    ...expenseData,
                    createdAt: Timestamp.now(),
                    createdBy: user.uid
                });
            }

            setIsAddOpen(false);
            setEditingId(null);
            setNewExpense({
                description: '',
                amount: '',
                date: format(new Date(), 'yyyy-MM-dd'),
                type: 'opex',
                category: 'general'
            });
            fetchData();
        } catch (error) {
            console.error("Error saving expense:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (expense) => {
        setEditingId(expense.id);
        setNewExpense({
            description: expense.description,
            amount: expense.amount,
            date: expense.date,
            type: expense.type,
            category: expense.category
        });
        setIsAddOpen(true);
    };

    const handleDelete = async () => {
        if (!expenseToDelete) return;
        try {
            await deleteDoc(doc(db, 'expenses', expenseToDelete.id));
            setExpenses(prev => prev.filter(e => e.id !== expenseToDelete.id));
            setIsDeleteOpen(false);
        } catch (error) {
            console.error("Error deleting expense:", error);
        }
    };

    // Metrics
    const extraIncome = expenses.filter(e => e.type === 'income').reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const totalIncome = transactions.reduce((sum, t) => sum + (Number(t.total) || 0), 0) + extraIncome;
    const totalOpex = expenses.filter(e => e.type === 'opex').reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const totalCapex = expenses.filter(e => e.type === 'capex').reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const totalExpense = totalOpex + totalCapex;
    const netCashFlow = totalIncome - totalExpense;

    return (
        <div className="p-6 w-full space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Arus Kas (Cash Flow)</h1>
                    <p className="text-slate-500">Monitor pemasukan dan pencatatan pengeluaran operasional.</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <Button onClick={() => setIsAddOpen(true)} className="gap-2 w-full md:w-auto">
                        <Plus className="h-4 w-4" />
                        Catat Pengeluaran
                    </Button>
                </div>
            </div>

            {/* Filter */}
            <Card>
                <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-end">
                    <div className="w-full md:w-auto z-50">
                        <Label className="mb-2 block">Periode</Label>
                        <DateRangePicker date={dateRange} setDate={setDateRange} />
                    </div>
                    <Button variant="outline" onClick={fetchData} disabled={loading}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Refresh
                    </Button>
                </CardContent>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-emerald-50 border-emerald-100">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-emerald-600 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" /> Total Pemasukan
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-900">Rp {totalIncome.toLocaleString('id-ID')}</div>
                        <p className="text-xs text-emerald-600 mt-1">
                            Trx: {transactions.length} | Lainnya: Rp {extraIncome.toLocaleString('id-ID')}
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-red-50 border-red-100">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-red-600 flex items-center gap-2">
                            <TrendingDown className="h-4 w-4" /> Total Pengeluaran
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-900">Rp {totalExpense.toLocaleString('id-ID')}</div>
                        <div className="flex justify-between text-xs text-red-600 mt-1">
                            <span>OPEX: {totalOpex.toLocaleString('id-ID')}</span>
                            <span>CAPEX: {totalCapex.toLocaleString('id-ID')}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-slate-50 border-slate-100">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                            <Wallet className="h-4 w-4" /> Net Cash Flow
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${netCashFlow >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                            Rp {netCashFlow.toLocaleString('id-ID')}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Expenses List */}
            <Card>
                <CardHeader>
                    <CardTitle>Riwayat Pengeluaran</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tanggal</TableHead>
                                <TableHead>Deskripsi</TableHead>
                                <TableHead>Kategori</TableHead>
                                <TableHead>Tipe</TableHead>
                                <TableHead className="text-right">Jumlah</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {expenses.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        Belum ada data pengeluaran.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                expenses.map(expense => (
                                    <TableRow key={expense.id}>
                                        <TableCell>{format(new Date(expense.date), 'dd MMM yyyy', { locale: id })}</TableCell>
                                        <TableCell className="font-medium">{expense.description}</TableCell>
                                        <TableCell className="capitalize">{expense.category}</TableCell>
                                        <TableCell>
                                            <Badge variant={expense.type === 'income' ? 'default' : (expense.type === 'opex' ? 'secondary' : 'outline')}>
                                                {expense.type === 'income' ? 'PEMASUKAN' : expense.type.toUpperCase()}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className={`text-right font-medium ${expense.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                            {expense.type === 'income' ? '+' : '-'} Rp {Number(expense.amount).toLocaleString('id-ID')}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-500"
                                                    onClick={() => handleEdit(expense)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => {
                                                        setExpenseToDelete(expense);
                                                        setIsDeleteOpen(true);
                                                    }}
                                                >
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

            {/* Add Expense Modal */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Edit Pengeluaran' : 'Catat Pengeluaran Baru'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Tanggal</Label>
                            <Input
                                type="date"
                                value={newExpense.date}
                                onChange={e => setNewExpense({ ...newExpense, date: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Deskripsi Pengeluaran</Label>
                            <Input
                                placeholder="Contoh: Beli Makanan Kucing, Bayar Listrik"
                                value={newExpense.description}
                                onChange={e => setNewExpense({ ...newExpense, description: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Jumlah (Rp)</Label>
                            <Input
                                type="number"
                                placeholder="0"
                                value={newExpense.amount}
                                onChange={e => setNewExpense({ ...newExpense, amount: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Tipe Pengeluaran</Label>
                                <Select
                                    value={newExpense.type}
                                    onValueChange={v => setNewExpense({ ...newExpense, type: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="income">Pemasukan Lainnya</SelectItem>
                                        <SelectItem value="opex">OPEX (Operasional)</SelectItem>
                                        <SelectItem value="capex">CAPEX (Modal/Aset)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label>Kategori</Label>
                                <Select
                                    value={newExpense.category}
                                    onValueChange={v => setNewExpense({ ...newExpense, category: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="general">Umum</SelectItem>
                                        <SelectItem value="supplies">Perlengkapan</SelectItem>
                                        <SelectItem value="salary">Gaji</SelectItem>
                                        <SelectItem value="utilities">Listrik/Air</SelectItem>
                                        <SelectItem value="maintenance">Maintenance</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddOpen(false)}>Batal</Button>
                        <Button onClick={handleSaveExpense} disabled={isSubmitting || !newExpense.amount}>
                            {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                isOpen={isDeleteOpen}
                onClose={() => setIsDeleteOpen(false)}
                onConfirm={handleDelete}
                title="Hapus Pengeluaran"
                description="Yakin ingin menghapus data pengeluaran ini?"
                confirmText="Hapus"
                variant="destructive"
            />
        </div>
    );
};

export default CashFlow;
