
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAllUsers, type UserProfile } from '@/app/actions/get-all-users';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PlusCircle, Upload, Users, UserCheck, UserX, Search, BookOpen } from 'lucide-react';
import SignupSheet from './signup-sheet';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const formatCurrency = (value: number | null | undefined) => {
    if (value === null || typeof value === 'undefined' || isNaN(value)) {
        return '₹0.00';
    }
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
};


function UserItem({ user, onViewDetails, onViewTrades }: { user: UserProfile, onViewDetails: (id: string) => void, onViewTrades: (id: string) => void }) {
    return (
        <div className={cn("border-b p-4", user.is_hidden && "bg-primary/5")}>
            <div className="flex justify-between items-center mb-2" onClick={() => onViewDetails(user.id)}>
                <div className="flex flex-col gap-1 overflow-hidden">
                    <div className="flex items-center gap-2">
                        <p className="font-semibold text-primary truncate cursor-pointer hover:underline">{user.full_name || 'N/A'}</p>
                        {user.is_hidden && <Badge variant="outline" className="text-[8px] h-4">HIDDEN</Badge>}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={user.is_active ? 'default' : 'destructive'}>
                        {user.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                     <Badge variant={user.role === 'admin' ? 'destructive' : 'secondary'} className="capitalize">{user.role}</Badge>
                </div>
            </div>
            <div className="flex items-center justify-between text-sm" onClick={() => onViewDetails(user.id)}>
                 <p className="text-muted-foreground">Balance</p>
                 <p className="font-medium">{formatCurrency(user.cash_balance)}</p>
            </div>
            <div className="flex justify-end mt-2">
                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onViewTrades(user.id); }}>
                    <BookOpen className="mr-2 h-4 w-4" /> View Trades
                </Button>
            </div>
        </div>
    )
}

function StatCard({ title, value, icon: Icon }: { title: string, value: number, icon: React.ElementType }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
            </CardContent>
        </Card>
    )
}

