import { IdCard, GraduationCap, UtensilsCrossed, Users } from 'lucide-react'

export interface StudentFormValue {
  prenom: string
  nom: string
  nomAr: string
  prenomAr: string
  codeMassar: string
  classe: string
  genre: 'Garçon' | 'Fille'
  cantine: boolean
  gardeApresMidi: boolean
  gardeMatin: boolean
  gardeMidi: boolean
  transport: boolean
  dateNaissance: string
  lieuNaissance: string
  dateEntree: string
  parent1Nom: string
  parent1Prenom: string
  parent1Tel: string
  parent1Email: string
  parent2Nom: string
  parent2Prenom: string
  parent2Tel: string
  parent2Email: string
}

interface StudentIdentityFormFieldsProps {
  value: StudentFormValue
  onChange: (patch: Partial<StudentFormValue>) => void
  classOptions: string[]
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</label>
      {children}
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none'

function Section({ icon: Icon, title, children }: { icon: typeof IdCard; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-indigo-500" />
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </div>
  )
}

export default function StudentIdentityFormFields({ value, onChange, classOptions }: StudentIdentityFormFieldsProps) {
  return (
    <div className="space-y-4">
      <Section icon={IdCard} title="Identité">
        <Field label="Prénom *">
          <input className={inputClass} value={value.prenom} onChange={(e) => onChange({ prenom: e.target.value })} />
        </Field>
        <Field label="Nom *">
          <input className={inputClass} value={value.nom} onChange={(e) => onChange({ nom: e.target.value })} />
        </Field>
        <Field label="Prénom (ar)">
          <input dir="rtl" className={inputClass} value={value.prenomAr} onChange={(e) => onChange({ prenomAr: e.target.value })} />
        </Field>
        <Field label="Nom (ar)">
          <input dir="rtl" className={inputClass} value={value.nomAr} onChange={(e) => onChange({ nomAr: e.target.value })} />
        </Field>
        <Field label="Genre">
          <div className="flex items-center gap-4 pt-2">
            {(['Garçon', 'Fille'] as const).map((g) => (
              <label key={g} className="flex items-center gap-1.5 text-sm text-slate-700">
                <input type="radio" name="genre" checked={value.genre === g} onChange={() => onChange({ genre: g })} className="h-4 w-4 text-indigo-600" />
                {g}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Date de naissance (JJ/MM/AAAA)">
          <input placeholder="15/03/2013" className={inputClass} value={value.dateNaissance} onChange={(e) => onChange({ dateNaissance: e.target.value })} />
        </Field>
        <Field label="Lieu de naissance">
          <input className={inputClass} value={value.lieuNaissance} onChange={(e) => onChange({ lieuNaissance: e.target.value })} />
        </Field>
      </Section>

      <Section icon={GraduationCap} title="Scolarité">
        <Field label="Classe *">
          <select className={inputClass} value={value.classe} onChange={(e) => onChange({ classe: e.target.value })}>
            <option value="">Sélectionner…</option>
            {classOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Code Massar">
          <input className={inputClass} value={value.codeMassar} onChange={(e) => onChange({ codeMassar: e.target.value })} />
        </Field>
        <Field label="Date d'entrée (JJ/MM/AAAA)">
          <input placeholder="01/09/2024" className={inputClass} value={value.dateEntree} onChange={(e) => onChange({ dateEntree: e.target.value })} />
        </Field>
      </Section>

      <Section icon={UtensilsCrossed} title="Cantine & Transport">
        {(
          [
            ['cantine', 'Cantine'],
            ['gardeMatin', 'Garde matin'],
            ['gardeMidi', 'Garde midi'],
            ['gardeApresMidi', 'Garde après-midi'],
            ['transport', 'Transport'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={value[key]} onChange={(e) => onChange({ [key]: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
            {label}
          </label>
        ))}
      </Section>

      <Section icon={Users} title="Contacts parents">
        <Field label="Nom parent 1">
          <input className={inputClass} value={value.parent1Nom} onChange={(e) => onChange({ parent1Nom: e.target.value })} />
        </Field>
        <Field label="Prénom parent 1">
          <input className={inputClass} value={value.parent1Prenom} onChange={(e) => onChange({ parent1Prenom: e.target.value })} />
        </Field>
        <Field label="Téléphone parent 1">
          <input className={inputClass} value={value.parent1Tel} onChange={(e) => onChange({ parent1Tel: e.target.value })} />
        </Field>
        <Field label="Email parent 1">
          <input type="email" className={inputClass} value={value.parent1Email} onChange={(e) => onChange({ parent1Email: e.target.value })} />
        </Field>
        <Field label="Nom parent 2">
          <input className={inputClass} value={value.parent2Nom} onChange={(e) => onChange({ parent2Nom: e.target.value })} />
        </Field>
        <Field label="Prénom parent 2">
          <input className={inputClass} value={value.parent2Prenom} onChange={(e) => onChange({ parent2Prenom: e.target.value })} />
        </Field>
        <Field label="Téléphone parent 2">
          <input className={inputClass} value={value.parent2Tel} onChange={(e) => onChange({ parent2Tel: e.target.value })} />
        </Field>
        <Field label="Email parent 2">
          <input type="email" className={inputClass} value={value.parent2Email} onChange={(e) => onChange({ parent2Email: e.target.value })} />
        </Field>
      </Section>
    </div>
  )
}
