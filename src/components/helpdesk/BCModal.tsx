import { useState } from 'react'
import { FileText, X, Plus, Trash2, Printer, History, ChevronDown, ChevronUp, AlertTriangle, Users } from 'lucide-react'
import {
  computeBCTotals,
  makeBCLigne,
  TYPE_INTERVENANT_OPTIONS,
  TYPE_INTERVENANT_ICONS,
  CATEGORIE_TYPE_MAP,
  REGIME_TVA_OPTIONS,
  CATEGORIE_LIGNE_OPTIONS,
  MODE_PAIEMENT_OPTIONS,
  type BonCommande,
  type BCContext,
} from '../../data/helpdesk'
import { getPrestatairesSnapshot, findPrestataireByNomSnapshot, countPrestataireInterventionsSnapshot } from '../../services/helpdeskService'

interface BCModalProps {
  incident: BCContext
  onClose: () => void
  onSave: (bc: BonCommande, action: string) => void
  onPrint: (bc: BonCommande) => void
}

const STATUT_BADGE: Record<BonCommande['statut'], string> = {
  BROUILLON: 'bg-slate-100 text-slate-600',
  EN_ATTENTE_DIRECTION: 'bg-amber-50 text-amber-600',
  VALIDE: 'bg-emerald-50 text-emerald-600',
}

const STATUT_LABEL: Record<BonCommande['statut'], string> = {
  BROUILLON: 'Brouillon',
  EN_ATTENTE_DIRECTION: 'En attente Direction',
  VALIDE: 'Validé par Direction',
}

