/**
 * This route is no longer used — the portfolio is now a Single Page Application.
 * The Projects view is embedded in the main page (app/page.tsx) and toggled via
 * the Navbar's "Projects" button with an animated view transition.
 *
 * This file redirects any direct link to /projects back to home.
 */
import { redirect } from 'next/navigation'

export default function ProjectsRedirect() {
  redirect('/')
}
