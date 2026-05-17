// Skeleton instantaneo enquanto a page client (1422 LOC) baixa + hidrata.
// Reduz percepcao de latencia em navegacao interna para /painel/agenda.
export default function Loading() {
  return (
    <div className="px-6 py-6 space-y-4 animate-pulse">
      <div className="h-8 w-48 rounded-md bg-zinc-200/70 dark:bg-zinc-800/60" />
      <div className="h-4 w-72 rounded-md bg-zinc-200/50 dark:bg-zinc-800/40" />
      <div className="mt-6 grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-lg bg-zinc-200/60 dark:bg-zinc-800/50" />
        ))}
      </div>
    </div>
  );
}
