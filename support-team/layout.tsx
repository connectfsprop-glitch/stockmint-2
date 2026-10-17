
'use client';
import { useUserProfile } from "@/hooks/use-user-profile";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

function SupportSkeleton() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#030305]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthorized, hasCheckedAuth } = useUserProfile(['support', 'admin']);

  if (!hasCheckedAuth || isLoading) {
    return <SupportSkeleton />;
  }
  
  if (!isAuthorized) {
    return null; // The hook will handle the redirect
  }

  return <main className="bg-[#030305] min-h-screen text-white">{children}</main>;
}
