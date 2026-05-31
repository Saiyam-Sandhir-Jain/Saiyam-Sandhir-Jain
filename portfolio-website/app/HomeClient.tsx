'use client'

/**
 * HomeClient — the original page.tsx logic extracted into a client component.
 * page.tsx is now a Server Component that fetches data from Supabase
 * and passes it here as props. The visual design is UNCHANGED.
 */

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

import { Navbar, type ViewId } from '@/components/Navbar'
import { Hero }                from '@/components/Hero'
import { Experience }          from '@/components/Experience'
import { Skills }              from '@/components/Skills'
import { TallProject, SquareProject } from '@/components/Projects'
import { GitHubProjects }      from '@/components/GitHubProjects'
import { Footer }              from '@/components/Footer'
import { BentoAnimator }       from '@/components/BentoAnimator'
import { ProjectModal }        from '@/components/ProjectModal'
import { Explorations, PaperModal, PatentModal } from '@/components/Explorations'
import AgentChat               from '@/components/AgentChat'

import type {
  Personal,
  Experience as ExperienceType,
  Skill,
  Project,
  ResearchPaper,
  Patent,
  SocialLink,
  Footer as FooterType,
  NavItem,
  Explorations as ExplorationsType,
} from '@/types/portfolio'

export interface HomeClientProps {
  personal:      Personal
  experience:    ExperienceType[]
  skills:        Skill[]
  projects:      Project[]
  explorations:  ExplorationsType
  navigation:    NavItem[]
  social:        SocialLink[]
  footer:        FooterType
  samsAvatarUrl?: string | null
}

// ─── Shared page variants for view transitions (identical to original) ─────
const viewVariants = {
  initial: { opacity: 0, y: 24  },
  animate: { opacity: 1, y: 0   },
  exit:    { opacity: 0, y: -16 },
}
const viewTransition = { duration: 0.38, ease: [0.22, 1, 0.36, 1] as any }

// ─── Home view (bento grid) — identical layout to original ────────────────
function HomeView({
  personal, experience, skills, projects, explorations, social, footer,
  onProjectClick, onAskSams,
}: HomeClientProps & { onProjectClick: (p: Project) => void; onAskSams: (q: string) => void }) {
  const tallProject    = projects.find(p => p.type === 'tall')
  const squareProjects = projects.filter(p => p.type === 'square')

  const [selectedPaper,  setPaper]  = useState<ResearchPaper | null>(null)
  const [selectedPatent, setPatent] = useState<Patent | null>(null)

  const handleTileClick = useCallback((p: Project) => {
    if (p.subtype === 'research') {
      // Build ResearchPaper from the linked DB paper's actual data
      const paper: ResearchPaper = {
        id:        p.id,
        title:     p.modalHeading    ?? p.title,
        venue:     p.modalSubheading ?? p.description,
        year:      p.modalYear       ?? new Date().getFullYear(),
        status:    (['published', 'upcoming'].includes(p.modalStatus ?? '')
                    ? p.modalStatus as ResearchPaper['status']
                    : 'upcoming'),
        url:       p.modalLinks?.[0]?.url ?? '#',
        summary:   p.modalAbstract ?? '',
        tags:      p.modalTags     ?? [],
        coAuthors: p.modalAuthors  ?? [],
      }
      setPaper(paper)
    } else if (p.subtype === 'patent') {
      // Build Patent from the linked DB patent's actual data
      const patent: Patent = {
        id:                 p.id,
        title:              p.modalHeading   ?? p.title,
        registrationNumber: p.modalRegNumber ?? '',
        year:               p.modalYear      ?? new Date().getFullYear(),
        status:             (['granted', 'filed', 'upcoming'].includes(p.modalStatus ?? '')
                              ? p.modalStatus as Patent['status']
                              : 'filed'),
        summary:            p.modalAbstract ?? '',
        tags:               p.modalTags     ?? [],
      }
      setPatent(patent)
    } else {
      onProjectClick(p)
    }
  }, [onProjectClick])

  return (
    <>
      <div className="max-w-[820px] mx-auto px-4 pt-24 pb-4 space-y-3">
        {/* Hero */}
        <BentoAnimator>
          <section id="about">
            <Hero personal={personal} />
          </section>
        </BentoAnimator>

        <BentoAnimator delayBase={60}>
          {/* ── Desktop: two independent flex columns ── */}
          <div className="hidden lg:flex gap-3 items-stretch">
            {/* Left column: Experience → Tall project */}
            <div className="flex flex-col gap-3 flex-1">
              <section id="experience">
                <Experience items={experience} onAskSams={onAskSams} />
              </section>
              {tallProject && (
                <div className="flex flex-col flex-1">
                  <TallProject project={tallProject} onClick={handleTileClick} />
                </div>
              )}
            </div>

            {/* Right column: Skills → Square tiles */}
            <div className="flex flex-col gap-3 flex-1">
              <div id="portfolio">
                <Skills skills={skills} />
              </div>
              <div className="flex flex-col gap-3 flex-1">
                {squareProjects.map(project => (
                  <SquareProject key={project.id} project={project} onClick={handleTileClick} />
                ))}
              </div>
            </div>
          </div>

          {/* ── Mobile: single column ── */}
          <div className="flex flex-col gap-3 lg:hidden">
            <section id="experience">
              <Experience items={experience} onAskSams={onAskSams} />
            </section>
            <div id="portfolio">
              <Skills skills={skills} />
            </div>
            {tallProject && <TallProject project={tallProject} onClick={handleTileClick} />}
            {squareProjects.map(project => (
              <SquareProject key={project.id} project={project} onClick={handleTileClick} />
            ))}
          </div>
        </BentoAnimator>

        <div>
          <Footer footer={footer} social={social} available={personal.available} />
        </div>
      </div>

      {/* Research paper + patent modals — portaled, safe outside motion.div */}
      <PaperModal  paper={selectedPaper}   onClose={() => setPaper(null)}  onAskSams={onAskSams} />
      <PatentModal patent={selectedPatent} onClose={() => setPatent(null)} onAskSams={onAskSams} />
    </>
  )
}

