import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { collection, query, where, orderBy, updateDoc, doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Stethoscope, ClipboardList, Clock, ArrowRight } from 'lucide-react';

const ServiceClinic = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.storeId) return;

        const q = query(
            collection(db, 'bookings'),
            where('storeId', '==', user.storeId),
            where('serviceType', '==', 'clinic'),
            where('status', 'in', ['confirmed', 'checked_in', 'processing']),
            orderBy('startDate', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setQueue(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        }, (error) => {
            console.error("Error fetching clinic queue:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user?.storeId]);

    const handleCallPatient = async (booking) => {
        // Update status to 'processing' (Masuk Ruang Periksa)
        try {
            await updateDoc(doc(db, 'bookings', booking.id), { status: 'processing' });
            setQueue(prev => prev.map(b => b.id === booking.id ? { ...b, status: 'processing' } : b));
        } catch (error) {
            console.error("Error updating status:", error);
        }
    };

    const handleStartExam = (booking) => {
        // Navigate to Medical Record Form, pre-filling data
        navigate(`/pet-care/medical-records/add?bookingId=${booking.id}&petId=${booking.petId}&ownerId=${booking.ownerId}`);
    };

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Antrian Klinik & Dokter</h1>
            <p className="text-muted-foreground">Kelola antrian pasien dan pemeriksaan dokter.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Waiting List */}
                <Card className="md:col-span-1 border-l-4 border-l-yellow-400">
                    <CardHeader className="bg-yellow-50/50 pb-2">
                        <CardTitle className="text-lg flex items-center gap-2 text-yellow-800">
                            <Clock className="w-5 h-5" />
                            Ruang Tunggu
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3">
                        {loading && <p>Memuat...</p>}
                        {!loading && queue.filter(b => b.status === 'confirmed').length === 0 && (
                            <p className="text-sm text-muted-foreground italic">Tidak ada pasien menunggu.</p>
                        )}
                        {queue.filter(b => b.status === 'confirmed').map(booking => (
                            <div key={booking.id} className="p-3 bg-white border rounded-lg shadow-sm flex justify-between items-center group hover:border-yellow-300 transition-colors">
                                <div>
                                    <h4 className="font-semibold text-slate-900">{booking.petName}</h4>
                                    <p className="text-xs text-slate-500">{booking.ownerName}</p>
                                    <div className="flex gap-1 mt-1">
                                        {booking.anamnesis?.slice(0, 2).map(s => (
                                            <Badge key={s} variant="secondary" className="text-[10px] h-4 px-1">{s}</Badge>
                                        ))}
                                    </div>
                                </div>
                                <Button size="sm" onClick={() => handleCallPatient(booking)} className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-yellow-200">
                                    Panggil
                                </Button>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* In Examination */}
                <Card className="md:col-span-2 border-l-4 border-l-indigo-500">
                    <CardHeader className="bg-indigo-50/50 pb-2">
                        <CardTitle className="text-lg flex items-center gap-2 text-indigo-800">
                            <Stethoscope className="w-5 h-5" />
                            Sedang Diperiksa
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {queue.filter(b => b.status === 'processing').length === 0 && (
                            <p className="text-sm text-muted-foreground italic col-span-full">Tidak ada pemeriksaan berlangsung.</p>
                        )}
                        {queue.filter(b => b.status === 'processing').map(booking => (
                            <div key={booking.id} className="p-4 bg-white border rounded-xl shadow-sm flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-bold text-lg text-slate-900">{booking.petName}</h4>
                                        <p className="text-sm text-slate-500">{booking.ownerName}</p>
                                    </div>
                                    <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border-indigo-200">
                                        {booking.roomName || 'Ruang Periksa'}
                                    </Badge>
                                </div>

                                {booking.anamnesis?.length > 0 && (
                                    <div className="bg-slate-50 p-2 rounded text-xs text-slate-600">
                                        <strong>Keluhan: </strong> {booking.anamnesis.join(', ')}
                                    </div>
                                )}

                                <Button className="w-full mt-auto" onClick={() => handleStartExam(booking)}>
                                    <ClipboardList className="w-4 h-4 mr-2" />
                                    Input Rekam Medis
                                </Button>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default ServiceClinic;
