"use client";

import { usePathname } from "next/navigation";

export default function FloatingContactButtons({ settings }) {
  const pathname = usePathname();
  const isProductPage = /^\/product\/.+/.test(pathname || "");

  if (!settings) return null;

  const showWhatsapp = settings.whatsapp_enabled && settings.whatsapp_number;
  const showMessenger = settings.messenger_enabled && settings.messenger_link;

  const count = [showWhatsapp, showMessenger].filter(Boolean).length;
  if (count === 0) return null;

  return (
    <div
      className={`fixed right-4 z-40 flex flex-col items-end gap-2.5 transition-all duration-300 ${
        isProductPage ? "bottom-[88px] lg:bottom-5" : "bottom-5"
      }`}
    >
      {showWhatsapp && (
        <ContactButton
          href={`https://wa.me/${settings.whatsapp_number}`}
          label="WhatsApp"
          color="#25D366"
        >
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2zm5.8 14.1c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.12.11-1.8-.11-.42-.13-.96-.32-1.65-.62-2.9-1.25-4.8-4.17-4.94-4.36-.14-.19-1.18-1.57-1.18-3 0-1.42.75-2.12 1.02-2.41.27-.29.58-.36.78-.36.19 0 .39 0 .56.01.18.01.42-.07.65.5.24.58.82 2 .89 2.15.07.15.12.32.02.51-.09.19-.14.31-.27.48-.14.17-.29.37-.41.5-.14.14-.28.29-.12.57.16.28.71 1.17 1.52 1.9 1.05.94 1.93 1.23 2.21 1.37.28.14.45.12.61-.07.17-.19.71-.83.9-1.11.19-.28.38-.24.63-.14.26.09 1.64.77 1.92.91.28.14.47.21.53.33.07.12.07.68-.17 1.36z" />
        </ContactButton>
      )}

      {showMessenger && (
        <ContactButton
          href={settings.messenger_link}
          label="Messenger"
          color="#0084FF"
        >
          <path d="M12 2C6.48 2 2 6.14 2 11.25c0 2.9 1.45 5.49 3.72 7.19V22l3.4-1.87c.91.25 1.88.38 2.88.38 5.52 0 10-4.14 10-9.26C22 6.14 17.52 2 12 2zm1.02 12.47-2.55-2.72-4.98 2.72 5.48-5.82 2.61 2.72 4.92-2.72-5.48 5.82z" />
        </ContactButton>
      )}
    </div>
  );
}

function ContactButton({ href, label, color, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Chat on ${label}`}
      className="group relative flex items-center"
    >
      <span className="absolute right-full mr-3 text-xs font-medium text-ink bg-surface/95 backdrop-blur border border-line rounded-lg px-3 py-1.5 shadow-md opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 pointer-events-none whitespace-nowrap">
        {label}
      </span>

      <span
        className="flex items-center justify-center w-11 h-11 rounded-full bg-surface/95 backdrop-blur border border-line text-[var(--brand)] shadow-sm hover:bg-[var(--brand)] hover:text-white hover:border-transparent hover:shadow-md hover:-translate-y-0.5 active:scale-95 transition-all duration-200"
        style={{ "--brand": color }}
      >
        <svg
          width="21"
          height="21"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          {children}
        </svg>
      </span>
    </a>
  );
}
