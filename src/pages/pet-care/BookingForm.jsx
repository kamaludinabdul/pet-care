import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePOS } from '../../context/POSContext';
import { useStores } from '../../context/StoresContext';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, addDoc, doc, updateDoc, getDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../components/ui/card';
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group';
import { Textarea } from '../../components/ui/textarea';
import { CalendarIcon, ArrowLeft } from 'lucide-react';
import { sendBookingNotification } from '../../services/telegram';

const BookingForm = () => {
    const { id } = useParams();
    const isEdit = !!id;
    const navigate = useNavigate();
    const { user } = useAuth();
    const { currentStore } = useStores();
    const { customers } = usePOS();


    // Local State
    const [loading, setLoading] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [customerPets, setCustomerPets] = useState([]);
    const [selectedPet, setSelectedPet] = useState('');
    const [serviceType, setServiceType] = useState('grooming');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [startTime, setStartTime] = useState('09:00');
    const [endDate, setEndDate] = useState('');
    const [notes, setNotes] = useState('');
    const [rooms, setRooms] = useState([]);
    const [selectedRoom, setSelectedRoom] = useState('');
    const [groomingServices, setGroomingServices] = useState([]);
    const [selectedServiceId, setSelectedServiceId] = useState('');

    // Anamnesis State
    const [anamnesis, setAnamnesis] = useState([]);

    const SYMPTOMS = [
        'Muntah', 'Diare', 'Tidak Mau Makan', 'Lemas', 'Batuk', 'Pilek', 'Gatal / Masalah Kulit', 'Lainnya'
    ];

    const storeId = user?.storeId;

    // Fetch rooms if hotel
    useEffect(() => {
        const fetchRooms = async () => {
            if (!storeId) return;
            const q = query(collection(db, 'rooms'), where('storeId', '==', storeId));
            const snap = await getDocs(q);
            setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        };
        fetchRooms();
    }, [storeId]);

    // Fetch Grooming Services
    useEffect(() => {
        const fetchServices = async () => {
            if (!storeId) return;
            try {
                const q = query(collection(db, 'services'), where('storeId', '==', storeId), where('category', '==', 'grooming'));
                const snap = await getDocs(q);
                setGroomingServices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (err) {
                console.error("BookingForm.jsx: Error fetching services:", err);
            }
        };
        fetchServices();
    }, [storeId]);


    // Fetch Booking if Edit
    useEffect(() => {
        const fetchBooking = async () => {
            if (isEdit && id) {
                setLoading(true);
                try {
                    const docRef = doc(db, 'bookings', id);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setSelectedCustomer(data.ownerId);
                        setSelectedPet(data.petId);
                        setServiceType(data.serviceType);
                        setStartDate(data.startDate);
                        setStartTime(data.startTime);
                        setEndDate(data.endDate || '');
                        setNotes(data.notes || '');
                        setSelectedRoom(data.roomId || '');
                        setSelectedRoom(data.roomId || '');
                        setSelectedServiceId(data.serviceId || '');
                        setAnamnesis(data.anamnesis || []);
                    }
                } catch (error) {
                    console.error("Error fetching booking:", error);
                } finally {
                    setLoading(false);
                }
            }
        };
        fetchBooking();
    }, [isEdit, id]);

    // Fetch Pets when Customer Selects
    useEffect(() => {
        const fetchPets = async () => {
            if (selectedCustomer) {
                const q = query(collection(db, 'pets'), where('ownerId', '==', selectedCustomer));
                const snap = await getDocs(q);
                setCustomerPets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } else {
                setCustomerPets([]);
            }
        };
        fetchPets();
    }, [selectedCustomer]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        if (!selectedCustomer || !selectedPet) {
            alert("Mohon pilih Pelanggan dan Hewan Peliharaan terlebih dahulu.");
            setLoading(false);
            return;
        }

        if (serviceType === 'grooming' && !selectedServiceId) {
            alert("Mohon pilih Layanan Grooming.");
            setLoading(false);
            return;
        }

        try {
            const customer = customers.find(c => c.id === selectedCustomer);
            const pet = customerPets.find(p => p.id === selectedPet);
            const room = rooms.find(r => r.id === selectedRoom);
            const service = groomingServices.find(s => s.id === selectedServiceId);

            // Calculate Price
            let unitPrice = 0;
            let totalPrice = 0;

            if (serviceType === 'hotel' && room) {
                unitPrice = Number(room.price) || 0;
                if (startDate && endDate) {
                    const start = new Date(startDate);
                    const end = new Date(endDate);
                    const diffTime = Math.abs(end - start);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1; // Minimum 1 night
                    totalPrice = unitPrice * diffDays;
                } else {
                    totalPrice = unitPrice;
                }
            } else if (serviceType === 'grooming' && service) {
                unitPrice = Number(service.price) || 0;
                totalPrice = unitPrice;
            }

            const bookingData = {
                storeId,
                ownerId: selectedCustomer,
                ownerName: customer?.name || 'Unknown',
                petId: selectedPet,
                petName: pet?.name || 'Unknown',
                petType: pet?.type || 'Dog',
                serviceType,
                startDate,
                startTime,
                endDate: serviceType === 'hotel' ? endDate : null,
                roomId: serviceType === 'hotel' ? selectedRoom : null,
                roomName: serviceType === 'hotel' ? room?.name : null,
                serviceId: serviceType === 'grooming' ? selectedServiceId : null,
                serviceName: serviceType === 'grooming' ? service?.name : null,
                unitPrice, // Save Unit Price
                totalPrice, // Save Total Price
                notes,
                anamnesis: serviceType === 'clinic' ? anamnesis : [], // Save Anamnesis
                status: isEdit ? undefined : (serviceType === 'grooming' ? 'pending' : 'confirmed'),
                updatedAt: serverTimestamp(),
            };

            if (!isEdit) {
                bookingData.createdAt = serverTimestamp();
                const docRef = await addDoc(collection(db, 'bookings'), bookingData);

                // Update Room Status if Hotel
                if (serviceType === 'hotel' && selectedRoom) {
                    await updateDoc(doc(db, 'rooms', selectedRoom), { status: 'occupied', currentOccupantId: docRef.id });
                }

                // Send Telegram Notification
                await sendBookingNotification(
                    { id: docRef.id, ...bookingData },
                    currentStore,
                    customer,
                    pet
                );

            } else {
                await updateDoc(doc(db, 'bookings', id), bookingData);
            }

            navigate('/pet-care/bookings');
        } catch (error) {
            console.error("Error saving booking:", error);
            alert("Gagal menyimpan booking.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-4">
            <Button variant="ghost" className="mb-4" onClick={() => navigate('/pet-care/bookings')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Kembali
            </Button>

            <Card>
                <CardHeader>
                    <CardTitle>{isEdit ? 'Edit Reservasi' : 'Buat Reservasi Baru'}</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">

                        <div className="space-y-2">
                            <Label>Pelanggan</Label>
                            <Select value={selectedCustomer} onValueChange={setSelectedCustomer} disabled={isEdit}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih Pelanggan" />
                                </SelectTrigger>
                                <SelectContent>
                                    {customers.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.name} - {c.phone}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Hewan Peliharaan</Label>
                            <Select value={selectedPet} onValueChange={setSelectedPet} disabled={!selectedCustomer}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih Hewan" />
                                </SelectTrigger>
                                <SelectContent>
                                    {customerPets.map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.name} ({p.type})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Jenis Layanan</Label>
                            <RadioGroup value={serviceType} onValueChange={setServiceType} className="flex gap-4">
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="grooming" id="grooming" />
                                    <Label htmlFor="grooming">Grooming</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="hotel" id="hotel" />
                                    <Label htmlFor="hotel">Pet Hotel</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="clinic" id="clinic" />
                                    <Label htmlFor="clinic">Klinik / Dokter</Label>
                                </div>
                            </RadioGroup>
                        </div>

                        {serviceType === 'clinic' && (
                            <div className="space-y-3 p-4 bg-red-50 border border-red-100 rounded-lg">
                                <Label className="text-red-800 font-semibold">Anamnesa / Keluhan Awal</Label>
                                <div className="grid grid-cols-2 gap-3">
                                    {SYMPTOMS.map(symptom => (
                                        <div key={symptom} className="flex items-center space-x-2">
                                            <input
                                                type="checkbox"
                                                id={`sym-${symptom}`}
                                                className="rounded border-red-300 text-red-600 focus:ring-red-500"
                                                checked={anamnesis.includes(symptom)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setAnamnesis(prev => [...prev, symptom]);
                                                    } else {
                                                        setAnamnesis(prev => prev.filter(s => s !== symptom));
                                                    }
                                                }}
                                            />
                                            <Label htmlFor={`sym-${symptom}`} className="cursor-pointer text-slate-700 font-normal">
                                                {symptom}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {serviceType === 'grooming' && (
                            <div className="space-y-2">
                                <Label>Pilih Layanan Grooming <span className="text-red-500">*</span></Label>
                                <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih Layanan..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {groomingServices.map(s => (
                                            <SelectItem key={s.id} value={s.id}>
                                                {s.name} - Rp {s.price.toLocaleString()}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Tanggal Mulai</Label>
                                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Waktu</Label>
                                <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required />
                            </div>
                        </div>

                        {serviceType === 'hotel' && (
                            <>
                                <div className="space-y-2">
                                    <Label>Tanggal Selesai (Check-out)</Label>
                                    <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
                                </div>
                                <div className="space-y-2">
                                    <Label>Pilih Kandang / Ruangan</Label>
                                    <Select value={selectedRoom} onValueChange={setSelectedRoom}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Pilih Ruangan" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {rooms.filter(r => r.status === 'available' || r.id === selectedRoom).map(r => (
                                                <SelectItem key={r.id} value={r.id}>
                                                    {r.name} ({r.type}) - Rp {r.price.toLocaleString()}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </>
                        )}

                        <div className="space-y-2">
                            <Label>Catatan</Label>
                            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Catatan khusus..." />
                        </div>

                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? 'Menyimpan...' : (isEdit ? 'Simpan Perubahan' : 'Buat Reservasi')}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default BookingForm;
