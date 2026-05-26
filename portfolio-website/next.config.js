/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        // Supabase Storage — avatars, resumes, highlights
        protocol: 'https',
        hostname: 'lkvzvjyyedkbtvorbvnk.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  // Fix: animejs v3 is CommonJS; transpiling prevents ChunkLoadError
  transpilePackages: ['animejs'],

  // ── Security headers ────────────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Prevent MIME-type sniffing
          { key: 'X-Content-Type-Options',   value: 'nosniff' },
          // Disallow embedding in iframes (clickjacking protection)
          { key: 'X-Frame-Options',          value: 'DENY' },
          // Legacy XSS filter for older browsers
          { key: 'X-XSS-Protection',         value: '1; mode=block' },
          // Don't leak the full referrer to third parties
          { key: 'Referrer-Policy',          value: 'strict-origin-when-cross-origin' },
          // Disable browser features the site doesn't use
          { key: 'Permissions-Policy',       value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
