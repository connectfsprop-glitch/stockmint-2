'use client';
import { useUserProfile } from "@/hooks/use-user-profile";
import { AppLayout } from "@/components/app-layout";
import { Skeleton } from "@/components/ui/skeleton";

function SettingsSkeleton() {
    return (
        <AppLayout>
            <div className="flex flex-col h-full">
                <header className="flex-shrink-0 flex h-16 items-center border-b px-6">
                    <Skeleton className="h-6 w-24" />
                </header>
                <main className="flex-1 overflow-y-auto p-6 flex justify-center items-start">
                    <Skeleton className="h-48 w-full max-w-lg" />
                </main>
            </div>
        </AppLayout>
    );
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthorized } = useUserProfile(['student', 'admin', 'mentor', 'support']);

  if (isLoading || !isAuthorized) {
    return <SettingsSkeleton />;
  }

  return <main>{children}</main>;
}
