import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isWithinInterval, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent } from '../../components/ui/card';

const HotelCalendar = ({ bookings }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const goToToday = () => setCurrentMonth(new Date());

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const dateFormat = "d";
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const weekDays = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

    const getBookingsForDate = (date) => {
        return bookings.filter(booking => {
            if (!booking.startDate) return false;
            // Check if date is within booking range
            // If only startDate is present (single day or checkin), check equality
            // If endDate is present, check interval
            const start = parseISO(booking.startDate);
            const end = booking.endDate ? parseISO(booking.endDate) : start;

            // Allow checking out on the day to still show? 
            // Usually hotel bookings are "nights". 
            // Let's simply show if the date falls within [start, end] inclusive for visual simplicity.
            return isWithinInterval(date, { start, end });
        });
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-lg shadow border border-slate-200">
            {/* Calendar Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-semibold text-slate-800 capitalize">
                        {format(currentMonth, 'MMMM yyyy', { locale: idLocale })}
                    </h2>
                    <div className="flex bg-slate-100 rounded-md p-1">
                        <Button variant="ghost" size="icon" onClick={prevMonth} className="h-7 w-7">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={goToToday} className="h-7 px-2 text-xs">
                            Hari Ini
                        </Button>
                        <Button variant="ghost" size="icon" onClick={nextMonth} className="h-7 w-7">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                <div className="flex gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-500"></div> Confirmed</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> Checked In</div>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="flex flex-col flex-1">
                {/* Week Day Names */}
                <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
                    {weekDays.map(day => (
                        <div key={day} className="py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Days */}
                <div className="grid grid-cols-7 flex-1 auto-rows-fr">
                    {days.map((day) => {
                        const dayBookings = getBookingsForDate(day);
                        const isToday = isSameDay(day, new Date());

                        return (
                            <div
                                key={day.toString()}
                                className={`min-h-[120px] border-b border-r border-slate-100 p-1 transition-colors hover:bg-slate-50 ${!isSameMonth(day, monthStart) ? 'bg-slate-50/50 text-slate-400' : 'bg-white'
                                    } `}
                            >
                                <div className="flex justify-between items-start mb-1 px-1">
                                    <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-700'
                                        } `}>
                                        {format(day, dateFormat)}
                                    </span>
                                </div>
                                <div className="flex flex-col gap-1 overflow-y-auto max-h-[100px] px-1">
                                    {dayBookings.map(booking => {
                                        // Find room name from items
                                        const roomItem = booking.items?.find(i => i.type === 'room_booking');
                                        const roomName = roomItem ? roomItem.name : 'Unknown Room';

                                        return (
                                            <div
                                                key={booking.id}
                                                className={`text-[10px] px-1.5 py-1 rounded border truncate flex flex-col leading-tight ${booking.status === 'checked_in'
                                                    ? 'bg-green-50 text-green-700 border-green-200'
                                                    : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                                    } `}
                                                title={`${roomName} - ${booking.petName} (${booking.customer?.name})`}
                                            >
                                                <span className="font-bold">{roomName}</span>
                                                <span className="opacity-90">{booking.petName}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default HotelCalendar;
