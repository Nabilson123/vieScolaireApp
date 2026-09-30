// supabase/functions/manage-user/index.ts
//
// Première Edge Function de ce projet. Toutes les opérations de gestion de compte (invitation,
// désactivation, réactivation, suppression) nécessitent la clé service-role de Supabase, qui ne
// doit JAMAIS être présente dans le bundle client — cette fonction tourne côté serveur, avec la
// clé injectée comme secret d'environnement par Supabase, jamais exposée au navigateur.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Body =
  | { action: 'invite'; email: string; nomComplet: string; role?: string; telephone?: string; accountType?: 'staff' | 'parent' }
  | { action: 'disable' | 'enable' | 'delete'; userId: string; accountType?: 'staff' | 'parent' }
  | { action: 'updateEmail'; userId: string; newEmail: string; accountType?: 'staff' | 'parent' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  try {
    const body = (await req.json()) as Body

    if (body.action === 'invite') {
      const accountType = body.accountType ?? 'staff'
      // account_type dans les métadonnées d'invitation : lu par handle_new_user() (migration 041)
      // pour choisir dans quelle table (profiles ou parents) insérer la ligne créée par le trigger.
      const { data, error } = await admin.auth.admin.inviteUserByEmail(body.email, { data: { account_type: accountType } })
      if (error) throw error
      // Le trigger on_auth_user_created vient de créer la ligne profiles/parents (email seul) ; on
      // la complète avec les champs saisis dans la modale.
      if (accountType === 'parent') {
        const { error: parentError } = await admin
          .from('parents')
          .update({ nom_complet: body.nomComplet, telephone: body.telephone ?? '' })
          .eq('id', data.user.id)
        if (parentError) throw parentError
      } else {
        const { error: profileError } = await admin
          .from('profiles')
          .update({ nom_complet: body.nomComplet, role: body.role ?? 'Autre' })
          .eq('id', data.user.id)
        if (profileError) throw profileError
      }
      return Response.json({ id: data.user.id }, { headers: corsHeaders })
    }

    if (body.action === 'disable' || body.action === 'enable') {
      const accountType = body.accountType ?? 'staff'
      // ban_duration bloque réellement la connexion (contrairement à un simple flag en base) —
      // mais un token déjà émis reste valide jusqu'à son expiration naturelle.
      const { error } = await admin.auth.admin.updateUserById(body.userId, {
        ban_duration: body.action === 'disable' ? '876000h' : 'none',
      })
      if (error) throw error
      const { error: rowError } = await admin
        .from(accountType === 'parent' ? 'parents' : 'profiles')
        .update({ actif: body.action === 'enable' })
        .eq('id', body.userId)
      if (rowError) throw rowError
      return Response.json({ ok: true }, { headers: corsHeaders })
    }

    if (body.action === 'updateEmail') {
      const accountType = body.accountType ?? 'staff'
      // email_confirm:true court-circuite le double opt-in ("cliquer pour confirmer le nouvel
      // email") de GoTrue — l'admin qui modifie cette fiche est déjà authentifié comme personnel
      // habilité, la nouvelle adresse est donc appliquée immédiatement, pas laissée en attente de
      // confirmation par son ancien titulaire (souvent injoignable si le changement d'adresse fait
      // suite à un départ ou un changement de nom de domaine).
      const { error: authError } = await admin.auth.admin.updateUserById(body.userId, {
        email: body.newEmail,
        email_confirm: true,
      })
      if (authError) throw authError
      const { error: rowError } = await admin
        .from(accountType === 'parent' ? 'parents' : 'profiles')
        .update({ email: body.newEmail })
        .eq('id', body.userId)
      if (rowError) throw rowError
      // Même mécanisme d'envoi que inviteUserByEmail (déjà en production) — juste le template
      // "réinitialisation de mot de passe" de GoTrue au lieu de "invitation" : la personne reçoit un
      // lien pour définir un nouveau mot de passe sur sa nouvelle adresse, exactement comme à sa
      // création de compte initiale.
      const { error: resetError } = await admin.auth.resetPasswordForEmail(body.newEmail)
      if (resetError) throw resetError
      return Response.json({ ok: true }, { headers: corsHeaders })
    }

    if (body.action === 'delete') {
      // Suppression définitive de auth.users → cascade sur profiles/parents (on delete cascade).
      const { error } = await admin.auth.admin.deleteUser(body.userId)
      if (error) throw error
      return Response.json({ ok: true }, { headers: corsHeaders })
    }

    return Response.json({ error: 'Action inconnue' }, { status: 400, headers: corsHeaders })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400, headers: corsHeaders })
  }
})
