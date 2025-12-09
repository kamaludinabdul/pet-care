import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Plus, Search, FileText, Calendar, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const MedicalRecords = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchRecords = async () => {
            if (!user?.storeId) return;
            setLoading(true);
            try {
                // In a real app we'd join with Pets, but NoSQL... we store petName in record or fetch separately.
                // For now assuming basic query.
                const q = query(
                    collection(db, 'medical_records'),
                    where('storeId', '==', user.storeId),
                    orderBy('date', 'desc'),
                    limit(50)
                );

                const snapshot = await getDocs(q);
                const data = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setRecords(data);
            } catch (err) {
                console.error("Error fetching medical records", err);
                // Fallback if index missing
            } finally {
                setLoading(false);
            }
        };

        fetchRecords();
    }, [user?.storeId]);

    const filteredRecords = records.filter(r =>
        r.petName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.diagnosis?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Rekam Medis</h1>
                    <p className="text-slate-500">Riwayat kesehatan dan pemeriksaan hewan.</p>
                </div>
                <Button onClick={() => navigate('/medical-records/add')} className="bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Catat Rekam Medis
                </Button>
            </div>

            <Card>
                <CardHeader className="border-b bg-slate-50/50">
                    <div className="relative max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Cari nama hewan atau diagnosa..."
                            className="pl-9 bg-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-8 text-center text-slate-500">Memuat data...</div>
                    ) : filteredRecords.length === 0 ? (
                        <div className="p-12 flex flex-col items-center justify-center text-slate-500">
                            <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                <FileText className="h-6 w-6 text-slate-400" />
                            </div>
                            <h3 className="font-semibold text-lg text-slate-900">Belum ada rekam medis</h3>
                            <p className="text-sm mt-1 mb-4">Mulai catat pemeriksaan kesehatan hewan pelanggan Anda.</p>
                            <Button variant="outline" onClick={() => navigate('/medical-records/add')}>
                                Buat Catatan Pertama
                            </Button>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {filteredRecords.map((record) => (
                                <div key={record.id} className="p-4 hover:bg-slate-50 transition-colors flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                                    <div className="flex items-start gap-4">
                                        <div className="h-10 w-10 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <Activity className="h-5 w-5 text-indigo-600" />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-slate-900">{record.petName}</h4>
                                            <p className="text-sm text-slate-500">{record.ownerName || 'Tanpa Pemilik'}</p>
                                        </div>
                                    </div>

                                    <div className="flex-1 md:px-8">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-medium px-2 py-0.5 bg-red-50 text-red-700 rounded-full border border-red-100">
                                                {record.diagnosis}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-600 line-clamp-1">{record.symptoms}</p>
                                    </div>

                                    <div className="flex flex-col items-end gap-1 min-w-[120px]">
                                        <div className="flex items-center text-sm text-slate-500">
                                            <Calendar className="h-3 w-3 mr-1" />
                                            {format(doc.data().date?.toDate ? doc.data().date.toDate() : new Date(record.date), 'dd MMM yyyy', { locale: id })}
                                        </div>
                                        {record.nextVisit && (
                                            <span className="text-xs text-indigo-600 font-medium">
                                                Next: {format(new Date(record.nextVisit), 'dd MMM', { locale: id })}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default MedicalRecords;
