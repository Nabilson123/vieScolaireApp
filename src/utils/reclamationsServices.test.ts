import { describe, expect, it } from 'vitest'
import type { ReclamationService } from '../data/reclamationServices'
import type { Profile } from '../data/profiles'
import { categoriesWithoutService, isInMyServices, membersOf, serviceFor, toggleCategory } from './reclamationsServices'

const services: ReclamationService[] = [
  { id: 'cantine', nom: 'Cantine', categories: ['Cantine'], ordre: 1 },
  { id: 'transport', nom: 'Transport', categories: ['Transport'], ordre: 2 },
  { id: 'admin', nom: 'Administration', categories: ['Frais de scolarité / Facturation', 'Autre'], ordre: 3 },
]

const profile = (over: Partial<Profile>): Profile => ({
  id: 'p',
  email: 'p@ecole.ma',
  nomComplet: 'Une Personne',
  role: 'Surveillant',
  actif: true,
  permissions: {},
  serviceIds: [],
  ...over,
})

describe('serviceFor', () => {
  it('déduit le service de la catégorie', () => {
    expect(serviceFor({ type: 'Cantine' }, services)?.id).toBe('cantine')
    expect(serviceFor({ type: 'Autre' }, services)?.id).toBe('admin')
  })

  it('un service désigné à la main l’emporte sur la catégorie', () => {
    expect(serviceFor({ type: 'Cantine', serviceId: 'transport' }, services)?.id).toBe('transport')
  })

  it('un service désigné qui n’existe plus retombe sur la catégorie', () => {
    expect(serviceFor({ type: 'Cantine', serviceId: 'supprime' }, services)?.id).toBe('cantine')
  })

  it('aucun service pour une catégorie non rattachée', () => {
    expect(serviceFor({ type: 'Notes' }, services)).toBeUndefined()
  })
})

describe('membersOf', () => {
  it('ne garde que les comptes actifs du service', () => {
    const profiles = [
      profile({ id: 'a', serviceIds: ['cantine'] }),
      profile({ id: 'b', serviceIds: ['cantine', 'transport'] }),
      profile({ id: 'c', serviceIds: ['cantine'], actif: false }),
      profile({ id: 'd', serviceIds: ['transport'] }),
    ]
    expect(membersOf({ id: 'cantine' }, profiles).map((p) => p.id)).toEqual(['a', 'b'])
    expect(membersOf({ id: 'transport' }, profiles).map((p) => p.id)).toEqual(['b', 'd'])
  })
})

describe('isInMyServices', () => {
  it('vrai quand le service de la réclamation est l’un des miens', () => {
    expect(isInMyServices({ type: 'Cantine' }, services, { serviceIds: ['cantine'] })).toBe(true)
    expect(isInMyServices({ type: 'Transport' }, services, { serviceIds: ['cantine'] })).toBe(false)
  })

  it('faux sans service, sans profil ou pour une catégorie non rattachée', () => {
    expect(isInMyServices({ type: 'Cantine' }, services, { serviceIds: [] })).toBe(false)
    expect(isInMyServices({ type: 'Cantine' }, services, undefined)).toBe(false)
    expect(isInMyServices({ type: 'Notes' }, services, { serviceIds: ['cantine'] })).toBe(false)
  })
})

describe('categoriesWithoutService', () => {
  it('liste les catégories qu’aucun service ne traite', () => {
    expect(categoriesWithoutService(services, ['Cantine', 'Transport', 'Notes', 'Autre', 'Comportement'])).toEqual(['Notes', 'Comportement'])
  })
})

describe('toggleCategory', () => {
  it('cocher une catégorie pour un service la retire de celui qui la traitait', () => {
    const changed = toggleCategory(services, 'transport', 'Cantine', true)
    expect(changed.find((s) => s.id === 'transport')?.categories).toEqual(['Transport', 'Cantine'])
    expect(changed.find((s) => s.id === 'cantine')?.categories).toEqual([])
    expect(changed).toHaveLength(2)
  })

  it('décocher la retire seulement de ce service', () => {
    const changed = toggleCategory(services, 'admin', 'Autre', false)
    expect(changed).toHaveLength(1)
    expect(changed[0].categories).toEqual(['Frais de scolarité / Facturation'])
  })

  it('ne renvoie rien quand rien ne change', () => {
    expect(toggleCategory(services, 'cantine', 'Cantine', true)).toEqual([])
    expect(toggleCategory(services, 'cantine', 'Notes', false)).toEqual([])
  })
})
