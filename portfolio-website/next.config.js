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
}

module.exports = nextConfig
