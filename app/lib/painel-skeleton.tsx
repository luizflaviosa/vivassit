'use client';

// Skeleton loaders compartilhados pro painel.

export function MetricCardSkeleton() {
  return (
    <div className="rounded-xl border border-black/[0.07] bg-white p-4 sm:p-5">
      <div className="h-7 w-7 rounded-md bg-zinc-100 mb-3 animate-pulse" />
      <div className="h-7 w-20 rounded bg-zinc-100 animate-pulse" />
      <div className="h-3 w-28 rounded bg-zinc-100 mt-2 animate-pulse" />
    </div>
  );
}

export function StatRowSkeleton() {
  return (
    <div className="rounded-xl border border-black/[0.07] bg-white p-4 flex items-center gap-3">
      <div className="h-8 w-8 rounded-md bg-zinc-100 animate-pulse flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-4 w-12 rounded bg-zinc-100 animate-pulse" />
        <div className="h-3 w-32 rounded bg-zinc-100 animate-pulse" />
      </div>
    </div>
  );
}

export function DoctorCardSkeleton() {
  return (
    <div className="rounded-xl border border-black/[0.07] bg-white p-4 sm:p-5 flex items-start gap-4">
      <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-zinc-100 animate-pulse flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-40 rounded bg-zinc-100 animate-pulse" />
        <div className="h-3 w-24 rounded bg-zinc-100 animate-pulse" />
        <div className="h-3 w-56 rounded bg-zinc-100 animate-pulse" />
      </div>
    </div>
  );
}

export function PatientRowSkeleton() {
  return (
    <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center border-b border-black/[0.06]">
      <div className="col-span-4">
        <div className="h-4 w-32 rounded bg-zinc-100 animate-pulse" />
      </div>
      <div className="col-span-3 hidden sm:block">
        <div className="h-3 w-24 rounded bg-zinc-100 animate-pulse" />
      </div>
      <div className="col-span-2 hidden sm:block">
        <div className="h-3 w-16 rounded bg-zinc-100 animate-pulse" />
      </div>
      <div className="col-span-2 hidden sm:block">
        <div className="h-3 w-20 rounded bg-zinc-100 animate-pulse" />
      </div>
      <div className="col-span-1 text-right">
        <div className="h-4 w-6 ml-auto rounded bg-zinc-100 animate-pulse" />
      </div>
    </div>
  );
}

export function PageHeadingSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-3 w-20 rounded bg-zinc-100 animate-pulse" />
      <div className="h-8 w-48 rounded bg-zinc-100 animate-pulse" />
      <div className="h-3 w-64 rounded bg-zinc-100 animate-pulse" />
    </div>
  );
}
