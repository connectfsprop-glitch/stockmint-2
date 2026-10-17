
'use client';

import { useState, useTransition, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { updateUserRiskSettings } from '@/app/actions/update-user-risk-settings';

interface EditUserSettingsSheetProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    userProfile: {
        id: string;
        loss_limit_percentage: number;
        daily_loss_limit_percentage: number;
        per_trade_loss_limit_percentage: number;
    } | null;
    userLeverages: {
        equity: number;
    } | null;
    onSettingsSaved: () => void;
}

export function EditUserSettingsSheet({ isOpen, onOpenChange, userProfile, userLeverages, onSettingsSaved }: EditUserSettingsSheetProps) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [equityLeverage, setEquityLeverage] = useState<number | string>('');
    const [lossLimit, setLossLimit] = useState<number | string>('');
    const [dailyLossLimit, setDailyLossLimit] = useState<number | string>('');
    const [perTradeLossLimit, setPerTradeLossLimit] = useState<number | string>('');

    useEffect(() => {
        if (userProfile && userLeverages) {
            setEquityLeverage(userLeverages.equity);
            setLossLimit(userProfile.loss_limit_percentage);
            setDailyLossLimit(userProfile.daily_loss_limit_percentage);
            setPerTradeLossLimit(userProfile.per_trade_loss_limit_percentage);
        }
    }, [userProfile, userLeverages, isOpen]);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!userProfile) {
            setError("User profile not available.");
            return;
        }

        startTransition(async () => {
            const result = await updateUserRiskSettings({
                userId: userProfile.id,
                equityLeverage: Number(equityLeverage),
                lossLimitPercentage: Number(lossLimit),
                dailyLossLimitPercentage: Number(dailyLossLimit),
                perTradeLossLimitPercentage: Number(perTradeLossLimit),
            });

            if (result.success) {
                toast({ title: 'Settings Updated', description: result.message });
                onSettingsSaved();
                onOpenChange(false);
            } else {
                setError(result.message);
            }
        });
    };

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent className="overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>Edit Risk & Leverage</SheetTitle>
                    <SheetDescription>
                        Adjust the risk parameters and equity leverage for this user.
                    </SheetDescription>
                </SheetHeader>
                <form onSubmit={handleSubmit} className="space-y-6 py-6">
                    {error && <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

                    <div>
                        <Label className="text-base font-medium">Risk Settings (%)</Label>
                         <div className="mt-2 space-y-4 rounded-md border p-4">
                            <div className="grid grid-cols-2 items-center gap-4">
                                <Label htmlFor="lossLimitPercentage">Max Drawdown</Label>
                                <Input id="lossLimitPercentage" type="number" value={lossLimit} onChange={e => setLossLimit(e.target.value)} required />
                            </div>
                            <div className="grid grid-cols-2 items-center gap-4">
                                <Label htmlFor="dailyLossLimitPercentage">Daily Loss</Label>
                                <Input id="dailyLossLimitPercentage" type="number" value={dailyLossLimit} onChange={e => setDailyLossLimit(e.target.value)} required />
                            </div>
                            <div className="grid grid-cols-2 items-center gap-4">
                                <Label htmlFor="perTradeLossLimitPercentage">Per-Trade Loss</Label>
                                <Input id="perTradeLossLimitPercentage" type="number" value={perTradeLossLimit} onChange={e => setPerTradeLossLimit(e.target.value)} required />
                            </div>
                         </div>
                    </div>

                    <div>
                        <Label className="text-base font-medium">Leverage Settings (Multiplier)</Label>
                        <div className="mt-2 space-y-4 rounded-md border p-4">
                            <div className="grid grid-cols-2 items-center gap-4">
                                <Label htmlFor="leverage-equity">Equity Leverage</Label>
                                <Input 
                                    id="leverage-equity" 
                                    type="number" 
                                    min="1"
                                    value={equityLeverage} 
                                    onChange={e => setEquityLeverage(e.target.value)} 
                                />
                            </div>
                        </div>
                    </div>

                    <SheetFooter>
                        <Button type="submit" className="w-full" disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </SheetFooter>
                </form>
            </SheetContent>
        </Sheet>
    );
}
