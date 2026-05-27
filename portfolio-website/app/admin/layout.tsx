/**
 * Admin layout — completely separate from the main portfolio layout.
 * Does NOT include SmoothScrollProvider, noise overlay, or portfolio fonts.
 * Dark mode is forced by the root layout's anti-flash script (checks /admin path).
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children
}
