import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import AdminShell from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({ children }) {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");
  return <AdminShell>{children}</AdminShell>;
}
