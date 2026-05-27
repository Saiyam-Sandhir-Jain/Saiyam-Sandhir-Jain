/**
 * Root page — Server Component.
 * Fetches all data from Supabase, falls back to portfolio.json when absent.
 */

import { createClient }   from '@/lib/supabase/server'
import { HomeClient }     from './HomeClient'

import type {
  Personal, Experience, Skill, Project, Explorations as ExplorationsType, SocialLink,
} from '@/types/portfolio'
import rawData   from '@/data/portfolio.json'
import type { PortfolioData } from '@/types/portfolio'

const fallback = rawData as unknown as PortfolioData

export default async function Home() {
  const db = createClient()

  const [profileRes, expRes, skillsRes, highlightsRes, papersRes, patentsRes, certsRes, lorsRes] =
    await Promise.all([
      db.from('about_profile').select('*').single(),
      db.from('experience').select('*').order('sort_order'),
      db.from('skills').select('*').order('slot'),
      db.from('highlights').select('*, selected_paper:research_papers(*), selected_patent:patents(*)'),
      db.from('research_papers').select('*').order('sort_order'),
      db.from('patents').select('*').order('sort_order'),
      db.from('certificates').select('*').order('sort_order'),
      db.from('lors').select('*').order('sort_order'),
    ])

  // ── Personal ──────────────────────────────────────────────────────────────
  const p = profileRes.data
  const personal: Personal = p
    ? {
        name:      p.name,
        firstName: p.first_name,
        lastName:  p.last_name,
        initials:  p.initials,
        title:     p.title,
        bio:       p.bio,
        email:     p.email,
        avatarUrl: p.avatar_url  ?? '',
        available: p.available,
        resumeUrl: p.resume_url  ?? '#',
      }
    : fallback.personal

  // ── Social links (footer) — from DB if available, else portfolio.json ─────
  const social: SocialLink[] =
    Array.isArray(p?.social_links) && (p.social_links as any[]).length > 0
      ? (p.social_links as any[]).map((l: any) => ({
          label: l.label ?? '',
          url:   l.url   ?? '#',
          icon:  l.icon  ?? '',
        }))
      : fallback.social

  // ── Experience ────────────────────────────────────────────────────────────
  const experience: Experience[] = expRes.data?.length
    ? expRes.data.map((e: any) => ({
        id:        e.id,
        role:      e.role,
        company:   e.company,
        startDate: e.start_date,
        endDate:   e.end_date,
        current:   e.is_current,
        url:       e.url ?? '#',
      }))
    : fallback.experience

  // ── Skills ────────────────────────────────────────────────────────────────
  const skills: Skill[] = skillsRes.data?.length
    ? skillsRes.data.map((s: any) => ({
        id:       s.id,
        category: s.category,
        size:     s.size as 'full' | 'half',
        tags:     s.tags,
      }))
    : fallback.skills

  // ── Highlights → Projects ─────────────────────────────────────────────────
  const SLOT_ORDER: Record<string, number> = { project: 0, research: 1, patent: 2 }

  const projects: Project[] = highlightsRes.data?.length
    ? ([...highlightsRes.data] as any[])
        .sort((a, b) => (SLOT_ORDER[a.slot] ?? 9) - (SLOT_ORDER[b.slot] ?? 9))
        .map(h => {
          if (h.slot === 'research' && h.selected_paper) {
            const sp = h.selected_paper
            return {
              id:              h.id,
              title:           h.heading     || h.slot,
              description:     h.subheading  || '',
              type:            'square' as const,
              subtype:         'research' as const,
              url:             sp.scholar_url ?? '#',
              imageUrl:        h.image_url    ?? '',
              backImageUrl:    '',
              accent:          '#f97316',
              label:           'research paper',
              modalHeading:    sp.title,
              modalSubheading: sp.venue ?? '',        // venue only — year passed separately to avoid "IEEE · 2026 · 2026"
              modalAbstract:   sp.abstract,
              modalTags:       sp.tags       ?? [],
              modalLinks:      sp.scholar_url ? [{ label: 'View', url: sp.scholar_url }] : [],
              modalStatus:     sp.status     ?? 'upcoming',
              modalYear:       sp.year       ?? 0,
              modalAuthors:    sp.authors    ?? [],
            }
          }

          if (h.slot === 'patent' && h.selected_patent) {
            const sp = h.selected_patent
            return {
              id:              h.id,
              title:           h.heading     || h.slot,
              description:     h.subheading  || '',
              type:            'square' as const,
              subtype:         'patent' as const,
              url:             '#',
              imageUrl:        h.image_url   ?? '',
              backImageUrl:    '',
              accent:          '#f97316',
              label:           '',
              modalHeading:    sp.title,
              modalSubheading: sp.registration_number ?? '', // reg number only — year passed separately
              modalAbstract:   sp.abstract,
              modalTags:       sp.tags       ?? [],
              modalLinks:      [],
              modalStatus:     sp.status     ?? 'upcoming',
              modalYear:       sp.year       ?? 0,
              modalRegNumber:  sp.registration_number ?? '',
            }
          }

          return {
            id:              h.id,
            title:           h.heading     || h.slot,
            description:     h.subheading  || '',
            type:            (h.slot === 'project' ? 'tall' : 'square') as 'tall' | 'square',
            subtype:         h.slot as 'project' | 'research' | 'patent',
            url:             (h.modal_links as any[])?.[0]?.url ?? '#',
            imageUrl:        h.image_url       ?? '',
            phoneImageUrl:   h.slot === 'project' ? (h.phone_image_url ?? '') : undefined,
            backImageUrl:    '',
            accent:          '#f97316',
            label:           h.slot === 'research' ? 'research paper' : '',
            modalHeading:    h.modal_heading    ?? '',
            modalSubheading: h.modal_subheading ?? '',
            modalAbstract:   h.modal_abstract   ?? '',
            modalTags:       h.modal_tags       ?? [],
            modalLinks:      h.modal_links      ?? [],
            modalStatus:     'upcoming',
          }
        })
    : fallback.projects

  // ── Explorations (from DB) ─────────────────────────────────────────────────
  const explorations: ExplorationsType = {
    papers: papersRes.data?.length
      ? papersRes.data.map((r: any) => ({
          id:        r.id,
          title:     r.title,
          venue:     r.venue      ?? '',
          year:      r.year       ?? 0,
          status:    r.status     ?? 'upcoming',
          url:       r.scholar_url ?? '#',
          summary:   r.abstract   ?? '',
          tags:      r.tags       ?? [],
          coAuthors: r.authors    ?? [],
        }))
      : fallback.explorations.papers,

    patents: patentsRes.data?.length
      ? patentsRes.data.map((r: any) => ({
          id:                 r.id,
          title:              r.title,
          registrationNumber: r.registration_number ?? '',
          year:               r.year                ?? 0,
          status:             r.status              ?? 'filed',
          summary:            r.abstract            ?? '',
          tags:               r.tags                ?? [],
        }))
      : fallback.explorations.patents,

    certificates: certsRes.data?.length
      ? certsRes.data.map((r: any) => ({
          id:       r.id,
          title:    r.title,
          issuer:   r.issuer    ?? '',
          date:     r.year      ?? '',
          imageUrl: r.image_url ?? '',
        }))
      : fallback.explorations.certificates,

    lors: lorsRes.data?.length
      ? lorsRes.data.map((r: any) => ({
          id:           r.id,
          recommender:  r.recommender_name ?? '',
          organization: r.organization     ?? '',
          relationship: r.relationship     ?? '',
          available:    r.available        ?? false,
          pdfUrl:       r.pdf_url          ?? undefined,
        }))
      : fallback.explorations.lors,
  }

  return (
    <HomeClient
      personal={personal}
      experience={experience}
      skills={skills}
      projects={projects}
      explorations={explorations}
      navigation={fallback.navigation}
      social={social}
      footer={fallback.footer}
      samsAvatarUrl={p?.sams_avatar_url ?? null}
    />
  )
}
