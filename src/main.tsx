import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import '@fontsource/playfair-display/latin-400.css'
import '@fontsource/playfair-display/latin-500.css'
import '@fontsource/playfair-display/latin-600.css'
import '@fontsource/playfair-display/latin-400-italic.css'
import '@fontsource/montserrat/latin-400.css'
import '@fontsource/montserrat/latin-500.css'
import '@fontsource/montserrat/latin-600.css'
import '@fontsource/montserrat/latin-700.css'
import './index.css'

const rootElement = document.getElementById('root')

if (!rootElement) throw new Error('Élément racine de l’application introuvable.')

const root = createRoot(rootElement)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  root.render(
    <main className="empty-state page-empty" role="alert">
      <span className="eyebrow">CONFIGURATION REQUISE</span>
      <h1>La boutique n’est pas encore configurée.</h1>
      <p>Ajoutez VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY dans votre fichier .env.local, puis redémarrez le serveur.</p>
    </main>,
  )
} else {
  void import('./App.tsx').then(({ default: App }) => {
    root.render(
      <StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </StrictMode>,
    )
  }).catch(error => {
    console.error('Application startup failed', error)
    root.render(
      <main className="empty-state page-empty" role="alert">
        <span className="eyebrow">ERREUR DE DÉMARRAGE</span>
        <h1>La boutique n’a pas pu démarrer.</h1>
        <p>Vérifiez la configuration Supabase et la console du navigateur pour identifier l’erreur.</p>
      </main>,
    )
  })
}
