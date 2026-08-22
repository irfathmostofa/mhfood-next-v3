export default function StarRating({ rating, size = "text-sm" }) {
  const full = Math.round(rating || 0);
  return (
    <span className={`${size} text-accent`} aria-label={`${full} out of 5 stars`}>
      {"★".repeat(full)}
      <span className="text-line">{"★".repeat(Math.max(0, 5 - full))}</span>
    </span>
  );
}
