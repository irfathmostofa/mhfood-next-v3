// Shared by the public form, the API routes and the admin panel.

export const CUSTOM_ORDER_BUCKET = "custom-order-files";
export const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB
export const FILE_ACCEPT = ".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx";

export const CUSTOM_ORDER_STATUSES = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "quoted", label: "Quoted" },
  { key: "confirmed", label: "Confirmed" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

export function formatFileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
