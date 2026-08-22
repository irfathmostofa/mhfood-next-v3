import StarRating from "./StarRating";

function initials(name) {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const AVATAR_PALETTE = [
  { bg: "#F3E7DB", fg: "#B4603A" },
  { bg: "#E9EDE6", fg: "#5C6B52" },
  { bg: "#EFE6DC", fg: "#8A6A45" },
  { bg: "#E6E9EC", fg: "#4A5A6B" },
];

function avatarColors(name) {
  const code = (name || "").charCodeAt(0) || 0;
  return AVATAR_PALETTE[code % AVATAR_PALETTE.length];
}

export default function ReviewsList({ reviews, avgRating, reviewCount }) {
  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 pb-6 mb-6 border-b border-line">
        <div className="flex items-baseline gap-1">
          <span className="font-display text-4xl text-ink leading-none">
            {avgRating > 0 ? Number(avgRating).toFixed(1) : "—"}
          </span>
          <span className="text-sm text-muted">/ 5</span>
        </div>
        <div>
          <StarRating rating={avgRating} size="text-lg" />
          <p className="text-sm text-muted mt-1">
            Based on {reviewCount} review{reviewCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line py-10 px-6 text-center">
          <p className="text-sm text-muted">
            No reviews yet — be the first to share what you think.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {reviews.map((r) => {
            const { bg, fg } = avatarColors(r.customer_name);
            return (
              <li
                key={r.id}
                className="rounded-xl border border-line p-5 transition-colors hover:border-accent/40"
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold"
                    style={{ backgroundColor: bg, color: fg }}
                    aria-hidden="true"
                  >
                    {initials(r.customer_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <p className="text-sm font-medium text-ink">
                        {r.customer_name}
                      </p>
                      <p className="text-xs text-muted">
                        {formatDate(r.created_at)}
                      </p>
                    </div>
                    <div className="mt-1">
                      <StarRating rating={r.rating} />
                    </div>
                    {r.comment && (
                      <p className="text-sm text-muted mt-2 leading-relaxed">
                        {r.comment}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