// ─── Projects view (GitHub stats + repos) ─────────────────────────────────
function ProjectsView({ footer, social, available }: {
  footer:    FooterType
  social:    SocialLink[]
  available: boolean
}) {
  return (
    <div className="max-w-[820px] mx-auto px-4 pt-24 pb-4">
      <BentoAnimator>
        <GitHubProjects />
      </BentoAnimator>
      <div className="mt-3">
        <Footer footer={footer} social={social} available={available} />
      </div>
    </div>
  )
}

// ─── Root SPA ─────────────────────────────────────────────────────────────
export function HomeClient(props: HomeClientProps) {
  const { navigation, explorations, social, footer, personal, samsAvatarUrl } = props
  const [view, setView]               = useState<ViewId>('home')
  const [selectedProject, setProject] = useState<Project | null>(null)
  const [chatOpen, setChatOpen]       = useState(false)
  const [chatQuery, setChatQuery]     = useState<string | null>(null)
  const router = useRouter()

  const handleAskSams = useCallback((query: string) => {
    setChatQuery(query)
    setChatOpen(true)
  }, [])

  // Listen for admin saves broadcast from any tab — refresh server data in-place
  // (no full page reload, no scroll jump, no client state reset)
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return
    const ch = new BroadcastChannel('portfolio-updates')
    ch.onmessage = () => router.refresh()
    return () => ch.close()
  }, [router])

  const handleViewChange = useCallback((v: ViewId) => setView(v), [])

  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--bg-page)' }}>
      <Navbar
        navigation={navigation}
        currentView={view}
        onViewChange={handleViewChange}
        onAgentToggle={() => setChatOpen(o => !o)}
        agentOpen={chatOpen}
      />

      {/* Animated view switcher — filter removed to keep fixed children anchored */}
      <AnimatePresence mode="wait">
        {view === 'home' ? (
          <motion.div
            key="home"
            variants={viewVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={viewTransition}
          >
            <HomeView {...props} onProjectClick={setProject} onAskSams={handleAskSams} />
          </motion.div>
        ) : view === 'projects' ? (
          <motion.div
            key="projects"
            variants={viewVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={viewTransition}
          >
            <ProjectsView footer={footer} social={social} available={personal.available} />
          </motion.div>
        ) : (
          <motion.div
            key="explorations"
            variants={viewVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={viewTransition}
          >
            <Explorations data={explorations} onAskSams={handleAskSams} />
            <div className="max-w-[820px] mx-auto px-4 pb-4 mt-3">
              <Footer footer={footer} social={social} available={personal.available} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Regular project detail modal — outside motion.div, fixed position works fine */}
      <ProjectModal
        project={selectedProject}
        onClose={() => setProject(null)}
        onAskSams={handleAskSams}
      />

      {/* Sams AI Agent chat panel */}
      <AgentChat
        open={chatOpen}
        onOpenChange={setChatOpen}
        samsAvatarUrl={samsAvatarUrl}
        pendingQuery={chatQuery}
        onPendingQueryConsumed={() => setChatQuery(null)}
      />
    </main>
  )
}
