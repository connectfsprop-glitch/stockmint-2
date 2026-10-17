'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Download, Search, X, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import { formatSimpleInstrumentName } from '@/lib/format-instrument';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSearchParams, useRouter } from 'next/navigation';
import { getAllUsers, type UserProfile } from '@/app/actions/get-all-users';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { useUserProfile } from '@/hooks/use-user-profile';


type Order = {
    id: number;
    created_at: string;
    symbol: string;
    order_type: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    status: string;
    average_price: number | null;
    pnl: number | null;
    profiles: {
        id: string;
        full_name: string;
    } | null;
};

const formatCurrency = (value: number | null | undefined, placeholder = '₹0.00', showSign = false) => {
    if (value === null || typeof value === 'undefined' || isNaN(value)) {
        return placeholder;
    }
    const formatted = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(value));

    if (showSign) {
        return value >= 0 ? `+${formatted}` : `-${formatted}`;
    }
    return formatted;
};

function MasterLog({ type }: { type: 'orders' | 'trades' }) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [data, setData] = useState<Order[]>([]);
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(searchParams.get('userId'));
    const [isLoading, setIsLoading] = useState(true);
    const [isUsersLoading, setIsUsersLoading] = useState(true);
    const [date, setDate] = React.useState<DateRange | undefined>(undefined); // Default to undefined for "All time"
    const [open, setOpen] = React.useState(false)

    const selectedUser = useMemo(() => {
        return allUsers.find(user => user.id === selectedUserId) || null;
    }, [allUsers, selectedUserId]);

    const fetchUsers = useCallback(async () => {
        setIsUsersLoading(true);
        const result = await getAllUsers();
        if (result.success) {
            setAllUsers(result.data);
        } else {
            console.error("Failed to fetch users:", result.error);
        }
        setIsUsersLoading(false);
    }, []);

    const fetchData = useCallback(async () => {
        setIsLoading(true);

        let query = supabase
            .from('orders')
            .select(`
                *,
                profiles (
                    id,
                    full_name
                )
            `)
            .order('created_at', { ascending: false });

        if (selectedUserId) {
            query = query.eq('user_id', selectedUserId);
        }

        if (date?.from) {
            query = query.gte('created_at', date.from.toISOString());
        }
        if (date?.to) {
            const toDate = new Date(date.to);
            toDate.setUTCHours(23, 59, 59, 999);
            query = query.lte('created_at', toDate.toISOString());
        }
        
        if (type === 'trades') {
            query = query.eq('status', 'COMPLETED').not('pnl', 'is', null);
        }

        const { data, error } = await query;
        if (error) {
            console.error("Error fetching master log:", error);
            setData([]);
        } else {
            setData(data as Order[]);
        }
        setIsLoading(false);
    }, [date, type, selectedUserId]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);
    
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleClearFilter = () => {
        setSelectedUserId(null);
        router.push('/admin/trades'); 
    };

    const calculateEntryPrice = (item: Order) => {
        if (item.pnl === null || item.quantity === 0) return 0;
        
        const closingOrderType = item.order_type; // This is the order that *closed* the position

        if (closingOrderType === 'SELL') {
             return item.price - (item.pnl / item.quantity);
        } else { // closingOrderType is 'BUY'
             return item.price + (item.pnl / item.quantity);
        }
    }

    const downloadPDF = () => {
        const doc = new jsPDF();
        const title = type === 'orders' ? "Master Order Report" : "Master Trade Report";
        doc.text(title, 14, 16);
        if (selectedUser) {
            doc.setFontSize(12);
            doc.text(`Filtered for user: ${selectedUser.full_name}`, 14, 22);
        }
        
        let head: any[], body: any[], columnStyles: any = {};
        const startY = selectedUser ? 28 : 22;

        if (type === 'orders') {
            head = [['User', 'Instrument', 'Type', 'Qty', 'Price', 'Status', 'Date']];
            body = data.map(item => [
                item.profiles?.full_name || 'N/A',
                formatSimpleInstrumentName({ tradingsymbol: item.symbol }),
                item.order_type,
                item.quantity,
                formatCurrency(item.price),
                item.status,
                new Date(item.created_at).toLocaleString(),
            ]);
            columnStyles = { 6: { cellWidth: 'auto' } };
        } else {
            head = [['User', 'Instrument', 'Type', 'Qty', 'Entry', 'Exit', 'P&L', 'Date']];
            body = data.map(item => {
                const entryPrice = calculateEntryPrice(item);
                const tradeType = item.order_type === 'SELL' ? 'BUY' : 'SELL';
                return [
                    item.profiles?.full_name || 'N/A',
                    formatSimpleInstrumentName({ tradingsymbol: item.symbol }),
                    tradeType,
                    item.quantity,
                    formatCurrency(entryPrice),
                    formatCurrency(item.price),
                    formatCurrency(item.pnl, '₹0.00', true),
                    new Date(item.created_at).toLocaleString(),
                ];
            });
            columnStyles = { 7: { cellWidth: 'auto' } };
        }

        (doc as any).autoTable({
            head: head,
            body: body,
            startY: startY,
            headStyles: { fillColor: [22, 163, 74] },
            columnStyles: columnStyles,
            theme: 'striped',
        });

        const userFileName = selectedUser ? `_${selectedUser.full_name.replace(/\s+/g, '_')}` : '';
        doc.save(`${type}_report${userFileName}.pdf`);
    };

    return (
        <Card>
            <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <CardTitle className="font-headline capitalize">{type}</CardTitle>
                    <CardDescription>
                        {type === 'orders' ? 'A log of all individual orders.' : 'A log of all completed trades with P&L.'}
                    </CardDescription>
                </div>
                 <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                     {type === 'trades' && (
                        <Popover open={open} onOpenChange={setOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={open}
                                    className="w-full sm:w-[200px] justify-between"
                                >
                                    {selectedUser ? selectedUser.full_name : "Select user..."}
                                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[200px] p-0">
                                <Command>
                                    <CommandInput placeholder="Search user..." />
                                    <CommandEmpty>No user found.</CommandEmpty>
                                    <CommandGroup>
                                        <CommandItem
                                            onSelect={() => {
                                                handleClearFilter();
                                                setOpen(false);
                                            }}
                                        >
                                            All Users
                                        </CommandItem>
                                        {allUsers.map((user) => (
                                            <CommandItem
                                                key={user.id}
                                                value={user.full_name || ''}
                                                onSelect={() => {
                                                    setSelectedUserId(user.id);
                                                    setOpen(false);
                                                }}
                                            >
                                                {user.full_name}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    )}
                    <div className="relative">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                id="date"
                                variant={"outline"}
                                className={cn(
                                    "w-full sm:w-[260px] justify-start text-left font-normal",
                                    !date && "text-muted-foreground"
                                )}
                                >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date?.from ? (
                                    date.to ? (
                                    <>
                                        {format(date.from, "LLL dd, y")} -{" "}
                                        {format(date.to, "LLL dd, y")}
                                    </>
                                    ) : (
                                    format(date.from, "LLL dd, y")
                                    )
                                ) : (
                                    <span>All time</span>
                                )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                                <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={date?.from}
                                selected={date}
                                onSelect={setDate}
                                numberOfMonths={2}
                                />
                            </PopoverContent>
                        </Popover>
                        {date && (
                             <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                                onClick={() => setDate(undefined)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>

                    <Button onClick={downloadPDF} disabled={data.length === 0} className="w-full sm:w-auto">
                        <Download className="mr-2 h-4 w-4" />
                        Download
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="md:hidden">
                    {isLoading ? (
                        <p className="text-center p-4">Loading...</p>
                    ) : data.length > 0 ? (
                        <div className="space-y-4 p-4">
                        {data.map(item => {
                            const entryPrice = type === 'trades' ? calculateEntryPrice(item) : 0;
                            return (
                                <div key={item.id} className="border rounded-lg p-3 text-sm space-y-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-primary">{item.profiles?.full_name || 'N/A'}</p>
                                            <p className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</p>
                                        </div>
                                        {type === 'orders' ? (
                                            <p className="font-semibold">{item.status}</p>
                                        ) : (
                                            <p className={cn("font-semibold", (item.pnl ?? 0) >= 0 ? "text-green-500" : "text-red-500")}>
                                                {formatCurrency(item.pnl, '₹0.00', true)}
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-semibold">{formatSimpleInstrumentName({ tradingsymbol: item.symbol })}</p>
                                        {type === 'orders' ? (
                                            <p className="text-muted-foreground">{item.order_type} {item.quantity} @ {formatCurrency(item.price)}</p>
                                        ) : (
                                            <div className="flex justify-between text-xs text-muted-foreground">
                                                <span>Type: {item.order_type === 'SELL' ? 'BUY' : 'SELL'}</span>
                                                <span>Qty: {item.quantity}</span>
                                                <span>Entry: {formatCurrency(entryPrice)}</span>
                                                <span>Exit: {formatCurrency(item.price)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                        </div>
                    ) : (
                         <p className="text-center p-4 text-muted-foreground">No data found.</p>
                    )}
                </div>
                <Table className="hidden md:table">
                    <TableHeader>
                        {type === 'orders' ? (
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Instrument</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Quantity</TableHead>
                                <TableHead>Price</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Date</TableHead>
                            </TableRow>
                        ) : (
                             <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Instrument</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Quantity</TableHead>
                                <TableHead>Entry Price</TableHead>
                                <TableHead>Exit Price</TableHead>
                                <TableHead>P&L</TableHead>
                                <TableHead className="text-right">Date</TableHead>
                            </TableRow>
                        )}
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={type === 'orders' ? 7 : 8} className="text-center">Loading...</TableCell></TableRow>
                        ) : data.length > 0 ? (
                            data.map(item => {
                                const tradeType = item.order_type === 'SELL' ? 'BUY' : 'SELL';
                                const entryPrice = type === 'trades' ? calculateEntryPrice(item) : 0;
                                return type === 'orders' ? (
                                    <TableRow key={item.id}>
                                        <TableCell>{item.profiles?.full_name}</TableCell>
                                        <TableCell>{formatSimpleInstrumentName({ tradingsymbol: item.symbol })}</TableCell>
                                        <TableCell>{item.order_type}</TableCell>
                                        <TableCell>{item.quantity}</TableCell>
                                        <TableCell>{formatCurrency(item.price)}</TableCell>
                                        <TableCell>{item.status}</TableCell>
                                        <TableCell className="text-right text-xs">{new Date(item.created_at).toLocaleString()}</TableCell>
                                    </TableRow>
                                ) : (
                                    <TableRow key={item.id}>
                                        <TableCell>{item.profiles?.full_name}</TableCell>
                                        <TableCell>{formatSimpleInstrumentName({ tradingsymbol: item.symbol })}</TableCell>
                                        <TableCell>
                                            <span className={cn('font-semibold', tradeType === 'BUY' ? 'text-blue-500' : 'text-red-500')}>
                                                {tradeType}
                                            </span>
                                        </TableCell>
                                        <TableCell>{item.quantity}</TableCell>
                                        <TableCell>{formatCurrency(entryPrice)}</TableCell>
                                        <TableCell>{formatCurrency(item.price)}</TableCell>
                                        <TableCell className={cn("font-semibold", (item.pnl ?? 0) >= 0 ? "text-green-500" : "text-red-500")}>
                                            {formatCurrency(item.pnl, '₹0.00', true)}
                                        </TableCell>
                                        <TableCell className="text-right text-xs">{new Date(item.created_at).toLocaleString()}</TableCell>
                                    </TableRow>
                                )}
                            )
                        ) : (
                            <TableRow><TableCell colSpan={type === 'orders' ? 7 : 8} className="text-center">No data found for the selected date range.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

function MasterLogsContent() {
    const searchParams = useSearchParams();
    const tab = searchParams.get('tab') || 'orders';

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <header className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight font-headline text-foreground">Platform Activity</h1>
                <p className="text-muted-foreground">View all orders and trades across the platform.</p>
            </header>
            <Tabs defaultValue={tab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="orders">Master Order Log</TabsTrigger>
                    <TabsTrigger value="trades">Master Trade Log</TabsTrigger>
                </TabsList>
                <TabsContent value="orders">
                    <MasterLog type="orders" />
                </TabsContent>
                <TabsContent value="trades">
                    <MasterLog type="trades" />
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default function MasterLogsPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>}>
            <MasterLogsContent />
        </Suspense>
    );
}
