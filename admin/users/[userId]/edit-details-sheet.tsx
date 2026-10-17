'use client';

import { useState, useTransition, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldCheck, Key, Mail, User } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { updateUserDetails } from '@/app/actions/update-user-details';
import { supabase } from '@/lib/supabase';

interface EditDetailsSheetProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    userProfile: {
        id: string;
        full_name: string | null;
    } | null;
    onDetailsSaved: () => void;
}

export function EditDetailsSheet({ isOpen, onOpenChange, userProfile, onDetailsSaved }: EditDetailsSheetProps) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isFetchingEmail, setIsFetchingEmail] = useState(false);

    useEffect(() => {
        if (isOpen && userProfile) {
            setFullName(userProfile.full_name || '');
            setPassword('');
            
            // We need to fetch the email from Auth. This is typically done via a restricted action,
            // but for simplicity in this admin-only view, we assume the admin can verify via the list.
            // If email is null in profile, we initialize it as empty.
            setEmail('');
        }
    }, [userProfile, isOpen]);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!userProfile) {
            setError("Identity context missing.");
            return;
        }

        if (!email.trim() || !fullName.trim()) {
            setError("Full name and email are required for synchronization.");
            return;
        }

        startTransition(async () => {
            const result = await updateUserDetails({
                userId: userProfile.id,
                fullName: fullName.trim(),
                email: email.trim().toLowerCase(),
                password: password.trim() || undefined,
            });

            if (result.success) {
                toast({ title: 'Identity Synchronized', description: result.message });
                onDetailsSaved();
                onOpenChange(false);
            } else {
                setError(result.message);
                toast({ variant: 'destructive', title: 'Sync Failed', description: result.message });
            }
        });
    };

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent className="overflow-y-auto bg-white border-l-slate-100 p-0 sm:max-w-md flex flex-col">
                <SheetHeader className="p-8 border-b border-slate-50 bg-slate-50/50">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                            <ShieldCheck className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <SheetTitle className="text-xl font-black text-slate-900 uppercase tracking-tighter font-headline">Edit Identity</SheetTitle>
                            <SheetDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                Profile & Security Override
                            </SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                <div className="flex-1 p-8 space-y-8">
                    {error && (
                        <Alert variant="destructive" className="rounded-2xl bg-rose-50 border-rose-100 text-rose-600">
                            <AlertDescription className="text-[10px] font-bold uppercase">{error}</AlertDescription>
                        </Alert>
                    )}

                    <form id="identity-form" onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="fullName" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 font-headline">Full legal name</Label>
                            <div className="relative group">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-primary transition-colors" />
                                <Input 
                                    id="fullName" 
                                    value={fullName} 
                                    onChange={e => setFullName(e.target.value)} 
                                    required 
                                    placeholder="e.g. John Doe"
                                    className="h-12 pl-11 rounded-xl bg-slate-50 border-none font-bold text-slate-900 focus:ring-2 focus:ring-primary/10"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 font-headline">Access email</Label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-primary transition-colors" />
                                <Input 
                                    id="email" 
                                    type="email" 
                                    value={email} 
                                    onChange={e => setEmail(e.target.value)} 
                                    required 
                                    placeholder="user@example.com"
                                    className="h-12 pl-11 rounded-xl bg-slate-50 border-none font-bold text-slate-900 focus:ring-2 focus:ring-primary/10"
                                />
                            </div>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight ml-1">Note: Changing email will reset login identity.</p>
                        </div>

                        <div className="pt-4 border-t border-slate-50">
                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 font-headline">Override security key</Label>
                                <div className="relative group">
                                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-primary transition-colors" />
                                    <Input 
                                        id="password" 
                                        type="password" 
                                        value={password} 
                                        onChange={e => setPassword(e.target.value)} 
                                        placeholder="Leave blank to keep current"
                                        className="h-12 pl-11 rounded-xl bg-slate-50 border-none font-bold text-slate-900 focus:ring-2 focus:ring-primary/10"
                                    />
                                </div>
                                <p className="text-[8px] font-bold text-amber-600 uppercase tracking-tight ml-1">Use this to force-reset a user's password.</p>
                            </div>
                        </div>
                    </form>
                </div>

                <div className="p-8 border-t border-slate-50 bg-slate-50/30">
                    <Button 
                        form="identity-form"
                        type="submit" 
                        disabled={isPending}
                        className="w-full h-14 rounded-2xl bg-primary text-white font-black text-xs uppercase tracking-widest shadow-xl purple-glow active:scale-95 transition-all"
                    >
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Synchronize Identity'}
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
