import '@fontsource-variable/inter'
import '@fontsource-variable/plus-jakarta-sans'
import '@fontsource-variable/jetbrains-mono'
import './styles/index.css'
import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { App } from './App'
import { splitLang } from './i18n/routes'

const container = document.getElementById('root')!
const app = (
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)

// Public pages are prerendered at build time; hydrate them. In `vite` dev the root is empty.
// If the served HTML is for another language (e.g. a fallback 404 page), render fresh instead.
const ssrMatches = document.documentElement.lang === splitLang(location.pathname).lang
if (container.firstElementChild && ssrMatches) hydrateRoot(container, app)
else {
  container.textContent = ''
  createRoot(container).render(app)
}
