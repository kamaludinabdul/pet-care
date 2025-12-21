import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, doc, getDoc, updateDoc, runTransaction } from 'firebase/firestore';
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
import { Syringe, CheckCircle2 } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';

const COMMON_VACCINES = {
    dog: ['Rabies', 'Parvovirus', 'Distemper', 'Adenovirus', 'Parainfluenza', 'Leptospirosis', 'Bordetella', 'Lyme', 'Canine Influenza'],
    cat: ['Rabies', 'Feline Panleukopenia (FVRCP)', 'Feline Calicivirus', 'Feline Rhinotracheitis', 'Feline Leukemia (FeLV)', 'Bordetella', 'Chlamydia'],
    rabbit: ['Myxomatosis', 'Rabbit Hemorrhagic Disease (RHD)'],
    other: ['Rabies']
};

const PetForm = () => {
    const { id } = useParams(); // If present, we are editing
    const navigate = useNavigate();
    const { customers } = useData();
    const { user } = useAuth(); // Get user from AuthContext
    const storeId = user?.storeId; // Simple storeId retrieval for Store Admin

    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        medicalRecordNumber: '', // New field
        type: 'dog', // dog, cat, etc.
        breed: '',
        gender: 'male',
        birthDate: '',
        color: '',
        weight: '',
        ownerId: '',
        notes: '',
        isNeutered: false,
        isVaccinated: false,
        vaccinations: [] // Array of { name, date, isHere }
    });

    // Owner Search State


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

    const handleVaccinationChange = (vaccineName, checked) => {
        setFormData(prev => {
            let newVaccinations = [...(prev.vaccinations || [])];
            if (checked) {
                // Add if not exists
                if (!newVaccinations.find(v => v.name === vaccineName)) {
                    newVaccinations.push({
                        name: vaccineName,
                        date: new Date().toISOString().split('T')[0],
                        isHere: false
                    });
                }
            } else {
                // Remove
                newVaccinations = newVaccinations.filter(v => v.name !== vaccineName);
            }
            return { ...prev, vaccinations: newVaccinations };
        });
    };

    const updateVaccinationDetail = (vaccineName, field, value) => {
        setFormData(prev => {
            const newVaccinations = (prev.vaccinations || []).map(v =>
                v.name === vaccineName ? { ...v, [field]: value } : v
            );
            return { ...prev, vaccinations: newVaccinations };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!storeId) return;

        setLoading(true);
        try {
            if (id) {
                const dataToSave = {
                    ...formData,
                    storeId,
                    updatedAt: new Date().toISOString()
                };
                await updateDoc(doc(db, 'pets', id), dataToSave);
            } else {
                // Generate RM Number using transaction
                await runTransaction(db, async (transaction) => {
                    const counterRef = doc(db, 'counters', `${storeId}_pet_counter`);
                    const counterDoc = await transaction.get(counterRef);

                    let newCount = 1;
                    if (counterDoc.exists()) {
                        newCount = counterDoc.data().count + 1;
                    }

                    // Format: RM-0001
                    const rmNumber = `RM-${String(newCount).padStart(4, '0')}`;

                    // Update counter
                    transaction.set(counterRef, { count: newCount }, { merge: true });

                    // Create Pet
                    const newPetRef = doc(collection(db, 'pets'));
                    transaction.set(newPetRef, {
                        ...formData,
                        medicalRecordNumber: rmNumber,
                        storeId,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
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
                                onValueChange={(val) => {
                                    const selectedCustomer = customers.find(c => c.id === val);
                                    setFormData({
                                        ...formData,
                                        ownerId: val,
                                        ownerName: selectedCustomer ? selectedCustomer.name : ''
                                    });
                                }}
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



                        {/* RM Number (Read Only) & Pet Basic Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="rm">No. Rekam Medis (Auto)</Label>
                                <Input
                                    id="rm"
                                    value={formData.medicalRecordNumber || 'Auto-generated'}
                                    disabled
                                    className="bg-slate-100 text-slate-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="name">Nama Hewan <span className="text-red-500">*</span></Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
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
                            <div className="space-y-2">
                                <Label htmlFor="breed">Ras (Breed)</Label>
                                <Input
                                    id="breed"
                                    value={formData.breed}
                                    onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
                                    placeholder="Contoh: Persia, Golden Retriever"
                                />
                            </div>
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

                        <div className="grid grid-cols-2 gap-4 border-t pt-4">
                            <div className="flex items-center justify-between space-x-2 border p-3 rounded-lg">
                                <Label htmlFor="isNeutered" className="flex flex-col space-y-1 cursor-pointer">
                                    <span className="font-medium">Sudah Steril?</span>
                                    <span className="font-normal text-xs text-muted-foreground">Apakah hewan sudah dikebiri/neutered?</span>
                                </Label>
                                <Switch
                                    id="isNeutered"
                                    checked={formData.isNeutered}
                                    onCheckedChange={(c) => setFormData({ ...formData, isNeutered: c })}
                                />
                            </div>
                            <div className="flex items-center justify-between space-x-2 border p-3 rounded-lg">
                                <Label htmlFor="isVaccinated" className="flex flex-col space-y-1 cursor-pointer">
                                    <span className="font-medium">Sudah Vaksin?</span>
                                    <span className="font-normal text-xs text-muted-foreground">Status vaksinasi umum</span>
                                </Label>
                                <Switch
                                    id="isVaccinated"
                                    checked={formData.isVaccinated}
                                    onCheckedChange={(c) => setFormData({ ...formData, isVaccinated: c })}
                                />
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

                        {/* Vaccination Section */}
                        <div className="space-y-4 pt-4 border-t">
                            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                <Syringe className="h-5 w-5 text-indigo-600" />
                                Riwayat Vaksinasi
                            </h3>

                            <div className="grid grid-cols-1 gap-3">
                                {(COMMON_VACCINES[formData.type] || COMMON_VACCINES.other).map((vaccine) => {
                                    const record = (formData.vaccinations || []).find(v => v.name === vaccine);
                                    const isChecked = !!record;

                                    return (
                                        <div key={vaccine} className={`p-3 rounded-lg border transition-all ${isChecked ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-white border-slate-200'}`}>
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3">
                                                    <Switch
                                                        checked={isChecked}
                                                        onCheckedChange={(checked) => handleVaccinationChange(vaccine, checked)}
                                                    />
                                                    <div>
                                                        <Label className="font-medium text-slate-900 cursor-pointer" onClick={() => handleVaccinationChange(vaccine, !isChecked)}>
                                                            {vaccine}
                                                        </Label>
                                                        {isChecked && record.isHere && (
                                                            <div className="flex items-center gap-1 mt-1 text-xs text-emerald-600 font-medium">
                                                                <CheckCircle2 className="h-3 w-3" />
                                                                Sertifikat tersedia di klinik
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {isChecked && (
                                                <div className="mt-3 pl-12 grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 fade-in duration-200">
                                                    <div className="space-y-1">
                                                        <Label className="text-xs text-slate-500">Tanggal Vaksin</Label>
                                                        <Input
                                                            type="date"
                                                            className="h-8 text-xs bg-white"
                                                            value={record.date}
                                                            onChange={(e) => updateVaccinationDetail(vaccine, 'date', e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="flex items-center pt-5">
                                                        <div className="flex items-center space-x-2">
                                                            <Switch
                                                                id={`here-${vaccine}`}
                                                                className="data-[state=checked]:bg-emerald-500"
                                                                checked={record.isHere}
                                                                onCheckedChange={(c) => updateVaccinationDetail(vaccine, 'isHere', c)}
                                                            />
                                                            <Label htmlFor={`here-${vaccine}`} className="text-xs cursor-pointer">Vaksin disini?</Label>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t">
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
        </div >
    );
};

export default PetForm;
