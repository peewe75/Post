import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { cliente_id, canale, formato, model, openrouter_key } = await req.json()

    if (!openrouter_key) {
      return NextResponse.json({ error: 'OpenRouter key mancante. Impostala in Impostazioni → AI.' }, { status: 400 })
    }
    if (!cliente_id) {
      return NextResponse.json({ error: 'Cliente non selezionato' }, { status: 400 })
    }

    // Normalize model: bare name (no provider prefix) → default
    const resolvedModel = (model && model.includes('/'))
      ? model
      : 'anthropic/claude-sonnet-4-5'

    const supabase = await createClient()

    // Fetch brand
    const { data: brands } = await supabase
      .from('brand')
      .select('brand_name, sito_url, tono_voce, target, hashtag_base, cta_base, parole_da_usare, parole_da_evitare, emoji_policy')
      .eq('cliente_id', cliente_id)
      .limit(1)

    const brand = brands?.[0]

    // Fetch prodotti attivi
    const { data: prodotti } = await supabase
      .from('prodotti')
      .select('product_id, nome_prodotto, categoria, prezzo, prezzo_promo, mood, target, link_img_1')
      .eq('cliente_id', cliente_id)
      .eq('prodotto_attivo', 'SI')
      .neq('stock_status', 'esaurito')
      .limit(12)

    // Build prompt
    const prompt = buildPrompt({ canale, formato, brand, prodotti: prodotti ?? [] })

    // Call OpenRouter
    const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouter_key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://socialpost26.netlify.app',
        'X-Title': 'Social Automation',
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1200,
        temperature: 0.8,
      }),
    })

    if (!orRes.ok) {
      const err = await orRes.text()
      return NextResponse.json({ error: `OpenRouter error ${orRes.status}: ${err}` }, { status: 500 })
    }

    const orData = await orRes.json()
    const rawContent: string = orData.choices?.[0]?.message?.content ?? ''

    // Extract JSON from response (handles markdown code blocks too)
    let parsed: Record<string, string>
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found')
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      return NextResponse.json({ error: 'Risposta AI non in formato JSON valido', raw: rawContent }, { status: 500 })
    }

    // Generate unique id_contenuto
    const ts = Date.now()
    const idContenuto = `${canale.toUpperCase().replace('_', '')}_${ts}`

    // Tomorrow as default publish date
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dataPub = tomorrow.toISOString().split('T')[0]

    // Insert in calendario
    const { error: insErr } = await supabase.from('calendario').insert({
      id_contenuto: idContenuto,
      cliente_id,
      canale,
      formato,
      status: 'DA_APPROVARE',
      data_pubblicazione: dataPub,
      ora_pubblicazione: '12:00',
      tema:    parsed.tema    ?? '',
      hook:    parsed.hook    ?? '',
      caption: parsed.caption ?? '',
      hashtag: parsed.hashtag ?? '',
      cta:     parsed.cta     ?? '',
    })

    if (insErr) {
      return NextResponse.json({ error: `Supabase: ${insErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id_contenuto: idContenuto })

  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

function buildPrompt({ canale, formato, brand, prodotti }: {
  canale: string
  formato: string
  brand: Record<string, string> | undefined
  prodotti: Record<string, string | number>[]
}) {
  const brandStr = brand
    ? `Brand: ${brand.brand_name}
Sito: ${brand.sito_url ?? 'N/A'}
Tono voce: ${brand.tono_voce ?? 'moderno, coinvolgente'}
Target: ${brand.target ?? 'giovani adulti'}
Hashtag base: ${brand.hashtag_base ?? ''}
CTA base: ${brand.cta_base ?? ''}
Parole da usare: ${brand.parole_da_usare ?? ''}
Parole da evitare: ${brand.parole_da_evitare ?? ''}
Emoji policy: ${brand.emoji_policy ?? 'moderato'}`
    : 'Brand non ancora configurato. Usa tono moderno e professionale.'

  const prodottiStr = prodotti.length > 0
    ? prodotti
        .map(p => `- ${p.nome_prodotto} (${p.categoria ?? ''}) €${p.prezzo_promo ?? p.prezzo ?? '?'} | mood: ${p.mood ?? ''}`)
        .join('\n')
    : 'Nessun prodotto configurato. Crea contenuto brand awareness generico.'

  const formatoDesc: Record<string, string> = {
    post:      'Post foto singola con caption e hashtag',
    carousel:  'Carosello multi-slide: hook slide 1, descrizione prodotto, lifestyle, CTA finale',
    reel:      'Script video verticale 9:16, 15-30s: hook nei primi 2s, 3-4 scene, CTA',
    story:     'Story 24h: brevissima, visiva, con swipe up o sticker poll',
    video:     'Script video landscape 16:9, 30-60s: apertura forte, messaggio chiaro, CTA',
    pin:       'Pin verticale 2:3 SEO-friendly: titolo keyword-rich, descrizione, link prodotto',
    articolo:  'Post thought leadership: insight settore, dati, CTA professionale',
    short:     'YouTube Short 9:16 60s max: hook 0-3s, valore rapido, subscribe CTA',
  }

  return `Sei un social media manager esperto. Crea UN contenuto per ${canale} (${formatoDesc[formato] ?? formato}).

${brandStr}

Prodotti disponibili:
${prodottiStr}

Regole:
- Hook: max 10 parole, potente, crea curiosità o desiderio
- Caption: max 200 parole, tono del brand, NON ripetere l'hook
- Hashtag: 8-15 tag rilevanti (includi #) separati da spazio
- CTA: frase breve e diretta (es. "Scopri ora →", "Acquista in bio")
- Scegli UN prodotto dalla lista se disponibile

Rispondi SOLO con JSON valido, nessun altro testo:
{
  "tema": "tema in 3-5 parole",
  "hook": "hook accattivante",
  "caption": "caption completa",
  "hashtag": "#tag1 #tag2 #tag3",
  "cta": "call to action"
}`
}
