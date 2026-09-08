export default function StoreLoading() {
  return (
    <div className="max-w-7xl mx-auto px-5 py-8 min-h-[60vh]">
      <div className="h-[250px] sm:h-[300px] lg:h-[350px] rounded-2xl bg-primary/5 animate-pulse" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6 mt-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-2xl bg-primary/5 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
