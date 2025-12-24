import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Plus, Search, Edit, Trash2, Pill, Loader2 } from 'lucide-react';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import ConfirmDialog from '../../components/ConfirmDialog';

const Medicines = () => {
    const { user } = useAuth();
    const [medicines, setMedicines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        capitalPrice: '', // Harga Modal
        price: '',
        stock: '',
        unit: 'Pcs',
        description: '',
        commissionType: 'fixed',
        commissionValue: ''
    });
    const [saving, setSaving] = useState(false);

    // Delete State
    const [deleteId, setDeleteId] = useState(null);

    const fetchMedicines = async () => {
        if (!user?.storeId) return;
        setLoading(true);
        try {
            // We store medicines in 'products' collection but with type='medicine' or isPetCare=true & category='medicine'
            // To be consistent with the plan, let's use a distinct type or category.
            // Let's use collection 'products' and filter by type == 'medicine'.
            // This allows them to be potentially sold in POS too if needed.
            const q = query(collection(db, 'products'), where('storeId', '==', user.storeId), where('type', '==', 'medicine'));
            const snap = await getDocs(q);
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMedicines(data);
        } catch (error) {
            console.error("Error fetching medicines:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMedicines();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.storeId]);

    const handleOpenModal = (medicine = null) => {
        if (medicine) {
            setEditingId(medicine.id);
            setFormData({
                name: medicine.name,
                capitalPrice: medicine.capitalPrice || '',
                price: medicine.price,
                stock: medicine.stock || 0,
                unit: medicine.unit || 'Pcs',
                description: medicine.description || '',
                commissionType: medicine.commission?.type || 'fixed',
                commissionValue: medicine.commission?.value || ''
            });
        } else {
            setEditingId(null);
            setFormData({
                name: '',
                capitalPrice: '',
                price: '',
                stock: '',
                unit: 'Pcs',
                description: '',
                commissionType: 'fixed',
                commissionValue: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const data = {
                ...formData,
                capitalPrice: Number(formData.capitalPrice),
                price: Number(formData.price),
                stock: Number(formData.stock),
                storeId: user.storeId,
                type: 'medicine', // Identifier
                isPetCare: true,
                commission: {
                    type: formData.commissionType || 'fixed',
                    value: parseFloat(formData.commissionValue || 0)
                },
                updatedAt: serverTimestamp()
            };

            if (editingId) {
                await updateDoc(doc(db, 'products', editingId), data);
            } else {
                await addDoc(collection(db, 'products'), {
                    ...data,
                    createdAt: serverTimestamp()
                });
            }
            setIsModalOpen(false);
            fetchMedicines();
        } catch (error) {
            console.error("Error saving medicine:", error);
            alert("Gagal menyimpan data obat.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await deleteDoc(doc(db, 'products', deleteId));
            setDeleteId(null);
            fetchMedicines();
        } catch (error) {
            console.error("Error deleting medicine:", error);
        }
    };

    const filteredMedicines = medicines.filter(m =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Data Obat & Vitamin</h1>
                    <p className="text-slate-500">Kelola stok obat-obatan klinik.</p>
                </div>
                <Button onClick={() => handleOpenModal()} className="bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Tambah Obat
                </Button>
            </div>

            <Card>
                <CardHeader className="border-b bg-slate-50/50">
                    <div className="relative max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Cari obat..."
                            className="pl-9 bg-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nama Obat</TableHead>
                                <TableHead>Harga Modal</TableHead>
                                <TableHead>Harga Jual</TableHead>
                                <TableHead>Stok</TableHead>
                                <TableHead>Satuan</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8">Memuat data...</TableCell>
                                </TableRow>
                            ) : filteredMedicines.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                        Belum ada data obat.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredMedicines.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                                                    <Pill className="h-4 w-4" />
                                                </div>
                                                {item.name}
                                            </div>
                                        </TableCell>
                                        <TableCell>Rp {(item.capitalPrice || 0).toLocaleString('id-ID')}</TableCell>
                                        <TableCell>Rp {item.price.toLocaleString('id-ID')}</TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.stock <= 5 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                {item.stock}
                                            </span>
                                        </TableCell>
                                        <TableCell>{item.unit}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => handleOpenModal(item)}>
                                                    <Edit className="h-4 w-4 text-slate-500" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => setDeleteId(item.id)} className="text-red-500">
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

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Edit Obat' : 'Tambah Obat Baru'}</DialogTitle>
                        <DialogDescription>
                            Isi informasi obat di bawah ini.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Nama Obat</Label>
                            <Input
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Contoh: Amoxicillin 500mg"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Harga Modal (HPP)</Label>
                                <Input
                                    type="number"
                                    value={formData.capitalPrice}
                                    onChange={e => setFormData({ ...formData, capitalPrice: e.target.value })}
                                    placeholder="0"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Harga Jual</Label>
                                <Input
                                    type="number"
                                    value={formData.price}
                                    onChange={e => setFormData({ ...formData, price: e.target.value })}
                                    placeholder="0"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Stok Awal</Label>
                                <Input
                                    type="number"
                                    value={formData.stock}
                                    onChange={e => setFormData({ ...formData, stock: e.target.value })}
                                    placeholder="0"
                                    required
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Satuan</Label>
                                <Input
                                    value={formData.unit}
                                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                                    placeholder="Pcs/Tablet/Botol"
                                    required
                                />
                            </div>
                        </div>
                        <Label>Keterangan (Opsional)</Label>
                        <Input
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Dosis atau keterangan lain"
                        />
                        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                            <div className="col-span-2">
                                <Label className="text-indigo-600 font-semibold">Fee Dokter (Opsional)</Label>
                            </div>
                            <div className="space-y-2">
                                <Label>Tipe Komisi</Label>
                                <Select
                                    value={formData.commissionType || 'fixed'}
                                    onValueChange={(value) => setFormData({ ...formData, commissionType: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="fixed">Nominal (Rp)</SelectItem>
                                        <SelectItem value="percentage">Persentase (%)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Nilai Komisi</Label>
                                <Input
                                    type="number"
                                    value={formData.commissionValue}
                                    onChange={e => setFormData({ ...formData, commissionValue: e.target.value })}
                                    placeholder="0"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Batal</Button>
                            <Button type="submit" disabled={saving}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Simpan
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={handleDelete}
                title="Hapus Obat"
                description="Apakah Anda yakin ingin menghapus data obat ini?"
                confirmText="Hapus"
                variant="destructive"
            />
        </div >
    );
};

export default Medicines;
