'use client';
import { useUserProfile } from "@/hooks/use-user-profile";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from '@/components/app-layout';

function OrdersSkeleton() {
  return (
    <AppLayout>
       <div className="h-full flex flex-col bg-background text-foreground">
            <header className="flex-shrink-0 flex h-16 items-center border-b px-6">
                <Skeleton className="h-6 w-24" />
            </header>
            <main className="flex-1 overflow-y-auto p-6">
                <div className="space-y-4">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                </div>
            </main>
        </div>
    </AppLayout>
  );
}

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthorized } = useUserProfile(['student', 'admin', 'mentor', 'support']);

  if (isLoading || !isAuthorized) {
    return <OrdersSkeleton />;
  }

  return <main>{children}</main>;
}
