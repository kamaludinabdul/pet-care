import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import { Plus, Search, Edit, Trash2, Scissors, Stethoscope } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import ConfirmDialog from '../../components/ConfirmDialog';
import { Badge } from '../../components/ui/badge';

const PetServices = () => {
    const { user } = useAuth();
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [currentService, setCurrentService] = useState(null);
    const [serviceToDelete, setServiceToDelete] = useState(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        category: 'Grooming',
        price: 0,
        duration: 60, // in minutes
    });

    const storeId = user?.storeId;

    useEffect(() => {
        fetchServices();
    }, [storeId]);

    const fetchServices = async () => {
        if (!storeId) return;
        setLoading(true);
        try {
            // Fetch products that are flagged as pet services
            const q = query(
                collection(db, 'products'),
                where('storeId', '==', storeId),
                where('isPetService', '==', true)
            );
            const querySnapshot = await getDocs(q);
            const serviceData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            serviceData.sort((a, b) => a.name.localeCompare(b.name));
            setServices(serviceData);
        } catch (error) {
            console.error("Error fetching services:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'price' || name === 'duration' ? parseFloat(value) : value
        }));
    };

    const handleSelectChange = (value) => {
        setFormData(prev => ({ ...prev, category: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!storeId) return;

        try {
            const serviceData = {
                ...formData,
                isPetService: true,
                stockType: 'Jasa',
                stock: 9999, // Infinite stock for services
                trackStock: false,
                storeId,
                updatedAt: new Date().toISOString()
            };

            if (currentService) {
                // Update
                const serviceRef = doc(db, 'products', currentService.id);
                await updateDoc(serviceRef, serviceData);
                setIsEditOpen(false);
            } else {
                // Create
                await addDoc(collection(db, 'products'), {
                    ...serviceData,
                    createdAt: new Date().toISOString()
                });
                setIsAddOpen(false);
            }
            fetchServices();
            resetForm();
        } catch (error) {
            console.error("Error saving service:", error);
        }
    };

    const handleEdit = (service) => {
        setCurrentService(service);
        setFormData({
            name: service.name,
            category: service.category,
            price: service.price,
            duration: service.duration || 60
        });
        setIsEditOpen(true);
    };

    const handleDelete = (service) => {
        setServiceToDelete(service);
        setIsDeleteOpen(true);
    };

    const confirmDelete = async () => {
        if (!serviceToDelete) return;
        try {
            await deleteDoc(doc(db, 'products', serviceToDelete.id));
            setServices(prev => prev.filter(s => s.id !== serviceToDelete.id));
            setIsDeleteOpen(false);
        } catch (error) {
            console.error("Error deleting service:", error);
        }
    };

    const resetForm = () => {
        setCurrentService(null);
        setFormData({
            name: '',
            category: 'Grooming',
            price: 0,
            duration: 60,
        });
    };

    const filteredServices = services.filter(service =>
        service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-4 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Layanan & Harga</h1>
                    <p className="text-muted-foreground">Atur daftar layanan (Grooming, Klinik, dll) dan harganya.</p>
                </div>
                <Button onClick={() => { resetForm(); setIsAddOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" />
                    Tambah Layanan
                </Button>
            </div>

            <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari layanan..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                    />
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nama Layanan</TableHead>
                                <TableHead>Kategori</TableHead>
                                <TableHead>Durasi (Est)</TableHead>
                                <TableHead>Harga</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8">Memuat data...</TableCell>
                                </TableRow>
                            ) : filteredServices.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        Belum ada data layanan.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredServices.map((service) => (
                                    <TableRow key={service.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <div className={`p-2 rounded-lg ${service.category === 'Klinik' ? 'bg-red-100 text-red-600' : 'bg-purple-100 text-purple-600'}`}>
                                                    {service.category === 'Klinik' ? <Stethoscope className="h-4 w-4" /> : <Scissors className="h-4 w-4" />}
                                                </div>
                                                {service.name}
                                            </div>
                                        </TableCell>
                                        <TableCell><Badge variant="outline">{service.category}</Badge></TableCell>
                                        <TableCell>{service.duration || '-'} Menit</TableCell>
                                        <TableCell>Rp {service.price.toLocaleString()}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(service)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(service)}>
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

            <Dialog open={isAddOpen || isEditOpen} onOpenChange={(open) => {
                if (!open) {
                    setIsAddOpen(false);
                    setIsEditOpen(false);
                    resetForm();
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{currentService ? 'Edit Layanan' : 'Tambah Layanan Baru'}</DialogTitle>
                        <DialogDescription>
                            Isi informasi layanan di bawah ini.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nama Layanan</Label>
                            <Input id="name" name="name" placeholder="Contoh: Basic Grooming Small" value={formData.name} onChange={handleInputChange} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="category">Kategori</Label>
                            <Select value={formData.category} onValueChange={handleSelectChange}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih kategori" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Grooming">Grooming</SelectItem>
                                    <SelectItem value="Klinik">Klinik</SelectItem>
                                    <SelectItem value="Penitipan">Penitipan (Add-on)</SelectItem>
                                    <SelectItem value="Lainnya">Lainnya</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="price">Harga</Label>
                                <Input id="price" name="price" type="number" min="0" value={formData.price} onChange={handleInputChange} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="duration">Durasi (Menit)</Label>
                                <Input id="duration" name="duration" type="number" min="0" value={formData.duration} onChange={handleInputChange} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="submit">{currentService ? 'Simpan Perubahan' : 'Buat Layanan'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                isOpen={isDeleteOpen}
                onClose={() => setIsDeleteOpen(false)}
                onConfirm={confirmDelete}
                title="Hapus Layanan"
                description={`Apakah Anda yakin ingin menghapus layanan "${serviceToDelete?.name}"?`}
                confirmText="Hapus"
                variant="destructive"
            />
        </div>
    );
};

export default PetServices;
