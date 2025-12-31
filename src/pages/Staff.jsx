import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, Shield, User, Circle, History, Eye, EyeOff } from 'lucide-react';
import { db } from '../firebase';
import { collection, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { AVAILABLE_PERMISSIONS } from '../utils/permissions';
import { useStores } from '../context/StoresContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import UpgradeAlert from '../components/UpgradeAlert';
import Pagination from '../components/Pagination';
import AlertDialog from '../components/AlertDialog';
import ConfirmDialog from '../components/ConfirmDialog';

const Staff = () => {
    const { user } = useAuth();
    const { activeStoreId, stores, addUser } = useStores();
    const [staffList, setStaffList] = useState([]);
    const [activeShifts, setActiveShifts] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentStaff, setCurrentStaff] = useState({ name: '', email: '', role: 'staff', pin: '', photo: '', petCareAccess: false });
    const [isEditing, setIsEditing] = useState(false);
    const [showUpgradeAlert, setShowUpgradeAlert] = useState(false);
    const [upgradeDebugInfo, setUpgradeDebugInfo] = useState(null);

    // Dialog States
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [alertData, setAlertData] = useState({ title: '', message: '' });
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [confirmData, setConfirmData] = useState({ title: '', message: '', onConfirm: null });

    // History State
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [staffHistory, setStaffHistory] = useState([]);
    const [selectedStaffName, setSelectedStaffName] = useState('');
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [historyPage, setHistoryPage] = useState(1);
    const historyItemsPerPage = 5;
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (!activeStoreId) {
            setStaffList([]);
            return;
        }

        // Real-time listener for users collection filtered by storeId
        const qUsers = query(collection(db, 'users'), where('storeId', '==', activeStoreId));
        const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
            const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setStaffList(users);
        });

        // Real-time listener for active shifts to determine status
        const qShifts = query(
            collection(db, 'shifts'),
            where('storeId', '==', activeStoreId),
            where('status', '==', 'active')
        );
        const unsubscribeShifts = onSnapshot(qShifts, (snapshot) => {
            const shifts = snapshot.docs.map(doc => doc.data());
            setActiveShifts(shifts);
        });

        return () => {
            unsubscribeUsers();
            unsubscribeShifts();
        };
    }, [activeStoreId]);

    const showAlert = (title, message) => {
        setAlertData({ title, message });
        setIsAlertOpen(true);
    };

    const showConfirm = (title, message, onConfirm) => {
        setConfirmData({ title, message, onConfirm });
        setIsConfirmOpen(true);
    };

    const getStaffStatus = (staff) => {
        // Use the status field from user document (online/offline)
        // Fallback to checking active shifts if status field doesn't exist
        if (staff.status) {
            return staff.status === 'online' ? 'login' : 'logout';
        }
        const isActive = activeShifts.some(shift => shift.cashierId === staff.id);
        return isActive ? 'login' : 'logout';
    };

    const handleAddStaff = () => {
        setCurrentStaff({
            name: '',
            email: '',
            role: 'staff',
            password: '',
            photo: '',
            petCareAccess: false,
            permissions: {} // Dynamic permissions
        });
        setIsEditing(false);
        setShowPassword(false);
        setIsModalOpen(true);
    };

    const handleEditStaff = (staff) => {
        // If staff has pin but no password (legacy), use pin as password
        // If staff has pin but no password (legacy), use pin as password
        setCurrentStaff({
            id: staff.id,
            name: staff.name,
            email: staff.email || '',
            role: staff.role,
            password: staff.password || staff.pin || '', // Fallback to PIN
            photo: staff.photo || '',
            petCareAccess: staff.petCareAccess || false,
            permissions: staff.permissions || {}
        });
        setIsEditing(true);
        setShowPassword(false);
        setIsModalOpen(true);
    };

    const handleDeleteStaff = (id) => {
        showConfirm(
            'Hapus Staff',
            'Apakah Anda yakin ingin menghapus staff ini?',
            async () => {
                try {
                    await deleteDoc(doc(db, 'users', id));
                } catch (error) {
                    console.error("Error deleting staff:", error);
                    showAlert("Gagal", "Gagal menghapus staff.");
                }
            }
        );
    };

    const handleViewHistory = async (staff) => {
        setSelectedStaffName(staff.name);
        setIsHistoryModalOpen(true);
        setIsLoadingHistory(true);
        setStaffHistory([]);
        setHistoryPage(1); // Reset to first page

        try {
            // Query login_history for this staff member
            const q = query(
                collection(db, 'login_history'),
                where('userId', '==', staff.id),
                where('storeId', '==', activeStoreId)
            );

            const snapshot = await getDocs(q);
            let history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Sort client-side
            history.sort((a, b) => new Date(b.loginTime) - new Date(a.loginTime));

            setStaffHistory(history);
        } catch (error) {
            console.error("Error fetching login history:", error);
            showAlert("Gagal", "Gagal mengambil riwayat login: " + error.message);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setCurrentStaff(prev => ({ ...prev, photo: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!activeStoreId) {
            showAlert("Error", "Terjadi kesalahan: Tidak ada toko yang aktif.");
            return;
        }

        try {
            if (isEditing) {
                const staffRef = doc(db, 'users', currentStaff.id);
                await updateDoc(staffRef, {
                    name: currentStaff.name,
                    email: currentStaff.email || '',
                    role: currentStaff.role,
                    password: currentStaff.password,
                    pin: currentStaff.password, // Keep pin synced for backward compatibility
                    photo: currentStaff.photo || '',
                    petCareAccess: currentStaff.petCareAccess || false,
                    permissions: currentStaff.permissions || {}
                });
            } else {
                // Find store name for denormalization if needed
                const currentStore = stores.find(s => s.id === activeStoreId);

                const result = await addUser({
                    name: currentStaff.name,
                    email: currentStaff.email,
                    role: currentStaff.role,
                    password: currentStaff.password,
                    pin: currentStaff.password, // Keep pin synced for backward compatibility
                    photo: currentStaff.photo || '',
                    petCareAccess: currentStaff.petCareAccess || false,
                    permissions: currentStaff.permissions || {},
                    storeId: activeStoreId,
                    storeName: currentStore ? currentStore.name : ''
                });

                if (!result.success) {
                    if (result.isLimitError) {
                        setUpgradeDebugInfo(result.debugInfo);
                        setIsModalOpen(false); // Close the form modal
                        setShowUpgradeAlert(true); // Show upgrade alert
                    } else {
                        showAlert("Gagal", result.error || "Gagal menambahkan staff.");
                    }
                    return;
                }
            }
            setIsModalOpen(false);
            showAlert(
                "Berhasil",
                isEditing ? "Data staff berhasil diperbarui!" : "Staff baru berhasil ditambahkan!"
            );
        } catch (error) {
            console.error("Error saving staff:", error);
            showAlert("Gagal", "Gagal menyimpan data staff.");
        }
    };

    // Pagination Logic for History
    const indexOfLastHistory = historyPage * historyItemsPerPage;
    const indexOfFirstHistory = indexOfLastHistory - historyItemsPerPage;
    const currentHistory = staffHistory.slice(indexOfFirstHistory, indexOfLastHistory);

    return (
        <div className="p-4 space-y-6">
            <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Manajemen Staff</h1>
                    <p className="text-muted-foreground mt-1">Kelola akses dan karyawan toko Anda.</p>
                </div>
                <Button onClick={handleAddStaff}>
                    <Plus className="h-4 w-4 mr-2" />
                    Tambah Staff
                </Button>
            </header>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[80px]">Foto</TableHead>
                                <TableHead>Nama</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {staffList.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        Belum ada staff di toko ini.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                staffList.map((staff) => {
                                    const status = getStaffStatus(staff);
                                    return (
                                        <TableRow key={staff.id}>
                                            <TableCell>
                                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/20">
                                                    {staff.photo ? (
                                                        <img src={staff.photo} alt={staff.name} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <span className="text-sm font-bold text-primary">
                                                            {staff.name ? staff.name.charAt(0).toUpperCase() : '?'}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                <div className="flex flex-col">
                                                    <span>{staff.name}</span>
                                                    <span className="text-xs text-muted-foreground">Password: ••••••</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={
                                                    staff.role === 'admin' ? 'default' :
                                                        staff.role === 'sales' ? 'outline' :
                                                            staff.role === 'dokter' ? 'default' : // Doctor gets distinct style if possible, or default
                                                                staff.role === 'paramedis' ? 'secondary' :
                                                                    'secondary'
                                                } className={staff.role === 'dokter' ? 'bg-indigo-600 hover:bg-indigo-700' : ''}>
                                                    {
                                                        staff.role === 'admin' ? 'Administrator' :
                                                            staff.role === 'sales' ? 'Sales' :
                                                                staff.role === 'dokter' ? 'Dokter Hewan' :
                                                                    staff.role === 'paramedis' ? 'Paramedis' :
                                                                        'Kasir'
                                                    }
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Circle className={`h-3 w-3 fill-current ${status === 'login' ? 'text-green-500' : 'text-gray-300'}`} />
                                                    <span className={status === 'login' ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                                                        {status === 'login' ? 'Sedang Login' : 'Logout'}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="sm" onClick={() => handleViewHistory(staff)} title="Riwayat Login">
                                                        <History className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => handleEditStaff(staff)}>
                                                        <Edit2 className="h-4 w-4" />
                                                    </Button>
                                                    {(user?.role === 'super_admin' || user?.permissions?.manage_staff) && staff.role !== 'admin' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDeleteStaff(staff.id)}
                                                            className="text-destructive hover:text-destructive"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'Edit Staff' : 'Tambah Staff Baru'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="staffName">Nama Lengkap</Label>
                            <Input
                                id="staffName"
                                type="text"
                                value={currentStaff.name}
                                onChange={(e) => setCurrentStaff({ ...currentStaff, name: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="staffEmail">Email (Opsional)</Label>
                            <Input
                                id="staffEmail"
                                type="email"
                                value={currentStaff.email || ''}
                                onChange={(e) => setCurrentStaff({ ...currentStaff, email: e.target.value })}
                                placeholder="nama@email.com (untuk login)"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="staffPhoto">Foto Profil</Label>
                            <div className="flex items-center gap-4">
                                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center overflow-hidden border">
                                    {currentStaff.photo ? (
                                        <img src={currentStaff.photo} alt="Preview" className="h-full w-full object-cover" />
                                    ) : (
                                        <User className="h-8 w-8 text-muted-foreground" />
                                    )}
                                </div>
                                <Input
                                    id="staffPhoto"
                                    type="file"
                                    accept="image/*"
                                    onChange={handlePhotoChange}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="staffRole">Role / Peran</Label>
                            <Select
                                value={currentStaff.role}
                                onValueChange={(value) => setCurrentStaff({ ...currentStaff, role: value })}
                            >
                                <SelectTrigger id="staffRole">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="staff">Kasir</SelectItem>
                                    <SelectItem value="sales">Sales</SelectItem>
                                    <SelectItem value="dokter">Dokter Hewan</SelectItem>
                                    <SelectItem value="paramedis">Paramedis</SelectItem>
                                    <SelectItem value="admin">Administrator</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="staffPassword">Password</Label>
                            <div className="relative">
                                <Input
                                    id="staffPassword"
                                    type={showPassword ? "text" : "password"}
                                    value={currentStaff.password}
                                    onChange={(e) => setCurrentStaff({ ...currentStaff, password: e.target.value })}
                                    required
                                    placeholder="Masukkan password"
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3 pt-4 border-t">
                            <Label className="text-base font-semibold">Hak Akses & Izin</Label>

                            <div className="flex items-center space-x-2 pb-4">
                                <input
                                    type="checkbox"
                                    id="petCareAccess"
                                    checked={currentStaff.petCareAccess}
                                    onChange={(e) => setCurrentStaff({ ...currentStaff, petCareAccess: e.target.checked })}
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <Label htmlFor="petCareAccess" className="font-normal cursor-pointer">
                                    Login ke Aplikasi Pet Care
                                </Label>
                            </div>

                            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 border rounded-md p-3 bg-slate-50">
                                {AVAILABLE_PERMISSIONS.filter(p => p.category).map((group, idx) => (
                                    <div key={idx} className="space-y-2">
                                        <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider text-[10px]">{group.category}</h4>
                                        <div className="space-y-2">
                                            {group.items.map(perm => (
                                                <div key={perm.id} className="flex items-start space-x-2 bg-white p-2 rounded border border-slate-100">
                                                    <input
                                                        type="checkbox"
                                                        id={perm.id}
                                                        checked={currentStaff.permissions?.[perm.id] || false}
                                                        onChange={(e) => setCurrentStaff({
                                                            ...currentStaff,
                                                            permissions: { ...currentStaff.permissions, [perm.id]: e.target.checked }
                                                        })}
                                                        className="h-4 w-4 mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
                                                    />
                                                    <div className="flex flex-col">
                                                        <Label htmlFor={perm.id} className="font-medium cursor-pointer text-sm text-slate-800">
                                                            {perm.label}
                                                        </Label>
                                                        <span className="text-[10px] text-slate-500">{perm.description}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                                Batal
                            </Button>
                            <Button type="submit">Simpan</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog >

            <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Riwayat Login - {selectedStaffName}</DialogTitle>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto">
                        {isLoadingHistory ? (
                            <div className="text-center py-8 text-muted-foreground">Memuat riwayat...</div>
                        ) : (
                            <>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Waktu</TableHead>
                                            <TableHead>Aktivitas</TableHead>
                                            <TableHead>Device</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {currentHistory.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                                    Belum ada riwayat login.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            currentHistory.map((log) => (
                                                <TableRow key={log.id}>
                                                    <TableCell>
                                                        <div>
                                                            <div>{new Date(log.loginTime).toLocaleDateString('id-ID')}</div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {new Date(log.loginTime).toLocaleTimeString('id-ID')}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={
                                                            log.status === 'success' ? 'default' :
                                                                log.status === 'logout' ? 'secondary' :
                                                                    'destructive'
                                                        }>
                                                            {log.status === 'success' ? 'Login Berhasil' :
                                                                log.status === 'logout' ? 'Logout' :
                                                                    'Login Gagal'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                                                        {log.userAgent ? log.userAgent.split(' ').slice(0, 3).join(' ') : '-'}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                                <Pagination
                                    currentPage={historyPage}
                                    totalItems={staffHistory.length}
                                    itemsPerPage={historyItemsPerPage}
                                    onPageChange={setHistoryPage}
                                />
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <UpgradeAlert
                isOpen={showUpgradeAlert}
                onClose={() => setShowUpgradeAlert(false)}
                title="Batas Staff Tercapai"
                description={
                    upgradeDebugInfo
                        ? `Plan: ${upgradeDebugInfo.plan.toUpperCase()} | Limit: ${upgradeDebugInfo.limit} | Terpakai: ${upgradeDebugInfo.currentCount}. Upgrade untuk menambah slot.`
                        : "Paket Free hanya mengizinkan 2 pengguna (1 Admin + 1 Kasir). Upgrade ke Pro untuk menambahkan hingga 5 staff."
                }
                benefits={[
                    "Hingga 5 Staff / Kasir",
                    "Produk Tanpa Batas",
                    "Laporan Keuangan Lengkap",
                    "Manajemen Stok Lanjutan"
                ]}
            />

            <AlertDialog
                isOpen={isAlertOpen}
                onClose={() => setIsAlertOpen(false)}
                title={alertData.title}
                message={alertData.message}
            />

            <ConfirmDialog
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                title={confirmData.title}
                message={confirmData.message}
                onConfirm={confirmData.onConfirm}
            />
        </div >
    );
};

export default Staff;
