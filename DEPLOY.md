# BriefIntel - Guía de Deployment

## Stack
- **Framework:** Astro 4.x + Tailwind CSS
- **Hosting:** Vercel (static)
- **Dominio:** getbriefintel.com

---

## 1. Deployment a Vercel

### Opción A: Desde GitHub (recomendado)

1. **Push el código a GitHub:**
   ```bash
   cd briefintel-site
   git init
   git add .
   git commit -m "Initial commit: BriefIntel landing page"
   git remote add origin https://github.com/medinet22/briefintel-site.git
   git push -u origin main
   ```

2. **Conectar con Vercel:**
   - Ve a https://vercel.com/new
   - Importa el repositorio `medinet22/briefintel-site`
   - Framework preset: Astro
   - Build command: `npm run build`
   - Output directory: `dist`
   - Click "Deploy"

### Opción B: Vercel CLI

```bash
# Instalar Vercel CLI si no está
npm i -g vercel

# Deploy desde el directorio del proyecto
cd briefintel-site
vercel

# Para producción
vercel --prod
```

---

## 2. Configurar DNS (Cloudflare)

### Requisitos previos:
- Dominio getbriefintel.com activo
- Cloudflare como DNS (recomendado para SSL y CDN)

### Pasos:

1. **En Vercel Dashboard:**
   - Settings → Domains
   - Add: `getbriefintel.com`
   - Add: `www.getbriefintel.com`

2. **En Cloudflare:**
   - DNS → Add record:
     - Type: `CNAME`
     - Name: `@`
     - Target: `cname.vercel-dns.com`
     - Proxy status: DNS only (grey cloud)
   
   - DNS → Add record:
     - Type: `CNAME`
     - Name: `www`
     - Target: `cname.vercel-dns.com`
     - Proxy status: DNS only (grey cloud)

3. **Verificar en Vercel:**
   - Esperar propagación DNS (5-10 min)
   - Vercel generará SSL automáticamente

---

## 3. Variables de entorno

No se requieren variables de entorno para el sitio estático.

Para futuras integraciones (analytics, checkout):

```bash
# En Vercel Dashboard → Settings → Environment Variables
STRIPE_PUBLIC_KEY=pk_live_xxx
POSTHOG_KEY=phc_xxx
```

---

## 4. Actualizaciones

Cada push a `main` trigerea deploy automático en Vercel.

```bash
# Hacer cambios
git add .
git commit -m "Update: [descripción del cambio]"
git push
```

---

## 5. Testing local

```bash
# Desarrollo
npm run dev
# Abre http://localhost:4321

# Build de producción
npm run build

# Preview del build
npm run preview
```

---

## 6. Checklist Pre-Launch

- [ ] Build sin errores (`npm run build`)
- [ ] Dominio configurado en Vercel
- [ ] DNS propagado (check con `dig getbriefintel.com`)
- [ ] SSL activo (https://getbriefintel.com)
- [ ] Emails de pricing apuntan a d@negoia.com
- [ ] Favicon visible
- [ ] Mobile responsive OK
- [ ] Google Analytics/PostHog configurado (opcional)

---

## 7. Próximos pasos post-launch

1. **Stripe Integration:**
   - Crear productos en Stripe Dashboard
   - Generar Payment Links
   - Reemplazar `mailto:` por Payment Links en botones

2. **Tally Form:**
   - Crear formulario de brief
   - Configurar redirect post-checkout

3. **Analytics:**
   - Añadir PostHog o Plausible
   - Configurar eventos de conversión

---

## Soporte

Problemas con deployment: consultar docs de Vercel o contactar d@negoia.com
