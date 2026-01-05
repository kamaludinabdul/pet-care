import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { usePOS } from '../../context/POSContext';
import { db } from '../../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { format, addDays } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const HotelBookingModal = ({ room, isOpen, onClose, onSuccess, storeId }) => {
    const { customers } = usePOS();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        customerId: '',
        petId: '',
        startDate: new Date().toISOString().split('T')[0],
        startTime: '14:00',
        endDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
        endTime: '12:00',
        notes: ''
    });

    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerPets, setCustomerPets] = useState([]);

    useEffect(() => {
        if (isOpen && room) {
            // Reset form when opening
            setFormData({
                customerId: '',
                petId: '',
                startDate: new Date().toISOString().split('T')[0],
                startTime: '14:00',
                endDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
                endTime: '12:00',
                notes: ''
            });
            setSelectedCustomer(null);
            setCustomerPets([]);
        }
    }, [isOpen, room]);

    // Handle customer selection
    const handleCustomerChange = (customerId) => {
        const customer = customers.find(c => c.id === customerId);
        setSelectedCustomer(customer);
        setFormData(prev => ({ ...prev, customerId, petId: '' }));

        if (customer && customer.pets) {
            setCustomerPets(customer.pets);
        } else {
            setCustomerPets([]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.customerId || !formData.petId || !formData.startDate || !formData.endDate) {
            toast.error('Mohon lengkapi data booking');
            return;
        }

        setLoading(true);
        try {
            const selectedPet = customerPets.find(p => p.id === formData.petId);

            const bookingData = {
                storeId,
                serviceType: 'hotel', // Force service type
                ownerId: formData.customerId,
                ownerName: selectedCustomer?.name || 'Unknown',
                ownerPhone: selectedCustomer?.phone || '',
                petId: formData.petId,
                petName: selectedPet?.name || 'Unknown Pet',
                startDate: formData.startDate,
                startTime: formData.startTime,
                endDate: formData.endDate,
                endTime: formData.endTime, // Typical hotel checkout time
                notes: formData.notes,
                roomId: room.id,
                roomName: room.name,
                status: 'checked_in', // Direct check-in
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            // 1. Create Booking
            const docRef = await addDoc(collection(db, 'bookings'), bookingData);

            // 2. Update Room Status
            await updateDoc(doc(db, 'rooms', room.id), {
                status: 'occupied',
                currentBookingId: docRef.id,
                lastUpdated: serverTimestamp()
            });

            toast.success('Check-in Berhasil!');
            onSuccess();
            onClose();
        } catch (error) {
            console.error("Error creating booking:", error);
            toast.error('Gagal melakukan check-in');
        } finally {
            setLoading(false);
        }
    };

    if (!room) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Quick Check-in: {room.name}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Pilih Customer</Label>
                        <Select
                            value={formData.customerId}
                            onValueChange={handleCustomerChange}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Cari Customer..." />
                            </SelectTrigger>
                            <SelectContent>
                                {customers.map(c => (
                                    <SelectItem key={c.id} value={c.id}>
                                        {c.name} {c.phone ? `(${c.phone})` : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Pilih Hewan</Label>
                        <Select
                            value={formData.petId}
                            onValueChange={(val) => setFormData({ ...formData, petId: val })}
                            disabled={!formData.customerId}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={!formData.customerId ? "Pilih customer dulu" : "Pilih Hewan..."} />
                            </SelectTrigger>
                            <SelectContent>
                                {customerPets.map(p => (
                                    <SelectItem key={p.id} value={p.id}>
                                        {p.name} ({p.type || 'Pet'})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Check-In Date</Label>
                            <Input
                                type="date"
                                value={formData.startDate}
                                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Check-Out Date</Label>
                            <Input
                                type="date"
                                value={formData.endDate}
                                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                min={formData.startDate}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Catatan (Opsional)</Label>
                        <Textarea
                            placeholder="Instruksi khusus, alergi, dll..."
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        />
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Batal
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Check-In Sekarang
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default HotelBookingModal;
