import { useState } from 'react'
import { Plus, Trash2, IdCard, Car, HeartHandshake, ShieldCheck } from 'lucide-react'
import { useChauffeurs, useAddChauffeur, useUpdateChauffeur, useDeleteChauffeur, type Chauffeur } from '../services/chauffeursService'
import {
  useAidesMaitresses,
  useAddAideMaitresse,
  useUpdateAideMaitresse,
  useDeleteAideMaitresse,
  type AideMaitresse,
} from '../services/aidesMaitressesService'
import { useVigiles, useAddVigile, useUpdateVigile, useDeleteVigile, type Vigile } from '../services/vigilesService'
import { useCurrentProfile, getModuleAccess } from '../services/permissions'
import NoEditAccessBanner from '../components/NoEditAccessBanner'

interface PersonnelGlobalProps {
  onDataChanged?: () => void
}

type PageTab = 'chauffeurs' | 'aides' | 'vigiles'

const PAGE_TABS: { key: PageTab; label: string; icon: typeof Car }[] = [
  { key: 'chauffeurs', label: 'Chauffeurs', icon: Car },
  { key: 'aides', label: 'Aides-Maîtresses', icon: HeartHandshake },
  { key: 'vigiles', label: 'Vigiles', icon: ShieldCheck },
]

export default function PersonnelGlobal({ onDataChanged }: PersonnelGlobalProps) {
  const profile = useCurrentProfile()
  const canEdit = getModuleAccess(profile, 'personnel').canEdit
  const [pageTab, setPageTab] = useState<PageTab>('chauffeurs')
  const onSaved = () => onDataChanged?.()

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-gradient-to-r from-teal-600 to-cyan-600 p-5 text-white shadow-sm">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <IdCard className="h-5 w-5" />
            Personnel
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-white/80">
            Listes des chauffeurs et aides-maîtresses — réutilisées pour l'affectation aux lignes du module Transport.
          </p>
        </div>
      </div>

      {!canEdit && <NoEditAccessBanner />}

      <div className="mb-5 inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1">
        {PAGE_TABS.map((t) => {
          const Icon = t.icon
          const isActive = pageTab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setPageTab(t.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      <fieldset disabled={!canEdit} className="contents">
        {pageTab === 'chauffeurs' && <ChauffeursTab onSaved={onSaved} />}
        {pageTab === 'aides' && <AidesTab onSaved={onSaved} />}
        {pageTab === 'vigiles' && <VigilesTab onSaved={onSaved} />}
      </fieldset>
    </div>
  )
}

function ChauffeursTab({ onSaved }: { onSaved: () => void }) {
  const { data: chauffeurs = [] } = useChauffeurs()
  const addChauffeur = useAddChauffeur()
  const updateChauffeur = useUpdateChauffeur()
  const deleteChauffeur = useDeleteChauffeur()

  const [nom, setNom] = useState('')
  const [telephone, setTelephone] = useState('')

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Téléphone</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {chauffeurs.map((c: Chauffeur) => (
              <tr key={c.id} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-2.5">
                  <input
                    defaultValue={c.nom}
                    onBlur={(e) => {
                      if (e.target.value !== c.nom) {
                        updateChauffeur.mutate({ ...c, nom: e.target.value })
                        onSaved()
                      }
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <input
                    defaultValue={c.telephone}
                    onBlur={(e) => {
                      if (e.target.value !== c.telephone) {
                        updateChauffeur.mutate({ ...c, telephone: e.target.value })
                        onSaved()
                      }
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      deleteChauffeur.mutate(c.id)
                      onSaved()
                    }}
                    className="text-rose-500 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {chauffeurs.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Aucun chauffeur enregistré.</p>}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-100 p-3">
        <Car className="h-4 w-4 text-slate-400" />
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom" className="w-56 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
        <input
          value={telephone}
          onChange={(e) => setTelephone(e.target.value)}
          placeholder="Téléphone"
          className="w-44 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={() => {
            if (!nom.trim()) return
            addChauffeur.mutate({ nom: nom.trim(), telephone: telephone.trim() })
            setNom('')
            setTelephone('')
            onSaved()
          }}
          className="flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter un chauffeur
        </button>
      </div>
    </div>
  )
}

function AidesTab({ onSaved }: { onSaved: () => void }) {
  const { data: aides = [] } = useAidesMaitresses()
  const addAide = useAddAideMaitresse()
  const updateAide = useUpdateAideMaitresse()
  const deleteAide = useDeleteAideMaitresse()

  const [nom, setNom] = useState('')
  const [telephone, setTelephone] = useState('')

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Téléphone</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {aides.map((a: AideMaitresse) => (
              <tr key={a.id} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-2.5">
                  <input
                    defaultValue={a.nom}
                    onBlur={(e) => {
                      if (e.target.value !== a.nom) {
                        updateAide.mutate({ ...a, nom: e.target.value })
                        onSaved()
                      }
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <input
                    defaultValue={a.telephone}
                    onBlur={(e) => {
                      if (e.target.value !== a.telephone) {
                        updateAide.mutate({ ...a, telephone: e.target.value })
                        onSaved()
                      }
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      deleteAide.mutate(a.id)
                      onSaved()
                    }}
                    className="text-rose-500 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {aides.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Aucune aide-maîtresse enregistrée.</p>}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-100 p-3">
        <HeartHandshake className="h-4 w-4 text-slate-400" />
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom" className="w-56 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
        <input
          value={telephone}
          onChange={(e) => setTelephone(e.target.value)}
          placeholder="Téléphone"
          className="w-44 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={() => {
            if (!nom.trim()) return
            addAide.mutate({ nom: nom.trim(), telephone: telephone.trim() })
            setNom('')
            setTelephone('')
            onSaved()
          }}
          className="flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter une aide-maîtresse
        </button>
      </div>
    </div>
  )
}

function VigilesTab({ onSaved }: { onSaved: () => void }) {
  const { data: vigiles = [] } = useVigiles()
  const addVigile = useAddVigile()
  const updateVigile = useUpdateVigile()
  const deleteVigile = useDeleteVigile()

  const [nom, setNom] = useState('')
  const [telephone, setTelephone] = useState('')

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Téléphone</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {vigiles.map((v: Vigile) => (
              <tr key={v.id} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-2.5">
                  <input
                    defaultValue={v.nom}
                    onBlur={(e) => {
                      if (e.target.value !== v.nom) {
                        updateVigile.mutate({ ...v, nom: e.target.value })
                        onSaved()
                      }
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <input
                    defaultValue={v.telephone}
                    onBlur={(e) => {
                      if (e.target.value !== v.telephone) {
                        updateVigile.mutate({ ...v, telephone: e.target.value })
                        onSaved()
                      }
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      deleteVigile.mutate(v.id)
                      onSaved()
                    }}
                    className="text-rose-500 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {vigiles.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Aucun vigile enregistré.</p>}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-100 p-3">
        <ShieldCheck className="h-4 w-4 text-slate-400" />
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom" className="w-56 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
        <input
          value={telephone}
          onChange={(e) => setTelephone(e.target.value)}
          placeholder="Téléphone"
          className="w-44 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={() => {
            if (!nom.trim()) return
            addVigile.mutate({ nom: nom.trim(), telephone: telephone.trim() })
            setNom('')
            setTelephone('')
            onSaved()
          }}
          className="flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter un vigile
        </button>
      </div>
    </div>
  )
}
