export const Footer = () => {
  const year = new Date().getFullYear()
  return (
    <footer className="site-footer">
      <p>© {year} The Wessex School — Boletín Mensual</p>
      <p>Publicaciones oficiales · Experiencias y noticias del colegio</p>
    </footer>
  )
}
