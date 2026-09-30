// supabase/functions/ai-copilot/index.ts
//
// Relais fin vers l'API Gemini (Google) pour l'Assistant IA — choisi pour son palier gratuit
// (aucune carte bancaire requise, function calling inclus) plutôt qu'Anthropic, qui est payant à
// l'usage. Ne détient que la clé API Gemini (secret serveur) — comme pour l'architecture initiale,
// aucune clé service-role Supabase n'est utilisée : le garde-fou "personnel uniquement" ci-dessous
// s'appuie sur le propre jeton de l'appelant, pas sur des droits élevés. Tout accès aux données de
// l'école passe par le client Supabase authentifié du navigateur (RLS normale) côté client, jamais
// par cette fonction — elle ne contient aucune logique métier, seulement l'adaptation de forme
// nécessaire pour appeler l'API Gemini (systemInstruction/tools/contents fournis tels quels par le
// client, transmis sans modification hormis l'enveloppe systemInstruction attendue par Gemini).
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Modèle gratuit avec function calling — gemini-2.5-flash a été retiré pour les nouveaux comptes
// en 2026 (erreur API explicite recommandant 3.6) ; à ajuster ici seul si Google fait à nouveau
// évoluer sa gamme "flash".
const MODEL = 'gemini-3.6-flash'

interface RequestBody {
  systemInstruction: string
  contents: unknown[]
  tools: unknown[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Garde-fou "personnel uniquement" — ne protège aucune donnée supplémentaire (la RLS s'en
    // charge déjà côté client), sert seulement à éviter qu'un compte parent authentifié ne
    // consomme du quota gratuit en appelant cette fonction directement (ex. depuis les devtools) :
    // un parent n'a jamais de ligne dans profiles (cf. handle_new_user(), il atterrit dans parents).
    const scoped = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: userData, error: userError } = await scoped.auth.getUser()
    if (userError || !userData.user) {
      return Response.json({ error: 'Non authentifié.' }, { status: 401, headers: corsHeaders })
    }
    const { data: profileRow } = await scoped.from('profiles').select('id').eq('id', userData.user.id).maybeSingle()
    if (!profileRow) {
      return Response.json({ error: 'Accès réservé au personnel.' }, { status: 403, headers: corsHeaders })
    }

    const body = (await req.json()) as RequestBody
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': Deno.env.get('GEMINI_API_KEY')!,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: body.systemInstruction }] },
        contents: body.contents,
        tools: body.tools,
      }),
    })
    const data = await geminiRes.json()
    if (!geminiRes.ok) {
      return Response.json({ error: data?.error?.message ?? 'Erreur Gemini.' }, { status: geminiRes.status, headers: corsHeaders })
    }
    return Response.json(data, { headers: corsHeaders })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500, headers: corsHeaders })
  }
})
