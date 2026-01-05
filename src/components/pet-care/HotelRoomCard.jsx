import React from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Camera, LogIn, LogOut, MoreVertical, PawPrint, User, Calendar, Clock, Share2, Printer } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { format, differenceInDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const HotelRoomCard = ({ room, booking, onCheckIn, onCheckOut, onShareCCTV, onViewDetails, onPrintInvoice }) => {
    const isOccupied = room.status === 'occupied' && booking;
    const isAvailable = room.status === 'available';
    const isMaintenance = room.status === 'maintenance';

    // Calculate duration/remaining days if occupied
    let daysRemaining = 0;

    if (isOccupied) {
        const end = new Date(booking.endDate);
        const today = new Date();
        daysRemaining = differenceInDays(end, today);
    }

    const getStatusColor = () => {
        if (isOccupied) return 'border-l-4 border-l-red-500 shadow-sm';
        if (isAvailable) return 'border-l-4 border-l-green-500 hover:shadow-md cursor-pointer transition-all opacity-90 hover:opacity-100';
        if (isMaintenance) return 'border-l-4 border-l-slate-400 bg-slate-50 opacity-60';
        return 'border-l-4 border-l-yellow-500';
    };

    return (
        <Card
            className={`flex flex-col h-full bg-white relative overflow-hidden ${getStatusColor()}`}
            onClick={() => isAvailable && onCheckIn(room)}
        >
            {/* Header / Room Name */}
            <div className="p-4 pb-2 flex justify-between items-start">
                <div>
                    <h3 className="font-bold text-lg leading-tight flex items-center gap-2">
                        {room.name}
                        {room.cameraSerial && (
                            <Camera className="w-3 h-3 text-slate-400" />
                        )}
                    </h3>
                    <div className="text-xs text-muted-foreground mt-0.5">{room.type}</div>
                </div>

                {isOccupied && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-6 w-6 -mr-2">
                                <MoreVertical className="h-4 w-4 text-slate-400" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onViewDetails(booking)}>
                                Detail Booking
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onPrintInvoice && onPrintInvoice(booking)}>
                                <Printer className="w-4 h-4 mr-2" />
                                Cetak Invoice
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600" onClick={() => onCheckOut(room, booking)}>
                                <LogOut className="w-4 h-4 mr-2" />
                                Check Out Now
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>

            {/* Content Body */}
            <div className="flex-1 p-4 pt-0">
                {isOccupied ? (
                    <div className="space-y-3 mt-2">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-600 font-bold border border-indigo-200">
                                <PawPrint className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="font-bold text-slate-800 leading-tight">{booking.petName}</div>
                                <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                    <User className="w-3 h-3" /> {booking.ownerName}
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 rounded-lg p-2 text-xs space-y-1.5 border border-slate-100">
                            <div className="flex justify-between items-center text-slate-600">
                                <span className="flex items-center gap-1.5">
                                    <LogIn className="w-3 h-3" /> Masuk
                                </span>
                                <span className="font-medium">
                                    {format(new Date(booking.startDate), 'dd MMM', { locale: idLocale })}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-slate-600">
                                <span className="flex items-center gap-1.5">
                                    <LogOut className="w-3 h-3" /> Keluar
                                </span>
                                <span className={`font-medium ${daysRemaining < 0 ? 'text-red-600' : ''}`}>
                                    {format(new Date(booking.endDate), 'dd MMM', { locale: idLocale })}
                                </span>
                            </div>
                        </div>
                    </div>
                ) : isAvailable ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 min-h-[100px] gap-2">
                        <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center">
                            <LogIn className="w-6 h-6 text-green-500/50" />
                        </div>
                        <span className="text-sm font-medium text-green-600/80">Tap to Check-In</span>
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                        Under Maintenance
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            {isOccupied && (
                <div className="p-3 border-t bg-slate-50/50 flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-xs gap-1 bg-white border-slate-200 hover:text-indigo-600 hover:border-indigo-200"
                        onClick={(e) => {
                            e.stopPropagation();
                            onShareCCTV(booking);
                        }}
                        disabled={!room.cameraSerial}
                    >
                        <Share2 className="w-3 h-3" />
                        {room.cameraSerial ? 'Share CCTV' : 'No Cam'}
                    </Button>
                    <Button
                        size="sm"
                        className="flex-1 h-8 text-xs gap-1 bg-indigo-600 hover:bg-indigo-700"
                        onClick={(e) => {
                            e.stopPropagation();
                            onCheckOut(room, booking);
                        }}
                    >
                        <LogOut className="w-3 h-3" />
                        Check Out
                    </Button>
                </div>
            )}
        </Card>
    );
};

export default HotelRoomCard;
