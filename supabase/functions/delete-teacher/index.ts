import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ─────────────────────────────────────────────────────────────
   delete-teacher Edge Function

   Admin-only. Removes a teacher account and the classrooms that
   teacher solo-owns. Preserves classrooms shared with other
   teachers (just unlinks this teacher from those).

   Cascade chain when the auth.users row is deleted:
     profiles.id            → auth.users.id  ON DELETE CASCADE
     classroom_teachers.teacher_id → auth.users.id  ON DELETE CASCADE
     lesson_plans.teacher_id      → auth.users.id  ON DELETE CASCADE
     classrooms.created_by        → auth.users.id  ON DELETE SET NULL

   So we explicitly:
     1) Find every classroom this teacher is linked to.
     2) For each, if no other teacher is linked, delete the
        classroom (cascades its resources and notes).
     3) Delete the auth.users row (cascades the rest).
───────────────────────────────────────────────────────────── */

const SUPABASE_URL       = Deno.env.get("SUPABASE_URL")              ?? "";
const SERVICE_ROLE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY           = Deno.env.get("SUPABASE_ANON_KEY")         ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")    return json(405, { error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json(401, { error: "Missing Authorization header" });

    // Identify the caller via their JWT
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json(401, { error: "Unauthenticated" });

    // Admin client (service role) for everything that needs to bypass RLS
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Caller must be an admin
    const { data: callerProfile, error: callerErr } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (callerErr) return json(500, { error: "Could not read caller profile: " + callerErr.message });
    if (callerProfile?.role !== "admin") return json(403, { error: "Forbidden — admin only" });

    // Parse target
    let body: { teacher_id?: string } = {};
    try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON body" }); }
    const targetId = body.teacher_id;
    if (!targetId) return json(400, { error: "Missing teacher_id" });
    if (targetId === user.id) return json(400, { error: "You can't delete your own account from here." });

    // Target must exist and be a teacher
    const { data: target, error: targetErr } = await admin
      .from("profiles")
      .select("id, role, display_name, email")
      .eq("id", targetId)
      .maybeSingle();
    if (targetErr) return json(500, { error: "Could not look up target: " + targetErr.message });
    if (!target)               return json(404, { error: "Target user not found" });
    if (target.role !== "teacher") return json(400, { error: "Target is not a teacher (refusing to delete)" });

    // Find every classroom this teacher is linked to
    const { data: links, error: linksErr } = await admin
      .from("classroom_teachers")
      .select("classroom_id")
      .eq("teacher_id", targetId);
    if (linksErr) return json(500, { error: "Could not read links: " + linksErr.message });

    const classroomIds: string[] = (links ?? []).map((r) => r.classroom_id);
    let deletedClassrooms = 0;
    let preservedShared  = 0;

    // Delete solo-owned classrooms (cascades resources + notes)
    for (const cid of classroomIds) {
      const { data: others, error: othersErr } = await admin
        .from("classroom_teachers")
        .select("teacher_id")
        .eq("classroom_id", cid)
        .neq("teacher_id", targetId);
      if (othersErr) return json(500, { error: "Could not check shared status: " + othersErr.message });

      if (!others || others.length === 0) {
        const { error: delClassErr } = await admin
          .from("classrooms")
          .delete()
          .eq("id", cid);
        if (delClassErr) return json(500, { error: "Could not delete solo classroom: " + delClassErr.message });
        deletedClassrooms++;
      } else {
        preservedShared++;
      }
    }

    // Delete the auth user (cascades: profile, remaining classroom_teachers links, lesson_plans)
    const { error: delAuthErr } = await admin.auth.admin.deleteUser(targetId);
    if (delAuthErr) return json(500, { error: "Could not delete auth user: " + delAuthErr.message });

    return json(200, {
      ok: true,
      deleted_classrooms:           deletedClassrooms,
      preserved_shared_classrooms:  preservedShared,
      deleted_display_name:         target.display_name,
      deleted_email:                target.email,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json(500, { error: message });
  }
});
