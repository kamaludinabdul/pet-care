import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext'; // Import useAuth
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { useNavigate, useParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { calculateAge } from '../../lib/utils';

const PetForm = () => {
    const { id } = useParams(); // If present, we are editing
    const navigate = useNavigate();
    const { customers } = useData();
    const { user } = useAuth(); // Get user from AuthContext
    const storeId = user?.storeId; // Simple storeId retrieval for Store Admin

    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        type: 'dog', // dog, cat, etc.
        breed: '',
        gender: 'male',
        birthDate: '',
        color: '',
        weight: '',
        ownerId: '',
        notes: ''
    });

    // Owner Search State
    const [openOwnerSelect, setOpenOwnerSelect] = useState(false);

    // Helper to display age
    const ageParams = calculateAge(formData.birthDate);
    const ageDisplay = ageParams ? `${ageParams.years} Tahun ${ageParams.months} Bulan` : '';

    useEffect(() => {
        if (id) {
            // Fetch existing pet data
            const fetchPet = async () => {
                setLoading(true);
                try {
                    const docRef = doc(db, 'pets', id);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        setFormData({ ...docSnap.data() });
                    }
                } catch (error) {
                    console.error("Error fetching pet:", error);
                } finally {
                    setLoading(false);
                }
            };
            fetchPet();
        }
    }, [id]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!storeId) return;

        setLoading(true);
        try {
            const dataToSave = {
                ...formData,
                storeId,
                updatedAt: new Date().toISOString()
            };

            if (id) {
                await updateDoc(doc(db, 'pets', id), dataToSave);
            } else {
                await addDoc(collection(db, 'pets'), {
                    ...dataToSave,
                    createdAt: new Date().toISOString()
                });
            }
            navigate('/pet-care/pets');
        } catch (error) {
            console.error("Error saving pet:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 max-w-2xl mx-auto">
            <Card>
                <CardHeader>
                    <CardTitle>{id ? 'Edit Hewan' : 'Daftar Hewan Baru'}</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Owner Selection */}
                        <div className="space-y-2">
                            <Label>Pemilik (Pelanggan) <span className="text-red-500">*</span></Label>
                            <Select
                                value={formData.ownerId}
                                onValueChange={(val) => setFormData({ ...formData, ownerId: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih Pemilik..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {customers.map((customer) => (
                                        <SelectItem key={customer.id} value={customer.id}>
                                            {customer.name} {customer.phone && `(${customer.phone})`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Pet Basic Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nama Hewan <span className="text-red-500">*</span></Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="type">Jenis Hewan</Label>
                                <Select
                                    value={formData.type}
                                    onValueChange={(val) => setFormData({ ...formData, type: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="dog">Anjing</SelectItem>
                                        <SelectItem value="cat">Kucing</SelectItem>
                                        <SelectItem value="rabbit">Kelinci</SelectItem>
                                        <SelectItem value="bird">Burung</SelectItem>
                                        <SelectItem value="other">Lainnya</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="breed">Ras (Breed)</Label>
                                <Input
                                    id="breed"
                                    value={formData.breed}
                                    onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
                                    placeholder="Contoh: Persia, Golden Retriever"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="gender">Jenis Kelamin</Label>
                                <Select
                                    value={formData.gender}
                                    onValueChange={(val) => setFormData({ ...formData, gender: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="male">Jantan</SelectItem>
                                        <SelectItem value="female">Betina</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="birthDate">Tanggal Lahir</Label>
                                <Input
                                    id="birthDate"
                                    type="date"
                                    value={formData.birthDate}
                                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                                />
                                {ageDisplay && <p className="text-xs text-muted-foreground">Umur: {ageDisplay}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="color">Warna / Ciri</Label>
                                <Input
                                    id="color"
                                    value={formData.color}
                                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="weight">Berat (kg)</Label>
                                <Input
                                    id="weight"
                                    type="number"
                                    step="0.1"
                                    value={formData.weight}
                                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="notes">Catatan Medis / Alergi</Label>
                            <Textarea
                                id="notes"
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="Contoh: Alergi ayam, butuh obat khusus..."
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <Button type="button" variant="outline" onClick={() => navigate('/pet-care/pets')}>
                                Batal
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? 'Menyimpan...' : 'Simpan'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default PetForm;
