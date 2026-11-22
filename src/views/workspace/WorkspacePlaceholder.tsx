import Link from "next/link";
import { EmptyState } from "@/components/ui";

export function WorkspacePlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto grid max-w-[975px] gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <EmptyState
        title="Nothing here yet"
        actions={
          <Link href="/agent" className="inline-flex min-h-10 items-center rounded-full bg-accent px-4 text-sm font-medium text-accent-ink">
            Go to Agent
          </Link>
        }
      >
        {description}
      </EmptyState>
    </div>
  );
}
