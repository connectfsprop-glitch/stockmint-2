
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getMentorStudents } from '@/app/actions/get-mentor-students';
import type { UserProfile } from '@/app/actions/get-all-users';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, UserCheck, UserX, Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

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
    );
}

export default function MentorUsersPage() {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const router = useRouter();

    useEffect(() => {
        const fetchUsers = async () => {
            setIsLoading(true);
            const result = await getMentorStudents();
            if (result.success) {
                setUsers(result.data);
            } else {
                console.error(result.error);
                setError(result.error);
            }
            setIsLoading(false);
        };
        fetchUsers();
    }, []);
    
    const filteredUsers = useMemo(() => {
        return users
            .filter(user => {
                if (statusFilter === 'all') return true;
                return statusFilter === 'active' ? user.is_active : !user.is_active;
            })
            .filter(user => {
                if (!searchQuery) return true;
                return user.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
            });
    }, [users, statusFilter, searchQuery]);
    
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.is_active).length;
    const inactiveUsers = totalUsers - activeUsers;

    // A mentor cannot view the full details of a user, so this is disabled.
    // const handleRowClick = (userId: string) => {
    //     router.push(`/admin/users/${userId}`);
    // };

    if (isLoading) {
        return <div className="p-8">Loading students...</div>
    }

    if (error) {
        return <div className="p-8 text-red-500">Error: {error}</div>
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <header className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight font-headline text-foreground">My Students</h1>
                <p className="text-muted-foreground">View and monitor your assigned students.</p>
            </header>

            <div className="grid gap-4 md:grid-cols-3 mb-8">
                <StatCard title="Total Students" value={totalUsers} icon={Users} />
                <StatCard title="Active Students" value={activeUsers} icon={UserCheck} />
                <StatCard title="Inactive Students" value={inactiveUsers} icon={UserX} />
            </div>
            
            <Card>
                <CardHeader className="flex-col md:flex-row md:items-center md:justify-between gap-4">
                     <CardTitle>Student List</CardTitle>
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
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                     </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Full Name</TableHead>
                                <TableHead>Account Balance</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={3} className="text-center">Loading students...</TableCell></TableRow>
                            ) : filteredUsers.length > 0 ? (
                                filteredUsers.map(user => (
                                    <TableRow key={user.id}>
                                        <TableCell className="font-medium">{user.full_name || 'N/A'}</TableCell>
                                        <TableCell>{formatCurrency(user.cash_balance)}</TableCell>
                                        <TableCell>
                                            <Badge variant={user.is_active ? 'default' : 'destructive'}>
                                                {user.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={3} className="text-center">No students found.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
