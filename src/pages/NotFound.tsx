import { Link } from 'react-router'
import { useI18n } from '../i18n'

export default function NotFound() {
  const { t, to } = useI18n()
  return (
    <section className="section">
      <div className="container-page max-w-xl text-center">
        <p className="font-mono text-sm font-semibold text-brand-fg">404</p>
        <h1 className="mt-3 text-4xl font-extrabold">{t.notFound.title}</h1>
        <p className="mt-4 text-muted">{t.notFound.body}</p>
        <Link to={to('home')} className="btn-primary mt-8">
          {t.notFound.home}
        </Link>
      </div>
    </section>
  )
}
