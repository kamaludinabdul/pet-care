import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "../components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { useData } from '../context/DataContext';
import { Loader2, ArrowUp, ArrowDown, History } from 'lucide-react';

const ProductHistoryDialog = ({ isOpen, onClose, product }) => {
    const { stockMovements } = useData();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && product) {
            setLoading(true);
            // Filter movements for this product from the global context
            // Since movements are already fetched and sorted in context, we just filter
            const productMovements = stockMovements.filter(m => m.productId === product.id);
            setHistory(productMovements);
            setLoading(false);
        }
    }, [isOpen, product, stockMovements]);

    const getTypeBadge = (type) => {
        switch (type) {
            case 'in':
                return <Badge className="bg-green-100 text-green-700 hover:bg-green-200"><ArrowUp size={12} className="mr-1" /> Masuk</Badge>;
            case 'out':
                return <Badge className="bg-red-100 text-red-700 hover:bg-red-200"><ArrowDown size={12} className="mr-1" /> Keluar</Badge>;
            case 'adjustment':
                return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200"><History size={12} className="mr-1" /> Opname</Badge>;
            default:
                return <Badge variant="outline">{type}</Badge>;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <History className="h-5 w-5" />
                        Riwayat Stok: {product?.name}
                    </DialogTitle>
                    <DialogDescription>
                        Catatan pergerakan stok untuk produk ini.
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-4">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                        </div>
                    ) : history.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground border rounded-lg bg-slate-50">
                            Belum ada riwayat pergerakan stok.
                        </div>
                    ) : (
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50">
                                        <TableHead>Tanggal</TableHead>
                                        <TableHead>Tipe</TableHead>
                                        <TableHead className="text-right">Jumlah</TableHead>
                                        <TableHead>Keterangan</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {history.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="text-sm">
                                                <div className="font-medium">
                                                    {new Date(item.date).toLocaleDateString('id-ID')}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {new Date(item.date).toLocaleTimeString('id-ID')}
                                                </div>
                                            </TableCell>
                                            <TableCell>{getTypeBadge(item.type)}</TableCell>
                                            <TableCell className={`text-right font-bold ${item.type === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                                                {item.type === 'in' ? '+' : '-'}{item.qty}
                                            </TableCell>
                                            <TableCell className="text-sm text-slate-600">
                                                {item.note || '-'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ProductHistoryDialog;
