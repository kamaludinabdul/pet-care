import React, { useState } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addDays, parseISO, isWithinInterval } from 'date-fns';
import { id } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Home, Scissors } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/utils';
import { Badge } from '../../components/ui/badge';

const CalendarView = ({ bookings, onSelectBooking }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const startDate = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }); // Monday start
    const endDate = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });

    const calendarDays = eachDayOfInterval({
        start: startDate,
        end: endDate,
    });

    const nextMonth = () => {
        setCurrentMonth(addDays(currentMonth, 30));
    };

    const prevMonth = () => {
        setCurrentMonth(addDays(currentMonth, -30));
    };

    const getDayBookings = (day) => {
        return bookings.filter(b => {
            if (b.serviceType === 'hotel') {
                return isWithinInterval(day, {
                    start: parseISO(b.startDate),
                    end: parseISO(b.endDate)
                });
            } else {
                return isSameDay(parseISO(b.startDate), day);
            }
        });
    };

    return (
        <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-bold text-slate-900 capitalize">
                    {format(currentMonth, 'MMMM yyyy', { locale: id })}
                </h2>
                <div className="flex gap-1">
                    <Button variant="outline" size="icon" onClick={prevMonth}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => setCurrentMonth(new Date())}>
                        Today
                    </Button>
                    <Button variant="outline" size="icon" onClick={nextMonth}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Days Header */}
            <div className="grid grid-cols-7 bg-slate-50 border-b">
                {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day) => (
                    <div key={day} className="py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 auto-rows-fr">
                {calendarDays.map((day, dayIdx) => {
                    const dayEvents = getDayBookings(day);
                    const isToday = isSameDay(day, new Date());
                    const isCurrentMonth = isSameMonth(day, currentMonth);

                    return (
                        <div
                            key={day.toString()}
                            className={cn(
                                "min-h-[120px] p-2 border-b border-r relative group transition-colors",
                                isCurrentMonth ? "bg-white" : "bg-slate-50/50 text-slate-400",
                                isToday && "bg-indigo-50/30"
                            )}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={cn(
                                    "text-sm font-medium h-6 w-6 flex items-center justify-center rounded-full",
                                    isToday ? "bg-indigo-600 text-white" : ""
                                )}>
                                    {format(day, 'd')}
                                </span>
                            </div>

                            <div className="space-y-1 overflow-y-auto max-h-[90px]">
                                {dayEvents.map(event => {
                                    // Relaxed logic: Check top-level roomName first, then items
                                    let roomName = event.roomName;
                                    if (!roomName) {
                                        const roomItem = event.items?.find(i => i.type === 'room_booking') || (event.items && event.items.length > 0 ? event.items[0] : null);
                                        roomName = roomItem ? roomItem.name : null;
                                    }

                                    return (
                                        <div
                                            key={`${event.id}-${dayIdx}`}
                                            onClick={() => onSelectBooking(event)}
                                            className={cn(
                                                "text-[10px] px-1.5 py-1 rounded border cursor-pointer flex flex-col gap-0.5 shadow-sm min-h-[36px]",
                                                event.serviceType === 'hotel'
                                                    ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                                                    : "bg-pink-50 border-pink-200 text-pink-700 hover:bg-pink-100"
                                            )}
                                            title={`${roomName ? roomName + ' - ' : ''}${event.petName}`}
                                        >
                                            <div className="flex items-center gap-1 font-bold">
                                                {event.serviceType === 'hotel' ? <Home className="h-3 w-3 flex-shrink-0" /> : <Scissors className="h-3 w-3 flex-shrink-0" />}
                                                {roomName && <span className="truncate">{roomName}</span>}
                                            </div>
                                            <div className="pl-4 truncate font-medium opacity-90">
                                                {event.petName}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default CalendarView;
