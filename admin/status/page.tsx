
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Server, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { getStockPrice } from '@/app/actions/get-stock-price';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface CheckResult {
    status: Status;
    message: string;
    details?: any;
}

export default function AdminStatusPage() {
    const [zerodhaStatus, setZerodhaStatus] = useState<CheckResult>({ status: 'idle', message: 'Not checked yet.' });
    const [isChecking, setIsChecking] = useState(false);

    const checkZerodhaConnection = async () => {
        setIsChecking(true);
        setZerodhaStatus({ status: 'loading', message: 'Pinging Zerodha API...' });
        
        try {
            const result = await getStockPrice({ symbol: 'SENSEX', exchange: 'BSE' });
            
            if (result.success) {
                setZerodhaStatus({
                    status: 'success',
                    message: 'Successfully connected to Zerodha and fetched data.',
                    details: result.data
                });
            } else {
                setZerodhaStatus({
                    status: 'error',
                    message: 'Failed to connect or fetch data from Zerodha.',
                    details: result.error,
                });
            }
        } catch (error: any) {
            setZerodhaStatus({
                status: 'error',
                message: 'An unexpected client-side error occurred.',
                details: error.message,
            });
        }
        
        setIsChecking(false);
    };

    useEffect(() => {
        checkZerodhaConnection();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const StatusIndicator = ({ status }: { status: Status }) => {
        switch (status) {
            case 'success':
                return <CheckCircle className="h-6 w-6 text-green-500" />;
            case 'error':
                return <XCircle className="h-6 w-6 text-red-500" />;
            case 'loading':
                return <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />;
            default:
                return <Server className="h-6 w-6 text-muted-foreground" />;
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <header className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight font-headline text-foreground">System Status</h1>
                <p className="text-muted-foreground">Live health checks for critical third-party services.</p>
            </header>

            <Card className="max-w-2xl">
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>Service Health</span>
                        <Button onClick={checkZerodhaConnection} disabled={isChecking} variant="outline" size="sm">
                            <RefreshCw className={cn("mr-2 h-4 w-4", isChecking && "animate-spin")} />
                            Re-check
                        </Button>
                    </CardTitle>
                    <CardDescription>
                        This page provides a real-time diagnosis of the connection to external APIs.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-start gap-4 rounded-lg border p-4">
                        <StatusIndicator status={zerodhaStatus.status} />
                        <div className="flex-1">
                            <h3 className="font-semibold">Zerodha Kite API</h3>
                            <p className="text-sm text-muted-foreground">{zerodhaStatus.message}</p>
                             {zerodhaStatus.status === 'error' && (
                                <Alert variant="destructive" className="mt-4">
                                    <AlertTitle>Error Details</AlertTitle>
                                    <AlertDescription className="font-mono text-xs break-all">
                                        {typeof zerodhaStatus.details === 'string' 
                                            ? zerodhaStatus.details 
                                            : JSON.stringify(zerodhaStatus.details, null, 2)}
                                    </AlertDescription>
                                </Alert>
                            )}
                             {zerodhaStatus.status === 'success' && (
                                <Alert className="mt-4">
                                    <AlertTitle>Success Details</AlertTitle>
                                    <AlertDescription className="font-mono text-xs break-all">
                                        {JSON.stringify(zerodhaStatus.details, null, 2)}
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
