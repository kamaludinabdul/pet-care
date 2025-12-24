import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Plus, Search, Filter, Calendar, Eye, ShoppingCart, ChevronLeft, ChevronRight, Calculator, FileText, ArrowUpDown, X, Printer, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { DateRangePicker } from '../../components/DateRangePicker';
import PetPaymentModal from '../../components/PetPaymentModal';
import MedicalInvoice from '../../components/MedicalInvoice';
import { subDays } from 'date-fns';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useStores } from '../../context/StoresContext';
import { usePOS } from '../../context/POSContext';
import { useNavigate, useSearchParams } from 'react-router-dom';

const MedicalRecords = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { activeStoreId, stores } = useStores();
    const { customers } = usePOS();
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState({
        from: subDays(new Date(), 30),
        to: new Date()
    });
    const [searchParams] = useSearchParams();
    const filterPetId = searchParams.get('petId');
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

    useEffect(() => {
        const fetchRecords = async () => {
            if (!user?.storeId) return;
            setLoading(true);
            try {
                // Build query
                let recordsQuery;

                if (filterPetId) {
                    // If filtering by specific pet, show ALL history for that pet
                    recordsQuery = query(
                        collection(db, 'medical_records'),
                        where('storeId', '==', user.storeId),
                        where('petId', '==', filterPetId),
                        orderBy('date', 'desc')
                    );
                } else if (dateRange?.from && dateRange?.to) {
                    // Ensure 'to' covers the end of the day
                    const toDate = new Date(dateRange.to);
                    toDate.setHours(23, 59, 59, 999);

                    recordsQuery = query(
                        collection(db, 'medical_records'),
                        where('storeId', '==', user.storeId),
                        where('date', '>=', dateRange.from.toISOString()),
                        where('date', '<=', toDate.toISOString()),
                        orderBy('date', 'desc')
                    );
                } else {
                    // Fallback if no date range (though we default to one)
                    recordsQuery = query(
                        collection(db, 'medical_records'),
                        where('storeId', '==', user.storeId),
                        orderBy('date', 'desc'),
                        limit(50)
                    );
                }

                const [recordsSnap, petsSnap] = await Promise.all([
                    getDocs(recordsQuery),
                    getDocs(query(collection(db, 'pets'), where('storeId', '==', user.storeId)))
                ]);

                const petsMap = {};
                petsSnap.docs.forEach(d => {
                    petsMap[d.id] = d.data();
                });

                const data = recordsSnap.docs.map(doc => {
                    const r = doc.data();
                    // Resolve owner name if missing
                    let resolvedOwner = r.ownerName;
                    if (!resolvedOwner || resolvedOwner === 'Tanpa Pemilik') {
                        const pet = petsMap[r.petId];
                        if (pet && pet.ownerId) {
                            const customer = customers.find(c => c.id === pet.ownerId);
                            if (customer) resolvedOwner = customer.name;
                        }
                    }

                    let rmNumber = '';
                    if (r.petId) {
                        const pet = petsMap[r.petId];
                        if (pet) {
                            rmNumber = pet.medicalRecordNumber || '';
                        }
                    }

                    let ownerId = r.ownerId; // Try to use existing ownerId
                    if (!ownerId && r.petId) {
                        const pet = petsMap[r.petId];
                        if (pet) ownerId = pet.ownerId;
                    }

                    return {
                        id: doc.id,
                        ...r,
                        ownerId: ownerId, // Ensure ownerId is available for Payment Modal
                        ownerName: resolvedOwner,
                        rmNumber: rmNumber,
                        dateObj: new Date(r.date) // Helper for sorting/comparing
                    };
                });

                // Smart "Next Visit" Logic
                // We keep the original sort order (desc) for this calculation so it's consistent
                // even if the user sorts differently later, the 'actualNextVisit' relation is based on history.
                data.sort((a, b) => b.dateObj - a.dateObj);

                const finalData = data.map((record, index) => {
                    // Find if there is a newer record for this SAME pet
                    const newerRecord = data.slice(0, index).find(d => d.petId === record.petId);

                    // User Request: "maka di yang sebelumnya RM001 akan kosong next visit nya"
                    // If a newer record exists, we effectively clear the "Next Visit" for this old record
                    // because the cycle is closed/superseded.
                    const displayNextVisit = newerRecord ? null : record.nextVisit;

                    return {
                        ...record,
                        displayNextVisit
                    };
                });

                setRecords(finalData);
            } catch (err) {
                console.error("Error fetching medical records", err);
            } finally {
                setLoading(false);
            }
        };

        fetchRecords();
    }, [user?.storeId, customers, dateRange, filterPetId]);

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const filteredRecords = records.filter(r =>
        r.petName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.diagnosis?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.rmNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => {
        if (!sortConfig.key) return 0;

        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // Specific handling for dates
        if (sortConfig.key === 'date') {
            aValue = a.dateObj;
            bValue = b.dateObj;
        }

        if (aValue < bValue) {
            return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
            return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
    });

    // Pagination Logic
    const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
    const paginatedRecords = filteredRecords.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Reset page when filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, dateRange]);

    const [selectedRecord, setSelectedRecord] = useState(null);
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    const [paymentRecord, setPaymentRecord] = useState(null);

    const handleCheckout = (record) => {
        setPaymentRecord(record);
        setIsPaymentOpen(true);
    };

    const handlePaymentSuccess = () => {
        setIsPaymentOpen(false);
        // Refresh by reloading page to reflect payment status if needed, 
        // or just let the user see it next time. 
        // A reload is safest for consistency across lists.
        window.location.reload();
    };

    const [invoiceRecord, setInvoiceRecord] = useState(null);

    const handlePrint = (record) => {
        setInvoiceRecord(record);
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Rekam Medis</h1>
                    <p className="text-slate-500">Kelola riwayat kesehatan dan pengobatan pasien.</p>
                </div>
                <Button onClick={() => navigate('/pet-care/medical-records/add')} className="bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Catat Rekam Medis
                </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between print:hidden">
                <div className="relative w-full md:max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Cari hewan, RM, atau diagnosa..."
                        className="pl-9 bg-white"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    {!filterPetId && (
                        <DateRangePicker
                            date={dateRange}
                            setDate={setDateRange}
                        />
                    )}
                    {filterPetId && (
                        <Button variant="outline" onClick={() => navigate('/pet-care/medical-records')}>
                            Clear Filter
                        </Button>
                    )}
                </div>
            </div>

            <Card className="print:hidden">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]">No</TableHead>
                                <TableHead className="w-[120px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('date')}>
                                    <div className="flex items-center gap-1">
                                        Tanggal
                                        <ArrowUpDown className="h-3 w-3" />
                                    </div>
                                </TableHead>
                                <TableHead className="w-[100px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('rmNumber')}>
                                    <div className="flex items-center gap-1">
                                        No. RM
                                        <ArrowUpDown className="h-3 w-3" />
                                    </div>
                                </TableHead>
                                <TableHead className="min-w-[150px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('petName')}>
                                    <div className="flex items-center gap-1">
                                        Hewan
                                        <ArrowUpDown className="h-3 w-3" />
                                    </div>
                                </TableHead>
                                <TableHead className="min-w-[150px]">Pemilik</TableHead>
                                <TableHead className="w-[200px]">Diagnosa</TableHead>
                                <TableHead className="w-[150px]">Next Visit</TableHead>
                                <TableHead className="w-[100px]">Status</TableHead>
                                <TableHead className="w-[80px] text-right">Detail</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-24 text-center">
                                        Memuat data...
                                    </TableCell>
                                </TableRow>
                            ) : paginatedRecords.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-24 text-center text-slate-500">
                                        Belum ada rekam medis.
                                        <Button variant="link" onClick={() => navigate('/pet-care/medical-records/add')}>
                                            Buat Baru
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedRecords.map((record, i) => (
                                    <TableRow key={record.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelectedRecord(record)}>
                                        <TableCell>{(currentPage - 1) * itemsPerPage + i + 1}</TableCell>
                                        <TableCell className="font-medium whitespace-nowrap">
                                            {format(new Date(record.date), 'dd MMM yyyy', { locale: id })}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">
                                            {record.rmNumber ? (
                                                <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded">
                                                    {record.rmNumber}
                                                </span>
                                            ) : '-'}
                                        </TableCell>
                                        <TableCell className="font-medium text-slate-900">
                                            {record.petName}
                                        </TableCell>
                                        <TableCell className="text-slate-500">
                                            {record.ownerName || 'Tanpa Pemilik'}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <span className="font-medium text-slate-900 line-clamp-1">{record.diagnosis}</span>
                                                <span className="text-xs text-slate-500 line-clamp-1">{record.symptoms}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {record.displayNextVisit ? (
                                                <span className="inline-flex items-center text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-1 rounded-full whitespace-nowrap">
                                                    Next: {format(new Date(record.displayNextVisit), 'dd MMM', { locale: id })}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 text-xs">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {record.paymentStatus === 'paid' ? (
                                                <span className="inline-flex items-center text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
                                                    Lunas
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                                                    Belum Bayar
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-indigo-600" onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedRecord(record);
                                                }}>
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                {record.paymentStatus !== 'paid' && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:bg-amber-50" onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/pet-care/medical-records/edit/${record.id}`);
                                                    }} title="Edit">
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                {record.paymentStatus !== 'paid' && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-600 hover:bg-indigo-50" onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCheckout(record);
                                                    }} title="Bayar">
                                                        <ShoppingCart className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>

                {/* Pagination Controls */}
                {!loading && filteredRecords.length > 0 && (
                    <div className="flex items-center justify-between p-4 border-t">
                        <div className="text-sm text-slate-500">
                            Menampilkan {Math.min((currentPage - 1) * itemsPerPage + 1, filteredRecords.length)} - {Math.min(currentPage * itemsPerPage, filteredRecords.length)} dari {filteredRecords.length} data
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Prev
                            </Button>
                            <span className="text-sm font-medium mx-2">
                                Halaman {currentPage} dari {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                            >
                                Next
                                <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

            {/* Record Detail Modal */}
            {
                selectedRecord && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:p-0 print:bg-white print:static">
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto print:shadow-none print:w-full print:max-w-none print:max-h-none print:overflow-visible">
                            <div className="p-6 space-y-6">
                                <div className="flex justify-between items-start print:hidden">
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-900">Detail Rekam Medis</h2>
                                        <p className="text-sm text-slate-500">ID: {selectedRecord.id}</p>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => { handlePrint(selectedRecord); setSelectedRecord(null); }}>
                                        <X className="h-5 w-5" />
                                    </Button>
                                </div>

                                {/* Print Header */}
                                <div className="hidden print:block text-center mb-8 border-b pb-4">
                                    <h1 className="text-2xl font-bold">Kula Pet Care</h1>
                                    <p className="text-slate-600">Laporan Rekam Medis Hewan</p>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <h3 className="text-sm font-medium text-slate-500 mb-1">Hewan</h3>
                                        <p className="text-lg font-semibold flex items-center gap-2">
                                            {selectedRecord.petName}
                                            {selectedRecord.rmNumber && (
                                                <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                                    {selectedRecord.rmNumber}
                                                </span>
                                            )}
                                        </p>
                                        <p className="text-sm text-slate-600">Pemilik: {selectedRecord.ownerName}</p>
                                    </div>
                                    <div className="text-right">
                                        <h3 className="text-sm font-medium text-slate-500 mb-1">Tanggal Periksa</h3>
                                        <p className="text-lg font-semibold">{format(new Date(selectedRecord.date), 'dd MMMM yyyy', { locale: id })}</p>
                                    </div>
                                </div>

                                <div className="space-y-4 border-t pt-4">
                                    <div>
                                        <h3 className="font-medium text-slate-900 mb-1">Gejala / Keluhan</h3>
                                        <div className="bg-slate-50 p-3 rounded-lg text-slate-700 print:bg-transparent print:p-0 print:border">
                                            {selectedRecord.symptoms}
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-slate-900 mb-1">Diagnosa</h3>
                                        <div className="bg-red-50 p-3 rounded-lg text-red-800 font-medium border border-red-100 print:bg-transparent print:p-0 print:border-none print:text-black">
                                            {selectedRecord.diagnosis}
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-slate-900 mb-1">Tindakan / Pengobatan</h3>
                                        <div className="bg-slate-50 p-3 rounded-lg text-slate-700 print:bg-transparent print:p-0 print:border">
                                            {selectedRecord.treatment}
                                        </div>
                                    </div>
                                    {selectedRecord.notes && (
                                        <div>
                                            <h3 className="font-medium text-slate-900 mb-1">Catatan Tambahan</h3>
                                            <div className="text-slate-600 italic">
                                                {selectedRecord.notes}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {selectedRecord.nextVisit && (
                                    <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg flex items-center gap-3 print:bg-transparent print:border-slate-200">
                                        <Calendar className="h-5 w-5 text-indigo-600" />
                                        <div>
                                            <p className="text-sm font-medium text-indigo-900">Jadwal Kunjungan Berikutnya</p>
                                            <p className="text-indigo-700">{format(new Date(selectedRecord.nextVisit), 'dd MMMM yyyy', { locale: id })}</p>
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end gap-3 pt-4 border-t print:hidden">
                                    <Button variant="outline" onClick={() => setSelectedRecord(null)}>
                                        Tutup
                                    </Button>
                                    <Button onClick={handlePrint} className="bg-indigo-600 hover:bg-indigo-700">
                                        <Printer className="h-4 w-4 mr-2" />
                                        Cetak PDF
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Payment Modal */}
            <PetPaymentModal
                isOpen={isPaymentOpen}
                onClose={() => setIsPaymentOpen(false)}
                medicalRecord={paymentRecord}
                onSuccess={handlePaymentSuccess}
            />
            {/* Invoice Modal */}
            {
                invoiceRecord && (
                    <MedicalInvoice
                        record={invoiceRecord}
                        store={stores.find(s => s.id === activeStoreId)}
                        customer={customers.find(c => c.id === invoiceRecord.ownerId) || { name: invoiceRecord.ownerName }}
                        onClose={() => setInvoiceRecord(null)}
                    />
                )
            }
        </div >
    );
};

export default MedicalRecords;
