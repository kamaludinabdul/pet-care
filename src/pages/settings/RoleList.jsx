import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStores } from '../../context/StoresContext';
import { db } from '../../firebase';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { Button } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Plus, Trash2, Edit } from 'lucide-react';

const RoleList = () => {
    const navigate = useNavigate();
    const { activeStoreId } = useStores();
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRoles = async () => {
            if (!activeStoreId) return;
            try {
                const q = query(collection(db, 'roles'), where('storeId', '==', activeStoreId));
                const snap = await getDocs(q);
                setRoles(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (err) {
                console.error("Error fetching roles:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchRoles();
    }, [activeStoreId]);

    const handleDelete = async (id) => {
        if (!window.confirm("Apakah Anda yakin ingin menghapus hak akses ini?")) return;
        try {
            await deleteDoc(doc(db, 'roles', id));
            setRoles(roles.filter(r => r.id !== id));
        } catch (err) {
            console.error("Error deleting role:", err);
            alert("Gagal menghapus.");
        }
    };

    return (
        <div className="p-6 space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Hak Akses & Peran</h1>
                    <p className="text-slate-500">Kelola daftar peran dan izin akses untuk staff.</p>
                </div>
                <Button onClick={() => navigate('/settings/roles/add')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Buat Peran Baru
                </Button>
            </header>

            <div className="bg-white rounded-lg border border-slate-200">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[200px]">Nama Peran</TableHead>
                            <TableHead>Izin Akses</TableHead>
                            <TableHead className="w-[100px] text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center py-8 text-slate-500">
                                    Memuat data...
                                </TableCell>
                            </TableRow>
                        ) : roles.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center py-12 text-slate-500">
                                    Belum ada peran yang dibuat.
                                </TableCell>
                            </TableRow>
                        ) : (
                            roles.map((role) => {
                                const activePermissions = Object.entries(role.permissions || {}).filter(([, v]) => v).map(([k]) => k);
                                return (
                                    <TableRow key={role.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/settings/roles/${role.id}`)}>
                                        <TableCell className="font-medium text-slate-900 align-top py-4">
                                            {role.name}
                                        </TableCell>
                                        <TableCell className="align-top py-4">
                                            <div className="flex flex-wrap gap-1.5">
                                                {activePermissions.slice(0, 8).map((perm) => (
                                                    <Badge key={perm} variant="secondary" className="font-normal text-xs bg-slate-100 text-slate-600 hover:bg-slate-200">
                                                        {perm.replace(/_/g, ' ')}
                                                    </Badge>
                                                ))}
                                                {activePermissions.length > 8 && (
                                                    <Badge variant="outline" className="font-normal text-xs text-slate-500">
                                                        +{activePermissions.length - 8} lainnya
                                                    </Badge>
                                                )}
                                                {activePermissions.length === 0 && (
                                                    <span className="text-slate-400 italic text-sm">Tidak ada izin aktif</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right align-top py-4">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8 text-slate-500 hover:text-indigo-600"
                                                    onClick={(e) => { e.stopPropagation(); navigate(`/settings/roles/${role.id}`); }}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(role.id); }}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default RoleList;
