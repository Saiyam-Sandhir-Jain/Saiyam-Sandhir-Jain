/**
 * Admin layout — completely separate from the main portfolio layout.
 * Does NOT include SmoothScrollProvider, noise overlay, or portfolio fonts.
 * Always forces dark mode — ignores the user's portfolio theme preference.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Force dark mode in admin regardless of saved portfolio theme preference.
          Runs synchronously before paint so there is no flash. */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.removeAttribute('data-theme');`,
          }}
        />
      </head>
      {children}
    </>
  )
}
