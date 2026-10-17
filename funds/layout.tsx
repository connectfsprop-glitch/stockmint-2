'use client';
import { useUserProfile } from "@/hooks/use-user-profile";
import { AppLayout } from '@/components/app-layout';
import { Skeleton } from "@/components/ui/skeleton";

function FundsSkeleton() {
  return (
      <AppLayout>
          <div className="h-full flex flex-col bg-background text-foreground">
              <header className="flex-shrink-0 flex h-16 items-center border-b px-6">
                  <Skeleton className="h-6 w-20" />
              </header>
              <main className="flex-1 overflow-y-auto p-6 flex justify-center bg-muted/50">
                  <div className="w-full max-w-lg space-y-6">
                      <Skeleton className="h-48 w-full" />
                      <Skeleton className="h-64 w-full" />
                  </div>
              </main>
          </div>
    </AppLayout>
  );
}

export default function FundsLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthorized } = useUserProfile(['student', 'admin', 'mentor', 'support']);

  if (isLoading || !isAuthorized) {
    return <FundsSkeleton />;
  }

  return <main>{children}</main>;
}
