import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { ArrowLeft, Calendar, DollarSign, Activity, FileText, Syringe, Scissors, Home, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';

const PetDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [pet, setPet] = useState(null);
    const [bookings, setBookings] = useState([]);
    const [medicalRecords, setMedicalRecords] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Fetch Pet Details
                const petDoc = await getDoc(doc(db, 'pets', id));
                if (petDoc.exists()) {
                    setPet({ id: petDoc.id, ...petDoc.data() });
                } else {
                    console.log("No such pet!");
                    return;
                }

                // 2. Fetch Bookings (Hotel, Grooming)
                const qBookings = query(
                    collection(db, 'bookings'),
                    where('petId', '==', id),
                    orderBy('createdAt', 'desc')
                );
                const bookingsSnap = await getDocs(qBookings);
                const bookingsData = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data(), type: 'booking' }));
                setBookings(bookingsData);

                // 3. Fetch Medical Records
                const qMedical = query(
                    collection(db, 'medical_records'),
                    where('petId', '==', id),
                    orderBy('date', 'desc')
                );
                const medicalSnap = await getDocs(qMedical);
                const medicalData = medicalSnap.docs.map(d => ({ id: d.id, ...d.data(), type: 'medical' }));
                setMedicalRecords(medicalData);

            } catch (error) {
                console.error("Error fetching pet details:", error);
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchData();
        }
    }, [id]);

    if (loading) return <div className="p-8 text-center">Loading pet details...</div>;
    if (!pet) return <div className="p-8 text-center">Pet not found.</div>;

    // Calculate Stats
    const totalBookingsSpend = bookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
    const totalMedicalSpend = medicalRecords.reduce((sum, m) => sum + (m.totalCost || 0), 0);
    const totalSpend = totalBookingsSpend + totalMedicalSpend;

    // Merge History for Timeline
    const allHistory = [
        ...bookings.map(b => ({
            ...b,
            date: b.startDate || b.date,
            title: b.serviceType === 'hotel' ? 'Pet Hotel' : 'Grooming',
            icon: b.serviceType === 'hotel' ? <Home className="w-4 h-4" /> : <Scissors className="w-4 h-4" />,
            details: b.serviceType === 'hotel' ? `${b.duration} Malam` : (b.serviceName || 'Grooming Service')
        })),
        ...medicalRecords.map(m => ({
            ...m,
            date: m.date,
            title: 'Kunjungan Dokter',
            icon: <Activity className="w-4 h-4" />,
            details: m.diagnosis
        }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Get Vaccinations (Assuming stored in medical records with explicit type or diagnosis/notes keywords, 
    // or if we add a 'vaccinations' array in existing medical records implementation. 
    // For now, filtering medical records that might contain vaccine info or if user adds them.
    // ALSO: Checking pet document for static vaccine status)

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" onClick={() => navigate(-1)}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
                </Button>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                        {pet.name}
                        {pet.gender === 'Jantan' ? <span className="text-blue-500 text-xl">♂</span> : <span className="text-pink-500 text-xl">♀</span>}
                    </h1>
                    <p className="text-slate-500">{pet.breed} • {pet.age} Tahun • Owner: {pet.ownerName}</p>
                </div>
                <div className="flex gap-2">
                    {pet.isNeutered && <Badge variant="secondary" className="bg-purple-100 text-purple-700">Sudah Steril</Badge>}
                    {pet.vaccineStatus === 'Lengkap' && <Badge variant="secondary" className="bg-green-100 text-green-700">Vaksin Lengkap</Badge>}
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="p-3 bg-green-100 rounded-full text-green-600">
                            <DollarSign className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 font-medium">Total Pengeluaran</p>
                            <h3 className="text-2xl font-bold text-slate-900">Rp {totalSpend.toLocaleString('id-ID')}</h3>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="p-3 bg-blue-100 rounded-full text-blue-600">
                            <Calendar className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 font-medium">Total Kunjungan</p>
                            <h3 className="text-2xl font-bold text-slate-900">{allHistory.length}x</h3>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="p-3 bg-amber-100 rounded-full text-amber-600">
                            <FileText className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 font-medium">Terakhir Berkunjung</p>
                            <h3 className="text-lg font-bold text-slate-900">
                                {allHistory.length > 0 ? format(new Date(allHistory[0].date), 'dd MMM yyyy', { locale: idLocale }) : '-'}
                            </h3>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content Tabs */}
            <Tabs defaultValue="history" className="w-full">
                <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
                    <TabsTrigger value="history">Riwayat</TabsTrigger>
                    <TabsTrigger value="medical">Rekam Medis</TabsTrigger>
                    <TabsTrigger value="vaccine">Vaksinasi</TabsTrigger>
                </TabsList>

                {/* Timeline History */}
                <TabsContent value="history" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Riwayat Aktivitas</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6">
                                {allHistory.length === 0 ? (
                                    <p className="text-center text-slate-500 py-4">Belum ada riwayat aktivitas.</p>
                                ) : (
                                    allHistory.map((item, idx) => (
                                        <div key={idx} className="flex gap-4 items-start relative">
                                            {/* Timeline Line */}
                                            {idx !== allHistory.length - 1 && (
                                                <div className="absolute left-[19px] top-10 bottom-[-24px] w-[2px] bg-slate-100"></div>
                                            )}

                                            <div className={`p-2 rounded-full z-10 ${item.type === 'medical' ? 'bg-red-100 text-red-600' :
                                                    item.title === 'Pet Hotel' ? 'bg-indigo-100 text-indigo-600' : 'bg-pink-100 text-pink-600'
                                                }`}>
                                                {item.icon}
                                            </div>
                                            <div className="flex-1 bg-slate-50 rounded-lg p-4">
                                                <div className="flex justify-between items-start mb-1">
                                                    <h4 className="font-semibold text-slate-800">{item.title}</h4>
                                                    <span className="text-xs text-slate-500">{format(new Date(item.date), 'dd MMMM yyyy HH:mm', { locale: idLocale })}</span>
                                                </div>
                                                <p className="text-sm text-slate-600 mb-2">{item.details}</p>
                                                {item.totalPrice && (
                                                    <Badge variant="outline" className="text-xs">
                                                        Rp {item.totalPrice.toLocaleString()}
                                                    </Badge>
                                                )}
                                                {item.totalCost && (
                                                    <Badge variant="outline" className="text-xs">
                                                        Rp {item.totalCost.toLocaleString()}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Medical Records Table */}
                <TabsContent value="medical" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Rekam Medis (Klinik)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tanggal</TableHead>
                                        <TableHead>Diagnosa</TableHead>
                                        <TableHead>Tindakan / Obat</TableHead>
                                        <TableHead>Berat Badan</TableHead>
                                        <TableHead>Suhu</TableHead>
                                        <TableHead>Dokter</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {medicalRecords.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-6 text-slate-500">
                                                Tidak ada rekam medis.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        medicalRecords.map((record) => (
                                            <TableRow key={record.id}>
                                                <TableCell>{format(new Date(record.date), 'dd/MM/yyyy', { locale: idLocale })}</TableCell>
                                                <TableCell className="font-medium">{record.diagnosis}</TableCell>
                                                <TableCell>{record.treatment}</TableCell>
                                                <TableCell>{record.weight} kg</TableCell>
                                                <TableCell>{record.temperature} °C</TableCell>
                                                <TableCell>{record.doctorName || '-'}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Vaccinations (Placeholder logic for now based on medical records or future dedicated collection) */}
                <TabsContent value="vaccine" className="mt-6">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Riwayat Vaksinasi</CardTitle>
                                <Button size="sm" variant="outline"> <Syringe className="w-4 h-4 mr-2" /> Catat Vaksin</Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Tanggal</TableHead>
                                            <TableHead>Jenis Vaksin</TableHead>
                                            <TableHead>Dokter / Klinik</TableHead>
                                            <TableHead>Next Due Date</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {/* Filter medical records that have 'vaksin' in diagnosis or treatment */}
                                        {medicalRecords.filter(m =>
                                            m.diagnosis?.toLowerCase().includes('vaksin') ||
                                            m.treatment?.toLowerCase().includes('vaksin')
                                        ).map(record => (
                                            <TableRow key={record.id}>
                                                <TableCell>{format(new Date(record.date), 'dd/MM/yyyy', { locale: idLocale })}</TableCell>
                                                <TableCell className="font-medium">{record.treatment || 'Vaksinasi'}</TableCell>
                                                <TableCell>{record.doctorName || 'Kula Pet Care'}</TableCell>
                                                <TableCell>-</TableCell>
                                            </TableRow>
                                        ))}
                                        {medicalRecords.filter(m =>
                                            m.diagnosis?.toLowerCase().includes('vaksin') ||
                                            m.treatment?.toLowerCase().includes('vaksin')
                                        ).length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="text-center py-6 text-slate-500">
                                                        Belum ada data vaksinasi tercatat di sistem.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default PetDetail;
