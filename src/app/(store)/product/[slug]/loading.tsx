export default function ProductLoading() {
  return (
    <div className="max-w-[94%] mx-auto sm:px-2 py-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="hidden lg:flex flex-col gap-2 w-20">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square rounded-lg bg-primary/5 animate-pulse"
              />
            ))}
          </div>
          <div className="aspect-square flex-1 rounded-2xl bg-primary/5 animate-pulse" />
        </div>
        <div>
          <div className="h-3 w-28 bg-primary/5 rounded mb-3 animate-pulse" />
          <div className="h-8 w-3/4 bg-primary/5 rounded-lg mb-4 animate-pulse" />
          <div className="h-4 w-40 bg-primary/5 rounded mb-6 animate-pulse" />
          <div className="h-8 w-32 bg-primary/5 rounded mb-6 animate-pulse" />
          <div className="h-16 w-full bg-primary/5 rounded-xl mb-6 animate-pulse" />
          <div className="flex gap-3">
            <div className="h-11 flex-1 bg-primary/5 rounded-full animate-pulse" />
            <div className="h-11 flex-1 bg-primary/5 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
