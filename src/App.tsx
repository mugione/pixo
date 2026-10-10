import type { ComponentType } from 'react'
import { Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { PAGES, type PageId } from './i18n/routes'
import About from './pages/About'
import Contact from './pages/Contact'
import Demo from './pages/Demo'
import Faq from './pages/Faq'
import Features from './pages/Features'
import Home from './pages/Home'
import HowItWorks from './pages/HowItWorks'
import { Cookies, Kvkk, Privacy, Terms } from './pages/Legal'
import NotFound from './pages/NotFound'
import Pricing from './pages/Pricing'
import Roadmap from './pages/Roadmap'
import Signup from './pages/Signup'
import Solutions from './pages/Solutions'

export const PAGE_COMPONENTS: Record<PageId, ComponentType> = {
  home: Home,
  features: Features,
  howItWorks: HowItWorks,
  solutions: Solutions,
  pricing: Pricing,
  about: About,
  roadmap: Roadmap,
  faq: Faq,
  contact: Contact,
  demo: Demo,
  privacy: Privacy,
  terms: Terms,
  cookies: Cookies,
  kvkk: Kvkk,
  signup: Signup,
}

const pageRoutes = (Object.keys(PAGES) as PageId[]).map((id) => {
  const C = PAGE_COMPONENTS[id]
  return PAGES[id] === '/' ? <Route key={id} index element={<C />} /> : <Route key={id} path={PAGES[id].slice(1)} element={<C />} />
})

export function App() {
  return (
    <Routes>
      <Route path="/en" element={<Layout />}>
        {pageRoutes}
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="/" element={<Layout />}>
        {pageRoutes}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
