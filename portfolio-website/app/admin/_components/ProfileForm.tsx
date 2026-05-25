'use client'

import { useState, useRef } from 'react'
import { broadcastPortfolioRefresh } from '@/lib/broadcastRefresh'
import { updateProfileText, updateSocialLinks, uploadAvatar, deleteAvatar, uploadResume } from '../_actions/profile'

interface SocialLink { label: string; url: string; icon: string }

interface ProfileData {
  title:        string
  bio:          string
  email:        string
  available:    boolean
  avatar_url:   string | null
  resume_url:   string | null
  social_links: SocialLink[]
}

export function ProfileForm({ profile }: { profile: ProfileData }) {
  const [status,    setStatus]    = useState('')
  const [available, setAvailable] = useState(profile.available)
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? '')
  const [resumeUrl, setResumeUrl] = useState(profile.resume_url ?? '')
  const [loading,   setLoading]   = useState(false)

  // Social links state
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(
    profile.social_links?.length
      ? profile.social_links
      : [
          { label: 'LinkedIn', url: '#', icon: 'linkedin' },
          { label: 'GitHub',   url: '#', icon: 'github'   },
          { label: 'Scholar',  url: '#', icon: 'scholar'  },
        ]
  )
  const [socialStatus, setSocialStatus] = useState('')
  const [socialLoading, setSocialLoading] = useState(false)

  const avatarInputRef = useRef<HTMLInputElement>(null)
  const resumeInputRef = useRef<HTMLInputElement>(null)

  const handleTextSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true); setStatus('')
    try {
      const fd = new FormData(e.currentTarget)
      fd.set('available', String(available))
      await updateProfileText(fd)
      setStatus('✓ Profile saved.'); broadcastPortfolioRefresh()
    } catch (err: any) {
      setStatus(`✗ ${err.message}`)
    } finally { setLoading(false) }
  }

  const handleAvatarUpload = async () => {
    const file = avatarInputRef.current?.files?.[0]
    if (!file) return
    setLoading(true); setStatus('')
    try {
      const fd = new FormData()
      fd.append('avatar', file)
      const res = await uploadAvatar(fd)
      setAvatarUrl(res.url!)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
      setStatus('✓ Avatar uploaded.'); broadcastPortfolioRefresh()
    } catch (err: any) { setStatus(`✗ ${err.message}`) }
    finally { setLoading(false) }
  }

  const handleAvatarDelete = async () => {
    setLoading(true); setStatus('')
    try {
      await deleteAvatar()
      setAvatarUrl('')
      setStatus('✓ Avatar deleted.'); broadcastPortfolioRefresh()
    } catch (err: any) { setStatus(`✗ ${err.message}`) }
    finally { setLoading(false) }
  }

  const handleResumeUpload = async () => {
    const file = resumeInputRef.current?.files?.[0]
    if (!file) return
    setLoading(true); setStatus('')
    try {
      const fd = new FormData()
      fd.append('resume', file)
      const res = await uploadResume(fd)
      setResumeUrl(res.url!)
      setStatus('✓ Résumé uploaded.'); broadcastPortfolioRefresh()
    } catch (err: any) { setStatus(`✗ ${err.message}`) }
    finally { setLoading(false) }
  }

  const handleSocialSave = async () => {
    setSocialLoading(true); setSocialStatus('')
    try {
      await updateSocialLinks(socialLinks)
      setSocialStatus('✓ Footer links saved.'); broadcastPortfolioRefresh()
    } catch (err: any) { setSocialStatus(`✗ ${err.message}`) }
    finally { setSocialLoading(false) }
  }

  const updateLink = (i: number, field: keyof SocialLink, value: string) => {
    setSocialLinks(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))
  }

  const inputCls = 'w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-white'
  const labelCls = 'block text-xs text-zinc-400 mb-1'
  const btnCls   = 'px-3 py-1.5 rounded text-xs font-semibold bg-orange-600 hover:bg-orange-500 text-white disabled:opacity-50'

  return (
    <div className="space-y-6">
      {status && (
        <p className={`text-sm ${status.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{status}</p>
      )}

      {/* ── Text fields ── */}
      <form onSubmit={handleTextSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>Job Title</label>
          <input name="title" defaultValue={profile.title} className={inputCls} required />
        </div>
        <div>
          <label className={labelCls}>Bio</label>
          <textarea name="bio" defaultValue={profile.bio} rows={4} className={inputCls} required />
        </div>
        <div>
          <label className={labelCls}>Contact Email (for Copy Email button)</label>
          <input name="email" type="email" defaultValue={profile.email} className={inputCls} required />
        </div>
        <div className="flex items-center gap-3">
          <span className={labelCls + ' mb-0'}>Status badge</span>
          <button
            type="button"
            onClick={() => setAvailable(v => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${available ? 'bg-green-600' : 'bg-orange-600'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${available ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
          <span className="text-xs text-zinc-400">
            {available ? '🟢 Exploring Roles (green dot)' : '🟠 Not Seeking (orange dot)'}
          </span>
        </div>
        <button type="submit" disabled={loading} className={btnCls}>
          {loading ? 'Saving…' : 'Save Profile Text'}
        </button>
      </form>

      <hr className="border-zinc-800" />

      {/* ── Avatar upload ── */}
      <div>
        <p className="text-sm font-semibold text-zinc-300 mb-3">Profile Photo</p>
        {avatarUrl && (
          <div className="mb-2 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarUrl} alt="Avatar" className="w-12 h-12 rounded-full object-cover border border-zinc-700" />
            <button onClick={handleAvatarDelete} disabled={loading}
              className="px-2 py-1 text-xs rounded border border-red-700 text-red-400 hover:bg-red-900/30">
              Delete
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input ref={avatarInputRef} type="file" accept="image/*" className="text-xs text-zinc-400" />
          <button onClick={handleAvatarUpload} disabled={loading} className={btnCls}>
            {loading ? 'Uploading…' : 'Upload Avatar'}
          </button>
        </div>
      </div>

      <hr className="border-zinc-800" />

      {/* ── Resume upload ── */}
      <div>
        <p className="text-sm font-semibold text-zinc-300 mb-2">Résumé PDF</p>
        {resumeUrl && (
          <p className="text-xs text-zinc-500 mb-2 truncate">
            Current: <a href={resumeUrl} target="_blank" rel="noreferrer" className="text-orange-400 underline">{resumeUrl}</a>
          </p>
        )}
        <div className="flex items-center gap-2">
          <input ref={resumeInputRef} type="file" accept="application/pdf" className="text-xs text-zinc-400" />
          <button onClick={handleResumeUpload} disabled={loading} className={btnCls}>
            {loading ? 'Uploading…' : 'Upload Résumé'}
          </button>
        </div>
      </div>

      <hr className="border-zinc-800" />

      {/* ── Footer social links ── */}
      <div>
        <p className="text-sm font-semibold text-zinc-300 mb-1">Footer Links</p>
        <p className="text-xs text-zinc-500 mb-4">
          These are the 3 links shown in the portfolio footer (e.g. LinkedIn, GitHub, Scholar).
          Change the display name and/or URL for each.
        </p>
        {socialStatus && (
          <p className={`text-xs mb-3 ${socialStatus.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
            {socialStatus}
          </p>
        )}
        <div className="space-y-3">
          {socialLinks.map((link, i) => (
            <div key={i} className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-zinc-800 bg-zinc-900/40">
              <div>
                <label className={labelCls}>Display Name</label>
                <input
                  className={inputCls}
                  value={link.label}
                  onChange={e => updateLink(i, 'label', e.target.value)}
                  placeholder="e.g. LinkedIn"
                />
              </div>
              <div>
                <label className={labelCls}>URL</label>
                <input
                  className={inputCls}
                  value={link.url}
                  onChange={e => updateLink(i, 'url', e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
          ))}
        </div>
        <button onClick={handleSocialSave} disabled={socialLoading} className={`mt-3 ${btnCls}`}>
          {socialLoading ? 'Saving…' : 'Save Footer Links'}
        </button>
      </div>
    </div>
  )
}
