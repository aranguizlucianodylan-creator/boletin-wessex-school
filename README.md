# Revista Mensual

Aplicacion web estatica para publicar revistas mensuales en formato flipbook usando PDFs generados en Canva.

## 1. Instalar el proyecto

```bash
npm install
```

## 2. Correr localmente

```bash
npm run dev
```

Luego abre la URL que indique Vite en el navegador.

## 3. Agregar una revista nueva desde el panel

1. Exporta el PDF desde Canva.
2. Abre `/#/admin`.
3. Configura una vez un token de GitHub con permisos de escritura al repo.
4. En `Publicar boletin`, selecciona el PDF y completa los datos.
5. Pulsa `Publicar boletin`.
6. El panel subira el PDF y actualizara `issues.json` directamente en GitHub.
7. GitHub Pages publicara la nueva edicion automaticamente.

## 4. Publicar gratis en GitHub Pages

El proyecto ya incluye el workflow `/.github/workflows/deploy-pages.yml`, asi que GitHub Pages puede publicar automaticamente cada cambio en `main`.

Pasos:

1. Crea un repositorio nuevo en GitHub.
2. Sube esta carpeta completa al branch `main`.
3. En GitHub, entra a `Settings > Pages`.
4. En `Source`, selecciona `GitHub Actions`.
5. Haz un push a `main` y GitHub publicara el sitio.

La URL final quedara con este formato:

```text
https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/
```

Como el sitio usa `HashRouter` para que Pages no rompa las rutas internas, las paginas compartibles quedan asi:

```text
https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/#/admin
https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/#/revista/boletin-julio-2026
```

## 5. Generar el build manualmente

Esta app es estatica y funciona sin backend ni tokens privados. Puedes generar la carpeta `dist/` con:

```bash
npm run build
```

Luego puedes subir `dist/` a GitHub Pages, Netlify Free, Vercel Free, Cloudflare Pages o cualquier hosting estatico.

## 6. Gestionar boletines existentes

1. Abre `/admin`.
2. En `Gestionar boletines`, elimina el boletin deseado.
3. El panel actualizara `issues.json` en GitHub automaticamente.
4. GitHub Pages volvera a desplegar el sitio.

## 7. Si el PDF pesa demasiado

- Usa compresion en Canva.
- Exporta en calidad media o baja si no necesitas alta resolucion.
- Considera una version reducida para web.

## 8. Cambiar colores, nombre, logo y textos

- Nombre y subtitulo: ajusta los textos en `src/components/Header.tsx`.
- Colores: modifica `src/App.css`.
- Logo: reemplaza `public/logo.png` si lo agregas y actualiza la referencia en el header.
- Footer: modifica `src/components/Footer.tsx`.

## Notas tecnicas

- El visor usa `pdfjs-dist` para convertir paginas del PDF a canvas.
- El efecto de pasar paginas usa `react-pageflip`.
- El proyecto esta pensado para funcionar como sitio estatico sin servidor.
