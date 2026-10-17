
'use client';

import React, { useState, useCallback, useMemo, useTransition } from 'react';
import Papa from 'papaparse';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { bulkCreateUsers } from '@/app/actions/bulk-create-users';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Download } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type UserData = {
    fullName: string;
    email: string;
    password?: string;
    role: 'student' | 'mentor';
    initialBalance: number;
    lossLimitPercentage: number;
    dailyLossLimitPercentage: number;
    perTradeLossLimitPercentage: number;
    equityLeverage: number;
};

type ValidationResult = {
    isValid: boolean;
    errors: { [key: string]: string };
};

const REQUIRED_FIELDS: (keyof UserData)[] = [
    'fullName', 'email', 'password', 'role', 'initialBalance',
    'lossLimitPercentage', 'dailyLossLimitPercentage',
    'perTradeLossLimitPercentage', 'equityLeverage'
];

const validateRow = (row: Partial<UserData>, index: number): ValidationResult => {
    const errors: { [key: string]: string } = {};

    for (const field of REQUIRED_FIELDS) {
        if (row[field] === undefined || String(row[field]).trim() === '') {
            errors[field] = 'Required';
        }
    }

    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
        errors.email = 'Invalid email format';
    }
    
    if (row.role && !['student', 'mentor'].includes(row.role)) {
        errors.role = "Must be 'student' or 'mentor'";
    }

    const numericFields: (keyof UserData)[] = [
        'initialBalance', 'lossLimitPercentage', 'dailyLossLimitPercentage',
        'perTradeLossLimitPercentage', 'equityLeverage'
    ];
    numericFields.forEach(field => {
        if (row[field] !== undefined && isNaN(Number(row[field]))) {
            errors[field] = 'Must be a number';
        }
    });

    return { isValid: Object.keys(errors).length === 0, errors };
};

