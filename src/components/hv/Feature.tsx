import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { myFeatures } from "@/lib/features.functions";

/** True unless a Super Admin feature switch turns this key off for the user. */
export function useFeature(key: string) {
  const fn = useServerFn(myFeatures);
  const { data } = useQuery({ queryKey: ["my-features"], queryFn: () => fn(), staleTime: 60_000 });
  return data?.[key] ?? true;
}

export function Locked({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-6 text-center">
      <Lock className="h-6 w-6 text-primary" />
      <p className="font-semibold">{name} isn't included in your current plan</p>
      <p className="text-sm text-muted-foreground">Upgrade to unlock it for your account.</p>
      <Link to="/app/plans" className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">See upgrade options</Link>
    </div>
  );
}

export function FeatureGate({ flag, name, children }: { flag: string; name: string; children: ReactNode }) {
  return useFeature(flag) ? <>{children}</> : <Locked name={name} />;
}
