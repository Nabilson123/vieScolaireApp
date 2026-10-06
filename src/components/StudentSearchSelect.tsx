import type { Student } from '../data/students'
import { searchStudents } from '../utils/studentSearch'
import SearchSelect from './SearchSelect'

interface StudentSearchSelectProps {
  students: Student[]
  /** Identifiant de l'élève choisi ('' = aucun). */
  value: string
  onChange: (studentId: string) => void
  /** Classe de référence : ses élèves sont proposés d'emblée ; la recherche, elle, couvre toutes les classes fournies. */
  classe?: string
  /** Texte affiché quand aucun élève n'est choisi (ex. « — Non désigné — », « Tous les élèves »). */
  placeholder?: string
  disabled?: boolean
  /** `sm` pour les barres de filtres et les tableaux. */
  size?: 'md' | 'sm'
  /** Classes ajoutées au champ (ex. un liseré d'alerte). */
  inputClassName?: string
}

/** Menu de sélection d'un élève avec recherche : on tape une partie du nom (ou de la classe) et la liste se réduit. */
export default function StudentSearchSelect({ students, value, onChange, classe, placeholder = 'Rechercher un élève...', disabled, size, inputClassName }: StudentSearchSelectProps) {
  const selected = students.find((s) => s.id === value)

  return (
    <SearchSelect
      value={value}
      selectedLabel={selected?.name}
      search={(query) =>
        searchStudents(students, query, { preferredClasse: classe }).map((s) => ({
          id: s.id,
          label: s.name,
          badge: s.classe,
          badgeAccent: !!classe && s.classe !== classe,
        }))
      }
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      size={size}
      inputClassName={inputClassName}
      headerText={(query, count) =>
        query.trim()
          ? `${count} élève${count > 1 ? 's' : ''} trouvé${count > 1 ? 's' : ''}${count > 0 && students.some((s) => s.classe !== classe) ? ' (toutes classes)' : ''}`
          : classe
            ? `Élèves de ${classe} — tapez pour chercher dans toutes les classes`
            : 'Tapez un nom ou une classe'
      }
      emptyText="Aucun élève trouvé."
      clearLabel="Effacer l'élève"
    />
  )
}
