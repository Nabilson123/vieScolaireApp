import { describe, expect, it } from 'vitest'
import { estFusionne, fusionner, hasCompteRenduContent, listeClasses, pointParClasseRempli, remarquesParClasse, separer } from './suiviCompteRendu'

const classes = ['CE1-A', 'CE1-B']

describe('listeClasses', () => {
  it('« A », « A et B », « A, B et C »', () => {
    expect(listeClasses(['CE1-A'])).toBe('CE1-A')
    expect(listeClasses(classes)).toBe('CE1-A et CE1-B')
    expect(listeClasses(['1APIC-A', '2APIC-A', '3APIC-A'])).toBe('1APIC-A, 2APIC-A et 3APIC-A')
  })
})

describe('remarquesParClasse', () => {
  it('une entrée par classe quand elles ne sont pas fusionnées', () => {
    const cr = { point2: { 'CE1-A': 'Programme à jour', 'CE1-B': 'Un chapitre de retard' } }
    expect(remarquesParClasse(cr, 'point2', classes)).toEqual([
      { label: 'CE1-A', text: 'Programme à jour' },
      { label: 'CE1-B', text: 'Un chapitre de retard' },
    ])
  })

  it('une seule entrée, nommée d’après toutes les classes, quand elles sont fusionnées', () => {
    const cr = { point4Fusion: true, point4Commun: 'Mêmes retards', point4: { 'CE1-A': 'ignoré' } }
    expect(remarquesParClasse(cr, 'point4', classes)).toEqual([{ label: 'CE1-A et CE1-B', text: 'Mêmes retards' }])
  })

  it('la fusion n’a pas d’effet avec une seule classe', () => {
    const cr = { point2Fusion: true, point2Commun: 'x', point2: { 'CE1-A': 'texte de la classe' } }
    expect(estFusionne(cr, 'point2', ['CE1-A'])).toBe(false)
    expect(remarquesParClasse(cr, 'point2', ['CE1-A'])).toEqual([{ label: 'CE1-A', text: 'texte de la classe' }])
  })
})

describe('fusionner', () => {
  it('textes identiques : on n’en garde qu’un', () => {
    const cr = { point2: { 'CE1-A': 'Même remarque', 'CE1-B': 'Même remarque' } }
    const fused = fusionner(cr, 'point2', classes)
    expect(fused.point2Fusion).toBe(true)
    expect(fused.point2Commun).toBe('Même remarque')
  })

  it('textes différents : chacun garde le nom de sa classe', () => {
    const cr = { point4: { 'CE1-A': 'Deux retards', 'CE1-B': 'Une absence' } }
    expect(fusionner(cr, 'point4', classes).point4Commun).toBe('CE1-A : Deux retards\nCE1-B : Une absence')
  })

  it('un seul texte renseigné : repris tel quel', () => {
    expect(fusionner({ point2: { 'CE1-B': 'Seulement B' } }, 'point2', classes).point2Commun).toBe('Seulement B')
  })

  it('un texte commun déjà écrit est conservé', () => {
    const cr = { point2Commun: 'Déjà saisi', point2: { 'CE1-A': 'autre chose' } }
    expect(fusionner(cr, 'point2', classes).point2Commun).toBe('Déjà saisi')
  })

  it('ne touche pas aux textes par classe', () => {
    const cr = { point2: { 'CE1-A': 'a', 'CE1-B': 'b' } }
    expect(fusionner(cr, 'point2', classes).point2).toEqual({ 'CE1-A': 'a', 'CE1-B': 'b' })
  })
})

describe('separer', () => {
  it('retrouve les textes par classe', () => {
    const cr = { point2Fusion: true, point2Commun: 'commun', point2: { 'CE1-A': 'a', 'CE1-B': 'b' } }
    const split = separer(cr, 'point2', classes)
    expect(split.point2Fusion).toBe(false)
    expect(split.point2).toEqual({ 'CE1-A': 'a', 'CE1-B': 'b' })
  })

  it('une classe sans texte reprend le texte commun', () => {
    const cr = { point4Fusion: true, point4Commun: 'commun', point4: { 'CE1-A': 'a' } }
    expect(separer(cr, 'point4', classes).point4).toEqual({ 'CE1-A': 'a', 'CE1-B': 'commun' })
  })
})

describe('contenu du compte-rendu', () => {
  it('un texte commun fusionné compte comme du contenu', () => {
    expect(hasCompteRenduContent({ point4Fusion: true, point4Commun: 'Remarque' })).toBe(true)
    expect(hasCompteRenduContent({ point4Fusion: false, point4Commun: 'Remarque' })).toBe(false)
  })

  it('pointParClasseRempli suit l’état de la fusion', () => {
    expect(pointParClasseRempli({ point2Fusion: true, point2Commun: 'x' }, 'point2', classes)).toBe(true)
    expect(pointParClasseRempli({ point2Fusion: true, point2: { 'CE1-A': 'x' } }, 'point2', classes)).toBe(false)
    expect(pointParClasseRempli({ point2: { 'CE1-A': 'x' } }, 'point2', classes)).toBe(true)
  })
})
