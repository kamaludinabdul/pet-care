import React, { useState } from 'react';
import { usePOS } from '../context/POSContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Search, Plus, Phone, Mail, User, X, Edit2, Trash2 } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import ConfirmDialog from '../components/ConfirmDialog';

const Customers = () => {
    const { customers, loading, addCustomer } = usePOS();
    const [searchTerm, setSearchTerm] = useState('');

    // Form State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentId, setCurrentId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Dialog State
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [confirmAction, setConfirmAction] = useState(null);

    const filteredCustomers = customers.filter(c =>
        (c.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (c.phone || '').includes(searchTerm) ||
        (c.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    const handleEdit = (customer) => {
        setFormData({
            name: customer.name || '',
            phone: customer.phone || '',
            email: customer.email || ''
        });
        setCurrentId(customer.id);
        setIsEditing(true);
        setIsFormOpen(true);
    };

    const handleDelete = (id) => {
        setConfirmAction(() => async () => {
            try {
                await deleteDoc(doc(db, 'customers', id));
            } catch (error) {
                console.error("Error deleting customer:", error);
                alert("Gagal menghapus pelanggan.");
            }
        });
        setIsConfirmOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (isEditing) {
                await updateDoc(doc(db, 'customers', currentId), {
                    name: formData.name,
                    phone: formData.phone,
                    email: formData.email
                });
            } else {
                // Check duplicate phone
                const exists = customers.find(c => c.phone === formData.phone);
                if (exists) {
                    alert("Nomor HP sudah terdaftar atas nama: " + exists.name);
                    setIsSubmitting(false);
                    return;
                }

                const res = await addCustomer({
                    name: formData.name,
                    phone: formData.phone,
                    email: formData.email
                });

                if (!res.success) {
                    throw new Error(res.error);
                }
            }

            setIsFormOpen(false);
            setFormData({ name: '', phone: '', email: '' });
            setIsEditing(false);
        } catch (error) {
            console.error("Error saving customer:", error);
            alert("Gagal menyimpan data: " + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({ name: '', phone: '', email: '' });
        setIsEditing(false);
        setIsFormOpen(false);
    };

    return (
        <div className="p-6 space-y-6 w-full mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Data Pelanggan</h1>
                    <p className="text-muted-foreground">Kelola data pelanggan dan riwayat loyalitas.</p>
                </div>
                <Button onClick={() => { resetForm(); setIsFormOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" />
                    Tambah Pelanggan
                </Button>
            </div>

            <Card>
                <CardHeader className="border-b bg-slate-50/50">
                    <div className="relative max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Cari nama, no. HP, atau email..."
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
                                <TableHead>Nama Pelanggan</TableHead>
                                <TableHead>Kontak</TableHead>
                                <TableHead>Poin Loyalty</TableHead>
                                <TableHead>Total Belanja</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8">Memuat data...</TableCell>
                                </TableRow>
                            ) : filteredCustomers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        Tidak ada data pelanggan yang cocok.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredCustomers.map((customer) => (
                                    <TableRow key={customer.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                                    <User className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <div className="font-semibold">{customer.name}</div>
                                                    <div className="text-xs text-muted-foreground">ID: {customer.id}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-1">
                                                {customer.phone && (
                                                    <div className="flex items-center text-sm text-slate-600">
                                                        <Phone className="h-3 w-3 mr-2" />
                                                        {customer.phone}
                                                    </div>
                                                )}
                                                {customer.email && (
                                                    <div className="flex items-center text-sm text-slate-600">
                                                        <Mail className="h-3 w-3 mr-2" />
                                                        {customer.email}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100">
                                                {customer.loyaltyPoints || 0} Poin
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            Rp {(customer.totalSpent || 0).toLocaleString('id-ID')}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(customer)}>
                                                    <Edit2 className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(customer.id)}>
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

            {/* Add/Edit Customer Modal */}
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'Edit Pelanggan' : 'Tambah Pelanggan Baru'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Nama Lengkap</Label>
                            <Input
                                placeholder="Nama Pelanggan"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Nomor HP (WhatsApp)</Label>
                            <Input
                                placeholder="Contoh: 08123456789"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                required
                                disabled={isEditing} // Prevent changing ID logic if using phone as ID
                            />
                            {!isEditing && <p className="text-xs text-muted-foreground">Nomor HP akan digunakan sebagai ID unik.</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Email (Opsional)</Label>
                            <Input
                                type="email"
                                placeholder="email@contoh.com"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={resetForm}>
                                Batal
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                title="Hapus Pelanggan"
                message="Apakah Anda yakin ingin menghapus pelanggan ini? Data riwayat belanja akan tetap tersimpan namun kehilangan tautan pelanggan."
                onConfirm={confirmAction}
            />
        </div>
    );
};

export default Customers;
