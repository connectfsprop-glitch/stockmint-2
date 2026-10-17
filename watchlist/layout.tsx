
'use client';
import { useUserProfile } from "@/hooks/use-user-profile";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from "@/components/app-layout";

function WatchlistSkeleton() {
  return (
    <AppLayout>
        <div className="flex flex-col h-full bg-background text-foreground">
             <main className="flex-1 overflow-y-auto p-6">
                 <div className="grid w-full grid-cols-2 mb-6">
                     <Skeleton className="h-10 w-48" />
                 </div>
                 <div className="space-y-4">
                     <Skeleton className="h-20 w-full rounded-2xl" />
                     <Skeleton className="h-20 w-full rounded-2xl" />
                     <Skeleton className="h-20 w-full rounded-2xl" />
                 </div>
             </main>
        </div>
    </AppLayout>
  );
}

export default function WatchlistLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthorized, hasCheckedAuth } = useUserProfile(['student', 'admin', 'mentor']);

  if (!hasCheckedAuth || isLoading) {
    return <WatchlistSkeleton />;
  }

  if (!isAuthorized) {
    return null;
  }

  return <main>{children}</main>;
}
