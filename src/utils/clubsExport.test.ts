import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'
import type { LigneJournal } from './clubsContexte'

vi.mock('xlsx', async (importOriginal) => {
  const reel = await importOriginal<typeof import('xlsx')>()
  return { ...reel, writeFile: vi.fn() }
})

import { exportJournalEncaissementsExcel } from './clubsExport'

const ligne = (over: Partial<LigneJournal> = {}): LigneJournal => ({
  numero: 'REC-2026-0001',
  dateReglement: '2026-10-09',
  famille: 'Famille ALAMI',
  mode: 'Espèces',
  reference: '',
  montantDh: 150,
  statut: 'Valide',
  motifAnnulation: '',
  detail: 'Adam ALAMI (Robotique, octobre 2026 : 150,00 DH)',
  ...over,
})

function classeurEcrit(): { nom: string; lignes: unknown[][] } {
  const appels = vi.mocked(XLSX.writeFile).mock.calls
  const [wb, nom] = appels[appels.length - 1]
  const feuille = wb.Sheets['Encaissements']
  return { nom, lignes: XLSX.utils.sheet_to_json<unknown[]>(feuille, { header: 1 }) }
}

describe('exportJournalEncaissementsExcel', () => {
  beforeEach(() => vi.mocked(XLSX.writeFile).mockClear())

  it('une ligne par règlement, en-têtes en français et nom de fichier daté', () => {
    exportJournalEncaissementsExcel([ligne(), ligne({ numero: 'REC-2026-0002', mode: 'Chèque', reference: 'CHQ 12 — Banque X', montantDh: 100.5 })])
    const { nom, lignes } = classeurEcrit()
    expect(nom).toMatch(/^journal-encaissements-clubs-\d{4}-\d{2}-\d{2}\.xlsx$/)
    expect(lignes[0]).toEqual(['N° de reçu', 'Date', 'Famille', 'Mode', 'Référence', 'Montant (DH)', 'Statut', "Motif d'annulation", 'Détail'])
    expect(lignes[1][0]).toBe('REC-2026-0001')
    expect(lignes[1][5]).toBe(150)
    expect(lignes[2][3]).toBe('Chèque')
    expect(lignes[2][4]).toBe('CHQ 12 — Banque X')
    expect(lignes[2][5]).toBe(100.5)
  })

  it('le total ne compte que les règlements valides', () => {
    exportJournalEncaissementsExcel([ligne(), ligne({ numero: 'REC-2026-0002', montantDh: 200, statut: 'Annulé', motifAnnulation: 'Erreur de saisie' }), ligne({ numero: 'REC-2026-0003', montantDh: 49.9 })])
    const { lignes } = classeurEcrit()
    const total = lignes[lignes.length - 1]
    expect(total[4]).toBe('Total encaissé (règlements valides)')
    expect(total[5]).toBe(199.9)
    expect(total[6]).toBe('2 règlements')
    // L'annulé reste visible dans le journal, marqué, avec son motif.
    expect(lignes[2][6]).toBe('Annulé')
    expect(lignes[2][7]).toBe('Erreur de saisie')
  })

  it('journal vide : seulement les en-têtes et un total à 0', () => {
    exportJournalEncaissementsExcel([])
    const { lignes } = classeurEcrit()
    expect(lignes[0][0]).toBe('N° de reçu')
    expect(lignes[lignes.length - 1][5]).toBe(0)
  })
})
