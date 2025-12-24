import React, { useState, useEffect } from 'react';
import { useStores } from '../context/StoresContext';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Store, Save, MapPin, Phone, Image } from 'lucide-react';

const Settings = () => {
    const { stores, activeStoreId, updateStore } = useStores();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        phone: '',
        logo: ''
    });

    useEffect(() => {
        if (activeStoreId && stores.length > 0) {
            const currentStore = stores.find(s => s.id === activeStoreId);
            if (currentStore) {
                setFormData({
                    name: currentStore.name || '',
                    address: currentStore.address || '',
                    phone: currentStore.phone || '',
                    logo: currentStore.logo || ''
                });
            }
        }
    }, [activeStoreId, stores]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const result = await updateStore(activeStoreId, formData);
            if (result.success) {
                alert('Pengaturan toko berhasil disimpan!');
            } else {
                alert('Gagal menyimpan pengaturan: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error("Error saving settings:", error);
            alert('Terjadi kesalahan saat menyimpan.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <header className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Pengaturan Toko</h1>
                <p className="text-slate-500">Kelola profil dan branding toko Anda.</p>
            </header>

            <form onSubmit={handleSubmit}>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Store className="h-5 w-5 text-indigo-600" />
                            Profil Toko
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nama Toko</Label>
                                <div className="relative">
                                    <Store className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                    <Input
                                        id="name"
                                        className="pl-9"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Nama Toko Anda"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Nomor Telepon</Label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                    <Input
                                        id="phone"
                                        className="pl-9"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="0812..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="address">Alamat Lengkap</Label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <Input
                                    id="address"
                                    className="pl-9"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    placeholder="Jl. Contoh No. 123"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="logo">URL Logo Toko</Label>
                            <div className="relative">
                                <Image className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <Input
                                    id="logo"
                                    className="pl-9"
                                    value={formData.logo}
                                    onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                                    placeholder="https://example.com/logo.png"
                                />
                            </div>
                            <p className="text-xs text-slate-500">
                                Masukkan URL gambar logo Anda (disarankan rasio 1:1, format PNG/JPG).
                                Logo ini akan muncul di Invoice dan Dashboard.
                            </p>
                            {formData.logo && (
                                <div className="mt-4 p-4 border rounded-lg bg-slate-50 flex items-center justify-center">
                                    <img
                                        src={formData.logo}
                                        alt="Logo Preview"
                                        className="h-24 w-24 object-contain rounded-md bg-white border shadow-sm"
                                        onError={(e) => { e.target.src = 'https://placehold.co/100?text=Invalid+URL'; }}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="pt-4 flex justify-end">
                            <Button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700">
                                {isLoading ? (
                                    <>
                                        <span className="animate-spin mr-2">⏳</span> Menyimpan...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" /> Simpan Perubahan
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </form>
        </div>
    );
};

export default Settings;
