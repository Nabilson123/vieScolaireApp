import type { Student } from '../data/students'
import type { NoteRow } from '../data/studentDetails'
import { computeSubjectMoyenne, computeMoyenneGenerale } from '../utils/studentAggregation'
import { moyenneScaleForClasse } from '../utils/alertEngine'
import SchoolLogo from './print/SchoolLogo'
import PrintPreviewShell from './print/PrintPreviewShell'
import { sanitizeFileName, todayFileStamp } from './print/printFileName'

interface BulletinPrintModalProps {
  student: Student
  notes: NoteRow[]
  onClose: () => void
}

function todayFR() {
  return new Date().toLocaleDateString('fr-FR')
}

export default function BulletinPrintModal({ student, notes, onClose }: BulletinPrintModalProps) {
  const moyenneGenerale = computeMoyenneGenerale(notes)
  const scale = moyenneScaleForClasse(student.classe) ?? 20

  return (
    <PrintPreviewShell
      subtitle={`Bulletin de Notes — ${student.name}`}
      onClose={onClose}
      fileName={`Bulletin_Notes_${sanitizeFileName(student.name)}_${todayFileStamp()}`}
    >
      <div className="print-page bg-white px-8 py-6 text-slate-800">
        <header className="mb-3 grid grid-cols-3 items-center border-b-2 border-slate-800 pb-2">
          <div>
            <p className="text-sm font-bold text-slate-900">Groupe Scolaire Mondrian</p>
            <p className="text-[9px] uppercase tracking-wide text-slate-500">École de la Bienveillance</p>
          </div>
          <SchoolLogo size={72} />
          <p className="text-right text-[9px] text-slate-500">Édité le : {todayFR()}</p>
        </header>

        <h1 className="mb-1 text-center text-base font-bold text-slate-900">BULLETIN DE NOTES</h1>
        <p className="mb-4 text-center text-xs text-slate-600">
          Élève : <span className="font-bold text-slate-900">{student.name}</span> &nbsp;| Classe :{' '}
          <span className="font-bold text-slate-900">{student.classe}</span>
        </p>

        <table className="mb-4 w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-slate-300 text-left text-slate-500">
              <th className="py-1.5 pr-2 font-semibold">Matière</th>
              <th className="py-1.5 pr-2 font-semibold">Coefficient</th>
              <th className="py-1.5 pr-2 font-semibold">Évaluations</th>
              <th className="py-1.5 font-semibold">Moyenne Matière</th>
            </tr>
          </thead>
          <tbody>
            {notes.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-center text-slate-400">
                  Aucune note enregistrée.
                </td>
              </tr>
            ) : (
              notes.map((row) => {
                const moyenne = computeSubjectMoyenne(row)
                return (
                  <tr key={row.subject} className="border-b border-slate-100">
                    <td className="py-2 pr-2 font-semibold text-slate-800">{row.subject}</td>
                    <td className="py-2 pr-2">{row.coef}</td>
                    <td className="py-2 pr-2">{row.evaluations.map((ev) => ev.value.toFixed(2)).join(', ')}</td>
                    <td className="py-2 font-bold text-emerald-600">{moyenne !== null ? `${moyenne.toFixed(2)}/${scale}` : '—'}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        <div className="rounded-lg border-l-4 border-l-indigo-500 bg-indigo-50/50 px-4 py-3 text-center">
          <p className="text-sm text-slate-600">Moyenne Générale</p>
          <p className="text-xl font-bold text-indigo-600">
            {moyenneGenerale === null ? 'N/A' : `${moyenneGenerale.toFixed(2)} / ${scale}`}
          </p>
        </div>

        <footer className="mt-6 border-t border-slate-200 pt-2 text-center text-[9px] text-slate-500">
          <div>Groupe Scolaire Mondrian · https://mondrian-dvs.web.app</div>
          <div className="mt-0.5 font-semibold uppercase tracking-wide text-slate-400">Direction de la Vie Scolaire</div>
        </footer>
      </div>
    </PrintPreviewShell>
  )
}
