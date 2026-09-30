export interface Parent {
  id: string
  email: string
  nomComplet: string
  telephone: string
  actif: boolean
}

export interface ParentStudentLink {
  id: string
  parentId: string
  studentId: string
  relation: string
}
