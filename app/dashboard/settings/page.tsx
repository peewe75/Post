'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Setting } from '@/lib/types'
import { Save, RefreshCw, Key, Bot } from 'lucide-react'
import { demoSettings } from '@/lib/demo-data'
import { useActiveClienteId } from '@/lib/tenant/client'

import { isDemo } from '@/lib/demo'

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState<string | null>(null)
  const [saved, setSaved]       = useState<string | null>(null)
  const [orKey, setOrKey]       = useState('')
  const [orModel, setOrModel]   = useState('anthropic/claude-sonnet-4-5')
  const supabase = createClient()
  const demo = isDemo()
  const { clienteId, loading: loadingCliente } = useActiveClienteId()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrKey(localStorage.getItem('openrouter_key') ?? '')
      setOrModel(localStorage.getItem('ai_model') ?? 'anthropic/claude-sonnet-4-5')
    }
  }, [])

  useEffect(() => {
    if (demo) {
      setSettings(demoSettings)
      setLoading(false)
      return
    }
    if (loadingCliente) return
    supabase.from('settings').select('*').eq('cliente_id', clienteId ?? '').order('chiave')
      .then(({ data }) => { setSettings(data ?? []); setLoading(false) })
  }, [supabase, demo, clienteId, loadingCliente])

  async function updateSetting(s: Setting, newVal: string) {
    setSaving(s.id)
    if (!demo) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('settings') as any).update({ valore: newVal }).eq('id', s.id)
    }
    setSettings(prev => prev.map(x => x.id === s.id ? { ...x, valore: newVal } : x))
    setSaved(s.id)
    setTimeout(() => setSaved(null), 2000)
    setSaving(null)
  }

  const boolKeys = ['automation_enabled','dry_run','telegram_notifications','backup_enabled','approval_required','media_validation_required','stock_check_required']

  return (
    <div className="p-4 md:p-8">
      <div className="mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Impostazioni</h1>
        <p className="text-xs md:text-sm text-gray-500 mt-0.5">Configurazione automazione</p>
      </div>

      {/* AI / OpenRouter */}
      <div className="max-w-2xl mb-8">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Bot className="w-4 h-4" /> AI — OpenRouter
        </h2>
        <div className="space-y-3">
          <div className="card p-4">
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5"><Key className="w-3.5 h-3.5" /> API Key OpenRouter</p>
                <p className="text-xs text-gray-400 mt-0.5">Salvata solo nel browser. Ottienila su <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="underline">openrouter.ai/keys</a></p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <input
                  type="password"
                  value={orKey}
                  onChange={e => { setOrKey(e.target.value); localStorage.setItem('openrouter_key', e.target.value) }}
                  placeholder="sk-or-v1-..."
                  className="input w-52 text-right font-mono text-xs"
                />
                {orKey && <Save className="w-4 h-4 text-green-500" />}
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">Modello AI</p>
                <p className="text-xs text-gray-400 mt-0.5">Usato per generare contenuti social</p>
              </div>
              <select
                value={orModel}
                onChange={e => { setOrModel(e.target.value); localStorage.setItem('ai_model', e.target.value) }}
                className="input w-56"
              >
                <optgroup label="Anthropic">
                  <option value="anthropic/claude-sonnet-4-5">Claude Sonnet 4.5</option>
                  <option value="anthropic/claude-opus-4">Claude Opus 4</option>
                  <option value="anthropic/claude-3-5-haiku">Claude 3.5 Haiku</option>
                </optgroup>
                <optgroup label="OpenAI">
                  <option value="openai/gpt-4o">GPT-4o</option>
                  <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
                </optgroup>
                <optgroup label="Google">
                  <option value="google/gemini-2.0-flash-001">Gemini 2.0 Flash</option>
                </optgroup>
                <optgroup label="Free">
                  <option value="meta-llama/llama-3.3-70b-instruct:free">Llama 3.3 70B (free)</option>
                  <option value="mistralai/mistral-nemo:free">Mistral Nemo (free)</option>
                </optgroup>
              </select>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      ) : (
        <div className="max-w-2xl space-y-3">
          {settings.map(s => (
            <div key={s.id} className="card p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{s.chiave}</p>
                {s.descrizione && <p className="text-xs text-gray-400 mt-0.5">{s.descrizione}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {boolKeys.includes(s.chiave) ? (
                  <button
                    onClick={() => updateSetting(s, s.valore.toUpperCase() === 'TRUE' ? 'FALSE' : 'TRUE')}
                    disabled={saving === s.id}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      s.valore.toUpperCase() === 'TRUE' ? 'bg-brand-600' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      s.valore.toUpperCase() === 'TRUE' ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      defaultValue={s.valore}
                      onBlur={e => {
                        if (e.target.value !== s.valore) updateSetting(s, e.target.value)
                      }}
                      className="input w-40 text-right"
                    />
                    {saving === s.id && <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />}
                    {saved === s.id && <Save className="w-4 h-4 text-green-500" />}
                  </div>
                )}
                {boolKeys.includes(s.chiave) && saved === s.id && (
                  <Save className="w-4 h-4 text-green-500" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sezione pericolosa */}
      <div className="max-w-2xl mt-10">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Zone pericolose</h2>
        <div className="card border-red-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Automation enabled</p>
              <p className="text-xs text-gray-400">Se disabilitato, NESSUN post viene pubblicato</p>
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${
              settings.find(s => s.chiave === 'automation_enabled')?.valore?.toUpperCase() === 'TRUE'
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {settings.find(s => s.chiave === 'automation_enabled')?.valore?.toUpperCase() === 'TRUE' ? 'ATTIVA' : 'SPENTA'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
