'use client';

import { useState, useTransition, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Info } from 'lucide-react';
import { createUser } from '@/app/actions/create-user';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase';

interface SignupSheetProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onUserCreated: () => void;
}

type MentorProfile = {
    id: string;
    full_name: string | null;
}

export default function SignupSheet({ isOpen, onOpenChange, onUserCreated }: SignupSheetProps) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'student' | 'mentor' | 'support' | ''>('');
    const [initialBalance, setInitialBalance] = useState<number | string>(100000);
    const [lossLimitPercentage, setLossLimitPercentage] = useState<number | string>(20);
    const [dailyLossLimitPercentage, setDailyLossLimitPercentage] = useState<number | string>(10);
    const [perTradeLossLimitPercentage, setPerTradeLossLimitPercentage] = useState<number | string>(5);
    const [equityLeverage, setEquityLeverage] = useState<number | string>(5);
    const [mentors, setMentors] = useState<MentorProfile[]>([]);
    const [assignedMentorId, setAssignedMentorId] = useState<string>('');


    useEffect(() => {
        if (isOpen) {
            const fetchMentors = async () => {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, full_name')
                    .eq('role', 'mentor');
                if (error) {
                    console.error("Failed to fetch mentors", error);
                } else {
                    setMentors(data);
                }
            };
            fetchMentors();
        }
    }, [isOpen]);


    const resetForm = () => {
        setFullName('');
        setEmail('');
        setPassword('');
        setRole('');
        setInitialBalance(100000);
        setLossLimitPercentage(20);
        setDailyLossLimitPercentage(10);
        setPerTradeLossLimitPercentage(5);
        setEquityLeverage(5);
        setAssignedMentorId('');
    }
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!role) {
            setError('Please select a role for the user.');
            return;
        }

        startTransition(async () => {
            const result = await createUser({
                fullName,
                email,
                password,
                role: role as any,
                initialBalance: role === 'student' ? Number(initialBalance) : 0,
                lossLimitPercentage: role === 'student' ? Number(lossLimitPercentage) : 0,
                dailyLossLimitPercentage: role === 'student' ? Number(dailyLossLimitPercentage) : 0,
                perTradeLossLimitPercentage: role === 'student' ? Number(perTradeLossLimitPercentage) : 0,
                equityLeverage: role === 'student' ? Number(equityLeverage) : 1,
                assignedMentorId: role === 'student' ? (assignedMentorId === 'unassigned' ? undefined : assignedMentorId) : undefined,
            });

            if (result.success) {
                toast({ title: 'User created', description: result.message });
                onUserCreated();
                resetForm();
            } else {
                setError(result.message);
            }
        });
    };

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent className="overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>Create new user</SheetTitle>
                    <SheetDescription>
                        Set up a new user account with their role, initial balance, and risk settings.
                    </SheetDescription>
                </SheetHeader>
                <form onSubmit={handleSubmit} className="space-y-6 py-6">
                    {error && <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

                    <div className="space-y-2">
                        <Label htmlFor="fullName">Full name</Label>
                        <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email address</Label>
                        <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="password">Login password</Label>
                        <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="role">User role</Label>
                        <Select onValueChange={(value: any) => setRole(value)} value={role} required>
                            <SelectTrigger id="role"><SelectValue placeholder="Select a role" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="student">Student</SelectItem>
                                <SelectItem value="mentor">Mentor</SelectItem>
                                <SelectItem value="support">Support Agent</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {role === 'student' && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="assignedMentorId">Assign mentor (optional)</Label>
                                <Select onValueChange={setAssignedMentorId} value={assignedMentorId}>
                                    <SelectTrigger id="assignedMentorId"><SelectValue placeholder="Select a mentor" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unassigned">Unassigned</SelectItem>
                                        {mentors.map(mentor => (
                                            <SelectItem key={mentor.id} value={mentor.id}>{mentor.full_name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="initialBalance">Initial balance (INR)</Label>
                                    <Input id="initialBalance" type="number" value={initialBalance} onChange={e => setInitialBalance(e.target.value)} required />
                                </div>
                                <div>
                                    <Label className="text-base font-medium">Risk settings</Label>
                                    <div className="mt-2 space-y-4 rounded-md border p-4">
                                        <div className="grid grid-cols-2 items-center gap-4">
                                            <Label htmlFor="lossLimitPercentage">Max drawdown limit (%)</Label>
                                            <Input id="lossLimitPercentage" type="number" value={lossLimitPercentage} onChange={e => setLossLimitPercentage(e.target.value)} required />
                                        </div>
                                        <div className="grid grid-cols-2 items-center gap-4">
                                            <Label htmlFor="dailyLossLimitPercentage">Daily loss limit (%)</Label>
                                            <Input id="dailyLossLimitPercentage" type="number" value={dailyLossLimitPercentage} onChange={e => setDailyLossLimitPercentage(e.target.value)} required />
                                        </div>
                                        <div className="grid grid-cols-2 items-center gap-4">
                                            <Label htmlFor="perTradeLossLimitPercentage">Per-trade loss limit (%)</Label>
                                            <Input id="perTradeLossLimitPercentage" type="number" value={perTradeLossLimitPercentage} onChange={e => setPerTradeLossLimitPercentage(e.target.value)} required />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <Label className="text-base font-medium">Leverage settings</Label>
                                <div className="mt-2 space-y-4 rounded-md border p-4">
                                    <div className="grid grid-cols-2 items-center gap-4">
                                        <Label htmlFor="leverage-equity">Equity leverage (multiplier)</Label>
                                        <Input 
                                            id="leverage-equity" 
                                            type="number" 
                                            min="1"
                                            value={equityLeverage} 
                                            onChange={e => setEquityLeverage(e.target.value)} 
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 items-center gap-4">
                                        <Label htmlFor="leverage-futures">Futures leverage</Label>
                                        <div className="relative">
                                            <Input id="leverage-futures" type="number" value={1} disabled className="pr-8"/>
                                            <Info className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" title="Futures leverage is fixed at 1x."/>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 items-center gap-4">
                                        <Label htmlFor="leverage-options">Options leverage</Label>
                                        <div className="relative">
                                            <Input id="leverage-options" type="number" value={1} disabled className="pr-8"/>
                                            <Info className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" title="Options leverage is fixed at 1x."/>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    <SheetFooter>
                        <Button type="submit" className="w-full" disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Account
                        </Button>
                    </SheetFooter>
                </form>
            </SheetContent>
        </Sheet>
    );
}