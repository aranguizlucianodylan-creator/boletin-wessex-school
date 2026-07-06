import { HashRouter, Route, Routes } from 'react-router-dom'
import { HomePage } from './routes/HomePage'
import { MagazinePage } from './routes/MagazinePage'
import { AdminPage } from './routes/AdminPage'
import './App.css'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/revista/:slug" element={<MagazinePage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </HashRouter>
  )
}

export default App
