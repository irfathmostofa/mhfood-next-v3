import Link from "next/link";
import {
  Phone,
  Mail,
  MapPin,
  Facebook,
  Instagram,
  MessageCircle,
} from "lucide-react";
import { getSiteSettings, getCategories } from "@/lib/site";

export default async function Footer({ theme }) {
  const year = new Date().getFullYear();
  const storeName = theme?.logo_text || theme?.store_name || "MHFood";
  const settings = await getSiteSettings();
  const categories = await getCategories();

  const parents = categories.filter((c) => !c.parent_id);
  const childrenByParent = {};
  categories.forEach((c) => {
    if (c.parent_id) {
      childrenByParent[c.parent_id] = childrenByParent[c.parent_id] || [];
      childrenByParent[c.parent_id].push(c);
    }
  });

  const shopLinks = [
    { to: "/shop", label: "Shop" },
    { to: "/track", label: "Track Order" },
    { to: "/checkout", label: "Checkout" },
  ];

  const contactItems = [
    settings?.store_phone && { icon: Phone, label: settings.store_phone },
    settings?.store_email && { icon: Mail, label: settings.store_email },
    settings?.store_address && { icon: MapPin, label: settings.store_address },
  ].filter(Boolean);

  const socialItems = [
    settings?.facebook_url && {
      href: settings.facebook_url,
      icon: Facebook,
      label: "Facebook",
    },
    settings?.instagram_url && {
      href: settings.instagram_url,
      icon: Instagram,
      label: "Instagram",
    },
    settings?.messenger_link && {
      href: settings.messenger_link,
      icon: MessageCircle,
      label: "Messenger",
    },
  ].filter(Boolean);

  const description =
    settings?.store_description ||
    "Fresh food and groceries — ordered in a click, tracked the whole way to your door.";

  return (
    <footer className="mt-16 bg-primary text-white">
      <div className="max-w-7xl mx-auto px-5 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 sm:gap-6">
          {/* Brand */}
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            <span className="text-xl font-semibold tracking-tight">
              {storeName.split(" ")[0]}
              <span className="text-accent">
                {storeName.split(" ").slice(1).join(" ")
                  ? ` ${storeName.split(" ").slice(1).join(" ")}`
                  : " Food"}
              </span>
            </span>
            <p className="mt-3 text-sm text-white/60 max-w-[240px] leading-relaxed">
              {description}
            </p>
            {settings?.messenger_link && (
              <a
                href={settings.messenger_link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
              >
                <MessageCircle size={16} className="text-accent" />
                Chat with us on Messenger
              </a>
            )}
          </div>

          {/* Links */}
          <div className="flex flex-col items-center sm:items-start">
            <span className="text-xs font-medium uppercase tracking-[0.1em] text-white/40 mb-4">
              Navigate
            </span>
            <div className="flex flex-col items-center sm:items-start gap-3">
              {shopLinks.map((link) => (
                <Link
                  key={link.to}
                  href={link.to}
                  className="relative group text-sm text-white/70 hover:text-white transition-colors"
                >
                  {link.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-accent transition-all duration-300 group-hover:w-full" />
                </Link>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div className="flex flex-col items-center sm:items-start">
            <span className="text-xs font-medium uppercase tracking-[0.1em] text-white/40 mb-4">
              Contact
            </span>
            <div className="flex flex-col items-center sm:items-start gap-3">
              {contactItems.length > 0 ? (
                contactItems.map((item) => (
                  <p
                    key={item.label}
                    className="flex items-center gap-2.5 text-sm text-white/70"
                  >
                    <item.icon size={15} className="text-accent shrink-0" />
                    <span className="break-all">{item.label}</span>
                  </p>
                ))
              ) : (
                <p className="text-sm text-white/70">
                  Reach us via our contact channels.
                </p>
              )}
              {settings?.whatsapp_number && (
                <a
                  href={`https://wa.me/${settings.whatsapp_number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 text-sm text-white/70 hover:text-white transition-colors"
                >
                  <Phone size={15} className="text-accent shrink-0" />
                  WhatsApp
                </a>
              )}
            </div>
          </div>

          {/* Social / built by */}
          <div className="flex flex-col items-center sm:items-start">
            <span className="text-xs font-medium uppercase tracking-[0.1em] text-white/40 mb-4">
              Follow us
            </span>
            {socialItems.length > 0 ? (
              <div className="flex items-center gap-3">
                {socialItems.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={item.label}
                    className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:border-white/50 transition-colors"
                  >
                    <item.icon size={17} />
                  </a>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:border-white/50 transition-colors"
                >
                  <Facebook size={17} />
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <span className="text-xs text-white/40">
            © {year} {storeName}. All rights reserved.
          </span>
          <span className="text-xs text-white/40">
            Any category. Any business. One store.
          </span>
        </div>
      </div>
    </footer>
  );
}
