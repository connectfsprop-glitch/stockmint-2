'use client';
import { useUserProfile } from "@/hooks/use-user-profile";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from "@/components/app-layout";

function AddFundsSkeleton() {
  return (
    <AppLayout>
        <div className="flex flex-col gap-6 md:gap-10">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/10">
                <Skeleton className="h-10 md:h-14 w-48 md:w-64 bg-white/10 rounded-2xl" />
            </header>
            <main className="flex justify-center items-start">
                <div className="w-full max-lg space-y-8">
                     <Skeleton className="h-64 w-full rounded-[2.5rem] bg-white shadow-xl" />
                     <Skeleton className="h-72 w-full rounded-[2.5rem] bg-white shadow-xl" />
                </div>
            </main>
        </div>
    </AppLayout>
  );
}

export default function AddFundsLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthorized } = useUserProfile(['student', 'admin', 'mentor', 'support']);

  if (isLoading || !isAuthorized) {
    return <AddFundsSkeleton />;
  }

  return <main>{children}</main>;
}
