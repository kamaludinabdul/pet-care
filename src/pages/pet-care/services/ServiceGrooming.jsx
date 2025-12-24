
import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { collection, query, where, orderBy, updateDoc, doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Scissors, CheckCircle, Clock } from 'lucide-react';

const KanbanColumn = ({ title, status, colorClass, icon: Icon, items, onStatusUpdate }) => ( // eslint-disable-line no-unused-vars
    <div className={`flex flex-col gap-4 min-w-[300px] flex-1 bg-slate-50/50 p-4 rounded-xl border border-slate-100 ${colorClass}`}>
        <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Icon className="w-4 h-4" />
                {title}
            </h3>
            <Badge variant="secondary" className="bg-white translate-y-px shadow-sm">{items.length}</Badge>
        </div >
        <div className="flex flex-col gap-3 h-full">
            {items.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-lg bg-white/50">
                    Kosong
                </div>
            )}
            {items.map(task => (
                <Card key={task.id} className="shadow-sm hover:shadow-md transition-all border-slate-200">
                    <CardContent className="p-3">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <div className="font-semibold">{task.petName}</div>
                                <div className="text-xs text-muted-foreground">{task.serviceName}</div>
                            </div>
                            <div className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                {task.startTime}
                            </div>
                        </div>

                        {task.groomerName && (
                            <div className="text-xs text-indigo-600 mb-3 flex items-center gap-1">
                                <Scissors className="w-3 h-3" />
                                {task.groomerName}
                            </div>
                        )}

                        <div className="flex gap-2 mt-2">
                            {status === 'pending' && (
                                <Button size="sm" className="w-full h-8 text-xs bg-indigo-600 hover:bg-indigo-700" onClick={() => onStatusUpdate(task.id, 'processing')}>
                                    Mulai
                                </Button>
                            )}
                            {status === 'processing' && (
                                <Button size="sm" className="w-full h-8 text-xs bg-green-600 hover:bg-green-700" onClick={() => onStatusUpdate(task.id, 'completed')}>
                                    Selesai
                                </Button>
                            )}
                            {status === 'completed' && (
                                <div className="w-full text-center text-xs text-green-600 font-medium py-1 bg-green-50 rounded">
                                    Selesai
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    </div >
);

const ServiceGrooming = () => {
    const { user } = useAuth();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.storeId) return;

        const startOfDay = new Date().toISOString().split('T')[0];
        const q = query(
            collection(db, 'bookings'),
            where('storeId', '==', user.storeId),
            where('serviceType', '==', 'grooming'),
            where('startDate', '>=', startOfDay),
            orderBy('startDate', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setTasks(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        }, (error) => {
            console.error("Error fetching grooming tasks:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user?.storeId]);

    const updateStatus = async (bookingId, newStatus) => {
        try {
            await updateDoc(doc(db, 'bookings', bookingId), { status: newStatus });
            setTasks(prev => prev.map(t => t.id === bookingId ? { ...t, status: newStatus } : t));
        } catch (error) {
            console.error("Error updating status:", error);
        }
    };

    return (
        <div className="p-6 h-[calc(100vh-4rem)] flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Grooming Station</h1>
                    <p className="text-muted-foreground">Proses layanan grooming hari ini.</p>
                </div>
            </div>

            <div className="flex-1 overflow-x-auto pb-4">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-slate-500">Memuat...</div>
                    </div>
                ) : (
                    <div className="flex gap-4 h-full min-w-max">
                        <KanbanColumn
                            title="Perlu Dikerjakan"
                            status="pending"
                            items={tasks.filter(t => t.status === 'pending' || t.status === 'confirmed')}
                            colorClass="border-t-4 border-t-slate-400"
                            icon={Clock}
                            onStatusUpdate={updateStatus}
                        />
                        <KanbanColumn
                            title="Sedang Proses"
                            status="processing"
                            items={tasks.filter(t => t.status === 'processing')}
                            colorClass="border-t-4 border-t-indigo-500"
                            icon={Scissors}
                            onStatusUpdate={updateStatus}
                        />
                        <KanbanColumn
                            title="Selesai"
                            status="completed"
                            items={tasks.filter(t => t.status === 'completed')}
                            colorClass="border-t-4 border-t-green-500"
                            icon={CheckCircle}
                            onStatusUpdate={updateStatus}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ServiceGrooming;
