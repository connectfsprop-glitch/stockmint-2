
'use client';
import { useUserProfile } from "@/hooks/use-user-profile";
import { Skeleton } from "@/components/ui/skeleton";

function DashboardSkeleton() {
    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <header className="mb-8">
                <Skeleton className="h-9 w-72" />
                <Skeleton className="h-4 w-96 mt-2" />
            </header>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
            </div>
      </div>
    );
  }

export default function MentorDashboardLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthorized, hasCheckedAuth } = useUserProfile(['mentor', 'admin']);

  if (!hasCheckedAuth || isLoading) {
    return <DashboardSkeleton />;
  }

  if (!isAuthorized) {
    return null; // The hook will handle the redirect
  }

  return <main>{children}</main>;
}
