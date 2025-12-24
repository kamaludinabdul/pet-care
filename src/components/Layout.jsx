import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    LayoutGrid,
    Calendar,
    Home,
    Dog,
    LogOut,
    Settings,
    Activity,
    Store,
    FileText,
    Users,
    ChartBar,
    Pill,
    ChevronDown,
    ChevronRight,
    PieChart,
    Receipt,
    TrendingUp,
    ShoppingCart,
    ClipboardList,
    Database,
    Wallet,
    Stethoscope,
    Scissors
} from 'lucide-react';
import { Button } from './ui/button';

const Layout = () => {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // State for collapsible menus
    const [isReportsOpen, setIsReportsOpen] = useState(true);
    const [isDatabasesOpen, setIsDatabasesOpen] = useState(true);
    const [isServicesOpen, setIsServicesOpen] = useState(true);

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error("Failed to logout", error);
        }
    };

    const navItems = [
        { path: '/dashboard', label: 'Dashboard', icon: Home },
        { path: '/pet-care/bookings', label: 'Booking', icon: Calendar },
        { path: '/pet-care/medical-records', label: 'Rekam Medis', icon: FileText },

        // Services Execution Group
        {
            label: 'Layanan',
            icon: Stethoscope,
            isCollapsible: true,
            isOpen: isServicesOpen,
            toggle: () => setIsServicesOpen(!isServicesOpen),
            children: [
                { path: '/pet-care/services/clinic', label: 'Dokter / Klinik', icon: Stethoscope },
                { path: '/pet-care/services/grooming', label: 'Grooming', icon: Scissors },
                { path: '/pet-care/services/hotel', label: 'Pet Hotel', icon: Home },
            ]
        },

        // Databases Group
        {
            label: 'Databases',
            icon: Database,
            isCollapsible: true,
            isOpen: isDatabasesOpen,
            toggle: () => setIsDatabasesOpen(!isDatabasesOpen),
            children: [
                { path: '/customers', label: 'Data Pelanggan', icon: Users },
                { path: '/pet-care/pets', label: 'Data Hewan', icon: Dog },
                // Staff Management - Check Permission
                ...((user?.role === 'admin' || user?.role === 'super_admin' || user?.permissions?.manage_staff) ? [
                    { path: '/staff', label: 'Data Staff', icon: Users }
                ] : []),
                { path: '/pet-care/medicines', label: 'Data Obat', icon: Pill },
                { path: '/pet-care/rooms', label: 'Ketersediaan Kamar', icon: Home },
                { path: '/pet-care/services', label: 'Daftar Layanan & Harga', icon: ClipboardList },
            ]
        },

        // Super Admin Menu
        ...(user?.role === 'super_admin' ? [
            { path: '/stores', label: 'Toko', icon: Store }
        ] : []),

        // Collapsible Reports Group - Check Permission
        ...((user?.role === 'admin' || user?.role === 'super_admin' || user?.permissions?.view_reports) ? [{
            label: 'Laporan',
            icon: ChartBar,
            isCollapsible: true,
            isOpen: isReportsOpen,
            toggle: () => setIsReportsOpen(!isReportsOpen),
            children: [
                { path: '/reports', label: 'Laporan Utama', icon: PieChart },
                { path: '/pet-care/fee-report', label: 'Laporan Komisi', icon: Receipt },
                { path: '/pet-care/profit-report', label: 'Laba Rugi', icon: TrendingUp },
                { path: '/pet-care/cash-flow', label: 'Arus Kas', icon: Wallet },
            ]
        }] : []),

        { path: '/settings', label: 'Pengaturan', icon: Settings }
    ];

    return (
        <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col">
                <div className="p-6 border-b border-slate-100 flex items-center gap-3">
                    <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                        K
                    </div>
                    <div>
                        <h1 className="font-bold text-lg tracking-tight">Kula Care</h1>
                        <p className="text-xs text-muted-foreground">Pet Hotel & Grooming</p>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {navItems.map((item, index) => {
                        const Icon = item.icon;

                        // Render Collapsible Group
                        if (item.isCollapsible) {
                            const isActiveGroup = item.children.some(child => location.pathname === child.path);
                            return (
                                <div key={index} className="space-y-1">
                                    <button
                                        onClick={item.toggle}
                                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${isActiveGroup ? 'text-indigo-700 bg-indigo-50' : 'text-slate-600 hover:bg-slate-50'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Icon className={`h-5 w-5 shrink-0 ${isActiveGroup ? 'text-indigo-600' : 'text-slate-400'}`} />
                                            <span className="break-words">{item.label}</span>
                                        </div>
                                        {item.isOpen ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />}
                                    </button>

                                    {item.isOpen && (
                                        <div className="pl-4 space-y-1">
                                            {item.children.map((child) => {
                                                const ChildIcon = child.icon;
                                                const isChildActive = location.pathname === child.path;
                                                return (
                                                    <button
                                                        key={child.path}
                                                        onClick={() => navigate(child.path)}
                                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${isChildActive
                                                            ? 'bg-indigo-50/50 text-indigo-700'
                                                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                                                            }`}
                                                    >
                                                        <ChildIcon className={`h-4 w-4 shrink-0 ${isChildActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                                                        <span className="break-words line-clamp-2">{child.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        // Render Standard Item
                        const isActive = location.pathname === item.path;
                        return (
                            <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${isActive
                                    ? 'bg-indigo-50 text-indigo-700'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                    }`}
                            >
                                <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                                <span className="break-words">{item.label}</span>
                            </button>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-slate-100">
                    <div className="flex items-center gap-3 px-3 py-3 mb-2">
                        <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-medium text-xs">
                            {user?.email?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{user?.email}</p>
                            <p className="text-xs text-muted-foreground truncate">Operator</p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={handleLogout}
                    >
                        <LogOut className="h-4 w-4 mr-2" />
                        Keluar
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;
