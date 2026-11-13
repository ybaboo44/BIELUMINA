// BIELUMINA — Fonction Edge d'envoi WhatsApp (WhatsApp Cloud API / Meta Graph)
// Secrets Supabase (jamais dans le navigateur) :
//   WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TEMPLATE_NAME (défaut)
//   WHATSAPP_API_VERSION (défaut v23.0), CRON_SECRET (pour l'action process-due)
// Comportement : si les identifiants Meta ne sont PAS configurés, la fonction
// échoue proprement en mode "simulation" — AUCUN message réel n'est envoyé.

import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Content-Type': 'application/json',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors })

const MAX_ATTEMPTS = 5
const BACKOFF_MINUTES = (attempt: number) => Math.min(attempt, 5) // 1..5 min, exponentiel plafonné

type Payload = Record<string, unknown>

// Transforme le payload de la notification en paramètres du modèle Meta.
// Le modèle approuvé doit déclarer ses variables dans le même ordre.
function templateParams(payload: Payload): string[] {
  const money = (v: unknown, currency: unknown) =>
    v === null || v === undefined ? '' : `${Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${currency ?? ''}`.trim()
  return [
    String(payload.customer_name ?? ''),
    String(payload.order_number ?? ''),
    money(payload.total, payload.currency),
    String(payload.status ?? ''),
    money(payload.subtotal, payload.currency),
    money(payload.shipping_fee, payload.currency),
    String(payload.delivery_address ?? ''),
    String(payload.payment_method ?? ''),
    String(payload.payment_status ?? ''),
  ]
}

async function sendOne(admin: ReturnType<typeof createClient>, item: Record<string, unknown>) {
  const id = item.id as string
  const attempts = (item.attempts as number) ?? 0
  if (item.status === 'sent') return { ok: true, duplicate_prevented: true }
  if (attempts >= MAX_ATTEMPTS) return { ok: false, error: 'MAX_ATTEMPTS_REACHED' }

  await admin.from('notifications')
    .update({ status: 'processing', attempts: attempts + 1, last_attempt_at: new Date().toISOString() })
    .eq('id', id)

  const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
  const template = (item.template_name as string) || Deno.env.get('WHATSAPP_TEMPLATE_NAME')

  if (!token || !phoneNumberId) {
    const code = 'META_NOT_CONFIGURED'
    await admin.from('notifications').update({ status: 'failed', error_code: code }).eq('id', id)
    await admin.from('notification_attempts').insert({ notification_id: id, status: 'failed', error_code: code })
    return { ok: false, simulation: true, error: code }
  }
  if (!template) {
    const code = 'TEMPLATE_NOT_CONFIGURED'
    await admin.from('notifications').update({ status: 'failed', error_code: code }).eq('id', id)
    return { ok: false, error: code }
  }

  const apiVersion = Deno.env.get('WHATSAPP_API_VERSION') || 'v23.0'
  const payload = (item.payload as Payload) ?? {}
  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: item.recipient,
      type: 'template',
      template: {
        name: template,
        language: { code: 'fr' },
        components: [{
          type: 'body',
          parameters: templateParams(payload).map(text => ({ type: 'text', text })),
        }],
      },
    }),
  })
  const result = await response.json().catch(() => ({}))

  if (!response.ok) {
    const code = String(result?.error?.code || 'META_API_ERROR')
    const retryAt = new Date(Date.now() + BACKOFF_MINUTES(attempts + 1) * 60000).toISOString()
    const finalAttempt = attempts + 1 >= MAX_ATTEMPTS
    await admin.from('notifications')
      .update({ status: finalAttempt ? 'failed' : 'pending', error_code: code, next_attempt_at: retryAt })
      .eq('id', id)
    await admin.from('notification_attempts').insert({ notification_id: id, status: 'failed', error_code: code })
    return { ok: false, error: 'META_SEND_FAILED', code }
  }

  const providerId = result?.messages?.[0]?.id
  await admin.from('notifications')
    .update({ status: 'sent', provider_message_id: providerId, sent_at: new Date().toISOString(), error_code: null })
    .eq('id', id)
  await admin.from('notification_attempts').insert({ notification_id: id, status: 'sent' })
  return { ok: true, provider_message_id: providerId }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405)
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const body = await req.json().catch(() => ({}))
    const action: string = body.action || 'process'

    // Action santé : aucune authentification requise, aucun envoi.
    if (action === 'test') {
      const configured = Boolean(Deno.env.get('WHATSAPP_ACCESS_TOKEN') && Deno.env.get('WHATSAPP_PHONE_NUMBER_ID'))
      return json({ ok: true, mode: configured ? 'configured' : 'simulation', message: configured ? 'Configuration Meta détectée.' : 'Simulation uniquement : aucun message réel envoyé.' })
    }

    // Traitement de file par cron : secret dédié, sans utilisateur connecté.
    const cronSecret = Deno.env.get('CRON_SECRET')
    const isCron = Boolean(cronSecret) && req.headers.get('x-cron-secret') === cronSecret

    if (!isCron) {
      const token = req.headers.get('Authorization') || ''
      const userClient = createClient(url, anon, { global: { headers: { Authorization: token } } })
      const { data: { user }, error: authError } = await userClient.auth.getUser()
      if (authError || !user) return json({ error: 'UNAUTHORIZED' }, 401)
      const { data: allowed } = await userClient.rpc('has_permission', { permission_name: 'orders.write' })
      if (!allowed) return json({ error: 'PERMISSION_DENIED' }, 403)
    }

    const admin = createClient(url, service)

    if (action === 'process' && body.notification_id) {
      const { data: item, error } = await admin.from('notifications')
        .select('*,orders(order_number,customer_name,total,currency,status,subtotal,shipping_fee,delivery_address,payment_method,payment_status)')
        .eq('id', body.notification_id).single()
      if (error || !item || item.channel !== 'whatsapp') return json({ error: 'NOTIFICATION_NOT_FOUND' }, 404)
      // Le payload dénormalisé prime ; on complète depuis la commande si besoin.
      const merged = { ...item.orders, ...(item.payload || {}) }
      return json(await sendOne(admin, { ...item, payload: merged }))
    }

    if (action === 'process-due') {
      const limit = Math.min(Number(body.limit) || 25, 100)
      const { data: due, error } = await admin.from('notifications')
        .select('*,orders(order_number,customer_name,total,currency,status,subtotal,shipping_fee,delivery_address,payment_method,payment_status)')
        .eq('channel', 'whatsapp').in('status', ['pending', 'failed'])
        .lte('next_attempt_at', new Date().toISOString())
        .lt('attempts', MAX_ATTEMPTS)
        .order('next_attempt_at').limit(limit)
      if (error) return json({ error: 'QUEUE_READ_FAILED' }, 500)
      const results = []
      for (const item of due || []) {
        const merged = { ...item.orders, ...(item.payload || {}) }
        results.push(await sendOne(admin, { ...item, payload: merged }))
      }
      return json({ ok: true, processed: results.length, results })
    }

    return json({ error: 'INVALID_ACTION' }, 400)
  } catch (error) {
    console.error('whatsapp-notifications', error)
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
})
