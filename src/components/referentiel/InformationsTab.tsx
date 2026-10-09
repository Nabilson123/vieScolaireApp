import { useEffect, useRef, useState } from 'react'
import { Image, Stamp } from 'lucide-react'
import { useSchoolIdentity, useUpdateSchoolIdentity } from '../../services/schoolIdentityService'
import type { SchoolIdentity } from '../../data/schoolIdentity'

interface InformationsTabProps {
  onSaved: () => void
}

type FormState = SchoolIdentity & { id: string }

export default function InformationsTab({ onSaved }: InformationsTabProps) {
  const { data: identity } = useSchoolIdentity()
  const updateIdentity = useUpdateSchoolIdentity()
  const [form, setForm] = useState<FormState | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cachetInputRef = useRef<HTMLInputElement>(null)
  const associationLogoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (identity) setForm(identity)
  }, [identity])

  const set = <K extends keyof SchoolIdentity>(key: K, value: SchoolIdentity[K]) => {
    if (!form) return
    const next = { ...form, [key]: value }
    setForm(next)
    updateIdentity.mutate(next)
    onSaved()
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => set('logo', reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleCachetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => set('cachet', reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleAssociationLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => set('associationLogo', reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  if (!form) {
    return <p className="text-sm text-slate-400">Chargement...</p>
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
      <div>
        <div className="flex h-40 w-40 items-center justify-center overflow-hidden rounded-full border-4 border-slate-100 bg-slate-50">
          {form.logo ? <img src={form.logo} alt="Logo" className="h-full w-full object-cover" /> : <Image className="h-10 w-10 text-slate-300" />}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mt-4 flex w-40 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:from-indigo-500 hover:to-violet-500"
        >
          <Image className="h-3.5 w-3.5" />
          Charger le logo
        </button>

        <div className="mt-8 flex h-40 w-40 items-center justify-center overflow-hidden rounded-full border-4 border-slate-100 bg-slate-50">
          {form.cachet ? <img src={form.cachet} alt="Cachet" className="h-full w-full object-cover" /> : <Stamp className="h-10 w-10 text-slate-300" />}
        </div>
        <input ref={cachetInputRef} type="file" accept="image/*" onChange={handleCachetChange} className="hidden" />
        <button
          type="button"
          onClick={() => cachetInputRef.current?.click()}
          className="mt-4 flex w-40 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:from-indigo-500 hover:to-violet-500"
        >
          <Stamp className="h-3.5 w-3.5" />
          Charger le cachet
        </button>
        <p className="mt-2 w-40 text-center text-[11px] leading-snug text-slate-400">
          Utilisé avec la signature du profil connecté sur les documents officiels.
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nom de l'école">
            <input value={form.nom} onChange={(e) => set('nom', e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none" />
          </Field>
          <Field label="Nom de l'école (ar)">
            <input dir="rtl" value={form.nomAr} onChange={(e) => set('nomAr', e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none" />
          </Field>
          <Field label="Numéro de téléphone 1">
            <input value={form.tel1} onChange={(e) => set('tel1', e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none" />
          </Field>
          <Field label="Numéro de téléphone 2">
            <input value={form.tel2} onChange={(e) => set('tel2', e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none" />
          </Field>
          <Field label="Fax">
            <input value={form.fax} onChange={(e) => set('fax', e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none" />
          </Field>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">Cycles</p>
          <div className="flex flex-wrap gap-4">
            {(
              [
                ['maternelle', 'Maternelle Ecole'],
                ['primaire', 'Primaire Ecole'],
                ['college', 'Collège Ecole'],
                ['lycee', 'Lycée Ecole'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.cycles[key]}
                  onChange={(e) => set('cycles', { ...form.cycles, [key]: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <Field label="Adresse">
          <input value={form.adresse} onChange={(e) => set('adresse', e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none" />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Site web">
            <input value={form.siteWeb} onChange={(e) => set('siteWeb', e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none" />
          </Field>
          <Field label="E-mail">
            <input value={form.email} onChange={(e) => set('email', e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none" />
          </Field>
          <Field label="Facebook">
            <input value={form.facebook} onChange={(e) => set('facebook', e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none" />
          </Field>
          <Field label="Instagram">
            <input value={form.instagram} onChange={(e) => set('instagram', e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none" />
          </Field>
          <Field label="Linkedin">
            <input value={form.linkedin} onChange={(e) => set('linkedin', e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none" />
          </Field>
        </div>

        <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-amber-800">Association sportive</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                {form.associationLogo ? <img src={form.associationLogo} alt="Logo de l'association" className="h-full w-full object-contain" /> : <Image className="h-8 w-8 text-slate-300" />}
              </div>
              <div className="flex flex-col gap-2">
                <input ref={associationLogoRef} type="file" accept="image/*" onChange={handleAssociationLogoChange} className="hidden" />
                <button
                  type="button"
                  onClick={() => associationLogoRef.current?.click()}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:from-indigo-500 hover:to-violet-500"
                >
                  <Image className="h-3.5 w-3.5" />
                  Charger le logo
                </button>
                {form.associationLogo && (
                  <button type="button" onClick={() => set('associationLogo', undefined)} className="text-xs font-medium text-slate-500 hover:text-rose-600 hover:underline">
                    Retirer le logo
                  </button>
                )}
              </div>
            </div>
            <Field label="Nom de l'association">
              <input value={form.associationNom} onChange={(e) => set('associationNom', e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none" />
            </Field>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Affichés à la place de l'école sur les documents des clubs : reçus, listes d'inscrits, feuilles de présence, états des impayés et bilans.</p>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</label>
      {children}
    </div>
  )
}