export default function BCModal({ incident, onClose, onSave, onPrint }: BCModalProps) {
  const [bc, setBc] = useState<BonCommande>(incident.bc)
  const [showHistory, setShowHistory] = useState(false)

  const readOnly = bc.statut === 'VALIDE'
  const { sousTotalHT, tvaCumulee, totalTTC } = computeBCTotals(bc)
  const usageCount = countPrestataireInterventionsSnapshot(bc.prestataireNom)
  const expectedTypes = incident.categorie ? CATEGORIE_TYPE_MAP[incident.categorie] : undefined
  const showCoherenceWarning =
    !!expectedTypes && bc.typeIntervenant !== 'Personnel Interne' && bc.typeIntervenant !== 'Autre' && !expectedTypes.includes(bc.typeIntervenant)

  const updateLigne = (id: string, patch: Partial<BonCommande['lignes'][number]>) => {
    setBc((prev) => ({ ...prev, lignes: prev.lignes.map((l) => (l.id === id ? { ...l, ...patch } : l)) }))
  }

  const addLigne = () => {
    setBc((prev) => ({ ...prev, lignes: [...prev.lignes, makeBCLigne(CATEGORIE_LIGNE_OPTIONS[0], '', 1, 'U', 0, REGIME_TVA_OPTIONS[0])] }))
  }

  const removeLigne = (id: string) => {
    setBc((prev) => ({ ...prev, lignes: prev.lignes.filter((l) => l.id !== id) }))
  }

  const handlePrestataireNomChange = (value: string) => {
    const match = findPrestataireByNomSnapshot(value)
    setBc((prev) => ({
      ...prev,
      prestataireNom: value,
      prestataireId: match?.id,
      typeIntervenant: match ? match.typeIntervenant : prev.typeIntervenant,
      prestataireContact: match ? match.telephone : prev.prestataireContact,
    }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <FileText className="h-5 w-5 text-indigo-500" />
              Gestion & Validation du Bon de Commande
            </h2>
            <p className="text-xs text-slate-500">Contrôle de cohérence prestataires/articles et validation hiérarchique.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${STATUT_BADGE[bc.statut]}`}>{STATUT_LABEL[bc.statut]}</span>
            <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1.5 block whitespace-nowrap text-sm font-semibold text-slate-700">N° Bon de Commande *</label>
              <input value={bc.numero} disabled className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-indigo-600" />
            </div>
            <div>
              <label className="mb-1.5 block whitespace-nowrap text-sm font-semibold text-slate-700">Type Intervenant *</label>
              <select
                value={bc.typeIntervenant}
                disabled={readOnly}
                onChange={(e) => setBc((prev) => ({ ...prev, typeIntervenant: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none disabled:bg-slate-50"
              >
                {TYPE_INTERVENANT_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_INTERVENANT_ICONS[t]} {t}
                  </option>
                ))}
              </select>
              {showCoherenceWarning && (
                <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-600">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  Ne correspond pas d'habitude à « {incident.categorie} »
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block whitespace-nowrap text-sm font-semibold text-slate-700">Prestataire / Société *</label>
              <input
                value={bc.prestataireNom}
                disabled={readOnly}
                onChange={(e) => handlePrestataireNomChange(e.target.value)}
                list="prestataires-suggestions"
                placeholder="Nom du prestataire ou de la société"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none disabled:bg-slate-50"
              />
              <datalist id="prestataires-suggestions">
                {getPrestatairesSnapshot().map((p) => (
                  <option key={p.id} value={p.nom} />
                ))}
              </datalist>
              {bc.prestataireNom && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                  <Users className="h-3 w-3 shrink-0" />
                  {usageCount > 0 ? `${usageCount} intervention(s) enregistrée(s) avec ce prestataire` : 'Nouveau prestataire — sera ajouté au répertoire'}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block whitespace-nowrap text-sm font-semibold text-slate-700">Contact Prestataire (Tél. / Email)</label>
              <input
                value={bc.prestataireContact}
                disabled={readOnly}
                onChange={(e) => setBc((prev) => ({ ...prev, prestataireContact: e.target.value }))}
                placeholder="ex: 06 XX XX XX XX ou contact@prestataire.ma"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none disabled:bg-slate-50"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Détail des Fournitures & Main-d'œuvre</h3>
              {!readOnly && (
                <button type="button" onClick={addLigne} className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500">
                  <Plus className="h-3.5 w-3.5" />
                  Ajouter une ligne
                </button>
              )}
            </div>

            {bc.lignes.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-400">Aucune ligne. Ajoutez du matériel ou de la main-d'œuvre.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase text-slate-400">
                      <th className="pb-1.5 pr-2">Catégorie</th>
                      <th className="pb-1.5 pr-2">Désignation</th>
                      <th className="pb-1.5 pr-2">Qté</th>
                      <th className="pb-1.5 pr-2">Unité</th>
                      <th className="pb-1.5 pr-2">P.U HT</th>
                      <th className="pb-1.5 pr-2">Régime</th>
                      <th className="pb-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {bc.lignes.map((l) => (
                      <tr key={l.id} className="border-t border-slate-50">
                        <td className="py-1.5 pr-2">
                          <select
                            value={l.categorie}
                            disabled={readOnly}
                            onChange={(e) => updateLigne(l.id, { categorie: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 px-2 py-1 disabled:bg-slate-50"
                          >
                            {CATEGORIE_LIGNE_OPTIONS.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            value={l.designation}
                            disabled={readOnly}
                            onChange={(e) => updateLigne(l.id, { designation: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 px-2 py-1 disabled:bg-slate-50"
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            type="number"
                            min={0}
                            value={l.quantite}
                            disabled={readOnly}
                            onChange={(e) => updateLigne(l.id, { quantite: Number(e.target.value) })}
                            className="w-16 rounded-lg border border-slate-200 px-2 py-1 disabled:bg-slate-50"
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            value={l.unite}
                            disabled={readOnly}
                            onChange={(e) => updateLigne(l.id, { unite: e.target.value })}
                            className="w-16 rounded-lg border border-slate-200 px-2 py-1 disabled:bg-slate-50"
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            type="number"
                            min={0}
                            value={l.puHT}
                            disabled={readOnly}
                            onChange={(e) => updateLigne(l.id, { puHT: Number(e.target.value) })}
                            className="w-20 rounded-lg border border-slate-200 px-2 py-1 disabled:bg-slate-50"
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <select
                            value={l.regimeTVA}
                            disabled={readOnly}
                            onChange={(e) => updateLigne(l.id, { regimeTVA: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 px-2 py-1 disabled:bg-slate-50"
                          >
                            {REGIME_TVA_OPTIONS.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-1.5">
                          {!readOnly && (
                            <button type="button" onClick={() => removeLigne(l.id)} className="text-rose-500 hover:text-rose-600">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1.5 block whitespace-nowrap text-xs font-semibold text-slate-500">Sous-Total HT (DH)</label>
              <input disabled value={sousTotalHT.toFixed(2)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold" />
            </div>
            <div>
              <label className="mb-1.5 block whitespace-nowrap text-xs font-semibold text-slate-500">TVA Cumulée (DH)</label>
              <input disabled value={tvaCumulee.toFixed(2)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold" />
            </div>
            <div>
              <label className="mb-1.5 block whitespace-nowrap text-xs font-semibold text-slate-500">Transp. & Manut. (DH)</label>
              <input
                type="number"
                min={0}
                disabled={readOnly}
                value={bc.transportManutention}
                onChange={(e) => setBc((prev) => ({ ...prev, transportManutention: Number(e.target.value) }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="mb-1.5 block whitespace-nowrap text-xs font-semibold text-emerald-600">TOTAL NET À PAYER (TTC) *</label>
              <input disabled value={totalTTC.toFixed(2)} className="w-full rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block whitespace-nowrap text-sm font-semibold text-slate-700">Mode de Paiement *</label>
              <select
                value={bc.modePaiement}
                disabled={readOnly}
                onChange={(e) => setBc((prev) => ({ ...prev, modePaiement: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none disabled:bg-slate-50"
              >
                {MODE_PAIEMENT_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block whitespace-nowrap text-sm font-semibold text-slate-700">Date d'Intervention *</label>
              <input
                type="date"
                value={bc.dateIntervention}
                disabled={readOnly}
                onChange={(e) => setBc((prev) => ({ ...prev, dateIntervention: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="mb-1.5 block whitespace-nowrap text-sm font-semibold text-slate-700">Garantie & Remarques</label>
              <input
                value={bc.garantieRemarques}
                disabled={readOnly}
                onChange={(e) => setBc((prev) => ({ ...prev, garantieRemarques: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none disabled:bg-slate-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="mb-1.5 block whitespace-nowrap text-sm font-semibold text-slate-700">Imputation (budget / centre de coût)</label>
              <input
                value={bc.imputation ?? ''}
                disabled={readOnly}
                onChange={(e) => setBc((prev) => ({ ...prev, imputation: e.target.value }))}
                placeholder="ex: Maintenance · Bâtiment"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none disabled:bg-slate-50"
              />
            </div>
          </div>

          <div>
            <button type="button" onClick={() => setShowHistory((v) => !v)} className="flex w-full items-center justify-between text-sm font-semibold text-slate-700">
              <span className="flex items-center gap-2">
                <History className="h-4 w-4 text-slate-400" />
                Historique ({incident.historique.length})
              </span>
              {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showHistory && (
              <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
                {incident.historique.map((h) => (
                  <div key={h.id} className="flex items-center justify-between rounded-lg bg-slate-50/60 px-3 py-2 text-xs">
                    <span className="text-slate-600">
                      <span className="font-semibold text-slate-800">{h.action}</span> · {h.auteur}
                    </span>
                    <span className="text-slate-400">{new Date(h.date).toLocaleString('fr-FR')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Annuler
          </button>
          {!readOnly && (
            <button
              type="button"
              onClick={() => onSave(bc, 'Bon de commande enregistré (brouillon)')}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Enregistrer Brouillon
            </button>
          )}
          <button
            type="button"
            onClick={() => onPrint(bc)}
            className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-100"
          >
            <Printer className="h-4 w-4" />
            Imprimer le Bon de Commande
          </button>
          {bc.statut === 'BROUILLON' && (
            <button
              type="button"
              onClick={() => onSave({ ...bc, statut: 'EN_ATTENTE_DIRECTION' }, 'Soumis à validation Direction')}
              className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500"
            >
              Soumettre à validation
            </button>
          )}
          {bc.statut === 'EN_ATTENTE_DIRECTION' && (
            <button
              type="button"
              onClick={() => onSave({ ...bc, statut: 'VALIDE' }, 'Bon de commande validé par Direction')}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500"
            >
              Valider (Direction)
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
