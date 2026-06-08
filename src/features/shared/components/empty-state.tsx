export function EmptyState({ text }: { text: string }) {
  return (
    <div className="grid min-h-[220px] place-items-center px-4 py-8 text-center text-sm text-stone-500">
      {text}
    </div>
  );
}
