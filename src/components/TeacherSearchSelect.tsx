import { teacherName, type Teacher } from '../data/teachers'
import { searchTeachers } from '../utils/teacherSearch'
import SearchSelect from './SearchSelect'

interface TeacherSearchSelectProps {
  teachers: Teacher[]
  /** Identifiant de l'enseignant (ou son nom complet avec `valueBy="name"`) ; '' = aucun. */
  value: string
  onChange: (value: string) => void
  /** Certains écrans enregistrent le nom de l'enseignant plutôt que son identifiant. */
  valueBy?: 'id' | 'name'
  /** Texte affiché quand aucun enseignant n'est choisi (ex. « Non assigné », « Tous les enseignants »). */
  placeholder?: string
  disabled?: boolean
  /** `sm` pour les barres de filtres et les tableaux. */
  size?: 'md' | 'sm'
  /** Classes ajoutées au champ (ex. un liseré d'alerte). */
  inputClassName?: string
  /** Choix proposé en fin de liste pour sortir de la liste (ex. « Autre / Personnel non-enseignant… »). */
  extra?: { value: string; label: string }
  /** Croix pour revenir à « aucun choix » (par défaut oui). */
  clearable?: boolean
}

/** Menu de sélection d'un enseignant avec recherche : on tape une partie du nom (ou de la matière) et la liste se réduit. */
export default function TeacherSearchSelect({
  teachers,
  value,
  onChange,
  valueBy = 'id',
  placeholder = 'Rechercher un enseignant...',
  disabled,
  size,
  inputClassName,
  extra,
  clearable,
}: TeacherSearchSelectProps) {
  const keyOf = (t: Teacher) => (valueBy === 'name' ? teacherName(t) : t.id)
  const selected = teachers.find((t) => keyOf(t) === value)
  // Un nom enregistré qui n'est plus dans la liste (enseignant parti, saisie ancienne) reste affiché tel quel.
  const selectedLabel = extra && value === extra.value ? extra.label : (selected ? teacherName(selected) : valueBy === 'name' && value ? value : undefined)

  return (
    <SearchSelect
      value={value}
      selectedLabel={selectedLabel}
      search={(query) =>
        searchTeachers(teachers, query).map((t) => ({
          id: keyOf(t),
          label: teacherName(t),
          badge: t.matieres.length > 0 ? `${t.matieres[0]}${t.matieres.length > 1 ? ` +${t.matieres.length - 1}` : ''}` : undefined,
        }))
      }
      extraItem={extra ? { id: extra.value, label: extra.label } : undefined}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      size={size}
      inputClassName={inputClassName}
      clearable={clearable}
      headerText={(query, count) => (query.trim() ? `${count} enseignant${count > 1 ? 's' : ''} trouvé${count > 1 ? 's' : ''}` : 'Tapez un nom ou une matière')}
      emptyText="Aucun enseignant trouvé."
      clearLabel="Effacer l'enseignant"
    />
  )
}
