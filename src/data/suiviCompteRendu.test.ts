import { describe, expect, it } from 'vitest'
import { hasCompteRenduContent, listeClasses, passerEnCommun, pointParClasseRempli, remarquesImprimees, texteIdentiqueAToutesLesClasses } from './suiviCompteRendu'

const classes = ['CE1-A', 'CE1-B']

describe('listeClasses', () => {
  it('« A », « A et B », « A, B et C »', () => {
    expect(listeClasses(['CE1-A'])).toBe('CE1-A')
    expect(listeClasses(classes)).toBe('CE1-A et CE1-B')
    expect(listeClasses(['1APIC-A', '2APIC-A', '3APIC-A'])).toBe('1APIC-A, 2APIC-A et 3APIC-A')
  })
})

describe('remarquesImprimees', () => {
  it('sans remarque commune : une entrée par classe, même vide', () => {
    const cr = { point2: { 'CE1-A': 'Programme à jour' } }
    expect(remarquesImprimees(cr, 'point2', classes)).toEqual([
      { label: 'CE1-A', text: 'Programme à jour', commune: false },
      { label: 'CE1-B', text: '', commune: false },
    ])
  })

  it('remarque commune seule : un seul bloc, nommé d’après toutes les classes', () => {
    const cr = { point4Commun: 'Mêmes retards' }
    expect(remarquesImprimees(cr, 'point4', classes)).toEqual([{ label: 'CE1-A et CE1-B', text: 'Mêmes retards', commune: true }])
  })

  it('commune + propres : la commune d’abord, puis seulement les classes qui ont une remarque propre', () => {
    const cr = { point2Commun: 'Programme respecté', point2: { 'CE1-B': 'Un chapitre de retard', 'CE1-A': '  ' } }
    expect(remarquesImprimees(cr, 'point2', classes)).toEqual([
      { label: 'CE1-A et CE1-B', text: 'Programme respecté', commune: true },
      { label: 'CE1-B', text: 'Un chapitre de retard', commune: false },
    ])
  })

  it('la zone commune n’existe pas avec une seule classe', () => {
    const cr = { point2Commun: 'ignoré', point2: { 'CE1-A': 'texte de la classe' } }
    expect(remarquesImprimees(cr, 'point2', ['CE1-A'])).toEqual([{ label: 'CE1-A', text: 'texte de la classe', commune: false }])
  })
})

describe('contenu', () => {
  it('pointParClasseRempli : commun, propre à une classe, ou rien', () => {
    expect(pointParClasseRempli({ point2Commun: 'x' }, 'point2', classes)).toBe(true)
    expect(pointParClasseRempli({ point2: { 'CE1-A': 'x' } }, 'point2', classes)).toBe(true)
    expect(pointParClasseRempli({ point2Commun: '  ', point2: { 'CE1-A': ' ' } }, 'point2', classes)).toBe(false)
    expect(pointParClasseRempli({ point2Commun: 'x' }, 'point2', ['CE1-A'])).toBe(false)
  })

  it('un texte commun suffit pour que le compte-rendu compte comme rédigé', () => {
    expect(hasCompteRenduContent({ point4Commun: 'Remarque' })).toBe(true)
    expect(hasCompteRenduContent({ point4Commun: '   ' })).toBe(false)
  })
})

describe('passer un texte identique en commun', () => {
  const identiques = { point4: { 'CE1-A': 'Mêmes retards', 'CE1-B': ' Mêmes retards ' } }

  it('détecte le même texte dans toutes les classes', () => {
    expect(texteIdentiqueAToutesLesClasses(identiques, 'point4', classes)).toBe('Mêmes retards')
  })

  it('rien à proposer : textes différents, absents, zone commune déjà remplie ou une seule classe', () => {
    expect(texteIdentiqueAToutesLesClasses({ point4: { 'CE1-A': 'a', 'CE1-B': 'b' } }, 'point4', classes)).toBeNull()
    expect(texteIdentiqueAToutesLesClasses({ point4: { 'CE1-A': 'a' } }, 'point4', classes)).toBeNull()
    expect(texteIdentiqueAToutesLesClasses({ ...identiques, point4Commun: 'déjà' }, 'point4', classes)).toBeNull()
    expect(texteIdentiqueAToutesLesClasses({ point4: { 'CE1-A': 'a' } }, 'point4', ['CE1-A'])).toBeNull()
  })

  it('le texte passe en commun et les zones par classe se vident', () => {
    const moved = passerEnCommun(identiques, 'point4', classes)
    expect(moved.point4Commun).toBe('Mêmes retards')
    expect(moved.point4).toEqual({ 'CE1-A': '', 'CE1-B': '' })
  })

  it('sans texte identique, le compte-rendu reste tel quel', () => {
    const cr = { point4: { 'CE1-A': 'a', 'CE1-B': 'b' } }
    expect(passerEnCommun(cr, 'point4', classes)).toBe(cr)
  })
})
