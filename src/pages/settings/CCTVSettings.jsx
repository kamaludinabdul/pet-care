import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Plus, Camera, Trash2, Edit, Key, Save, Eye, EyeOff, Wifi, WifiOff } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import ConfirmDialog from '../../components/ConfirmDialog';
import { testConnection } from '../../services/ezvizService';

const CCTVSettings = () => {
    const { user } = useAuth();
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [deviceToDelete, setDeviceToDelete] = useState(null);
    const [currentDevice, setCurrentDevice] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // API Credentials State
    const [apiCredentials, setApiCredentials] = useState({
        appKey: '',
        appSecret: ''
    });
    const [showSecret, setShowSecret] = useState(false);
    const [isSavingApi, setIsSavingApi] = useState(false);
    const [apiSaved, setApiSaved] = useState(false);

    // Test Connection State
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        serialNumber: '',
        type: 'camera',
        channels: 1,
        verificationCode: ''
    });

    const storeId = user?.storeId;

    useEffect(() => {
        fetchDevices();
        fetchApiCredentials();
    }, [storeId]);

    const fetchApiCredentials = async () => {
        if (!storeId) return;
        try {
            const docRef = doc(db, 'cctv_settings', storeId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setApiCredentials({
                    appKey: data.appKey || '',
                    appSecret: data.appSecret || ''
                });
            }
        } catch (error) {
            console.error("Error fetching API credentials:", error);
        }
    };

    const handleTestConnection = async (e) => {
        e.preventDefault();
        setIsTesting(true);
        setTestResult(null);

        // We use a dummy serial for the initial connection test or pick the first one if available
        let testSerial = 'BD7714453'; // Default fallback
        if (devices.length > 0) {
            testSerial = devices[0].serialNumber;
        }

        try {
            const result = await testConnection(apiCredentials.appKey, apiCredentials.appSecret, testSerial);
            setTestResult(result);

            if (result.success) {
                // Auto save if successful and not saved
                if (!apiSaved) {
                    await saveApiCredentials();
                }
            }
        } catch (error) {
            console.error('Test connection error:', error);
            setTestResult({
                success: false,
                error: 'Terjadi kesalahan sistem'
            });
        } finally {
            setIsTesting(false);
        }
    };

    const saveApiCredentials = async () => {
        if (!storeId) return;
        setIsSavingApi(true);
        try {
            const docRef = doc(db, 'cctv_settings', storeId);
            await setDoc(docRef, {
                appKey: apiCredentials.appKey,
                appSecret: apiCredentials.appSecret,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            setApiSaved(true);
            setTimeout(() => setApiSaved(false), 2000);
        } catch (error) {
            console.error("Error saving API credentials:", error);
            alert('Gagal menyimpan API credentials');
        } finally {
            setIsSavingApi(false);
        }
    };

    const fetchDevices = async () => {
        if (!storeId) return;
        setLoading(true);
        try {
            const q = query(collection(db, 'cctv_devices'), where('storeId', '==', storeId));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setDevices(data);
        } catch (error) {
            console.error("Error fetching CCTV devices:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!storeId) return;
        setIsSaving(true);

        try {
            if (currentDevice) {
                // Update
                await updateDoc(doc(db, 'cctv_devices', currentDevice.id), {
                    ...formData,
                    updatedAt: new Date().toISOString()
                });
            } else {
                // Create
                await addDoc(collection(db, 'cctv_devices'), {
                    ...formData,
                    storeId,
                    status: 'unknown',
                    createdAt: new Date().toISOString()
                });
            }
            setIsDialogOpen(false);
            resetForm();
            fetchDevices();
        } catch (error) {
            console.error("Error saving device:", error);
            alert('Gagal menyimpan device');
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (device) => {
        setCurrentDevice(device);
        setFormData({
            name: device.name,
            serialNumber: device.serialNumber,
            type: device.type || 'camera',
            channels: device.channels || 1,
            verificationCode: device.verificationCode || ''
        });
        setIsDialogOpen(true);
    };

    const handleDelete = (device) => {
        setDeviceToDelete(device);
        setIsDeleteOpen(true);
    };

    const confirmDelete = async () => {
        if (!deviceToDelete) return;
        try {
            await deleteDoc(doc(db, 'cctv_devices', deviceToDelete.id));
            setDevices(prev => prev.filter(d => d.id !== deviceToDelete.id));
            setIsDeleteOpen(false);
        } catch (error) {
            console.error("Error deleting device:", error);
        }
    };

    const resetForm = () => {
        setCurrentDevice(null);
        setFormData({
            name: '',
            serialNumber: '',
            type: 'camera',
            channels: 1,
            verificationCode: ''
        });
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'online':
                return <Badge className="bg-green-100 text-green-800"><Wifi className="h-3 w-3 mr-1" />Online</Badge>;
            case 'offline':
                return <Badge className="bg-red-100 text-red-800"><WifiOff className="h-3 w-3 mr-1" />Offline</Badge>;
            default:
                return <Badge variant="outline">Unknown</Badge>;
        }
    };

    return (
        <div className="p-6 w-full space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Pengaturan CCTV</h1>
                    <p className="text-slate-500">Kelola device CCTV untuk monitoring pet hotel.</p>
                </div>
                <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" />
                    Tambah Device
                </Button>
            </header>

            {/* API Credentials Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Key className="h-5 w-5 text-indigo-600" />
                        EZVIZ API Credentials
                    </CardTitle>
                    <CardDescription>
                        Masukkan App Key dan App Secret dari EZVIZ Open Platform.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="appKey">App Key</Label>
                            <Input
                                id="appKey"
                                value={apiCredentials.appKey}
                                onChange={(e) => setApiCredentials({ ...apiCredentials, appKey: e.target.value })}
                                placeholder="1dbe419471f842a1a61afef4c3494685"
                                className="font-mono text-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="appSecret">App Secret</Label>
                            <div className="relative">
                                <Input
                                    id="appSecret"
                                    type={showSecret ? 'text' : 'password'}
                                    value={apiCredentials.appSecret}
                                    onChange={(e) => setApiCredentials({ ...apiCredentials, appSecret: e.target.value })}
                                    placeholder="••••••••••••••••"
                                    className="font-mono text-sm pr-10"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-0 h-full"
                                    onClick={() => setShowSecret(!showSecret)}
                                >
                                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            {testResult && (
                                <div className={`text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                                    {testResult.success ? '✓ Terhubung' : `✗ ${testResult.error}`}
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={handleTestConnection}
                                disabled={isTesting || !apiCredentials.appKey || !apiCredentials.appSecret}
                            >
                                {isTesting ? 'Testing...' : 'Test Koneksi'}
                            </Button>
                            <Button onClick={saveApiCredentials} disabled={isSavingApi}>
                                {isSavingApi ? 'Menyimpan...' : apiSaved ? '✓ Tersimpan' : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Simpan
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500">
                        Dapatkan credentials dari <a href="https://open.ezviz.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">open.ezviz.com</a>.
                        Test koneksi mungkin gagal karena CORS - gunakan tombol "Test Device" di tabel device.
                    </p>
                </CardContent>
            </Card>

            {/* Device List Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Camera className="h-5 w-5 text-indigo-600" />
                        Daftar Device
                    </CardTitle>
                    <CardDescription>
                        Device CCTV EZVIZ yang terhubung. Gunakan Serial Number dari sticker device.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nama Device</TableHead>
                                <TableHead>Serial Number</TableHead>
                                <TableHead>Tipe</TableHead>
                                <TableHead>Channel</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8">Memuat...</TableCell>
                                </TableRow>
                            ) : devices.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        Belum ada device CCTV. Klik "Tambah Device" untuk menambahkan.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                devices.map(device => (
                                    <TableRow key={device.id}>
                                        <TableCell className="font-medium">{device.name}</TableCell>
                                        <TableCell className="font-mono text-sm">{device.serialNumber}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="capitalize">
                                                {device.type === 'nvr' ? 'NVR' : 'Camera'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{device.channels || 1}</TableCell>
                                        <TableCell>{getStatusBadge(device.status)}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(device)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                    onClick={() => handleDelete(device)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Add/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) { setIsDialogOpen(false); resetForm(); } else { setIsDialogOpen(true); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{currentDevice ? 'Edit Device' : 'Tambah Device CCTV'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nama Device</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Contoh: Camera Room VIP"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="serialNumber">Serial Number</Label>
                            <Input
                                id="serialNumber"
                                value={formData.serialNumber}
                                onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value.toUpperCase() })}
                                placeholder="Contoh: BD7714453"
                                required
                                className="font-mono"
                            />
                            <p className="text-xs text-slate-500">
                                Serial Number bisa dilihat di sticker device atau di app EZVIZ.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="type">Tipe Device</Label>
                                <Select
                                    value={formData.type}
                                    onValueChange={(v) => setFormData({ ...formData, type: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="camera">Camera</SelectItem>
                                        <SelectItem value="nvr">NVR</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="channels">Jumlah Channel</Label>
                                <Input
                                    id="channels"
                                    type="number"
                                    min="1"
                                    max="64"
                                    value={formData.channels}
                                    onChange={(e) => setFormData({ ...formData, channels: parseInt(e.target.value) || 1 })}
                                />
                                <p className="text-xs text-slate-500">
                                    Camera: 1, NVR: tergantung model (4/8/16/32)
                                </p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="verificationCode">Verification Code (Opsional)</Label>
                            <Input
                                id="verificationCode"
                                value={formData.verificationCode}
                                onChange={(e) => setFormData({ ...formData, verificationCode: e.target.value.toUpperCase() })}
                                placeholder="6-digit code"
                                maxLength="6"
                                className="font-mono"
                            />
                            <p className="text-xs text-slate-500">
                                Kode verifikasi 6-digit untuk kamera yang menggunakan enkripsi. Bisa dilihat di sticker kamera atau app EZVIZ.
                            </p>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                Batal
                            </Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? 'Menyimpan...' : currentDevice ? 'Simpan' : 'Tambah'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                isOpen={isDeleteOpen}
                onClose={() => setIsDeleteOpen(false)}
                onConfirm={confirmDelete}
                title="Hapus Device"
                description={`Apakah Anda yakin ingin menghapus device "${deviceToDelete?.name}"?`}
                confirmText="Hapus"
                variant="destructive"
            />
        </div >
    );
};

export default CCTVSettings;
