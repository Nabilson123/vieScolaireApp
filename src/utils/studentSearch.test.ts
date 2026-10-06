import { describe, expect, it } from 'vitest'
import type { Student } from '../data/students'
import { searchStudents } from './studentSearch'

const s = (id: string, name: string, classe: string): Student => ({ id, name, classe }) as Student

const students = [
  s('1', 'Adam BELGRAINI', '1APIC-A'),
  s('2', 'Adam FIKRI', '1APIC-A'),
  s('3', 'Zineb EL ADAM', 'CE1-B'),
  s('4', 'Mohamed Ali REDOUANE', '1APIC-A'),
  s('5', 'Hafsa ÉL HADDAD', 'CE1-B'),
  s('6', 'Mohamed AIT ALI', 'CE2-A'),
]

describe('searchStudents', () => {
  it('sans saisie : les élèves de la classe de référence par ordre alphabétique', () => {
    expect(searchStudents(students, '', { preferredClasse: '1APIC-A' }).map((x) => x.id)).toEqual(['1', '2', '4'])
  })

  it('sans saisie ni classe : tous les élèves, par ordre alphabétique', () => {
    expect(searchStudents(students, '').map((x) => x.name)).toEqual([
      'Adam BELGRAINI',
      'Adam FIKRI',
      'Hafsa ÉL HADDAD',
      'Mohamed AIT ALI',
      'Mohamed Ali REDOUANE',
      'Zineb EL ADAM',
    ])
  })

  it('la recherche couvre toutes les classes, sans tenir compte des accents ni de la casse', () => {
    expect(searchStudents(students, 'el haddad').map((x) => x.id)).toEqual(['5'])
    expect(searchStudents(students, 'EL HADDAD', { preferredClasse: '1APIC-A' }).map((x) => x.id)).toEqual(['5'])
  })

  it('l’ordre des mots est indifférent et chaque mot doit se retrouver', () => {
    expect(searchStudents(students, 'belgraini adam').map((x) => x.id)).toEqual(['1'])
    expect(searchStudents(students, 'adam zzz')).toEqual([])
  })

  it('on peut aussi chercher par classe', () => {
    expect(searchStudents(students, 'ce1').map((x) => x.id).sort()).toEqual(['3', '5'])
    expect(searchStudents(students, 'adam 1apic').map((x) => x.id)).toEqual(['1', '2'])
  })

  it('à pertinence égale, la classe de référence passe d’abord, puis l’ordre alphabétique', () => {
    expect(searchStudents(students, 'ali').map((x) => x.id)).toEqual(['6', '4'])
    expect(searchStudents(students, 'ali', { preferredClasse: '1APIC-A' }).map((x) => x.id)).toEqual(['4', '6'])
  })

  it('les noms dont un mot commence par la saisie passent avant les simples inclusions', () => {
    const list = [s('a', 'Nadia KAMAL', 'CE1-A'), s('b', 'Amal ZIANI', 'CE1-A')]
    // « ama » commence « Amal » mais n'est qu'au milieu de « Kamal » : Amal passe d'abord, même si Nadia est avant dans la liste.
    expect(searchStudents(list, 'ama').map((x) => x.id)).toEqual(['b', 'a'])
  })

  it('le nombre de résultats est plafonné', () => {
    expect(searchStudents(students, '', { limit: 2 })).toHaveLength(2)
  })
})
