import React from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { id } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Calendar } from './ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from './ui/popover';

export function DateRangePicker({
    date,
    setDate,
    className,
}) {
    const [month, setMonth] = React.useState(date?.from);
    const [isOpen, setIsOpen] = React.useState(false);

    const handlePreset = (preset) => {
        const today = new Date();
        let from = new Date();
        let to = new Date();

        switch (preset) {
            case 'today':
                from = today;
                to = today;
                break;
            case 'yesterday':
                from = new Date(today);
                from.setDate(today.getDate() - 1);
                to = new Date(from);
                break;
            case 'last7':
                from = new Date(today);
                from.setDate(today.getDate() - 6);
                to = today;
                break;
            case 'thisMonth':
                from = new Date(today.getFullYear(), today.getMonth(), 1);
                to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                break;
            case 'lastMonth':
                from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                to = new Date(today.getFullYear(), today.getMonth(), 0);
                break;
            default:
                break;
        }

        // Set to end of day for consistency
        if (to) to.setHours(23, 59, 59, 999);
        if (from) from.setHours(0, 0, 0, 0);

        setDate({ from, to });
        setMonth(from); // Update calendar view
        setIsOpen(false); // Close popover
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                        "w-[300px] justify-start text-left font-normal",
                        !date && "text-muted-foreground",
                        className
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date?.from ? (
                        date.to ? (
                            <>
                                {format(date.from, "dd MMM yyyy", { locale: id })} -{" "}
                                {format(date.to, "dd MMM yyyy", { locale: id })}
                            </>
                        ) : (
                            format(date.from, "dd MMM yyyy", { locale: id })
                        )
                    ) : (
                        <span>Pilih Tanggal</span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
                <div className="flex">
                    <div className="border-r p-2 flex flex-col gap-2 min-w-[140px]">
                        <Button variant="ghost" className="justify-start font-normal" onClick={() => handlePreset('today')}>
                            Hari Ini
                        </Button>
                        <Button variant="ghost" className="justify-start font-normal" onClick={() => handlePreset('yesterday')}>
                            Kemarin
                        </Button>
                        <Button variant="ghost" className="justify-start font-normal" onClick={() => handlePreset('last7')}>
                            7 Hari Terakhir
                        </Button>
                        <Button variant="ghost" className="justify-start font-normal" onClick={() => handlePreset('thisMonth')}>
                            Bulan Ini
                        </Button>
                        <Button variant="ghost" className="justify-start font-normal" onClick={() => handlePreset('lastMonth')}>
                            Bulan Lalu
                        </Button>
                    </div>
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={date?.from}
                        month={month}
                        onMonthChange={setMonth}
                        selected={date}
                        onSelect={setDate}
                        numberOfMonths={2}
                        locale={id}
                    />
                </div>
            </PopoverContent>
        </Popover>
    );
}