export default function UsersListPage() {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSignupSheetOpen, setIsSignupSheetOpen] = useState(false);
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const router = useRouter();
    const searchParams = useSearchParams();
    const isMasterView = searchParams.get('master_view') === 'TRUE';

    const fetchUsers = async () => {
        setIsLoading(true);
        const result = await getAllUsers();
        if (result.success) {
            setUsers(result.data);
        } else {
            console.error(result.error);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchUsers();
    }, []);
    
    // 1. Filter by view scope (Master vs Normal)
    const viewScopeUsers = useMemo(() => {
        return users.filter(user => isMasterView ? user.is_hidden : !user.is_hidden);
    }, [users, isMasterView]);

    // 2. Filter by UI search/status within that scope
    const filteredUsers = useMemo(() => {
        return viewScopeUsers
            .filter(user => {
                if (statusFilter === 'all') return true;
                return statusFilter === 'active' ? user.is_active : !user.is_active;
            })
            .filter(user => {
                if (!searchQuery) return true;
                return user.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
            });
    }, [viewScopeUsers, statusFilter, searchQuery]);
    
    const totalInScope = viewScopeUsers.length;
    const activeInScope = viewScopeUsers.filter(u => u.is_active).length;
    const inactiveInScope = totalInScope - activeInScope;

    const handleRowClick = (userId: string) => {
        router.push(`/admin/users/${userId}`);
    };

    const handleViewTrades = (userId: string) => {
        router.push(`/admin/trades?tab=trades&userId=${userId}`);
    };
    
    const handleUserCreated = () => {
        setIsSignupSheetOpen(false);
        fetchUsers(); // Refresh the user list
    };

    return (
        <>
            <SignupSheet
                isOpen={isSignupSheetOpen}
                onOpenChange={setIsSignupSheetOpen}
                onUserCreated={handleUserCreated}
            />
            <div className="p-4 sm:p-6 lg:p-8">
                <header className="mb-8">
                    <div className="flex justify-between items-center md:items-start">
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-bold tracking-tight font-headline text-foreground">
                                    {isMasterView ? 'Ghost Accounts' : 'User Management'}
                                </h1>
                                {isMasterView && (
                                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 px-3 py-1 font-bold">
                                        MASTER VIEW (HIDDEN ONLY)
                                    </Badge>
                                )}
                            </div>
                            <p className="text-muted-foreground hidden md:block">
                                {isMasterView ? 'Managing accounts excluded from the primary ledger.' : 'View and manage all users on the platform.'}
                            </p>
                        </div>
                        <div className="hidden md:flex items-center gap-2">
                           <Button asChild variant="outline">
                                <Link href="/admin/users/import">
                                    <Upload className="mr-2 h-4 w-4" />
                                    Bulk Import Users
                                </Link>
                            </Button>
                            <Button onClick={() => setIsSignupSheetOpen(true)}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Create User
                            </Button>
                        </div>
                    </div>
                     <div className="flex flex-col md:hidden w-full mt-4 space-y-2">
                        <Button onClick={() => setIsSignupSheetOpen(true)}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Create New User
                        </Button>
                        <Button asChild variant="outline">
                           <Link href="/admin/users/import">
                               <Upload className="mr-2 h-4 w-4" />
                               Bulk Import Users
                           </Link>
                       </Button>
                    </div>
                </header>

                <div className="grid gap-4 md:grid-cols-3 mb-8">
                    <StatCard title="Total" value={totalInScope} icon={Users} />
                    <StatCard title="Active" value={activeInScope} icon={UserCheck} />
                    <StatCard title="Inactive" value={inactiveInScope} icon={UserX} />
                </div>
                
                <Card>
                    <CardHeader className="flex-col md:flex-row md:items-center md:justify-between gap-4">
                         <CardTitle>{isMasterView ? 'Ghost Registry' : 'User List'}</CardTitle>
                         <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Search by name..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            <div className="w-full md:w-auto md:min-w-48">
                                <Select value={statusFilter} onValueChange={(value: 'all' | 'active' | 'inactive') => setStatusFilter(value)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Filter by status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Statuses</SelectItem>
                                        <SelectItem value="active">Active Users</SelectItem>
                                        <SelectItem value="inactive">Inactive Users</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                         </div>
                    </CardHeader>
                    <CardContent className="p-0">
                         {/* Mobile View */}
                        <div className="md:hidden">
                             {isLoading ? (
                                <div className="p-4 text-center">Loading users...</div>
                             ) : filteredUsers.length > 0 ? (
                                filteredUsers.map(user => (
                                    <UserItem 
                                        key={user.id} 
                                        user={user} 
                                        onViewDetails={handleRowClick} 
                                        onViewTrades={handleViewTrades}
                                    />
                                ))
                             ) : (
                                <div className="p-4 text-center text-muted-foreground">No users found.</div>
                             )}
                        </div>
                         {/* Desktop View */}
                        <Table className="hidden md:table">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Full Name</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Account Balance</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center">Loading users...</TableCell>
                                    </TableRow>
                                ) : filteredUsers.length > 0 ? (
                                    filteredUsers.map(user => (
                                        <TableRow key={user.id} className={cn("group", user.is_hidden && "bg-primary/5 opacity-80")}>
                                            <TableCell 
                                                onClick={() => handleRowClick(user.id)} 
                                                className="font-medium text-primary cursor-pointer hover:underline"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span>{user.full_name || 'N/A'}</span>
                                                    {isMasterView && user.is_hidden && <Badge variant="secondary" className="text-[8px] h-4">HIDDEN</Badge>}
                                                </div>
                                            </TableCell>
                                            <TableCell onClick={() => handleRowClick(user.id)} className="cursor-pointer">
                                                <Badge variant={user.role === 'admin' ? 'destructive' : 'secondary'} className="capitalize">{user.role}</Badge>
                                            </TableCell>
                                            <TableCell onClick={() => handleRowClick(user.id)} className="cursor-pointer">
                                                {formatCurrency(user.cash_balance)}
                                            </TableCell>
                                            <TableCell onClick={() => handleRowClick(user.id)} className="cursor-pointer">
                                                <Badge variant={user.is_active ? 'default' : 'destructive'}>
                                                    {user.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button variant="ghost" size="icon" onClick={() => handleViewTrades(user.id)}>
                                                                <BookOpen className="h-4 w-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>View User's Trades</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center">No users found.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
