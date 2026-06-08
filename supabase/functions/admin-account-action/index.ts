import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization") || "";

  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "Supabase env belum lengkap." }, 500);
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Token admin tidak tersedia." }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const serviceClient = createClient(supabaseUrl, serviceKey);

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Sesi admin tidak valid." }, 401);

  const adminId = userData.user.id;
  const { data: adminRow, error: adminError } = await serviceClient
    .from("resource_admins")
    .select("user_id")
    .eq("user_id", adminId)
    .maybeSingle();
  if (adminError || !adminRow) return json({ error: "Akses admin ditolak." }, 403);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "").trim();
  const userId = String(body.user_id || "").trim();
  const reason = String(body.reason || "").trim();
  if (!userId) return json({ error: "User ID wajib diisi." }, 400);
  if (userId === adminId) return json({ error: "Admin tidak bisa mengubah akun sendiri dari panel ini." }, 400);

  if (action === "suspend") {
    const { error } = await serviceClient
      .from("member_profiles")
      .update({
        suspended_at: new Date().toISOString(),
        suspended_by: adminId,
        suspend_reason: reason || "Disuspend oleh admin AT STRUCTURA.",
      })
      .eq("user_id", userId);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, action });
  }

  if (action === "unsuspend") {
    const { error } = await serviceClient
      .from("member_profiles")
      .update({ suspended_at: null, suspended_by: null, suspend_reason: null })
      .eq("user_id", userId);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, action });
  }

  if (action === "delete") {
    const { data: orders } = await serviceClient
      .from("orders")
      .select("id, proof_bucket, proof_path")
      .eq("user_id", userId);
    const orderIds = (orders || []).map((order) => order.id);

    const proofGroups = new Map<string, string[]>();
    for (const order of orders || []) {
      if (!order.proof_bucket || !order.proof_path) continue;
      const paths = proofGroups.get(order.proof_bucket) || [];
      paths.push(order.proof_path);
      proofGroups.set(order.proof_bucket, paths);
    }
    for (const [bucket, paths] of proofGroups.entries()) {
      await serviceClient.storage.from(bucket).remove(paths);
    }

    if (orderIds.length) {
      await serviceClient.from("order_items").delete().in("order_id", orderIds);
    }
    await serviceClient.from("member_access").delete().eq("user_id", userId);
    await serviceClient.from("saved_items").delete().eq("user_id", userId);
    await serviceClient.from("download_logs").delete().eq("user_id", userId);
    await serviceClient.from("orders").delete().eq("user_id", userId);
    await serviceClient.from("member_profiles").delete().eq("user_id", userId);

    const { error } = await serviceClient.auth.admin.deleteUser(userId);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, action });
  }

  return json({ error: "Aksi tidak dikenali." }, 400);
});
