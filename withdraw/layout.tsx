'use client';
import { useUserProfile } from "@/hooks/use-user-profile";
import { AppLayout } from "@/components/app-layout";
import { Skeleton } from "@/components/ui/skeleton";

function WithdrawSkeleton() {
  return (
    <AppLayout>
        <div className="flex flex-col gap-6 md:gap-10">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/10">
                <Skeleton className="h-10 md:h-14 w-48 md:w-64 bg-white/10 rounded-2xl" />
            </header>
            <main className="flex justify-center items-start">
                <Skeleton className="h-96 w-full max-w-lg rounded-[2.5rem] bg-white shadow-xl" />
            </main>
        </div>
    </AppLayout>
  );
}

export default function WithdrawLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthorized } = useUserProfile(['student', 'admin', 'mentor']);

  if (isLoading || !isAuthorized) {
    return <WithdrawSkeleton />;
  }

  return <main>{children}</main>;
}
