import { describe, expect, it } from 'vitest'
import type { Profile } from '../data/profiles'
import type { ReclamationService } from '../data/reclamationServices'
import { staffOptionsFrom } from './staffOptions'

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

const cantine: ReclamationService = { id: 'cantine', nom: 'Cantine', categories: ['Cantine'], ordre: 1 }

const profiles = [
  profile({ id: 'a', nomComplet: 'Zineb Alami', serviceIds: ['cantine'] }),
  profile({ id: 'b', nomComplet: 'Amine Berrada' }),
  profile({ id: 'c', nomComplet: 'Hind Cherkaoui', serviceIds: ['cantine'] }),
  profile({ id: 'd', nomComplet: 'Omar Désactivé', actif: false, serviceIds: ['cantine'] }),
]

describe('staffOptionsFrom', () => {
  it('sans service : liste à plat, triée, comptes actifs seulement', () => {
    const options = staffOptionsFrom(profiles)
    expect(options.map((o) => o.value)).toEqual(['Amine Berrada', 'Hind Cherkaoui', 'Zineb Alami'])
    expect(options.every((o) => o.group === undefined)).toBe(true)
  })

  it('avec un service : ses membres d’abord dans leur groupe, puis les autres', () => {
    const options = staffOptionsFrom(profiles, undefined, cantine)
    expect(options.map((o) => `${o.group} / ${o.value}`)).toEqual([
      'Service Cantine / Hind Cherkaoui',
      'Service Cantine / Zineb Alami',
      'Autres / Amine Berrada',
    ])
  })

  it('garde la valeur déjà enregistrée même si son compte est désactivé', () => {
    expect(staffOptionsFrom(profiles, 'Omar Désactivé').map((o) => o.value)).toContain('Omar Désactivé')
    const grouped = staffOptionsFrom(profiles, 'Omar Désactivé', cantine)
    expect(grouped.find((o) => o.value === 'Omar Désactivé')?.group).toBe('Autres')
  })
})
