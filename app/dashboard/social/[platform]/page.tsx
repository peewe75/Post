'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, use } from 'react'
import { PLATFORMS, type PlatformKey, type FormatoConfig } from '@/lib/social-config'
import { createClient } from '@/lib/supabase/client'
import { demoContenuti } from '@/lib/demo-data'
import { Sparkles, Loader2, Check, X, ArrowLeft, Calendar, Eye, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import StatusBadge from '@/components/StatusBadge'
import ConfirmModal from '@/components/ConfirmModal'
import type { Contenuto } from '@/lib/types'
import { useActiveClienteId } from '@/lib/tenant/client'

import { isDemo } from '@/lib/demo'

export default function SocialPlatformPage({ params }: { params: Promise<{ platform: string }> }) {
  const { platform } = use(params)
  const config = PLATFORMS[platform as PlatformKey]
  if (!config) notFound()

  return <PlatformContent config={config} />
}

function PlatformContent({ config }: { config: typeof PLATFORMS[PlatformKey] }) {
  const [recenti, setRecenti] = useState<Contenuto[]>([])
  const [states, setStates]   = useState<Record<string, 'idle' | 'loading' | 'success' | 'error'>>({})
  const [pending, setPending] = useState<FormatoConfig | null>(null)
  const [aiModel, setAiModel] = useState('anthropic/claude-sonnet-4-5')
  const supabase = createClient()
  const demo = isDemo()
  const { clienteId, loading: loadingCliente } = useActiveClienteId()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAiModel(localStorage.getItem('ai_model') ?? 'anthropic/claude-sonnet-4-5')
    }
  }, [])

  useEffect(() => {
    async function load() {
      if (demo) {
        setRecenti(demoContenuti.filter(c => c.canale === config.canaleDb).slice(0, 5))
        return
      }
      if (loadingCliente) return
      const { data } = await supabase
        .from('calendario')
        .select('*')
        .eq('cliente_id', clienteId ?? '')
        .eq('canale', config.canaleDb)
        .order('data_pubblicazione', { ascending: false })
        .limit(5)
      setRecenti(((data ?? []) as unknown) as Contenuto[])
    }
    load()
  }, [demo, supabase, config.canaleDb, clienteId, loadingCliente])

  function chiediGenera(f: FormatoConfig) {
    setPending(f)
  }

  async function genera(f: FormatoConfig) {
    setPending(null)
    setStates(s => ({ ...s, [f.id]: 'loading' }))
    if (demo) {
      await new Promise(r => setTimeout(r, 1200))
      setStates(s => ({ ...s, [f.id]: 'success' }))
      setTimeout(() => setStates(s => ({ ...s, [f.id]: 'idle' })), 3000)
      return
    }
    try {
      if (!clienteId) throw new Error('Cliente non selezionato')
      const model = typeof window !== 'undefined' ? localStorage.getItem('ai_model') ?? 'anthropic/claude-sonnet-4-5' : 'anthropic/claude-sonnet-4-5'
      const orKey = typeof window !== 'undefined' ? localStorage.getItem('openrouter_key') ?? '' : ''
      const res = await fetch('/api/genera', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente_id: clienteId, canale: config.canaleDb, formato: f.formato, model, openrouter_key: orKey }),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error ?? `HTTP ${res.status}`)
      }
      setStates(s => ({ ...s, [f.id]: 'success' }))
    } catch {
      setStates(s => ({ ...s, [f.id]: 'error' }))
    }
    setTimeout(() => setStates(s => ({ ...s, [f.id]: 'idle' })), 3500)
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
        <ArrowLeft className="w-3.5 h-3.5" />
        Dashboard
      </Link>

      {/* Header piattaforma */}
      <div className={`rounded-2xl bg-gradient-to-br ${config.gradient} border border-gray-100 p-6 md:p-8 mb-6`}>
        <div className="flex items-start gap-4">
          <div className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl ${config.colorBg} flex items-center justify-center text-3xl md:text-4xl shadow-lg flex-shrink-0`}>
            {config.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{config.nome}</h1>
            <p className="text-sm md:text-base text-gray-600 mt-1">{config.tagline}</p>
            <p className="text-xs md:text-sm text-gray-500 mt-2 max-w-2xl">{config.descrizione}</p>
          </div>
        </div>
      </div>

      {/* Format scegliere cosa creare */}
      <div className="mb-8">
        <h2 className="font-bold text-gray-900 mb-1">Cosa vuoi creare?</h2>
        <p className="text-xs md:text-sm text-gray-500 mb-4">Scegli il formato. L&apos;AI scriverà hook, caption, hashtag e CTA per te.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 md:gap-4">
          {config.formati.map(f => {
            const Icon = f.icon
            const st = states[f.id] ?? 'idle'
            return (
              <div key={f.id} className="card p-4 md:p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl ${config.colorBg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900">{f.nome}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{f.desc}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-mono">{f.aspectRatio}</span>
                      <span className="text-[10px] text-gray-400 font-mono">{f.workflow}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-2.5 mb-3">
                  <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-0.5">Esempio</p>
                  <p className="text-xs text-gray-700 italic">&ldquo;{f.esempio}&rdquo;</p>
                </div>

                <button
                  onClick={() => chiediGenera(f)}
                  disabled={st === 'loading'}
                  className={`w-full text-sm font-semibold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 ${
                    st === 'success' ? 'bg-green-100 text-green-700' :
                    st === 'error'   ? 'bg-red-100 text-red-700' :
                                       'bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60'
                  }`}
                >
                  {st === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
                  {st === 'success' && <Check className="w-4 h-4" />}
                  {st === 'error'   && <X className="w-4 h-4" />}
                  {st === 'idle'    && <Sparkles className="w-4 h-4" />}
                  {st === 'loading' ? 'Generando...' :
                   st === 'success' ? 'Aggiunto in calendario' :
                   st === 'error'   ? 'Errore — riprova' :
                   `Genera ${f.nome.toLowerCase()}`}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Confirm modal */}
      {pending && (() => {
        const isFree = aiModel.endsWith(':free')
        return (
          <ConfirmModal
            open={true}
            onClose={() => setPending(null)}
            onConfirm={() => genera(pending)}
            title={`Generare ${pending.nome} ${config.nome}?`}
            desc={`L'AI scriverà hook, caption, hashtag e CTA per un ${pending.nome.toLowerCase()} ${config.nome}. Verrà aggiunto al calendario in stato DA_APPROVARE.`}
            modello={aiModel}
            isFree={isFree}
            tokenEstimate={{
              input: 800,
              output: 600,
              cost: isFree ? 'GRATIS (OpenRouter free)' :
                    aiModel.includes('opus') ? '~$0.03' :
                    aiModel.includes('haiku') ? '~$0.004' :
                    '~$0.012',
            }}
            running={false}
          />
        )
      })()}

      {/* Contenuti recenti */}
      {recenti.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900">Ultimi contenuti {config.nome}</h2>
            <Link href={`/dashboard/calendario`} className="text-xs text-brand-600 hover:underline flex items-center gap-1">
              Tutti <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {recenti.map(c => (
              <div key={c.id} className="card p-3 md:p-4 flex items-center gap-3 hover:shadow-sm transition-shadow">
                <div className="w-12 h-12 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden">
                  {c.link_media_1 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.link_media_1} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl">{config.emoji}</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-[10px] text-gray-400">{c.id_contenuto}</span>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="text-sm font-medium text-gray-800 truncate">{c.hook || c.caption}</p>
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {c.data_pubblicazione} {c.ora_pubblicazione?.slice(0,5)}
                  </p>
                </div>
                <Link href={`/dashboard/calendario`} className="btn-secondary py-1.5 px-2">
                  <Eye className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
