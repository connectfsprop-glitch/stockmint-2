
'use client';

import React, { useState, useTransition, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
    Search, User, ArrowRightLeft, Loader2, 
    ShieldCheck, Activity, ShieldAlert, Upload,
    Download, Trash2, FileText, CheckCircle2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { migrateUserModel, bulkMigrateUserModels } from '@/app/actions/migrate-user-model';
import { cn } from '@/lib/utils';
import Papa from 'papaparse';

/**
 * @fileOverview MODEL MIGRATION TERMINAL
 * Supports Single Identity Lookup and CSV Bulk Migration.
 */

export default function ModelManagerPage() {
    const [mode, setMode] = useState<'single' | 'bulk'>('single');
    const [searchQuery, setSearchQuery] = useState('');
    const [foundUser, setFoundUser] = useState<any>(null);
    const [isSearching, setIsSearching] = useState(false);
    
    // Bulk States
    const [bulkList, setBulkList] = useState<any[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleSearch = async () => {
        const query = searchQuery.trim();
        if (!query) return;
        
        setIsSearching(true);
        setFoundUser(null);

        try {
            // Precise query for Single Mode: Check ID or Name
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query);
            
            let queryBuilder = supabase.from('profiles').select('*');
            if (isUUID) {
                queryBuilder = queryBuilder.eq('id', query);
            } else {
                queryBuilder = queryBuilder.ilike('full_name', `%${query}%`);
            }

            const { data, error } = await queryBuilder.limit(1).maybeSingle();

            if (error) throw error;
            if (!data) {
                toast({ variant: 'destructive', title: 'Detection Failed', description: 'No identity found matching that criteria.' });
                return;
            }
            setFoundUser(data);
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'System Error', description: err.message });
        } finally {
            setIsSearching(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const rawIdentities = results.data.map((row: any) => row.identity?.trim()).filter(Boolean);
                if (rawIdentities.length === 0) {
                    toast({ variant: 'destructive', title: 'Format Error', description: 'CSV must have a column header named "identity".' });
                    return;
                }

                setIsSearching(true);
                try {
                    // Separate UUIDs and Names to avoid Postgres type casting errors
                    const uuids = rawIdentities.filter((id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
                    const names = rawIdentities.filter((id: string) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));

                    let orParts = [];
                    if (uuids.length > 0) orParts.push(`id.in.(${uuids.map((u: string) => `"${u}"`).join(',')})`);
                    if (names.length > 0) orParts.push(`full_name.in.(${names.map((n: string) => `"${n}"`).join(',')})`);

                    if (orParts.length === 0) {
                        toast({ variant: 'destructive', title: 'Scan Empty', description: 'No valid identities detected in file.' });
                        return;
                    }

                    const { data, error } = await supabase
                        .from('profiles')
                        .select('*')
                        .or(orParts.join(','));

                    if (error) throw error;
                    setBulkList(data || []);
                    setSelectedIds(new Set((data || []).map(u => u.id)));
                    toast({ title: 'Scan Complete', description: `Detected ${data?.length || 0} matching accounts.` });
                } catch (err: any) {
                    toast({ variant: 'destructive', title: 'Sync Error', description: err.message });
                } finally {
                    setIsSearching(false);
                }
            }
        });
    };

    const handleMigrate = (id?: string, model?: string) => {
        const ids = id ? [id] : Array.from(selectedIds);
        if (ids.length === 0) return;

        const targetModel = id 
            ? (model === 'passthenpay' ? 'normal' : 'passthenpay')
            : 'passthenpay';

        startTransition(async () => {
            const result = id 
                ? await migrateUserModel(ids[0], targetModel as any)
                : await bulkMigrateUserModels(ids, targetModel as any);

            if (result.success) {
                toast({ title: 'Migration Successful', description: result.message });
                if (id) handleSearch(); 
                else setBulkList([]); 
            } else {
                toast({ variant: 'destructive', title: 'Action Failed', description: result.message });
            }
        });
    };

    const downloadTemplate = () => {
        const csvContent = "identity\n550e8400-e29b-41d4-a716-446655440000\nJohn Doe\nJane Smith";
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'migration_template.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const toggleSelectAll = (checked: boolean) => {
        if (checked) setSelectedIds(new Set(bulkList.map(u => u.id)));
        else setSelectedIds(new Set());
    };

    const toggleId = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-10">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div className="space-y-2">
                    <h1 className="text-3xl font-black tracking-tight font-headline text-white uppercase">Model Migration</h1>
                    <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Identity Spectrum Re-Classification</p>
                </div>
                <div className="flex glass p-1 rounded-2xl">
                    <button 
                        onClick={() => setMode('single')}
                        className={cn("px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", mode === 'single' ? "bg-primary text-white purple-glow" : "text-muted-foreground")}
                    > Single Mode </button>
                    <button 
                        onClick={() => setMode('bulk')}
                        className={cn("px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", mode === 'bulk' ? "bg-primary text-white purple-glow" : "text-muted-foreground")}
                    > Bulk Mode </button>
                </div>
            </header>

            {mode === 'single' ? (
                <div className="space-y-10">
                    <Card className="rounded-[2rem] border-white/5 bg-card overflow-hidden">
                        <div className="p-8 space-y-6">
                            <div className="space-y-2">
                                <p className="text-[9px] font-black uppercase tracking-widest text-primary opacity-60">Identify Trader</p>
                                <div className="flex gap-3">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input 
                                            placeholder="Enter Name or UUID..." 
                                            className="pl-11 h-14 rounded-2xl bg-white/[0.02] border-white/10 font-bold"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        />
                                    </div>
                                    <Button onClick={handleSearch} disabled={isSearching} className="h-14 px-8 rounded-2xl font-black text-[10px] uppercase tracking-widest purple-glow">
                                        {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Run Scan'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {foundUser && (
                        <Card className="rounded-[2.5rem] border-white/5 bg-card relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="p-10 space-y-10 relative z-10">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-b border-white/5 pb-10">
                                    <div className="flex items-center gap-6">
                                        <div className="h-20 w-20 rounded-[1.5rem] glass border-primary/20 flex items-center justify-center text-3xl font-black text-primary uppercase">
                                            {String(foundUser.full_name || 'A')[0]}
                                        </div>
                                        <div className="space-y-1">
                                            <h2 className="text-3xl font-black text-white tracking-tighter uppercase">{foundUser.full_name || 'Anonymous'}</h2>
                                            <div className="flex items-center gap-3">
                                                <Badge variant="outline" className="text-[10px] font-black border-white/10 opacity-40 uppercase">ID: {String(foundUser.id).slice(0, 8)}...</Badge>
                                                <Badge className={cn("text-[9px] font-black uppercase tracking-widest px-3", foundUser.account_model === 'passthenpay' ? "bg-amber-500 text-black" : "bg-primary text-white")}>
                                                    {foundUser.account_model === 'passthenpay' ? 'PASS THEN PAY' : 'STANDARD'}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                    <Badge variant={foundUser.is_active ? 'default' : 'destructive'} className="rounded-lg h-8 px-4 font-black uppercase tracking-widest">
                                        {foundUser.is_active ? 'ACTIVE' : 'RESTRICTED'}
                                    </Badge>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="p-8 rounded-[2rem] bg-white/[0.02] border border-white/5 space-y-4">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-40">Sync Metadata</p>
                                        <div className="space-y-3">
                                            <DetailRow icon={ShieldCheck} label="Overall Limit" value={`${foundUser.loss_limit_percentage}%`} />
                                            <DetailRow icon={Activity} label="Daily Limit" value={`${foundUser.daily_loss_limit_percentage}%`} />
                                            <DetailRow icon={ShieldAlert} label="Per-Trade" value={`${foundUser.per_trade_loss_limit_percentage}%`} />
                                        </div>
                                    </div>
                                    <div className="flex flex-col justify-center gap-6">
                                        <div className="space-y-2">
                                            <h3 className="text-xl font-black text-white uppercase tracking-tighter">Authorize Switch</h3>
                                            <p className="text-xs text-muted-foreground leading-relaxed">Identity transition re-calibrates institutional risk safety Tiers.</p>
                                        </div>
                                        <Button onClick={() => handleMigrate(foundUser.id, foundUser.account_model)} disabled={isPending} className={cn("h-16 rounded-[1.25rem] font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl", foundUser.account_model === 'passthenpay' ? "bg-white text-black" : "bg-amber-500 text-black")}>
                                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4 mr-3" />}
                                            Switch to {foundUser.account_model === 'passthenpay' ? 'Standard' : 'Pass Then Pay'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] -mr-32 -mt-32 pointer-events-none" />
                        </Card>
                    )}
                </div>
            ) : (
                <div className="space-y-8 animate-in fade-in duration-500">
                    <Card className="rounded-[2rem] border-white/5 bg-card overflow-hidden">
                        <div className="p-8 flex flex-col md:flex-row items-center gap-8">
                            <div className="flex-1 space-y-4">
                                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                                    <FileText className="h-6 w-6 text-primary" />
                                </div>
                                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Batch Import Scanner</h3>
                                <div className="space-y-2">
                                    <p className="text-xs text-muted-foreground leading-relaxed">1. Download the template below.</p>
                                    <p className="text-xs text-muted-foreground leading-relaxed">2. Add UUIDs or Names in the <span className="text-primary font-bold">identity</span> column.</p>
                                    <p className="text-xs text-muted-foreground leading-relaxed">3. Upload here to scan and select accounts for migration.</p>
                                </div>
                                <Button variant="outline" size="sm" onClick={downloadTemplate} className="rounded-xl border-white/5 text-[9px] font-black uppercase tracking-widest">
                                    <Download className="h-3 w-3 mr-2" /> Download CSV Template
                                </Button>
                            </div>
                            <div className="w-full md:w-auto">
                                <label className="flex flex-col items-center justify-center w-full md:w-64 h-48 border-2 border-dashed border-white/10 rounded-[2rem] hover:bg-white/[0.02] transition-all cursor-pointer group">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <Upload className="w-10 h-10 mb-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Upload Finished CSV</p>
                                    </div>
                                    <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
                                </label>
                            </div>
                        </div>
                    </Card>

                    {bulkList.length > 0 && (
                        <Card className="rounded-[2.5rem] border-white/5 bg-card overflow-hidden">
                            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                                <div className="flex items-center gap-4">
                                    <Checkbox 
                                        checked={selectedIds.size === bulkList.length}
                                        onCheckedChange={toggleSelectAll}
                                        className="h-5 w-5 rounded-md border-white/20"
                                    />
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-white">Identified Queue</p>
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-40">{selectedIds.size} / {bulkList.length} Selected</p>
                                    </div>
                                </div>
                                <Button onClick={() => handleMigrate()} disabled={isPending || selectedIds.size === 0} className="h-12 px-8 rounded-2xl bg-amber-500 text-black font-black text-[10px] uppercase tracking-widest shadow-xl">
                                    {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                    Migrate Selected to PTP
                                </Button>
                            </div>
                            <div className="max-h-[400px] overflow-y-auto no-scrollbar">
                                {bulkList.map((user) => (
                                    <div key={user.id} className="p-6 border-b border-white/5 flex items-center justify-between hover:bg-white/[0.01] transition-colors group">
                                        <div className="flex items-center gap-4">
                                            <Checkbox 
                                                checked={selectedIds.has(user.id)}
                                                onCheckedChange={() => toggleId(user.id)}
                                                className="h-5 w-5 rounded-md border-white/20"
                                            />
                                            <div>
                                                <p className="text-sm font-black text-white uppercase truncate">{user.full_name || 'Anonymous'}</p>
                                                <p className="text-[10px] font-mono text-muted-foreground opacity-40">{user.id}</p>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className={cn("text-[8px] font-black px-2 uppercase", user.account_model === 'passthenpay' ? "text-amber-500 border-amber-500/20" : "text-primary border-primary/20")}>
                                            {user.account_model || 'normal'}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}
                </div>
            )}
        </div>
    );
}

function DetailRow({ icon: Icon, label, value }: any) {
    return (
        <div className="flex items-center justify-between border-b border-white/5 pb-2 last:border-none last:pb-0">
            <div className="flex items-center gap-3">
                <Icon className="h-3.5 w-3.5 text-muted-foreground opacity-40" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase">{label}</span>
            </div>
            <span className="text-xs font-black text-white">{value}</span>
        </div>
    );
}
