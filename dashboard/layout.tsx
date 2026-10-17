
'use client';
import { useUserProfile } from "@/hooks/use-user-profile";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

function DashboardSkeleton() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="w-full max-w-md p-8">
            <div className="animate-pulse">
                <div className="w-full max-w-md p-8 border rounded-lg shadow-sm bg-card mt-4 mx-auto">
                    <Skeleton className="h-10 w-3/4 mb-4 font-headline" />
                    <Skeleton className="h-6 w-1/2 mb-8" />
                    <div className="space-y-4">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-48 w-full" />
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthorized, hasCheckedAuth } = useUserProfile(['student']);

  if (!hasCheckedAuth || isLoading) {
    return <DashboardSkeleton />;
  }
  
  if (!isAuthorized) {
    return null; // The hook will handle the redirect
  }

  return <main>{children}</main>;
}
