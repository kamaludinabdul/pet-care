import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { ChevronLeft, Save } from 'lucide-react';

const MedicalRecordForm = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [pets, setPets] = useState([]);

    const [formData, setFormData] = useState({
        petId: '',
        petName: '',
        ownerName: '',
        date: new Date().toISOString().split('T')[0],
        symptoms: '',
        diagnosis: '',
        treatment: '',
        notes: '',
        nextVisit: ''
    });

    useEffect(() => {
        const fetchPets = async () => {
            if (!user?.storeId) return;
            // Fetch pets for dropdown
            const q = query(collection(db, 'pets'), where('storeId', '==', user.storeId));
            const snap = await getDocs(q);
            setPets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        };
        fetchPets();
    }, [user?.storeId]);

    const handlePetChange = (petId) => {
        const pet = pets.find(p => p.id === petId);
        setFormData(prev => ({
            ...prev,
            petId,
            petName: pet?.name || '',
            ownerName: pet?.ownerName || ''
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await addDoc(collection(db, 'medical_records'), {
                ...formData,
                storeId: user.storeId,
                createdAt: Timestamp.now(),
                date: new Date(formData.date).toISOString() // Store as ISO string or timestamp
            });
            navigate('/medical-records');
        } catch (error) {
            console.error("Error saving record:", error);
            alert("Gagal menyimpan data.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Catat Rekam Medis</h1>
                    <p className="text-slate-500">Input hasil pemeriksaan kesehatan hewan.</p>
                </div>
            </div>

            <Card>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4 pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Hewan Peliharaan</Label>
                                <Select onValueChange={handlePetChange} required>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih Hewan" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {pets.map(pet => (
                                            <SelectItem key={pet.id} value={pet.id}>
                                                {pet.name} ({pet.ownerName})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Tanggal Pemeriksaan</Label>
                                <Input
                                    type="date"
                                    value={formData.date}
                                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Keluhan / Gejala (Symptoms)</Label>
                            <Textarea
                                placeholder="Contoh: Muntah, tidak mau makan, lemas..."
                                value={formData.symptoms}
                                onChange={e => setFormData({ ...formData, symptoms: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Diagnosa</Label>
                            <Input
                                placeholder="Contoh: Infeksi Pencernaan, Flu Kucing..."
                                value={formData.diagnosis}
                                onChange={e => setFormData({ ...formData, diagnosis: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Tindakan / Pengobatan (Treatment)</Label>
                            <Textarea
                                placeholder="Resep obat, tindakan suntik, dll..."
                                value={formData.treatment}
                                onChange={e => setFormData({ ...formData, treatment: e.target.value })}
                                className="h-24"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Kunjungan Berikutnya (Opsional)</Label>
                                <Input
                                    type="date"
                                    value={formData.nextVisit}
                                    onChange={e => setFormData({ ...formData, nextVisit: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Catatan Tambahan</Label>
                            <Textarea
                                value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            />
                        </div>

                    </CardContent>
                    <CardFooter className="flex justify-end gap-2 bg-slate-50 border-t p-4">
                        <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
                            Batal
                        </Button>
                        <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
                            <Save className="h-4 w-4 mr-2" />
                            {loading ? 'Menyimpan...' : 'Simpan Data'}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
};

export default MedicalRecordForm;
