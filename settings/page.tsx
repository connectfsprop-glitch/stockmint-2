'use client';

import { AppLayout } from '@/components/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useEffect, useState } from 'react';

function SettingsPageContent() {
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        const isDarkMode = document.documentElement.classList.contains('dark');
        setIsDark(isDarkMode);
    }, []);

    const toggleTheme = (checked: boolean) => {
        setIsDark(checked);
        if (checked) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    };

    return (
        <div className="flex flex-col h-full">
            <header className="flex-shrink-0 flex h-16 items-center border-b px-6">
                <h1 className="text-xl font-semibold">Settings</h1>
            </header>
            <main className="flex-1 overflow-y-auto p-6 flex justify-center items-start">
                <Card className="w-full max-w-lg">
                    <CardHeader>
                        <CardTitle>Appearance</CardTitle>
                        <CardDescription>
                            Customize the look and feel of the application.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <Label htmlFor="dark-mode" className="flex flex-col space-y-1">
                                <span>Dark Mode</span>
                                <span className="font-normal leading-snug text-muted-foreground">
                                    Enjoy a darker, more comfortable viewing experience.
                                </span>
                            </Label>
                            <Switch id="dark-mode" checked={isDark} onCheckedChange={toggleTheme} />
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}

export default function SettingsPage() {
    return (
        <AppLayout>
            <SettingsPageContent />
        </AppLayout>
    );
}
