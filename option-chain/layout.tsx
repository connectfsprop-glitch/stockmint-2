'use client';

import { useUserProfile } from "@/hooks/use-user-profile";
import { AppLayout } from "@/components/app-layout";
import { Skeleton } from "@/components/ui/skeleton";

function OptionChainSkeleton() {
  return (
    <AppLayout>
        <div className="flex flex-col h-full bg-background text-foreground">
            <header className="flex-shrink-0 flex h-20 items-center border-b border-white/5 px-6 gap-6">
                <Skeleton className="h-10 w-48 rounded-xl" />
                <Skeleton className="h-10 w-64 rounded-xl" />
            </header>
            <main className="flex-1 p-6 space-y-6">
                 <Skeleton className="h-32 w-full rounded-[2rem]" />
                 <Skeleton className="h-96 w-full rounded-[2rem]" />
            </main>
        </div>
    </AppLayout>
  );
}

export default function OptionChainLayout({ children }: { children: React.ReactNode }) {
  const { isLoading } = useUserProfile(['student', 'admin', 'mentor']);

  if (isLoading) {
    return <OptionChainSkeleton />;
  }

  return <main>{children}</main>;
}
