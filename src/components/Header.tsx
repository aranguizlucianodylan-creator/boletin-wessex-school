import { Link } from 'react-router-dom'

interface HeaderProps {
  title?: string
  subtitle?: string
}

export const Header = ({ title = 'Boletín Mensual', subtitle = 'The Wessex School' }: HeaderProps) => {
  return (
    <header className="site-header">
      <Link to="/" className="brand-block">
        <div className="brand-mark">📖</div>
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </Link>
      <nav className="header-nav">
        <Link to="/">Inicio</Link>
      </nav>
    </header>
  )
}
