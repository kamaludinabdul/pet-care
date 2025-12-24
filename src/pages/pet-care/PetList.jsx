
import React, { useState, useEffect } from 'react';
import { db } from '../../firebase'; // Adjust path if needed
import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { usePOS } from '../../context/POSContext';
import { useAuth } from '../../context/AuthContext'; // Import useAuth
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import { Plus, Search, Edit, Trash2, User as UserIcon, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../../components/ConfirmDialog';
import { Badge } from '../../components/ui/badge';
import { formatAge } from '../../lib/utils';

const PetList = () => {
    const { user } = useAuth(); // Get user from AuthContext
    const { customers } = usePOS(); // Get stores/customers from DataContext
    const navigate = useNavigate();
    const [pets, setPets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [petToDelete, setPetToDelete] = useState(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    // Get active store ID
    // If user is super_admin, we might need a way to select store (not implemented here yet for PetList)
    // For now, if super_admin, we default to the first store or handle it later.
    // Ideally Super Admin uses the "Store Selector" in the top bar if available,
    // OR we just use basic logic:
    const storeId = user?.storeId;

    // Note: If super_admin wants to view pets, we probably need to pass selectedStoreId from DataContext
    // Let's get selectedStoreId from DataContext just in case it's exposed or we need to add it.
    // For now, since the error is for "Admin Toko", user.storeId is sufficient.

    useEffect(() => {
        const fetchPets = async () => {
            if (!storeId) return;
            setLoading(true);
            try {
                // Fetch Pets
                const petsQ = query(collection(db, 'pets'), where('storeId', '==', storeId));
                const petsSnapshot = await getDocs(petsQ);
                const petsData = petsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // Fetch Owners (Customers) to display names
                // We could fetch all customers from DataContext but that might be heavy if not loaded?
                // Actually customers ARE loaded in DataContext.
                // Let's use customers from DataContext!

                setPets(petsData);
            } catch (error) {
                console.error("Error fetching pets:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchPets();
    }, [storeId]);

    // const { customers } = usePOS(); // Already destructured above

    const getOwnerName = (ownerId) => {
        const customer = customers.find(c => c.id === ownerId);
        return customer ? customer.name : 'Unknown Owner';
    };

    const filteredPets = pets.filter(pet =>
        pet.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (pet.medicalRecordNumber && pet.medicalRecordNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        getOwnerName(pet.ownerId).toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleDelete = (pet) => {
        setPetToDelete(pet);
        setIsDeleteOpen(true);
    };

    const confirmDelete = async () => {
        if (!petToDelete) return;
        try {
            await deleteDoc(doc(db, 'pets', petToDelete.id));
            setPets(prev => prev.filter(p => p.id !== petToDelete.id));
            setIsDeleteOpen(false);
        } catch (error) {
            console.error("Error deleting pet:", error);
            // Handle error (maybe show toast)
        }
    };

    if (!storeId) return <div className="p-4">Please select a store first.</div>;

    return (
        <div className="p-4 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Daftar Hewan</h1>
                    <p className="text-muted-foreground">Kelola hewan peliharaan yang terdaftar.</p>
                </div>
                <Button onClick={() => navigate('/pet-care/pets/add')}>
                    <Plus className="mr-2 h-4 w-4" />
                    Tambah Hewan
                </Button>
            </div>

            <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari nama hewan atau pemilik..."
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
                                <TableHead>No. RM</TableHead>
                                <TableHead>Nama Hewan</TableHead>
                                <TableHead>Jenis/Ras</TableHead>
                                <TableHead>Pemilik</TableHead>
                                <TableHead>Kelamin</TableHead>
                                <TableHead>Detail</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8">Memuat...</TableCell>
                                </TableRow>
                            ) : filteredPets.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                        Belum ada data hewan.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredPets.map((pet) => (
                                    <TableRow key={pet.id}>
                                        <TableCell className="font-mono text-xs text-slate-500">
                                            {pet.medicalRecordNumber || '-'}
                                        </TableCell>
                                        <TableCell className="font-medium">{pet.name}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span>{pet.type}</span>
                                                <span className="text-xs text-muted-foreground">{pet.breed}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <UserIcon className="h-4 w-4 text-muted-foreground" />
                                                {getOwnerName(pet.ownerId)}
                                            </div>
                                        </TableCell>
                                        <TableCell>{pet.gender || '-'}</TableCell>
                                        <TableCell>
                                            <div className="space-y-1 text-xs">
                                                <div>Umur: {formatAge(pet.birthDate)}</div>
                                                <div>Berat: {pet.weight ? pet.weight + ' kg' : '-'}</div>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {pet.isNeutered && (
                                                        <Badge variant="outline" className="text-[10px] px-1 py-0 border-pink-200 text-pink-600 bg-pink-50">
                                                            Steril
                                                        </Badge>
                                                    )}
                                                    {pet.isVaccinated && (
                                                        <Badge variant="outline" className="text-[10px] px-1 py-0 border-sky-200 text-sky-600 bg-sky-50">
                                                            Vaksin
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Lihat Detail & Riwayat"
                                                    className="text-indigo-600 hover:text-indigo-700"
                                                    onClick={() => navigate(`/pet-care/patients/${pet.id}`)}
                                                >
                                                    <FileText className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => navigate(`/ pet - care / pets / edit / ${pet.id} `)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                    onClick={() => handleDelete(pet)}
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

            <ConfirmDialog
                isOpen={isDeleteOpen}
                onClose={() => setIsDeleteOpen(false)}
                onConfirm={confirmDelete}
                title="Hapus Hewan"
                description={`Apakah Anda yakin ingin menghapus "${petToDelete?.name}" ? Data yang dihapus tidak dapat dikembalikan.`}
                confirmText="Hapus"
                variant="destructive"
            />
        </div>
    );
};

export default PetList;
