import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature, x-request-id',
}

/**
 * Verify Mercado Pago webhook signature.
 * Docs: https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks#bookmark_secret_key
 * Format of `x-signature` header: `ts=<timestamp>,v1=<hmac_sha256_hex>`
 * Manifest to sign: `id:<data.id>;request-id:<x-request-id>;ts:<timestamp>;`
 */
async function verifyMpSignature(req: Request, dataId: string | undefined, secret: string): Promise<boolean> {
  try {
    const sigHeader = req.headers.get('x-signature') || ''
    const requestId = req.headers.get('x-request-id') || ''
    if (!sigHeader || !requestId || !dataId) return false

    const parts = Object.fromEntries(
      sigHeader.split(',').map((p) => {
        const [k, v] = p.trim().split('=')
        return [k, v]
      })
    ) as Record<string, string>
    const ts = parts['ts']
    const v1 = parts['v1']
    if (!ts || !v1) return false

    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest))
    const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
    // constant-time compare
    if (hex.length !== v1.length) return false
    let diff = 0
    for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ v1.charCodeAt(i)
    return diff === 0
  } catch (e) {
    console.error('Signature verification error:', e)
    return false
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Credenciais configuradas via admin (tabela configuracoes_pagamento) têm
    // prioridade; o secret de ambiente fica como fallback de compatibilidade.
    const { data: pagamentoConfig } = await supabase
      .from('configuracoes_pagamento')
      .select('access_token, webhook_secret')
      .eq('provedor', 'mercadopago')
      .maybeSingle()

    const accessToken = pagamentoConfig?.access_token || Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
    const webhookSecret = pagamentoConfig?.webhook_secret || Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET')
    if (!accessToken) {
      console.error('Mercado Pago access token not configured (nem tabela nem env)')
      return new Response('Configuration error', { status: 500 })
    }

    const body = await req.json()
    const { type, data } = body || {}

    // Signature verification (mandatory when secret is configured)
    if (webhookSecret) {
      const ok = await verifyMpSignature(req, data?.id?.toString(), webhookSecret)
      if (!ok) {
        console.warn('MP webhook signature verification failed')
        return new Response('Invalid signature', { status: 400, headers: corsHeaders })
      }
    } else {
      console.warn('MERCADOPAGO_WEBHOOK_SECRET not configured — rejecting webhooks for safety')
      return new Response('Webhook not configured', { status: 503, headers: corsHeaders })
    }

    if (type === 'payment') {
      const paymentResponse = await fetch(
        `https://api.mercadopago.com/v1/payments/${data.id}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      )
      const payment = await paymentResponse.json()

      if (payment.status === 'approved') {
        let externalRef: { empresa_id: string; plano_id: string; annual?: boolean }
        try {
          externalRef = JSON.parse(payment.external_reference || '{}')
        } catch {
          console.error('Invalid external_reference')
          return new Response('OK', { status: 200 })
        }
        const { empresa_id, plano_id, annual } = externalRef

        if (empresa_id && plano_id) {
          // Deduplicate via UNIQUE index on pagamentos.referencia
          const { error: pagamentoError } = await supabase
            .from('pagamentos')
            .insert({
              empresa_id,
              valor: payment.transaction_amount,
              status: 'pago',
              data_pagamento: new Date().toISOString().split('T')[0],
              data_vencimento: new Date().toISOString().split('T')[0],
              metodo_pagamento: 'mercado_pago',
              referencia: payment.id.toString(),
              observacoes: `Pagamento via Mercado Pago - ${annual ? 'Anual' : 'Mensal'}`,
            })

          if (pagamentoError) {
            // Likely duplicate — swallow and return OK to prevent replay
            if ((pagamentoError as any).code === '23505') {
              console.log(`Duplicate payment ${payment.id}; ignoring replay`)
              return new Response('OK', { status: 200, headers: corsHeaders })
            }
            console.error('Error creating payment record:', pagamentoError)
          } else {
            const { error: contratoError } = await supabase
              .rpc('criar_contrato_plano', { p_empresa_id: empresa_id, p_plano_id: plano_id })
            if (contratoError) console.error('Error creating contract:', contratoError)

            await supabase
              .from('empresas')
              .update({ bloqueada: false, motivo_bloqueio: null, data_bloqueio: null, is_demo: false })
              .eq('id', empresa_id)
          }
        }
      } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
        console.log(`Payment ${data.id} was ${payment.status}`)
      }
    }

    return new Response('OK', { status: 200, headers: corsHeaders })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response('Error', { status: 500, headers: corsHeaders })
  }
})
