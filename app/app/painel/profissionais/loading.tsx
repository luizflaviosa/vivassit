// Skeleton enquanto /painel/profissionais (923 LOC) carrega.
export default function Loading() {
  return (
    <div className="px-6 py-6 space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-44 rounded-md bg-zinc-200/70 dark:bg-zinc-800/60" />
        <div className="h-10 w-32 rounded-lg bg-zinc-200/70 dark:bg-zinc-800/60" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-40 rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/50" />
        ))}
      </div>
    </div>
  );
}
