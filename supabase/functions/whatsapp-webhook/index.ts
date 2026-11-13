// BIELUMINA — Webhook WhatsApp Cloud API (Meta)
// GET  : vérification du webhook (WHATSAPP_VERIFY_TOKEN)
// POST : réception des événements — signature X-Hub-Signature-256 vérifiée
//        avec WHATSAPP_APP_SECRET avant tout traitement.
// Secrets : WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET

import { createClient } from 'npm:@supabase/supabase-js@2'

async function hmacSha256(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  const url = new URL(req.url)

  // --- Vérification Meta (challenge) ---
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    if (mode === 'subscribe' && token && token === Deno.env.get('WHATSAPP_VERIFY_TOKEN')) {
      return new Response(challenge, { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }

  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  // --- Vérification de la signature ---
  const rawBody = await req.text()
  const appSecret = Deno.env.get('WHATSAPP_APP_SECRET')
  const signature = req.headers.get('x-hub-signature-256') || ''
  if (appSecret) {
    const expected = 'sha256=' + await hmacSha256(appSecret, rawBody)
    if (signature !== expected) return new Response('Invalid signature', { status: 403 })
  }

  let event: Record<string, unknown>
  try { event = JSON.parse(rawBody) } catch { return new Response('Bad Request', { status: 400 }) }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  try {
    const entries = (event.entry as Record<string, unknown>[]) || []
    for (const entry of entries) {
      // 1) Statuts d'envoi : mise à jour de la notification correspondante.
      for (const statusEvent of (entry.changes as Record<string, unknown>[]) || []) {
        void statusEvent // réservé aux changements de profil (ignorés)
      }
      const statuses = ((entry.messaging_statuses || []) as Record<string, unknown>[])
        .concat((((entry as Record<string, unknown>).statuses || []) as Record<string, unknown>[]))
      for (const s of statuses) {
        const providerId = String(s.id || '')
        const state = String(s.status || '') // sent | delivered | read | failed
        if (!providerId) continue
        if (state === 'failed') {
          const err = (s.errors as Record<string, unknown>[])?.[0]
          await supabase.from('notifications')
            .update({ status: 'failed', error_code: String(err?.code || 'META_DELIVERY_FAILED') })
            .eq('provider_message_id', providerId)
        } else {
          await supabase.from('notification_attempts')
            .insert({ notification_id: (await supabase.from('notifications').select('id').eq('provider_message_id', providerId).single()).data?.id,
                      status: state === 'sent' ? 'sent' : 'sent', error_code: null })
        }
      }

      // 2) Messages entrants : journalisation et liaison à une commande.
      for (const msg of (entry.messaging as Record<string, unknown>[]) || []) {
        const from = String((msg.from as string) || '')
        const msgId = String((msg.id as string) || '')
        const text = String((msg.text as Record<string, unknown>)?.body ?? '')
        if (!from) continue
        // Liaison prudente : un numéro correspondant ET un numéro de commande cité.
        let orderId: string | null = null
        const orderMatch = text.match(/BL-[0-9A-F]{6,}/i)
        if (orderMatch) {
          const { data: order } = await supabase.from('orders')
            .select('id').eq('order_number', orderMatch[0].toUpperCase()).single()
          orderId = order?.id ?? null
        }
        if (!orderId && from) {
          const { data: latest } = await supabase.from('orders')
            .select('id').eq('phone', from).order('created_at', { ascending: false }).limit(1).single()
          orderId = latest?.id ?? null
        }
        await supabase.from('whatsapp_inbound').insert({
          provider_message_id: msgId || null,
          from_number: from,
          to_number: String((msg.to as string) || '') || null,
          order_id: orderId,
          body: text.slice(0, 4000),
          raw: msg,
        })
        // IMPORTANT : un message entrant n'confirme JAMAIS un paiement.
      }
    }
    return new Response('EVENT_RECEIVED', { status: 200 })
  } catch (error) {
    console.error('whatsapp-webhook', error)
    return new Response('Internal Error', { status: 500 })
  }
})
