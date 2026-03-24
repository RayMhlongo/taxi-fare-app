import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type LicenseRow = {
  license_id: string;
  driver_name: string;
  business_name: string | null;
  status: "active" | "grace" | "expired" | "suspended";
  paid_until: string | null;
  grace_until: string | null;
  bound_install_id: string | null;
  device_fingerprint: string | null;
  notes: string | null;
};

function endOfDay(value: string) {
  return new Date(`${value}T23:59:59.999Z`);
}

function addDays(value: string, days: number) {
  const next = new Date(`${value}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function resolveStatus(row: LicenseRow, graceDays: number) {
  if (row.status === "suspended") {
    return {
      status: "suspended",
      paidUntil: row.paid_until,
      graceUntil: row.grace_until,
    };
  }

  if (!row.paid_until) {
    return {
      status: "expired",
      paidUntil: row.paid_until,
      graceUntil: row.grace_until,
    };
  }

  const now = new Date();
  const paidUntil = endOfDay(row.paid_until);
  const graceUntil = row.grace_until
    ? endOfDay(row.grace_until)
    : endOfDay(addDays(row.paid_until, graceDays).toISOString().slice(0, 10));

  if (now <= paidUntil) {
    return {
      status: "active",
      paidUntil: row.paid_until,
      graceUntil: graceUntil.toISOString().slice(0, 10),
    };
  }

  if (now <= graceUntil) {
    return {
      status: "grace",
      paidUntil: row.paid_until,
      graceUntil: graceUntil.toISOString().slice(0, 10),
    };
  }

  return {
    status: "expired",
    paidUntil: row.paid_until,
    graceUntil: graceUntil.toISOString().slice(0, 10),
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ message: "Method not allowed." }), {
      status: 405,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const graceDays = Number(Deno.env.get("SUBSCRIPTION_GRACE_DAYS") || "2");

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ message: "Server configuration is incomplete." }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const body = await request.json();
  const licenseId = String(body.licenseId || "").trim();
  const installId = String(body.installId || "").trim();
  const deviceFingerprint = String(body.deviceFingerprint || "").trim();
  const bindingMode = String(body.deviceBindingMode || "soft").trim();

  if (!licenseId || !installId) {
    return new Response(JSON.stringify({ message: "licenseId and installId are required." }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  const { data, error } = await supabase
    .from("driver_licenses")
    .select("license_id, driver_name, business_name, status, paid_until, grace_until, bound_install_id, device_fingerprint, notes")
    .eq("license_id", licenseId)
    .maybeSingle<LicenseRow>();

  if (error) {
    return new Response(JSON.stringify({ message: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  if (!data) {
    return new Response(JSON.stringify({ message: "License could not be found." }), {
      status: 404,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  let effective = resolveStatus(data, graceDays);
  let deviceMismatch = false;
  let nextBoundInstallId = data.bound_install_id;

  if (bindingMode !== "off") {
    if (!data.bound_install_id) {
      nextBoundInstallId = installId;
    } else if (data.bound_install_id !== installId) {
      deviceMismatch = true;
      effective = {
        ...effective,
        status: "suspended",
      };
    }
  }

  await supabase
    .from("driver_licenses")
    .update({
      bound_install_id: nextBoundInstallId,
      device_fingerprint: deviceFingerprint || data.device_fingerprint,
      last_verified_at: new Date().toISOString(),
    })
    .eq("license_id", licenseId);

  await supabase
    .from("license_verification_log")
    .insert({
      license_id: licenseId,
      install_id: installId,
      device_fingerprint: deviceFingerprint,
      result_status: effective.status,
      notes: deviceMismatch ? "Install mismatch detected." : "Verification successful.",
    });

  return new Response(JSON.stringify({
    licenseId: data.license_id,
    driverName: data.driver_name,
    businessName: data.business_name,
    status: effective.status,
    paidUntil: effective.paidUntil,
    graceUntil: effective.graceUntil,
    boundInstallId: nextBoundInstallId,
    deviceFingerprint,
    deviceMismatch,
    message: deviceMismatch
      ? "This license is already linked to another installation."
      : effective.status === "expired"
        ? "Subscription expired."
        : effective.status === "grace"
          ? "Grace period active."
          : "License verified.",
    notes: data.notes,
    lastVerifiedAt: new Date().toISOString(),
  }), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
});
