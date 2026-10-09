import { describe, expect, it } from 'vitest'
import { CLUBS_PAIEMENTS_KEY, clubsPaiementsAccess, droitParDefaut } from './clubsDroits'

const profil = (role: string, permissions: Record<string, { view: boolean; edit: boolean }> = {}) => ({ role, permissions })

describe('droit sur les paiements des clubs', () => {
  it('refusé par défaut, même quand les autres modules sont ouverts', () => {
    expect(clubsPaiementsAccess(profil('Surveillant'))).toEqual({ canView: false, canEdit: false })
    expect(clubsPaiementsAccess(profil('CPE', { clubs: { view: true, edit: true } }))).toEqual({ canView: false, canEdit: false })
    expect(clubsPaiementsAccess(profil('Secrétariat'))).toEqual({ canView: false, canEdit: false })
    expect(clubsPaiementsAccess(profil('AED'))).toEqual({ canView: false, canEdit: false })
    expect(clubsPaiementsAccess(profil('type-abcd1234'))).toEqual({ canView: false, canEdit: false })
  })

  it('la Direction y a accès par défaut', () => {
    expect(clubsPaiementsAccess(profil('Direction'))).toEqual({ canView: true, canEdit: true })
  })

  it('une entrée explicite l’emporte sur le rôle, dans les deux sens', () => {
    expect(clubsPaiementsAccess(profil('Surveillant', { [CLUBS_PAIEMENTS_KEY]: { view: true, edit: false } }))).toEqual({ canView: true, canEdit: false })
    expect(clubsPaiementsAccess(profil('Surveillant', { [CLUBS_PAIEMENTS_KEY]: { view: true, edit: true } }))).toEqual({ canView: true, canEdit: true })
    expect(clubsPaiementsAccess(profil('Direction', { [CLUBS_PAIEMENTS_KEY]: { view: false, edit: false } }))).toEqual({ canView: false, canEdit: false })
    expect(clubsPaiementsAccess(profil('Direction', { [CLUBS_PAIEMENTS_KEY]: { view: true, edit: false } }))).toEqual({ canView: true, canEdit: false })
  })

  it('sans profil chargé, rien n’est autorisé', () => {
    expect(clubsPaiementsAccess(undefined)).toEqual({ canView: false, canEdit: false })
  })

  it('droitParDefaut : seulement la Direction', () => {
    expect(droitParDefaut('Direction')).toEqual({ view: true, edit: true })
    expect(droitParDefaut('CPE')).toEqual({ view: false, edit: false })
    expect(droitParDefaut(undefined)).toEqual({ view: false, edit: false })
  })
})
