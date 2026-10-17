'use client';
import { useUserProfile } from "@/hooks/use-user-profile";
import { AppLayout } from "@/components/app-layout";
import { Skeleton } from "@/components/ui/skeleton";

function ProfileSkeleton() {
  return (
    <AppLayout>
        <div className="h-full flex flex-col bg-background text-foreground">
             <main className="flex-1 overflow-y-auto p-6">
                 <div className="grid w-full grid-cols-2 mb-6">
                     <Skeleton className="h-10 w-48" />
                 </div>
                 <div className="max-w-2xl">
                     <Skeleton className="h-24 w-full mb-8" />
                 </div>
             </main>
        </div>
    </AppLayout>
  );
}


export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthorized } = useUserProfile(['student', 'admin', 'mentor', 'support']);

  if (isLoading || !isAuthorized) {
    return <ProfileSkeleton />;
  }

  return <main>{children}</main>;
}
