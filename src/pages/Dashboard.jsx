import React from 'react';
import PetCareWidget from './pet-care/PetCareWidget';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Activity, Calendar, FileText } from 'lucide-react';

const Dashboard = () => {
    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            <header className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
                <p className="text-slate-500">Ringkasan aktivitas Pet Hotel & Grooming hari ini.</p>
            </header>

            {/* Main Stats Widgets */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* We will reuse PetCareWidget but maybe we need more generic cards too */}
                <PetCareWidget />

                {/* Temporary placeholder cards for other stats */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pendapatan Hari Ini</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Rp 0</div>
                        <p className="text-xs text-muted-foreground">+0% dari kemarin</p>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Activity / Quick Actions Section */}
            <div className="grid gap-6 md:grid-cols-2">
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Aktivitas Terkini</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-slate-500">Belum ada aktivitas baru.</p>
                    </CardContent>
                </Card>

                {/* Quick Actions */}
                <div className="grid gap-4 grid-cols-2">
                    <button className="p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-500 hover:shadow-md transition-all text-left group">
                        <Calendar className="h-6 w-6 text-indigo-600 mb-2 group-hover:scale-110 transition-transform" />
                        <h3 className="font-semibold text-slate-900">Booking Baru</h3>
                        <p className="text-xs text-slate-500 mt-1">Buat reservasi hotel/grooming</p>
                    </button>
                    <button className="p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-500 hover:shadow-md transition-all text-left group">
                        <FileText className="h-6 w-6 text-emerald-600 mb-2 group-hover:scale-110 transition-transform" />
                        <h3 className="font-semibold text-slate-900">Rekam Medis</h3>
                        <p className="text-xs text-slate-500 mt-1">Catat kesehatan hewan</p>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
