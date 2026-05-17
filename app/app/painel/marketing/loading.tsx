// Skeleton enquanto /painel/marketing (1646 LOC) carrega.
export default function Loading() {
  return (
    <div className="px-6 py-6 space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-56 rounded-md bg-zinc-200/70 dark:bg-zinc-800/60" />
        <div className="h-4 w-96 rounded-md bg-zinc-200/50 dark:bg-zinc-800/40" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/50" />
        ))}
      </div>
      <div className="h-48 rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/50" />
    </div>
  );
}
