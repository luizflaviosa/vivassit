// Skeleton enquanto /painel/pacientes (638 LOC) carrega.
export default function Loading() {
  return (
    <div className="px-6 py-6 space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 rounded-md bg-zinc-200/70 dark:bg-zinc-800/60" />
        <div className="h-10 w-40 rounded-lg bg-zinc-200/70 dark:bg-zinc-800/60" />
      </div>
      <div className="h-10 w-full max-w-md rounded-lg bg-zinc-200/60 dark:bg-zinc-800/50" />
      <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800/50 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-14 border-b border-zinc-200/40 dark:border-zinc-800/30 bg-zinc-100/40 dark:bg-zinc-900/30" />
        ))}
      </div>
    </div>
  );
}
