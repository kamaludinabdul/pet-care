import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
// Using a simple search input within the list for now or we will build a custom selector
// Let's stick to a simple filtered list logic inside the modal or a dropdown
import { Check, ChevronsUpDown } from "lucide-react"
// Assuming standard shadcn paths if they exist, otherwise I will implement a simpler CustomSelect
// Let's assume standard select first but with search it needs Command.
// I will implement a "MedicineSelector" component inline or separate if complex.
// For now, I'll fetch medicines and use a standard Select if the list is small, or a custom search div.
// Given the requirements, a custom "Search & Add" row is best.
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { collection, addDoc, getDocs, query, where, Timestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { usePOS } from '../../context/POSContext';
import { ChevronLeft, Save, Plus, Trash2, User, Info } from 'lucide-react';

const MedicalRecordForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const bookingId = searchParams.get('bookingId');
    const paramPetId = searchParams.get('petId');
    const paramOwnerId = searchParams.get('ownerId');
    const { user } = useAuth();
    const { customers } = usePOS();
    const [loading, setLoading] = useState(false);
    const [pets, setPets] = useState([]);
    const [availableMedicines, setAvailableMedicines] = useState([]);
    const [availableServices, setAvailableServices] = useState([]);
    const [staffList, setStaffList] = useState([]); // Store all staff

    const [formData, setFormData] = useState({
        petId: '',
        petName: '',
        ownerName: '',
        date: new Date().toISOString().split('T')[0],
        symptoms: '',
        diagnosis: '',
        treatment: '',
        notes: '',
        nextVisit: '',
        doctorId: user?.uid || '', // Default to current user
        paramedicId: '', // Optional
    });

    useEffect(() => {
        const fetchInitialData = async () => {
            if (!user?.storeId) return;
            // Fetch pets
            const qPets = query(collection(db, 'pets'), where('storeId', '==', user.storeId));

            // Fetch Medicines
            const qMeds = query(collection(db, 'products'), where('storeId', '==', user.storeId), where('type', '==', 'medicine'));

            // Fetch Medical Services
            const qServices = query(collection(db, 'services'), where('storeId', '==', user.storeId), where('category', '==', 'medical'));

            // Fetch Staff
            const qStaff = query(collection(db, 'users'), where('storeId', '==', user.storeId));

            const [snapPets, snapMeds, snapServices, snapStaff] = await Promise.all([
                getDocs(qPets),
                getDocs(qMeds),
                getDocs(qServices),
                getDocs(qStaff)
            ]);

            setPets(snapPets.docs.map(d => ({ id: d.id, ...d.data() })));
            setAvailableMedicines(snapMeds.docs.map(d => ({ id: d.id, ...d.data() })));
            setAvailableServices(snapServices.docs.map(d => ({ id: d.id, ...d.data() })));
            setStaffList(snapStaff.docs.map(d => ({ id: d.id, ...d.data() })));

            // Pre-fill from URL params
            if (paramPetId && snapPets.size > 0) {
                const pet = snapPets.docs.find(d => d.id === paramPetId)?.data();
                const owner = customers.find(c => c.id === paramOwnerId); // Assuming customers already loaded via Context likely
                // Note: customers context might not be ready instantly if relying on it. 
                // But handlePetChange logic can be reused or set directly.
                if (pet) {
                    setFormData(prev => ({
                        ...prev,
                        petId: paramPetId,
                        petName: pet.name,
                        ownerName: owner?.name || pet.ownerName || ''
                    }));
                }
            }
        };
        fetchInitialData();
    }, [user?.storeId, paramPetId, customers, paramOwnerId]);

    // Fetch existing record if in Edit mode
    useEffect(() => {
        const fetchRecord = async () => {
            if (!id) return;
            try {
                const docRef = doc(db, 'medical_records', id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setFormData({
                        petId: data.petId || '',
                        petName: data.petName || '',
                        ownerName: data.ownerName || '',
                        date: data.date ? data.date.split('T')[0] : new Date().toISOString().split('T')[0],
                        symptoms: data.symptoms || '',
                        diagnosis: data.diagnosis || '',
                        treatment: data.treatment || '',
                        notes: data.notes || '',
                        nextVisit: data.nextVisit ? data.nextVisit.split('T')[0] : '', // Handle optional
                        doctorId: data.doctorId || '',
                        paramedicId: data.paramedicId || '',
                    });

                    if (data.services) {
                        setSelectedServices(data.services.map((s, i) => ({ ...s, id: Date.now() + i })));
                    }
                    if (data.prescriptions) {
                        setPrescriptions(data.prescriptions.map((p, i) => ({ ...p, id: Date.now() + i + 100 })));
                    }
                }
            } catch (err) {
                console.error("Error fetching record:", err);
            }
        };
        fetchRecord();
    }, [id]);

    const handlePetChange = (petId) => {
        const pet = pets.find(p => p.id === petId);
        const owner = customers.find(c => c.id === pet?.ownerId);

        setFormData(prev => ({
            ...prev,
            petId,
            petName: pet?.name || '',
            ownerName: owner?.name || pet?.ownerName || ''
        }));
    };

    // Generic Services Logic
    const [selectedServices, setSelectedServices] = useState([]);

    const handleAddService = () => {
        setSelectedServices([...selectedServices, { name: '', price: 0, capitalPrice: 0, serviceId: '', id: Date.now(), discount: 0, fee: 0, feeParamedic: 0, maxDiscount: 0 }]);
    };

    const handleServiceSelect = (index, serviceId) => {
        const service = availableServices.find(s => s.id === serviceId);
        if (!service) return;

        // Calculate Doctor Fee
        let fee = 0;
        if (service.commission) {
            if (service.commission.type === 'percentage') {
                fee = (service.price * (service.commission.value || 0)) / 100;
            } else {
                fee = service.commission.value || 0;
            }
        }

        // Calculate Paramedic Fee
        let feeParamedic = 0;
        if (service.paramedicCommission) {
            if (service.paramedicCommission.type === 'percentage') {
                feeParamedic = (service.price * (service.paramedicCommission.value || 0)) / 100;
            } else {
                feeParamedic = service.paramedicCommission.value || 0;
            }
        }

        const newItems = [...selectedServices];
        newItems[index] = {
            ...newItems[index],
            name: service.name,
            price: service.price,
            capitalPrice: service.capitalPrice || 0,
            serviceId: service.id,
            fee: fee,
            feeParamedic: feeParamedic,
            maxDiscount: fee + feeParamedic, // Discount cap could optionally include both fees? Or just doctor fee? Usually cap is to prevent loss. Let's start with just fee cap logic or loose it for now.
            discount: 0
        };

        // Re-evaluate discount cap: Usually you don't want discount > (Price - Capital). 
        // But here we used 'fee' as cap in previous code. 
        // Let's stick to safe defaults. using `fee` as variable for doctor fee.

        setSelectedServices(newItems);
    };

    const handleUpdateService = (index, field, value) => {
        const newItems = [...selectedServices];
        const item = newItems[index];

        if (field === 'discount') {
            let val = Number(value);
            if (val > item.maxDiscount) {
                // Prevent > Fee
                val = item.maxDiscount;
            }
            if (val < 0) val = 0;
            newItems[index] = { ...item, discount: val };
        } else {
            newItems[index] = { ...item, [field]: value };
        }
        setSelectedServices(newItems);
    };

    const handleRemoveService = (index) => {
        const newItems = [...selectedServices];
        newItems.splice(index, 1);
        setSelectedServices(newItems);
    };

    // Prescription Logic
    const [prescriptions, setPrescriptions] = useState([]);

    const handleAddPrescription = () => {
        setPrescriptions([...prescriptions, { name: '', dose: '', qty: 1, price: 0, capitalPrice: 0, medicineId: '', id: Date.now(), discount: 0, fee: 0, maxDiscount: 0 }]);
    };

    const handleMedicineSelect = (index, medicineId) => {
        const medicine = availableMedicines.find(m => m.id === medicineId);
        if (!medicine) return;

        // Calculate Fee (Optional for medicines)
        let fee = 0;
        if (medicine.commission) {
            if (medicine.commission.type === 'percentage') {
                fee = (medicine.price * (medicine.commission.value || 0)) / 100;
            } else {
                fee = medicine.commission.value || 0;
            }
        }

        const newItems = [...prescriptions];
        newItems[index] = {
            ...newItems[index],
            name: medicine.name,
            price: medicine.price,
            capitalPrice: medicine.capitalPrice || 0,
            stock: medicine.stock,
            medicineId: medicine.id, // Link to master data
            fee: fee,
            maxDiscount: fee,
            discount: 0
        };
        setPrescriptions(newItems);
    };

    const handleUpdatePrescription = (index, field, value) => {
        const newItems = [...prescriptions];
        const item = newItems[index];

        if (field === 'discount') {
            let val = Number(value);
            // Provide feedback if attempting to exceed fee
            // We enforce hard limit immediately for simplicity
            if (val > item.maxDiscount && item.maxDiscount > 0) {
                val = item.maxDiscount;
            } else if (item.maxDiscount === 0 && val > 0) {
                // No fee means no discount allowed based on rule "discount <= fee"
                val = 0;
            }
            if (val < 0) val = 0;
            newItems[index] = { ...item, discount: val };
        } else {
            newItems[index] = { ...item, [field]: value };
        }
        setPrescriptions(newItems);
    };

    const handleRemovePrescription = (index) => {
        const newItems = [...prescriptions];
        newItems.splice(index, 1);
        setPrescriptions(newItems);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const doctor = staffList.find(s => s.id === formData.doctorId);
        const doctorName = doctor ? (doctor.name || doctor.email) : 'Unknown Doctor';

        try {
            const payload = {
                ...formData,
                doctorName: doctorName,
                storeId: user.storeId,
                createdBy: user?.uid || 'unknown',
                // Only set createdAt for new records or preserve? 
                // Firestore merges on updateDoc, but here we passed full payload.
                // For update, we might want to exclude createdAt if we want to keep original.
                // But simpler to just pass it or conditionally add it.
                date: new Date(formData.date).toISOString(),
                services: selectedServices.map(s => ({
                    name: s.name,
                    price: Number(s.price),
                    capitalPrice: Number(s.capitalPrice || 0),
                    serviceId: s.serviceId || null,
                    fee: Number(s.fee || 0),
                    feeParamedic: Number(s.feeParamedic || 0),
                    discount: Number(s.discount || 0)
                })),
                prescriptions: prescriptions.map(p => ({
                    name: p.name,
                    dose: p.dose,
                    qty: Number(p.qty),
                    price: Number(p.price),
                    capitalPrice: Number(p.capitalPrice || 0),
                    fee: Number(p.fee || 0),
                    discount: Number(p.discount || 0)
                }))
            };

            if (!id) {
                payload.createdAt = Timestamp.now();
            }

            if (id) {
                await updateDoc(doc(db, 'medical_records', id), payload);
            } else {
                await addDoc(collection(db, 'medical_records'), payload);
            }

            // Update Booking Status if linked
            if (bookingId) {
                await updateDoc(doc(db, 'bookings', bookingId), { status: 'completed' });
            }

            navigate('/pet-care/medical-records');
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
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">{id ? 'Edit Rekam Medis' : 'Catat Rekam Medis'}</h1>
                    <p className="text-slate-500">
                        Dokter: <span className="font-semibold text-indigo-600">{formData.doctorName}</span>
                    </p>
                </div>
            </div>

            <Card>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4 pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Hewan Peliharaan</Label>
                                {paramPetId ? (
                                    <Input
                                        value={`${formData.petName} (${formData.ownerName})`}
                                        disabled
                                        className="bg-slate-100 text-slate-700 font-medium"
                                    />
                                ) : (
                                    <Select
                                        value={formData.petId}
                                        onValueChange={handlePetChange}
                                        required
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Pilih Hewan" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {pets.map(pet => {
                                                const owner = customers.find(c => c.id === pet.ownerId);
                                                const ownerName = owner?.name || pet.ownerName || 'Tanpa Pemilik';
                                                return (
                                                    <SelectItem key={pet.id} value={pet.id}>
                                                        {pet.name} - {pet.medicalRecordNumber || 'No RM'} ({ownerName})
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                )}
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

                        {/* Staff Assignment */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-4">
                            <div className="space-y-2">
                                <Label className="text-indigo-600">Dokter Hewan</Label>
                                <Select
                                    value={formData.doctorId}
                                    onValueChange={val => setFormData({ ...formData, doctorId: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih Dokter" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {staffList.filter(s => s.role === 'dokter' || s.role === 'admin' || s.role === 'super_admin').map(staff => (
                                            <SelectItem key={staff.id} value={staff.id}>{staff.name || staff.email}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-emerald-600">Paramedis (Opsional)</Label>
                                <Select
                                    value={formData.paramedicId}
                                    onValueChange={val => setFormData({ ...formData, paramedicId: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih Paramedis" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Tidak Ada</SelectItem>
                                        {staffList.filter(s => s.role === 'paramedis').map(staff => (
                                            <SelectItem key={staff.id} value={staff.id}>{staff.name || staff.email} ({staff.role})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
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
                                placeholder="Tindakan medis yang dilakukan..."
                                value={formData.treatment}
                                onChange={e => setFormData({ ...formData, treatment: e.target.value })}
                                className="h-24"
                                required
                            />
                        </div>

                        {/* Medical Services Section */}
                        <div className="space-y-4 border rounded-lg p-4 bg-indigo-50/50">
                            <div className="flex justify-between items-center">
                                <Label className="text-base font-semibold text-indigo-900">Tindakan / Layanan Medis (Rontgen, USG, dll)</Label>
                                <Button type="button" variant="outline" size="sm" onClick={handleAddService} className="border-indigo-200 hover:bg-indigo-100 text-indigo-700">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Tambah Layanan
                                </Button>
                            </div>

                            {selectedServices.length === 0 && (
                                <p className="text-sm text-indigo-400 italic text-center py-2">Belum ada tindakan medis yang dipilih.</p>
                            )}

                            {selectedServices.map((item, idx) => (
                                <div key={item.id} className="grid grid-cols-12 gap-2 items-start text-sm">
                                    <div className="col-span-12 md:col-span-5">
                                        <Select
                                            value={item.serviceId}
                                            onValueChange={(val) => handleServiceSelect(idx, val)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pilih Layanan" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableServices.map(s => (
                                                    <SelectItem key={s.id} value={s.id}>
                                                        {s.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="col-span-5 md:col-span-3">
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                placeholder="Harga"
                                                value={item.price}
                                                readOnly={true} // Locked
                                                className="bg-slate-50 text-slate-500"
                                            />
                                            {item.fee > 0 && <span className="absolute right-2 top-2 text-[10px] text-green-600 font-medium">Fee: {item.fee.toLocaleString()}</span>}
                                        </div>
                                    </div>
                                    <div className="col-span-5 md:col-span-3">
                                        <Input
                                            type="number"
                                            placeholder="Diskon"
                                            value={item.discount > 0 ? item.discount : ''}
                                            onChange={(e) => handleUpdateService(idx, 'discount', e.target.value)}
                                            title={`Maksimal Diskon: ${item.maxDiscount}`}
                                        />
                                    </div>
                                    <div className="col-span-2 md:col-span-1 flex justify-end">
                                        <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveService(idx)} className="text-red-500 hover:text-red-700">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Prescription Section */}
                        <div className="space-y-4 border rounded-lg p-4 bg-slate-50">
                            <div className="flex justify-between items-center">
                                <Label className="text-base font-semibold text-slate-700">Resep Obat & Layanan Tambahan</Label>
                                <Button type="button" variant="outline" size="sm" onClick={handleAddPrescription}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Tambah Obat/Item
                                </Button>
                            </div>

                            {prescriptions.length === 0 && (
                                <p className="text-sm text-slate-500 italic text-center py-2">Belum ada resep obat.</p>
                            )}

                            {prescriptions.map((item, idx) => (
                                <div key={item.id} className="grid grid-cols-12 gap-2 items-start">
                                    <div className="col-span-12 md:col-span-4">
                                        <Select
                                            value={item.medicineId}
                                            onValueChange={(val) => handleMedicineSelect(idx, val)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pilih Obat" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableMedicines.map(m => (
                                                    <SelectItem key={m.id} value={m.id}>
                                                        {m.name} (Stok: {m.stock})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="col-span-6 md:col-span-3">
                                        <Input
                                            placeholder="Dosis / Catatan"
                                            value={item.dose}
                                            onChange={(e) => handleUpdatePrescription(idx, 'dose', e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-6 md:col-span-2">
                                        <Input
                                            type="number"
                                            placeholder="Qty"
                                            value={item.qty}
                                            onChange={(e) => handleUpdatePrescription(idx, 'qty', e.target.value)}
                                            required
                                            min="1"
                                        />
                                    </div>
                                    <div className="col-span-5 md:col-span-2">
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                placeholder="Harga"
                                                value={item.price}
                                                readOnly={true} // Locked
                                                className="bg-slate-50 text-slate-500"
                                            />
                                            {item.fee > 0 && <span className="absolute right-2 top-2 text-[10px] text-green-600 font-medium">Fee: {item.fee.toLocaleString()}</span>}
                                        </div>
                                    </div>
                                    <div className="col-span-5 md:col-span-1">
                                        <Input
                                            type="number"
                                            placeholder="Diskon"
                                            value={item.discount > 0 ? item.discount : ''}
                                            onChange={(e) => handleUpdatePrescription(idx, 'discount', e.target.value)}
                                            title={`Maksimal Diskon: ${item.maxDiscount}`}
                                        />
                                    </div>
                                    <div className="col-span-2 md:col-span-1 flex justify-end">
                                        <Button type="button" variant="ghost" size="icon" onClick={() => handleRemovePrescription(idx)} className="text-red-500 hover:text-red-700">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div> (truncated in my internal thought but will provide full block)
                                </div>
                            ))}
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
