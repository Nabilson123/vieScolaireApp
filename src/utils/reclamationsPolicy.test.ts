import { describe, expect, it } from 'vitest'
import { NIVEAU_PAR_CATEGORIE, delaiAccuseJours, delaiResolutionAutorise, niveauOf } from './reclamationsPolicy'
import { RECLAMATION_CATEGORIES } from '../data/studentDetails'

describe('niveauOf', () => {
  it('classe les catégories sensibles en urgent et les administratives en administratif', () => {
    expect(niveauOf({ type: 'Harcèlement / Intimidation' })).toBe('urgent')
    expect(niveauOf({ type: 'Sécurité' })).toBe('urgent')
    expect(niveauOf({ type: 'Infirmerie / Santé' })).toBe('urgent')
    expect(niveauOf({ type: 'Frais de scolarité / Facturation' })).toBe('administratif')
    expect(niveauOf({ type: 'Inscription / Admission' })).toBe('administratif')
  })

  it('standard par défaut, y compris pour une catégorie inconnue', () => {
    expect(niveauOf({ type: 'Notes' })).toBe('standard')
    expect(niveauOf({ type: 'Cantine' })).toBe('standard')
    expect(niveauOf({ type: 'Catégorie qui n’existe plus' })).toBe('standard')
  })

  it('le marquage urgent force le niveau, quelle que soit la catégorie', () => {
    expect(niveauOf({ type: 'Frais de scolarité / Facturation', urgente: true })).toBe('urgent')
    expect(niveauOf({ type: 'Notes', urgente: false })).toBe('standard')
  })

  it('ne référence que des catégories du référentiel', () => {
    Object.keys(NIVEAU_PAR_CATEGORIE).forEach((c) => expect(RECLAMATION_CATEGORIES).toContain(c))
  })
})

describe('délais', () => {
  it('urgent : accusé le jour même, résolution sous 1 jour', () => {
    expect(delaiAccuseJours({ type: 'Sécurité' })).toBe(0)
    expect(delaiResolutionAutorise({ type: 'Sécurité' })).toBe(1)
  })

  it('standard : accusé sous 1 jour, résolution sous 3 jours (72 h)', () => {
    expect(delaiAccuseJours({ type: 'Notes' })).toBe(1)
    expect(delaiResolutionAutorise({ type: 'Notes' })).toBe(3)
  })

  it('administratif : accusé sous 1 jour, résolution sous 5 jours', () => {
    expect(delaiAccuseJours({ type: 'Emploi du temps' })).toBe(1)
    expect(delaiResolutionAutorise({ type: 'Emploi du temps' })).toBe(5)
  })
})
