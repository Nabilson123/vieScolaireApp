import { Bus } from 'lucide-react'
import { useStudents } from '../services/studentsService'
import { useStudentIdentities } from '../services/studentIdentityService'
import { useTransportLignes } from '../services/transportLignesService'
import { useChauffeurs } from '../services/chauffeursService'
import { useAidesMaitresses } from '../services/aidesMaitressesService'
import { useServicesCapacite } from '../services/servicesCapaciteService'
import { resolveStudentTransport } from '../utils/transportStudentResolver'

interface ParentPortalTransportProps {
  studentId: string
}

function InfoLine({ label, name, tel }: { label: string; name: string | undefined; tel: string | undefined }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-700">{name ? `${name}${tel ? ` · ${tel}` : ''}` : '—'}</span>
    </div>
  )
}

export default function ParentPortalTransport({ studentId }: ParentPortalTransportProps) {
  const { data: students = [] } = useStudents()
  const { data: identities = {} } = useStudentIdentities()
  const { data: lignes = [] } = useTransportLignes()
  const { data: chauffeurs = [] } = useChauffeurs()
  const { data: aides = [] } = useAidesMaitresses()
  const { data: capacite } = useServicesCapacite()

  const student = students.find((s) => s.id === studentId)
  if (!student) return <p className="py-10 text-center text-sm text-slate-400">Chargement...</p>

  const info = resolveStudentTransport(student, identities[studentId], lignes, chauffeurs, aides, capacite)

  if (!info.affecte) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-sm">
        <Bus className="mx-auto mb-2 h-8 w-8 text-slate-300" />
        <p className="text-sm text-slate-500">{student.name} n'est pas inscrit(e) au transport scolaire.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {info.matinParents ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-4 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Trajet du matin</p>
          <p className="mt-1 text-xs text-slate-500">Amené(e) par les parents — pas de bus le matin.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500 text-sm font-bold text-white">
              {info.ligneMatinNom ?? '—'}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Trajet du matin</p>
              <p className="text-xs text-slate-500">{info.ligneMatin?.trajet || 'Trajet non renseigné'} · {info.heureMatin || '—'}</p>
            </div>
          </div>
          <div className="space-y-1.5 border-t border-slate-100 pt-3">
            <InfoLine label="Chauffeur" name={info.chauffeurMatin?.nom} tel={info.chauffeurMatin?.telephone} />
            <InfoLine label="Aide-maîtresse" name={info.aideMatin?.nom} tel={info.aideMatin?.telephone} />
          </div>
        </div>
      )}

      {info.soirParents ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-4 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Trajet du soir</p>
          <p className="mt-1 text-xs text-slate-500">Amené(e) par les parents — pas de bus le soir.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-500 text-sm font-bold text-white">
              {info.ligneSoirNom ?? '—'}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Trajet du soir — départ {info.soirDepart ?? '—'}</p>
              <p className="text-xs text-slate-500">{info.ligneSoir?.trajet || 'Trajet non renseigné'} · {info.heureSoir || '—'}</p>
            </div>
          </div>
          <div className="space-y-1.5 border-t border-slate-100 pt-3">
            <InfoLine label="Chauffeur" name={info.chauffeurSoir?.nom} tel={info.chauffeurSoir?.telephone} />
            <InfoLine label="Aide-maîtresse" name={info.aideSoir?.nom} tel={info.aideSoir?.telephone} />
          </div>
        </div>
      )}
    </div>
  )
}
