import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Badge } from '../../components/ui/badge';
import { Plus, Edit, Trash2, Save, X, Search } from 'lucide-react';
import ConfirmDialog from '../../components/ConfirmDialog';

const Services = () => {
    const { user } = useAuth();
    const [services, setServices] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('medical');

    // Form State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        category: 'medical', // grooming, hotel, add-on, medical
        capitalPrice: '',
        price: '',
        duration: '', // in minutes
        description: '',
        commissionType: 'fixed',
        commissionValue: '',
        paramedicCommissionType: 'fixed',
        paramedicCommissionValue: ''
    });

    // Delete State
    const [deleteId, setDeleteId] = useState(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const storeId = user?.storeId;

    const fetchServices = async () => {
        if (!storeId) return;
        try {
            const q = query(collection(db, 'services'), where('storeId', '==', storeId));
            const snap = await getDocs(q);
            setServices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (error) {
            console.error("Services.jsx: Error fetching services (services collection):", error);
        }
    };

    useEffect(() => {
        fetchServices();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storeId]);

    const handleOpenForm = (service = null) => {
        if (service) {
            setEditingId(service.id);
            setFormData({
                name: service.name,
                category: service.category,
                capitalPrice: service.capitalPrice || '',
                price: service.price,
                duration: service.duration || '',
                description: service.description || '',
                commissionType: service.commission?.type || 'fixed',
                commissionValue: service.commission?.value || '',
                paramedicCommissionType: service.paramedicCommission?.type || 'fixed',
                paramedicCommissionValue: service.paramedicCommission?.value || ''
            });
        } else {
            setEditingId(null);
            setFormData({
                name: '',
                category: activeTab,
                capitalPrice: '',
                price: '',
                duration: '',
                description: '',
                commissionType: 'fixed',
                commissionValue: '',
                paramedicCommissionType: 'fixed',
                paramedicCommissionValue: ''
            });
        }
        setIsFormOpen(true);
    };


    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const data = {
                storeId,
                name: formData.name,
                category: formData.category,
                capitalPrice: parseFloat(formData.capitalPrice || 0),
                price: parseFloat(formData.price),
                duration: formData.duration ? parseInt(formData.duration) : null,
                description: formData.description,
                commission: {
                    type: formData.commissionType || 'fixed',
                    value: parseFloat(formData.commissionValue || 0)
                },
                paramedicCommission: {
                    type: formData.paramedicCommissionType || 'fixed',
                    value: parseFloat(formData.paramedicCommissionValue || 0)
                },
                updatedAt: serverTimestamp()
            };

            if (editingId) {
                await updateDoc(doc(db, 'services', editingId), data);
                setServices(prev => prev.map(s => s.id === editingId ? { ...s, ...data, id: editingId } : s));
            } else {
                data.createdAt = serverTimestamp();
                const ref = await addDoc(collection(db, 'services'), data);
                setServices(prev => [...prev, { ...data, id: ref.id }]);
            }
            setIsFormOpen(false);
        } catch (error) {
            console.error("Error saving service:", error);
            alert("Gagal menyimpan layanan");
        }
    };

    const confirmDelete = async () => {
        if (!deleteId) return;
        try {
            await deleteDoc(doc(db, 'services', deleteId));
            setServices(prev => prev.filter(s => s.id !== deleteId));
            setIsDeleteDialogOpen(false);
        } catch (error) {
            console.error("Error deleting service:", error);
        }
    };

    const filteredServices = services.filter(s =>
        s.category === activeTab &&
        (s.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="p-4 space-y-6 w-full mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Layanan & Harga</h1>
                    <p className="text-muted-foreground">Kelola daftar layanan grooming dan paket penitipan.</p>
                </div>
                <Button onClick={() => handleOpenForm()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Tambah Layanan
                </Button>
            </div>

            <Tabs defaultValue="grooming" value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="flex sm:justify-between flex-col sm:flex-row gap-4 mb-4">
                    <TabsList>
                        <TabsTrigger value="medical">Medis</TabsTrigger>
                        <TabsTrigger value="grooming">Grooming</TabsTrigger>
                        <TabsTrigger value="addon">Add-ons</TabsTrigger>
                    </TabsList>
                    <div className="relative max-w-sm w-full">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Cari layanan..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                </div>

                {['medical', 'grooming', 'addon'].map(tab => (
                    <TabsContent key={tab} value={tab} className="mt-0">
                        <Card>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nama Layanan</TableHead>
                                            <TableHead>Deskripsi</TableHead>
                                            <TableHead>Durasi (Menit)</TableHead>
                                            <TableHead>Biaya Modal</TableHead>
                                            <TableHead>Harga Jual</TableHead>
                                            <TableHead className="text-right">Aksi</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredServices.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                    Belum ada layanan di kategori ini.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredServices.map((service) => (
                                                <TableRow key={service.id}>
                                                    <TableCell className="font-medium">{service.name}</TableCell>
                                                    <TableCell className="text-muted-foreground text-sm">{service.description || '-'}</TableCell>
                                                    <TableCell>{service.duration ? `${service.duration} m` : '-'}</TableCell>
                                                    <TableCell>Rp {(service.capitalPrice || 0).toLocaleString('id-ID')}</TableCell>
                                                    <TableCell>Rp {service.price.toLocaleString('id-ID')}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button variant="ghost" size="icon" onClick={() => handleOpenForm(service)}>
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                                onClick={() => { setDeleteId(service.id); setIsDeleteDialogOpen(true); }}
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
                    </TabsContent>
                ))}
            </Tabs>

            {/* Form Dialog/Modal Overlay */}
            {isFormOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md animate-in fade-in zoom-in duration-200">
                        <CardHeader>
                            <CardTitle>{editingId ? 'Edit Layanan' : 'Tambah Layanan Baru'}</CardTitle>
                            <CardDescription>Isi detail layanan di bawah ini.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Nama Layanan</Label>
                                    <Input
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Contoh: Full Grooming Small"
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Biaya Modal (Rp)</Label>
                                        <Input
                                            type="number"
                                            value={formData.capitalPrice}
                                            onChange={e => setFormData({ ...formData, capitalPrice: e.target.value })}
                                            placeholder="0"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Harga Jual (Rp)</Label>
                                        <Input
                                            type="number"
                                            value={formData.price}
                                            onChange={e => setFormData({ ...formData, price: e.target.value })}
                                            placeholder="0"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Durasi (Menit)</Label>
                                        <Input
                                            type="number"
                                            value={formData.duration}
                                            onChange={e => setFormData({ ...formData, duration: e.target.value })}
                                            placeholder="Opsional"
                                        />
                                    </div>
                                </div>
                                <Label>Deskripsi</Label>
                                <Input
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Keterangan singkat..."
                                />
                                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                                    <div className="col-span-2">
                                        <Label className="text-indigo-600 font-semibold">{formData.category === 'medical' ? 'Fee Dokter' : 'Fee Groomer'}</Label>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Tipe Komisi</Label>
                                        <select
                                            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            value={formData.commissionType || 'fixed'}
                                            onChange={e => setFormData({ ...formData, commissionType: e.target.value })}
                                        >
                                            <option value="fixed">Nominal (Rp)</option>
                                            <option value="percentage">Persentase (%)</option>
                                        </select>
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

                                {formData.category === 'medical' && (
                                    <div className="grid grid-cols-2 gap-4 pt-2 border-t mt-2">
                                        <div className="col-span-2">
                                            <Label className="text-emerald-600 font-semibold">Fee Paramedis</Label>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Tipe Komisi</Label>
                                            <select
                                                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                value={formData.paramedicCommissionType || 'fixed'}
                                                onChange={e => setFormData({ ...formData, paramedicCommissionType: e.target.value })}
                                            >
                                                <option value="fixed">Nominal (Rp)</option>
                                                <option value="percentage">Persentase (%)</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Nilai Komisi</Label>
                                            <Input
                                                type="number"
                                                value={formData.paramedicCommissionValue}
                                                onChange={e => setFormData({ ...formData, paramedicCommissionValue: e.target.value })}
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="pt-2 flex gap-2 justify-end">
                                    <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Batal</Button>
                                    <Button type="submit">{editingId ? 'Simpan Perubahan' : 'Tambah'}</Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            )
            }

            <ConfirmDialog
                isOpen={isDeleteDialogOpen}
                onClose={() => setIsDeleteDialogOpen(false)}
                onConfirm={confirmDelete}
                title="Hapus Layanan"
                description="Layanan yang dihapus tidak dapat dikembalikan."
                confirmText="Hapus"
                variant="destructive"
            />
        </div >
    );
};

export default Services;
