import { useState } from 'react'
import type { ReclamationMessageLang } from '../../utils/whatsapp'

const STORAGE_KEY = 'reclamationMessageLang'

function readStored(): ReclamationMessageLang {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'ar' || v === 'both' ? v : 'fr'
  } catch {
    return 'fr'
  }
}

/** Langue du message à la famille, mémorisée sur ce poste (simple confort : l'équipe qui écrit surtout en arabe
 * n'a pas à rechoisir à chaque message). */
export function useMessageLang(): [ReclamationMessageLang, (lang: ReclamationMessageLang) => void] {
  const [lang, setLang] = useState<ReclamationMessageLang>(readStored)
  const choose = (next: ReclamationMessageLang) => {
    setLang(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Stockage indisponible (navigation privée…) : le choix vaut pour cette fenêtre seulement.
    }
  }
  return [lang, choose]
}

const OPTIONS: { key: ReclamationMessageLang; label: string; rtl?: boolean }[] = [
  { key: 'fr', label: 'Français' },
  { key: 'ar', label: 'العربية', rtl: true },
  { key: 'both', label: 'FR + عربية' },
]

export default function MessageLangSwitch({ lang, onChange }: { lang: ReclamationMessageLang; onChange: (lang: ReclamationMessageLang) => void }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5" role="group" aria-label="Langue du message">
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          dir={o.rtl ? 'rtl' : undefined}
          className={`rounded-md px-3 py-1 text-xs font-semibold ${lang === o.key ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
