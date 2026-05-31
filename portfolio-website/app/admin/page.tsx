import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { ProfileForm }        from './_components/ProfileForm'
import { ExperienceManager }  from './_components/ExperienceManager'
import { SkillsManager }      from './_components/SkillsManager'
import { HighlightsManager }  from './_components/HighlightsManager'
import { ExplorationsManager } from './_components/ExplorationsManager'
import { SamsManager }        from './_components/SamsManager'
import { ChatAnalytics }      from './_components/ChatAnalytics'
import { SignOutButton }       from './_components/SignOutButton'

// ─── Fetch all admin data with the service-role client (no RLS wait) ─────────
async function fetchAdminData() {
  const db = createServiceClient()

  const [profileRes, expRes, skillsRes, highlightsRes, papersRes, patentsRes, certsRes, lorsRes] =
    await Promise.all([
      db.from('about_profile').select('*').single(),
      db.from('experience').select('*').order('sort_order'),
      db.from('skills').select('*').order('slot'),
      db.from('highlights').select('*'),
      db.from('research_papers').select('*').order('sort_order'),
      db.from('patents').select('*').order('sort_order'),
      db.from('certificates').select('*').order('sort_order'),
      db.from('lors').select('*').order('sort_order'),
    ])

  return {
    profile:      profileRes.data,
    experience:   expRes.data     ?? [],
    skills:       skillsRes.data  ?? [],
    highlights:   highlightsRes.data ?? [],
    papers:       papersRes.data  ?? [],
    patents:      patentsRes.data ?? [],
    certificates: certsRes.data   ?? [],
    lors:         lorsRes.data    ?? [],
  }
}

// ─── Tab nav styling ──────────────────────────────────────────────────────────
const TABS = [
  { id: 'profile',      label: 'Profile'      },
  { id: 'experience',   label: 'Experience'   },
  { id: 'skills',       label: 'Skills'       },
  { id: 'highlights',   label: 'Highlights'   },
  { id: 'explorations', label: 'Explorations' },
  { id: 'sams',         label: '✦ Sams AI'    },
  { id: 'analytics',    label: '📊 Analytics'  },
]

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
  // ── Auth guard ──────────────────────────────────────────────────────────────
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session || session.user.email !== process.env.ADMIN_EMAIL) {
    redirect('/admin/login')
  }

  // ── Fetch data ──────────────────────────────────────────────────────────────
  const { profile, experience, skills, highlights, papers, patents, certificates, lors } =
    await fetchAdminData()

  const activeTab = searchParams.tab ?? 'profile'

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#111' }}>
      {/* ── Header ── */}
      <div
        className="sticky top-0 z-10 border-b border-zinc-800 px-4 sm:px-6 py-3 flex items-center justify-between gap-2"
        style={{ backgroundColor: '#161616' }}
      >
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <h1 className="text-white font-bold text-sm sm:text-base shrink-0">Portfolio Admin</h1>
          <span className="text-xs text-zinc-500 truncate hidden sm:block">{session.user.email}</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <a
            href="/"
            target="_blank"
            className="text-xs text-zinc-400 hover:text-white underline hidden xs:block"
          >
            View Site ↗
          </a>
          <SignOutButton />
        </div>
      </div>

      {/* ── Tab bar — horizontally scrollable on mobile ── */}
      <div
        className="border-b border-zinc-800 sticky top-[49px] z-10"
        style={{ backgroundColor: '#161616' }}
      >
        <div
          className="flex gap-0 overflow-x-auto"
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          {TABS.map(tab => (
            <a
              key={tab.id}
              href={`/admin?tab=${tab.id}`}
              className={`px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? 'border-orange-500 text-orange-400'
                  : 'border-transparent text-zinc-400 hover:text-white'
              }`}
            >
              {tab.label}
            </a>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {activeTab === 'profile' && profile && (
          <section>
            <h2 className="text-white font-semibold mb-6">Title Tile — Profile Information</h2>
            <ProfileForm
              profile={{
                title:        profile.title,
                bio:          profile.bio,
                email:        profile.email,
                available:    profile.available,
                avatar_url:   profile.avatar_url,
                resume_url:   profile.resume_url,
                favicon_url:  profile.favicon_url,
                social_links: Array.isArray(profile.social_links) ? profile.social_links : [],
              }}
            />
          </section>
        )}

        {activeTab === 'experience' && (
          <section>
            <h2 className="text-white font-semibold mb-2">Experience Tile</h2>
            <p className="text-xs text-zinc-500 mb-6">
              Manage work experiences. If more than 4 entries exist, a vertical scrollbar
              will appear inside the Experience tile on the portfolio.
            </p>
            <ExperienceManager initial={experience} />
          </section>
        )}

        {activeTab === 'skills' && (
          <section>
            <h2 className="text-white font-semibold mb-6">Skills Tiles</h2>
            <SkillsManager skills={skills} />
          </section>
        )}

        {activeTab === 'highlights' && (
          <section>
            <h2 className="text-white font-semibold mb-6">Highlights Tiles</h2>
            <HighlightsManager highlights={highlights} papers={papers} patents={patents} />
          </section>
        )}

        {activeTab === 'explorations' && (
          <section>
            <h2 className="text-white font-semibold mb-6">Explorations Section</h2>
            <ExplorationsManager
              papers={papers}
              patents={patents}
              certificates={certificates}
              lors={lors}
            />
          </section>
        )}

        {activeTab === 'sams' && (
          <section>
            <h2 className="text-white font-semibold mb-2">Sams AI Agent</h2>
            <p className="text-xs text-zinc-500 mb-6">
              Configure the Sams AI agent — upload knowledge files and set the chat avatar.
            </p>
            <SamsManager samsAvatarUrl={profile?.sams_avatar_url ?? null} />
          </section>
        )}

        {activeTab === 'analytics' && (
          <section>
            <h2 className="text-white font-semibold mb-1">Sams Chat Analytics</h2>
            <p className="text-xs text-zinc-500 mb-6">
              Questions visitors have asked Sams, common topics, and rate-limit usage.
              Chat history is saved server-side and never exposed to visitors.
            </p>
            <ChatAnalytics />
          </section>
        )}

        {activeTab === 'profile' && !profile && (
          <div className="text-red-400 text-sm">
            No profile row found in database. Run the schema.sql seed statements first.
          </div>
        )}
      </div>
    </div>
  )
}
