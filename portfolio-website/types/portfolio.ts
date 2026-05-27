// ─── Portfolio Types ────────────────────────────────────────────────────────
// These mirror the shape of data/portfolio.json and the Supabase DB schema.

export interface Meta {
  title: string
  description: string
  url: string
}

export interface Personal {
  name: string
  firstName: string
  lastName: string
  initials: string
  title: string
  bio: string
  email: string
  avatarUrl: string
  available: boolean
  resumeUrl: string
}

export interface NavItem {
  label: string
  href: string
}

export interface Experience {
  id: string
  role: string
  company: string
  startDate: string
  endDate: string
  current: boolean
  url: string
}

export interface Skill {
  id: string
  category: string
  size: 'full' | 'half'
  tags: string[]
}

export interface ModalLink {
  label: string
  url: string
}

export interface Project {
  id: string
  title: string
  description: string
  type: 'tall' | 'square'
  subtype?: 'project' | 'research' | 'patent'
  url: string
  imageUrl: string
  phoneImageUrl?: string
  backImageUrl?: string
  accent?: string
  label?: string
  // ── Modal content fields (populated from highlights table) ──
  modalHeading?:    string
  modalSubheading?: string
  modalAbstract?:   string
  modalTags?:       string[]
  modalLinks?:      ModalLink[]
  // ── Status + detail fields from the linked DB paper/patent ──
  modalStatus?:     string   // 'published' | 'upcoming' | 'filed' | 'granted'
  modalYear?:       number   // paper/patent year (avoids double-year in subtitle)
  modalAuthors?:    string[] // co-authors for research papers
  modalRegNumber?:  string   // registration number for patents
}

export interface SocialLink {
  label: string
  url: string
  icon: string
}

export interface Footer {
  label: string
  year: number
}

export interface ResearchPaper {
  id: string
  title: string
  venue: string
  year: number
  status: 'published' | 'upcoming'
  url: string
  summary: string
  tags: string[]
  coAuthors?: string[]
}

export interface Patent {
  id: string
  title: string
  registrationNumber: string
  year: number
  status: 'granted' | 'filed' | 'upcoming'
  summary: string
  tags: string[]
}

export interface Certificate {
  id: string
  title: string
  issuer: string
  date: string
  imageUrl: string
}

export interface LOR {
  id: string
  recommender: string
  organization: string
  relationship: string
  available: boolean
  pdfUrl?: string
}

export interface Explorations {
  papers: ResearchPaper[]
  patents: Patent[]
  certificates: Certificate[]
  lors: LOR[]
}

export interface PortfolioData {
  meta: Meta
  personal: Personal
  navigation: NavItem[]
  experience: Experience[]
  skills: Skill[]
  projects: Project[]
  social: SocialLink[]
  footer: Footer
  explorations: Explorations
}
