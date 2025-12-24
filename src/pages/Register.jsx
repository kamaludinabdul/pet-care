import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, ChevronRight, Mail, User, Store, Check, Layers, Scissors } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../components/ui/card';

const Register = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        storeName: '',
        appType: 'pos_petcare' // Default to complete package
    });

    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const { signup } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.id]: e.target.value });
    };

    const handleAppTypeSelect = (type) => {
        setFormData({ ...formData, appType: type });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        if (formData.password.length < 6) {
            setError('Password minimal 6 karakter');
            setIsLoading(false);
            return;
        }

        const result = await signup(
            formData.email,
            formData.password,
            formData.name,
            formData.storeName,
            formData.appType
        );

        if (result.success) {
            navigate('/');
        } else {
            setError(result.message);
        }
        setIsLoading(false);
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
            <Card className="w-full max-w-2xl shadow-2xl">
                <CardHeader className="space-y-4 text-center pb-8">
                    <div className="mx-auto flex flex-col items-center justify-center mb-4">
                        <div className="h-16 w-16 bg-indigo-600 rounded-2xl flex items-center justify-center mb-3">
                            <span className="text-3xl font-bold text-white">K</span>
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900">Bergabung dengan Kula Care</h1>
                        <p className="text-sm font-medium text-indigo-600">Platform Manajemen Pet Shop Modern</p>
                    </div>
                    <CardDescription className="text-base mt-2">
                        Daftarkan bisnis Anda dan mulai kelola dengan lebih mudah
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Left Column: Personal Info */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-slate-900">Informasi Pengguna</h3>

                                <div className="space-y-2">
                                    <Label htmlFor="name">Nama Lengkap</Label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                        <Input
                                            id="name"
                                            value={formData.name}
                                            onChange={handleChange}
                                            placeholder="Nama Pemilik"
                                            className="pl-10"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                        <Input
                                            id="email"
                                            type="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            placeholder="nama@email.com"
                                            className="pl-10"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="password">Password</Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                        <Input
                                            id="password"
                                            type={showPassword ? "text" : "password"}
                                            value={formData.password}
                                            onChange={handleChange}
                                            placeholder="Minimal 6 karakter"
                                            className="pl-10 pr-10"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            {showPassword ? "Hide" : "Show"}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Business Info & App Selection */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-slate-900">Informasi Bisnis</h3>

                                <div className="space-y-2">
                                    <Label htmlFor="storeName">Nama Bisnis / Toko</Label>
                                    <div className="relative">
                                        <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                        <Input
                                            id="storeName"
                                            value={formData.storeName}
                                            onChange={handleChange}
                                            placeholder="Contoh: Pet Shop Maju Jaya"
                                            className="pl-10"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3 pt-2">
                                    <Label>Pilih Tipe Aplikasi</Label>

                                    {/* Option 1: Complete */}
                                    <div
                                        className={`relative p-4 border rounded-xl cursor-pointer transition-all ${formData.appType === 'pos_petcare' ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' : 'border-slate-200 hover:border-slate-300'}`}
                                        onClick={() => handleAppTypeSelect('pos_petcare')}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="mt-1 bg-indigo-100 p-2 rounded-lg text-indigo-600">
                                                <Layers className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <div className="font-semibold text-slate-900 flex items-center gap-2">
                                                    Lengkap
                                                    {formData.appType === 'pos_petcare' && <Check className="h-4 w-4 text-indigo-600" />}
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1">Kasir (POS) + Manajemen Pet Care (Hotel & Grooming)</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Option 2: Pet Care Only */}
                                    <div
                                        className={`relative p-4 border rounded-xl cursor-pointer transition-all ${formData.appType === 'petcare_only' ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' : 'border-slate-200 hover:border-slate-300'}`}
                                        onClick={() => handleAppTypeSelect('petcare_only')}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="mt-1 bg-pink-100 p-2 rounded-lg text-pink-600">
                                                <Scissors className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <div className="font-semibold text-slate-900 flex items-center gap-2">
                                                    Pet Care Saja
                                                    {formData.appType === 'petcare_only' && <Check className="h-4 w-4 text-indigo-600" />}
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1">Hanya Manajemen Hotel & Grooming. Tanpa fitur Kasir Ritel.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-12 text-base gap-2 mt-6"
                            disabled={isLoading}
                        >
                            <span>{isLoading ? 'Memproses Pendaftaran...' : 'Buat Akun Sekarang'}</span>
                            <ChevronRight className="h-5 w-5" />
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex justify-center pb-8">
                    <p className="text-sm text-slate-600">
                        Sudah punya akun?{' '}
                        <Link to="/login" className="text-indigo-600 font-semibold hover:underline">
                            Masuk disini
                        </Link>
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
};

export default Register;
