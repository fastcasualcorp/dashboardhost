import { Icon } from '../nav'

export default function SectionPreview({ id, title, desc }: { id: string; title: string; desc: string }) {
  return (
    <div className="section section-preview">
      <div className="sp-card">
        <div className="sp-ic">
          <Icon name={id} size={26} />
        </div>
        <h2>{title}</h2>
        <p>{desc}</p>
        <span className="sp-tag">En preparación</span>
      </div>
    </div>
  )
}
