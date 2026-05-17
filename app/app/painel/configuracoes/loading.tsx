// Skeleton enquanto /painel/configuracoes (1089 LOC) carrega.
export default function Loading() {
  return (
    <div className="px-6 py-6 space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded-md bg-zinc-200/70 dark:bg-zinc-800/60" />
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-zinc-200/60 dark:bg-zinc-800/50" />
        ))}
      </div>
    </div>
  );
}
