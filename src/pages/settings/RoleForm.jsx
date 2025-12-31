import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStores } from '../../context/StoresContext';
import { db } from '../../firebase';
import { collection, addDoc, doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../components/ui/card';
import { Checkbox } from '../../components/ui/checkbox';
import { ArrowLeft, Save } from 'lucide-react';

const PERMISSION_GROUPS = [
    {
        name: 'Dashboard',
        permissions: [
            { id: 'view_dashboard', label: 'Lihat Dashboard' }
        ]
    },
    {
        name: 'Booking & Reservasi',
        permissions: [
            { id: 'view_bookings', label: 'Lihat Daftar Booking' },
            { id: 'create_booking', label: 'Buat Booking Baru' },
            { id: 'edit_booking', label: 'Edit Booking' },
            { id: 'delete_booking', label: 'Hapus Booking' },
            { id: 'process_checkin_out', label: 'Check-In / Check-Out Pet Hotel' }
        ]
    },
    {
        name: 'Rekam Medis (Medical)',
        permissions: [
            { id: 'view_medical_records', label: 'Lihat Rekam Medis' },
            { id: 'create_medical_record', label: 'Buat Rekam Medis' },
            { id: 'edit_medical_record', label: 'Edit Rekam Medis' }
        ]
    },
    {
        name: 'Layanan (Services)',
        permissions: [
            { id: 'access_grooming', label: 'Akses Modul Grooming' },
            { id: 'access_hotel', label: 'Akses Modul Pet Hotel' },
            { id: 'access_clinic', label: 'Akses Modul Klinik' }
        ]
    },
    {
        name: 'Databases (Data Master)',
        permissions: [
            { id: 'view_customers', label: 'Lihat Data Pelanggan' },
            { id: 'manage_customers', label: 'Kelola Pelanggan (Tambah/Edit)' },
            { id: 'view_pets', label: 'Lihat Data Hewan' },
            { id: 'manage_pets', label: 'Kelola Hewan' },
            { id: 'manage_stock', label: 'Kelola Stok / Obat' },
            { id: 'manage_staff', label: 'Kelola Staff' }
        ]
    },
    {
        name: 'Laporan & Keuangan',
        permissions: [
            { id: 'view_reports', label: 'Lihat Laporan Keuangan' },
            { id: 'manage_expenses', label: 'Catat Pengeluaran' }
        ]
    },
    {
        name: 'Pengaturan',
        permissions: [
            { id: 'manage_settings', label: 'Akses Pengaturan Toko' },
            { id: 'manage_roles', label: 'Kelola Hak Akses (Roles)' }
        ]
    }
];

const RoleForm = () => {
    const { id } = useParams();
    const isEdit = !!id;
    const navigate = useNavigate();
    const { activeStoreId } = useStores();

    const [loading, setLoading] = useState(false);
    const [name, setName] = useState('');
    const [permissions, setPermissions] = useState({});

    useEffect(() => {
        const fetchRole = async () => {
            if (isEdit && id) {
                setLoading(true);
                try {
                    const docSnap = await getDoc(doc(db, 'roles', id));
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setName(data.name);
                        setPermissions(data.permissions || {});
                    }
                } catch (err) {
                    console.error("Error fetching role:", err);
                } finally {
                    setLoading(false);
                }
            }
        };
        fetchRole();
    }, [isEdit, id]);

    const handlePermissionChange = (permId, checked) => {
        setPermissions(prev => ({
            ...prev,
            [permId]: checked
        }));
    };

    const handleSelectGroup = (groupPerms, checked) => {
        setPermissions(prev => {
            const next = { ...prev };
            groupPerms.forEach(p => {
                next[p.id] = checked;
            });
            return next;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const roleData = {
                name,
                permissions,
                storeId: activeStoreId,
                updatedAt: serverTimestamp()
            };

            if (!isEdit) {
                roleData.createdAt = serverTimestamp();
                await addDoc(collection(db, 'roles'), roleData);
            } else {
                await updateDoc(doc(db, 'roles', id), roleData);
            }
            navigate('/settings/roles');
        } catch (error) {
            console.error("Error saving role:", error);
            alert("Gagal menyimpan peran.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/settings/roles')}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">{isEdit ? 'Edit Peran' : 'Buat Peran Baru'}</h1>
                    <p className="text-slate-500">Tentukan nama peran dan hak akses yang diberikan.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="grid gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Informasi Dasar</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <Label htmlFor="roleName">Nama Peran (Role Name)</Label>
                                <Input
                                    id="roleName"
                                    placeholder="Contoh: Groomer Senior, Resepsionis, Admin Gudang"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    required
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Izin Akses (Permissions)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {PERMISSION_GROUPS.map((group, idx) => (
                                <div key={idx} className="space-y-3 pb-4 border-b border-slate-100 last:border-0">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-semibold text-slate-900">{group.name}</h3>
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`group-${idx}`}
                                                onCheckedChange={(checked) => handleSelectGroup(group.permissions, checked)}
                                            />
                                            <Label htmlFor={`group-${idx}`} className="text-xs text-slate-500 font-normal">Pilih Semua</Label>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {group.permissions.map(perm => (
                                            <div key={perm.id} className="flex items-start space-x-2 p-2 rounded hover:bg-slate-50 transition-colors">
                                                <Checkbox
                                                    id={perm.id}
                                                    checked={permissions[perm.id] || false}
                                                    onCheckedChange={(checked) => handlePermissionChange(perm.id, checked)}
                                                />
                                                <div className="grid gap-1.5 leading-none">
                                                    <Label
                                                        htmlFor={perm.id}
                                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                    >
                                                        {perm.label}
                                                    </Label>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                        <CardFooter className="bg-slate-50 border-t p-4 flex justify-end gap-2 rounded-b-xl">
                            <Button type="button" variant="ghost" onClick={() => navigate('/settings/roles')}>Batal</Button>
                            <Button type="submit" disabled={loading}>
                                <Save className="h-4 w-4 mr-2" />
                                {loading ? 'Menyimpan...' : 'Simpan Peran'}
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </form>
        </div>
    );
};

export default RoleForm;
