import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders })

const maxAttempts = 5
const retryDelayMinutes = (attempt: number) => Math.min(2 ** attempt, 60)
type JsonRecord = Record<string, unknown>

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('')
}

async function hashAccessToken(token: string) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))
}

function htmlEscape(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]!)
}

function formatMoney(value: unknown, currency: unknown) {
  const amount = Number(value)
  return `${Number.isFinite(amount) ? amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'} ${String(currency || '')}`.trim()
}

function statusLabel(status: unknown) {
  const labels: Record<string, string> = {
    pending_confirmation: 'En attente de confirmation',
    confirmed: 'Confirmée',
    processing: 'En préparation',
    ready_for_delivery: 'Prête à être livrée',
    shipped: 'Expédiée',
    delivered: 'Livrée',
    cancelled: 'Annulée',
    unpaid: 'Non payé',
    pending: 'En attente',
    paid: 'Payé',
    proof_received: 'Justificatif reçu',
    verification: 'En vérification',
    rejected: 'Refusé',
    failed: 'Échec',
    refunded: 'Remboursé',
  }
  const value = String(status ?? '')
  return labels[value] || value
}

function emailContent(order: JsonRecord, notification: JsonRecord) {
  const payload = (notification.payload || {}) as JsonRecord
  const isAdmin = payload.recipient_type === 'admin'
  const event = String(payload.event || 'order_created')
  const orderNumber = htmlEscape(order.order_number)
  const customerName = htmlEscape(order.customer_name)
  const eventStatus = htmlEscape(statusLabel(payload.status || order.status))
  const items = Array.isArray(order.order_items) ? order.order_items as JsonRecord[] : []
  const itemRows = items.map(item => `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #eee">${htmlEscape(item.product_name)} — ${htmlEscape(item.variant_name)}</td>
    <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:center">${htmlEscape(item.quantity)}</td>
    <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right">${htmlEscape(formatMoney(item.line_total, order.currency))}</td>
  </tr>`).join('')

  const subject = event === 'payment_status'
    ? `BIELUMINA · Paiement ${statusLabel(payload.status)} · ${order.order_number}`
    : event === 'order_status'
      ? `BIELUMINA · Commande ${statusLabel(payload.status)} · ${order.order_number}`
      : `BIELUMINA · Nouvelle commande ${order.order_number}`
  const heading = isAdmin ? 'Mise à jour de commande' : 'Votre commande BIELUMINA'
  const intro = isAdmin
    ? `Commande de ${customerName} (${htmlEscape(order.phone)}).`
    : 'Nous avons bien reçu votre commande. Notre équipe vous contactera pour confirmer les détails.'
  const paymentText = event === 'payment_status'
    ? `Le statut du paiement est maintenant : ${eventStatus}.`
    : `Statut de la commande : ${eventStatus}.`
  const textItems = items.map(item => `${item.product_name} — ${item.variant_name} × ${item.quantity}: ${formatMoney(item.line_total, order.currency)}`).join('\n')
  const text = `${heading}\n${intro}\nCommande : ${order.order_number}\n${paymentText}\n\n${textItems}\n\nSous-total : ${formatMoney(order.subtotal, order.currency)}\nLivraison : ${formatMoney(order.shipping_fee, order.currency)}\nTotal : ${formatMoney(order.total, order.currency)}`
  const html = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#211f1c">
    <div style="background:#1c1b19;color:#fff;padding:24px 28px"><strong style="letter-spacing:.18em">BIELUMINA</strong></div>
    <div style="padding:28px"><h1 style="font-size:24px">${heading}</h1>
      <p>${intro}</p><p><strong>Commande ${orderNumber}</strong><br>${paymentText}</p>
      <table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Article</th><th>Qté</th><th style="text-align:right">Montant</th></tr></thead>
      <tbody>${itemRows}</tbody></table>
      <p>Sous-total : <strong>${htmlEscape(formatMoney(order.subtotal, order.currency))}</strong><br>
      Livraison : <strong>${htmlEscape(formatMoney(order.shipping_fee, order.currency))}</strong><br>
      Total : <strong>${htmlEscape(formatMoney(order.total, order.currency))}</strong></p>
      ${isAdmin ? `<p>Téléphone : ${htmlEscape(order.phone)}<br>E-mail client : ${htmlEscape(order.email || 'non renseigné')}<br>Adresse : ${htmlEscape(order.delivery_address)}</p>` : ''}
      <p style="color:#746e65;font-size:13px">BIELUMINA · Élégance, qualité, vous.</p>
    </div></div>`
  return { subject, text, html }
}

function whatsappParameters(order: JsonRecord) {
  return [
    String(order.customer_name ?? ''),
    String(order.order_number ?? ''),
    formatMoney(order.total, order.currency),
    statusLabel(order.status),
    formatMoney(order.subtotal, order.currency),
    formatMoney(order.shipping_fee, order.currency),
    String(order.delivery_address ?? ''),
    String(order.payment_method ?? ''),
    statusLabel(order.payment_status),
  ]
}

async function providerSend(notification: JsonRecord, order: JsonRecord) {
  if (notification.channel === 'email') {
    const apiKey = Deno.env.get('RESEND_API_KEY')
    const from = Deno.env.get('EMAIL_FROM')
    if (!apiKey) throw new Error('RESEND_NOT_CONFIGURED')
    if (!from) throw new Error('EMAIL_FROM_NOT_CONFIGURED')
    const content = emailContent(order, notification)
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [notification.recipient], subject: content.subject, text: content.text, html: content.html }),
    })
    const result = await response.json().catch(() => ({})) as JsonRecord
    if (!response.ok) throw new Error(String(result.message || result.name || `RESEND_HTTP_${response.status}`))
    return String(result.id || '')
  }

  if (notification.channel === 'whatsapp') {
    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
    const templateName = String(notification.template_name || Deno.env.get('WHATSAPP_TEMPLATE_NAME') || '')
    if (!accessToken) throw new Error('WHATSAPP_ACCESS_TOKEN_NOT_CONFIGURED')
    if (!phoneNumberId) throw new Error('WHATSAPP_PHONE_NUMBER_ID_NOT_CONFIGURED')
    if (!templateName) throw new Error('WHATSAPP_TEMPLATE_NOT_CONFIGURED')
    const version = Deno.env.get('WHATSAPP_API_VERSION') || 'v23.0'
    const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: notification.recipient,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'fr' },
          components: [{
            type: 'body',
            parameters: whatsappParameters(order).map(text => ({ type: 'text', text })),
          }],
        },
      }),
    })
    const result = await response.json().catch(() => ({})) as JsonRecord
    if (!response.ok) {
      const providerError = result.error as JsonRecord | undefined
      throw new Error(String(providerError?.code || `WHATSAPP_HTTP_${response.status}`))
    }
    const messages = result.messages as JsonRecord[] | undefined
    return String(messages?.[0]?.id || '')
  }
  throw new Error('UNSUPPORTED_NOTIFICATION_CHANNEL')
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anonKey || !serviceKey) return json({ error: 'SUPABASE_FUNCTION_CONFIG_MISSING' }, 500)

  let body: JsonRecord
  try {
    body = await request.json() as JsonRecord
  } catch {
    return json({ error: 'INVALID_JSON' }, 400)
  }

  const admin = createClient(url, serviceKey)
  const authenticateAdmin = async (permission: string) => {
    const authorization = request.headers.get('Authorization')
    if (!authorization) return false
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } })
    const { data: { user }, error } = await userClient.auth.getUser()
    if (error || !user) return false
    const { data: allowed, error: permissionError } = await userClient.rpc('has_permission', { permission_name: permission })
    return !permissionError && allowed === true
  }

  try {
    const action = String(body.action || '')
    let orderId: string | undefined

    if (action === 'dispatch_order') {
      const orderNumber = String(body.order_number || '').trim().toUpperCase()
      const accessToken = String(body.access_token || '')
      if (!orderNumber || accessToken.length < 32) return json({ error: 'ORDER_ACCESS_REQUIRED' }, 400)
      const { data: order, error } = await admin.from('orders')
        .select('id,guest_token_hash').eq('order_number', orderNumber).maybeSingle()
      if (error) return json({ error: 'ORDER_LOOKUP_FAILED' }, 500)
      if (!order || await hashAccessToken(accessToken) !== order.guest_token_hash) return json({ error: 'ORDER_ACCESS_DENIED' }, 403)
      orderId = order.id
    } else if (action === 'dispatch_due' || action === 'dispatch_notification' || action === 'test') {
      const cronSecret = Deno.env.get('CRON_SECRET')
      const isCron = action === 'dispatch_due' && Boolean(cronSecret) && request.headers.get('x-cron-secret') === cronSecret
      if (!isCron && !await authenticateAdmin(action === 'test' ? 'orders.read' : 'orders.write')) return json({ error: 'PERMISSION_DENIED' }, 403)
      if (action === 'dispatch_notification') {
        orderId = String(body.order_id || '')
        if (!orderId) return json({ error: 'ORDER_ID_REQUIRED' }, 400)
      }
      if (action === 'test') {
        return json({
          ok: true,
          email_configured: Boolean(Deno.env.get('RESEND_API_KEY') && Deno.env.get('EMAIL_FROM')),
          whatsapp_configured: Boolean(Deno.env.get('WHATSAPP_ACCESS_TOKEN') && Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') && Deno.env.get('WHATSAPP_TEMPLATE_NAME')),
          message: 'Contrôle de configuration uniquement : aucun message n’a été envoyé.',
        })
      }
    } else {
      return json({ error: 'INVALID_ACTION' }, 400)
    }

    let query = admin.from('notifications')
      .select('id,order_id,channel,recipient,status,attempts,next_attempt_at,template_name,payload')
      .in('status', ['pending', 'failed'])
      .lte('next_attempt_at', new Date().toISOString())
      .lt('attempts', maxAttempts)
      .order('created_at', { ascending: true })
      .limit(Math.min(Math.max(Number(body.limit) || 25, 1), 100))
    if (orderId) query = query.eq('order_id', orderId)
    if (action === 'dispatch_notification') query = query.eq('id', String(body.notification_id || ''))
    const { data: notifications, error: queryError } = await query
    if (queryError) return json({ error: 'NOTIFICATION_QUEUE_READ_FAILED', detail: queryError.message }, 500)

    const results: JsonRecord[] = []
    for (const notification of notifications || []) {
      const { data: order, error: orderError } = await admin.from('orders')
        .select('*,order_items(*)').eq('id', notification.order_id).maybeSingle()
      if (orderError || !order) {
        results.push({ id: notification.id, ok: false, error: 'ORDER_NOT_FOUND' })
        continue
      }

      const now = new Date().toISOString()
      const { data: claimed, error: claimError } = await admin.from('notifications')
        .update({ status: 'processing', attempts: notification.attempts + 1, last_attempt_at: now })
        .eq('id', notification.id)
        .in('status', ['pending', 'failed'])
        .lt('attempts', maxAttempts)
        .lte('next_attempt_at', now)
        .select('id').maybeSingle()
      if (claimError) return json({ error: 'NOTIFICATION_CLAIM_FAILED', detail: claimError.message }, 500)
      if (!claimed) {
        results.push({ id: notification.id, ok: true, skipped: true })
        continue
      }

      try {
        const providerId = await providerSend(notification, order)
        const { error: saveError } = await admin.from('notifications')
          .update({ status: 'sent', provider_message_id: providerId || null, sent_at: new Date().toISOString(), error_code: null })
          .eq('id', notification.id)
        if (saveError) throw new Error('NOTIFICATION_STATUS_SAVE_FAILED')
        await admin.from('notification_attempts').insert({ notification_id: notification.id, status: 'sent' })
        results.push({ id: notification.id, ok: true, channel: notification.channel })
      } catch (error) {
        const errorCode = error instanceof Error ? error.message.slice(0, 120) : 'PROVIDER_SEND_FAILED'
        const attempts = notification.attempts + 1
        const finalAttempt = attempts >= maxAttempts
        const nextAttempt = new Date(Date.now() + retryDelayMinutes(attempts) * 60_000).toISOString()
        const { error: saveError } = await admin.from('notifications')
          .update({ status: finalAttempt ? 'failed' : 'pending', error_code: errorCode, next_attempt_at: nextAttempt })
          .eq('id', notification.id)
        if (saveError) console.error('notification status update failed', notification.id, saveError.message)
        const { error: attemptError } = await admin.from('notification_attempts')
          .insert({ notification_id: notification.id, status: 'failed', error_code: errorCode })
        if (attemptError) console.error('notification attempt log failed', notification.id, attemptError.message)
        results.push({ id: notification.id, ok: false, channel: notification.channel, error: errorCode })
      }
    }

    return json({ ok: results.every(result => result.ok), processed: results.length, results })
  } catch (error) {
    console.error('order-notifications', error)
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
})