export default function BulkImportPage() {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [users, setUsers] = useState<(UserData & { errors: { [key: string]: string } })[]>([]);
    const [fileError, setFileError] = useState<string | null>(null);
    const [finalReport, setFinalReport] = useState<{ message: string; results: any[] } | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setFileError(null);
        setFinalReport(null);

        if (file.type === 'text/csv') {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    const parsedData = results.data.map((row: any, index) => {
                         const validation = validateRow(row, index);
                         return { ...row, errors: validation.errors };
                    });
                    setUsers(parsedData);
                },
                error: (error) => {
                    setFileError(`CSV parsing error: ${error.message}`);
                }
            });
        } else if (file.type === 'application/json') {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target?.result as string);
                     const parsedData = data.map((row: any, index: number) => {
                         const validation = validateRow(row, index);
                         return { ...row, errors: validation.errors };
                    });
                    setUsers(parsedData);
                } catch (err: any) {
                    setFileError(`JSON parsing error: ${err.message}`);
                }
            };
            reader.readAsText(file);
        } else {
            setFileError('Unsupported file type. Please upload a CSV or JSON file.');
        }
    };
    
    const handleCellChange = (index: number, field: keyof UserData, value: any) => {
        const newUsers = [...users];
        newUsers[index] = { ...newUsers[index], [field]: value };
        const validation = validateRow(newUsers[index], index);
        newUsers[index].errors = validation.errors;
        setUsers(newUsers);
    };

    const handleSubmit = () => {
        startTransition(async () => {
            const result = await bulkCreateUsers(users);
            setFinalReport({ message: result.message, results: result.results });
            toast({
                title: "Bulk Import Processed",
                description: result.message,
            });
        });
    };

    const downloadTemplate = (type: 'csv' | 'json') => {
        const fields = REQUIRED_FIELDS.join(',');
        const exampleRow = [
            'John Doe', 'john.doe@example.com', 'strongpassword123', 'student',
            100000, 20, 10, 5, 5
        ].join(',');
        
        let content, filename, mimeType;

        if (type === 'csv') {
            content = `${fields}\n${exampleRow}`;
            filename = 'user_import_template.csv';
            mimeType = 'text/csv';
        } else {
            const jsonObject = REQUIRED_FIELDS.reduce((obj, key, i) => {
                const values = ['Jane Doe', 'jane.doe@example.com', 'strongpassword123', 'student', 100000, 20, 10, 5, 5];
                obj[key] = values[i];
                return obj;
            }, {} as any);
            content = JSON.stringify([jsonObject], null, 2);
            filename = 'user_import_template.json';
            mimeType = 'application/json';
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };


    const hasErrors = useMemo(() => users.some(u => Object.keys(u.errors).length > 0), [users]);

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <header className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight font-headline text-foreground">Bulk Import Users</h1>
                <p className="text-muted-foreground">Upload a CSV or JSON file to create multiple users at once.</p>
            </header>

            {!finalReport ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Step 1: Upload File</CardTitle>
                        <CardDescription>
                            Select a CSV or JSON file containing user data. Download a template if you're unsure of the format.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Input type="file" accept=".csv, .json" onChange={handleFileChange} />
                         <div className="flex items-center gap-4">
                            <Button variant="outline" size="sm" onClick={() => downloadTemplate('csv')}><Download className="mr-2 h-4 w-4" /> CSV Template</Button>
                            <Button variant="outline" size="sm" onClick={() => downloadTemplate('json')}><Download className="mr-2 h-4 w-4" /> JSON Template</Button>
                        </div>
                        {fileError && <Alert variant="destructive"><AlertTitle>File Error</AlertTitle><AlertDescription>{fileError}</AlertDescription></Alert>}
                    </CardContent>

                    {users.length > 0 && (
                        <>
                            <CardHeader>
                                <CardTitle>Step 2: Review and Edit Data</CardTitle>
                                <CardDescription>
                                    Verify the imported data. Edit any fields directly in the table. Rows with errors are highlighted.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            {REQUIRED_FIELDS.map(f => <TableHead key={f}>{f}</TableHead>)}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {users.map((user, index) => (
                                            <TableRow key={index} className={cn(Object.keys(user.errors).length > 0 && "bg-destructive/10")}>
                                                {REQUIRED_FIELDS.map(field => (
                                                    <TableCell key={field}>
                                                         {field === 'role' ? (
                                                            <Select
                                                                value={user.role ?? ''}
                                                                onValueChange={(value: 'student' | 'mentor') => handleCellChange(index, 'role', value)}
                                                            >
                                                                <SelectTrigger className={cn(user.errors[field] && "border-destructive ring-destructive ring-1")}>
                                                                    <SelectValue placeholder="Select role" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="student">Student</SelectItem>
                                                                    <SelectItem value="mentor">Mentor</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        ) : (
                                                            <Input
                                                                value={user[field] ?? ''}
                                                                onChange={(e) => handleCellChange(index, field, e.target.value)}
                                                                className={cn(user.errors[field] && "border-destructive ring-destructive ring-1")}
                                                            />
                                                        )}
                                                        {user.errors[field] && <p className="text-xs text-destructive mt-1">{user.errors[field]}</p>}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                             <CardFooter>
                                <Button onClick={handleSubmit} disabled={isPending || hasErrors}>
                                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                    {hasErrors ? 'Fix Errors to Continue' : `Create ${users.length} Users`}
                                </Button>
                            </CardFooter>
                        </>
                    )}
                </Card>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>Import Report</CardTitle>
                        <CardDescription>{finalReport.message}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                             <TableHeader>
                                <TableRow>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Details</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {finalReport.results.map((res, i) => (
                                    <TableRow key={i} className={cn(!res.success && "bg-destructive/10")}>
                                        <TableCell>{res.email}</TableCell>
                                        <TableCell>{res.success ? '✅ Success' : '❌ Failed'}</TableCell>
                                        <TableCell className="text-xs">{res.message}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                     <CardFooter>
                        <Button onClick={() => { setUsers([]); setFinalReport(null); }}>Start New Import</Button>
                    </CardFooter>
                </Card>
            )}
        </div>
    );
}
