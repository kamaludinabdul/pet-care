import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, doc, getDoc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { useNavigate, useParams } from 'react-router-dom';

const BookingForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    // We need customers to find pets, OR just fetch all pets.
    // Let's fetch pets directly.

    const [loading, setLoading] = useState(false);
    const [pets, setPets] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [services, setServices] = useState([]); // [NEW] Services List

    const storeId = user?.storeId;

    const [formData, setFormData] = useState({
        serviceType: 'grooming', // grooming, hotel
        petId: '',
        ownerId: '',
        roomId: '', // For hotel
        serviceId: '', // [NEW] For grooming/clinic
        startDate: new Date().toISOString().split('T')[0],
        startTime: '10:00',
        endDate: '', // For hotel
        notes: '',
        status: 'pending'
    });

    useEffect(() => {
        const fetchData = async () => {
            if (!storeId) return;

            // Fetch Pets
            const petsQ = query(collection(db, 'pets'), where('storeId', '==', storeId));
            const petsSnap = await getDocs(petsQ);
            setPets(petsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

            // Fetch Rooms
            const roomsQ = query(collection(db, 'rooms'), where('storeId', '==', storeId));
            const roomsSnap = await getDocs(roomsQ);
            setRooms(roomsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

            // [NEW] Fetch Services
            const servicesQ = query(
                collection(db, 'products'),
                where('storeId', '==', storeId),
                where('isPetService', '==', true)
            );
            const servicesSnap = await getDocs(servicesQ);
            setServices(servicesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        };
        fetchData();
    }, [storeId]);

    useEffect(() => {
        if (id) {
            const fetchBooking = async () => {
                setLoading(true);
                try {
                    const docSnap = await getDoc(doc(db, 'bookings', id));
                    if (docSnap.exists()) {
                        setFormData({ ...docSnap.data() });
                    }
                } catch (error) {
                    console.error("Error fetching booking:", error);
                } finally {
                    setLoading(false);
                }
            };
            fetchBooking();
        }
    }, [id]);

    const handlePetChange = (petId) => {
        const selectedPet = pets.find(p => p.id === petId);
        setFormData({
            ...formData,
            petId: petId,
            ownerId: selectedPet ? selectedPet.ownerId : ''
        });
    };

    // [NEW] Handle Service Change
    const handleServiceChange = (serviceId) => {
        // You might want to auto-fill price or notes based on service
        setFormData({ ...formData, serviceId: serviceId });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!storeId) return;

        if (!formData.petId) {
            alert("Mohon pilih hewan terlebih dahulu.");
            return;
        }

        if (formData.serviceType === 'hotel' && !formData.roomId) {
            alert("Mohon pilih kamar untuk layanan hotel.");
            return;
        }

        // [NEW] Validate service selection for non-hotel types
        if (formData.serviceType !== 'hotel' && !formData.serviceId) {
            alert("Mohon pilih jenis layanan.");
            return;
        }

        setLoading(true);
        try {
            // Check for Double Booking if Hotel
            if (formData.serviceType === 'hotel') {
                const bookingsRef = collection(db, 'bookings');
                // Query broadly for the room, then filter locally for date overlap to avoid complex indexes for now
                // Or use multiple queries. 
                // Simple Overlap Logic: (StartA <= EndB) and (EndA >= StartB)

                const q = query(
                    bookingsRef,
                    where('storeId', '==', storeId),
                    where('roomId', '==', formData.roomId),
                    where('status', 'in', ['confirmed', 'checked_in', 'pending']) // Don't check cancelled/completed? Maybe completed counts if user extends? usually completed means done.
                );

                const snapshot = await getDocs(q);
                const hasOverlap = snapshot.docs.some(doc => {
                    if (doc.id === id) return false; // Ignore self if editing
                    const b = doc.data();
                    const newStart = formData.startDate;
                    const newEnd = formData.endDate;
                    const existingStart = b.startDate;
                    const existingEnd = b.endDate || b.startDate; // Fallback if single day

                    return (newStart <= existingEnd && newEnd >= existingStart);
                });

                if (hasOverlap) {
                    alert("Kamar ini sudah terisi pada tanggal yang dipilih. Mohon pilih kamar lain atau tanggal berbeda.");
                    setLoading(false);
                    return;
                }
            }

            // Find selected room name if any
            const selectedRoom = rooms.find(r => r.id === formData.roomId);
            // [NEW] Find selected service name if any
            const selectedService = services.find(s => s.id === formData.serviceId);

            const dataToSave = {
                ...formData,
                roomName: selectedRoom ? selectedRoom.name : '', // Cache room name
                serviceName: selectedService ? selectedService.name : '', // [NEW] Cache service name
                servicePrice: selectedService ? selectedService.price : 0, // [NEW] Cache price
                storeId,
                updatedAt: new Date().toISOString()
            };

            if (id) {
                await updateDoc(doc(db, 'bookings', id), dataToSave);
            } else {
                await addDoc(collection(db, 'bookings'), {
                    ...dataToSave,
                    createdAt: new Date().toISOString()
                });
            }
            navigate('/pet-care/bookings');
        } catch (error) {
            console.error("Error saving booking:", error);
        } finally {
            setLoading(false);
        }
    };

    // Filter services based on type (simple mapping for now)
    const filteredServices = services.filter(s => {
        if (formData.serviceType === 'grooming') return s.category === 'Grooming';
        if (formData.serviceType === 'clinic') return s.category === 'Klinik';
        return true; // Show all for others or default
    });

    return (
        <div className="p-4 max-w-2xl mx-auto">
            <Card className="border-indigo-100 shadow-lg">
                <CardHeader className="bg-indigo-50/50 border-b border-indigo-100 pb-4">
                    <CardTitle className="text-xl font-bold text-indigo-950">{id ? 'Edit Reservasi' : 'Buat Reservasi Baru'}</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <form onSubmit={handleSubmit} className="space-y-6">

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Tipe Layanan</Label>
                                <Select
                                    value={formData.serviceType}
                                    onValueChange={(val) => setFormData({ ...formData, serviceType: val, serviceId: '' })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="grooming">Grooming / Salon</SelectItem>
                                        <SelectItem value="hotel">Hotel / Penitipan</SelectItem>
                                        <SelectItem value="clinic">Klinik / Dokter</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select
                                    value={formData.status}
                                    onValueChange={(val) => setFormData({ ...formData, status: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pending">Menunggu (Pending)</SelectItem>
                                        <SelectItem value="confirmed">Konfirmasi</SelectItem>
                                        <SelectItem value="checked_in">Check-In</SelectItem>
                                        <SelectItem value="checked_out">Selesai / Check-Out</SelectItem>
                                        <SelectItem value="cancelled">Dibatalkan</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Pilih Hewan <span className="text-red-500">*</span></Label>
                            <Select
                                value={formData.petId}
                                onValueChange={handlePetChange}
                                disabled={pets.length === 0}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih hewan..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {pets.map(pet => (
                                        <SelectItem key={pet.id} value={pet.id}>
                                            {pet.name} ({pet.type})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {pets.length === 0 && (
                                <p className="text-xs text-muted-foreground">Belum ada hewan. Silakan daftarkan hewan terlebih dahulu.</p>
                            )}
                        </div>

                        {/* [NEW] Service Selection for Grooming/Clinic */}
                        {formData.serviceType !== 'hotel' && (
                            <div className="space-y-2">
                                <Label>Pilih Paket / Layanan <span className="text-red-500">*</span></Label>
                                <Select
                                    value={formData.serviceId}
                                    onValueChange={handleServiceChange}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih layanan..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {filteredServices.map(service => (
                                            <SelectItem key={service.id} value={service.id}>
                                                {service.name} - Rp {service.price.toLocaleString()}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {filteredServices.length === 0 && (
                                    <p className="text-xs text-red-500">Belum ada layanan untuk kategori ini. Tambahkan di menu 'Layanan & Harga'.</p>
                                )}
                            </div>
                        )}

                        {formData.serviceType === 'hotel' && (
                            <div className="space-y-2">
                                <Label>Pilih Kamar <span className="text-red-500">*</span></Label>
                                <Select
                                    value={formData.roomId}
                                    onValueChange={(val) => setFormData({ ...formData, roomId: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih kamar..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {rooms.map(room => (
                                            <SelectItem key={room.id} value={room.id}>
                                                {room.name} ({room.type} - Rp {room.price?.toLocaleString()})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {rooms.length === 0 && (
                                    <p className="text-xs text-red-500">Belum ada kamar dibuat. Mohon buat kamar di menu Kamar Hotel.</p>
                                )}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Tanggal {formData.serviceType === 'hotel' ? 'Masuk' : 'Booking'}</Label>
                                <Input
                                    type="date"
                                    value={formData.startDate}
                                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Jam</Label>
                                <Input
                                    type="time"
                                    value={formData.startTime}
                                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                />
                            </div>
                        </div>

                        {formData.serviceType === 'hotel' && (
                            <div className="space-y-2">
                                <Label>Tanggal Keluar (Check-Out)</Label>
                                <Input
                                    type="date"
                                    value={formData.endDate}
                                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                    required={formData.serviceType === 'hotel'}
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Catatan Tambahan</Label>
                            <Textarea
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="Contoh: Request model potongan, bawa makanan sendiri, dll."
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <Button type="button" variant="outline" onClick={() => navigate('/pet-care/bookings')}>
                                Batal
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? 'Menyimpan...' : 'Simpan Reservasi'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default BookingForm;
