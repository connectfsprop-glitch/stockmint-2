'use client';
import { useUserProfile } from "@/hooks/use-user-profile";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from '@/components/app-layout';


function PortfolioSkeleton() {
  return (
    <AppLayout>
       <div className="p-4 sm:p-6 lg:p-8 h-full">
            <header className="mb-8">
                <Skeleton className="h-9 w-48" />
                <Skeleton className="h-4 w-64 mt-2" />
            </header>
            <div className="grid w-full grid-cols-2">
                 <Skeleton className="h-10 w-full" />
                 <Skeleton className="h-10 w-full" />
            </div>
            <div className="mt-4">
                 <Skeleton className="h-40 w-full" />
            </div>
        </div>
    </AppLayout>
  );
}

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthorized } = useUserProfile(['student', 'admin', 'mentor', 'support']);

  if (isLoading || !isAuthorized) {
    return <PortfolioSkeleton />;
  }

  return <main>{children}</main>;
}
