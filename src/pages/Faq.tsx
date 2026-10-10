import { Link } from 'react-router'
import { useI18n } from '../i18n'
import { Icon } from '../components/Icon'
import { PageHero } from '../components/ui'

export default function Faq() {
  const { t, to } = useI18n()
  const f = t.faq
  return (
    <>
      <PageHero title={f.title} lead={f.lead} />
      <section className="section">
        <div className="container-page max-w-3xl">
          <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {f.items.map((item) => (
              <details key={item.q} className="group px-5 py-1 sm:px-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left font-semibold [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <Icon name="chevronDown" className="h-5 w-5 shrink-0 text-muted transition-transform group-open:rotate-180" />
                </summary>
                <p className="pb-5 leading-relaxed text-muted">{item.a}</p>
              </details>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-muted">
            <Link to={to('contact')} className="font-semibold text-brand-fg hover:underline">
              {t.common.footer.contact} →
            </Link>
          </p>
        </div>
      </section>
    </>
  )
}
