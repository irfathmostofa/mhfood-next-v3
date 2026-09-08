import { createAdminClient } from "@/lib/admin";
import { resolveSteadfastCredentials } from "@/lib/steadfast";

export async function loadSteadfastCredentials() {
  const supabase = await createAdminClient();
  const { data: settings, error } = await supabase
    .from("logistics_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error && /logistics_settings/i.test(error.message || "")) {
    const err = new Error(
      "Run the logistics migration (012_logistics.sql) in Supabase first.",
    );
    err.status = 500;
    throw err;
  }
  if (error) {
    const err = new Error(error.message);
    err.status = 500;
    throw err;
  }

  const credentials = resolveSteadfastCredentials(settings);
  if (!credentials.configured) {
    const err = new Error(
      "Steadfast API keys are missing. Add them in Logistics settings.",
    );
    err.status = 400;
    throw err;
  }
  if (!credentials.enabled) {
    const err = new Error(
      "Logistics is disabled. Enable it in Logistics settings.",
    );
    err.status = 400;
    throw err;
  }
  return { supabase, settings, credentials };
}
