# BriefIntel — Entornos Stripe

> **Última actualización:** 2026-03-15 16:26 UTC

---

## 🧪 Entorno ACTUAL: TEST

**Estado:** ✅ Activo en producción (getbriefintel.com)

### Cómo funciona:
- `TEST_MODE=true` en Vercel → el webhook NO verifica firma de Stripe (parsea JSON directo)
- Las keys en Vercel son las de **test** (`sk_test_...`, `pk_test_...`)
- Los pagos se procesan en Stripe TEST dashboard (no cobran dinero real)
- Los payment_intents empiezan con `pi_` pero existen SOLO en modo test

### Keys activas en Vercel:
| Variable | Valor actual | Target |
|----------|--------------|--------|
| `STRIPE_SECRET_KEY` | sk_test_... (test) | production, preview |
| `STRIPE_PUBLISHABLE_KEY` | pk_test_... (test) | production, preview |
| `STRIPE_WEBHOOK_SECRET` | whsec_... (test) | production, preview |
| `TEST_MODE` | `true` | production, preview, development |

### Cómo probarlo:
- Tarjeta: `4242 4242 4242 4242`
- Fecha: cualquier fecha futura
- CVC: cualquier 3 dígitos
- Los pagos aparecen en: https://dashboard.stripe.com/test/payments

### Pagos de prueba realizados hoy (2026-03-15):
| Payment Intent | Empresa | Tipo | Importe | Email |
|----------------|---------|------|---------|-------|
| `pi_3TBBpMKHITR2cWbK...` | Makan | buyer-intel | €59 | medinet22@hotmail.com |
| `pi_3TBBwFKHITR2cWbK...` | Area101 | pack | €119 | daniel@101area.com |

**⚠️ CONFIRMADO: Estos pagos son TEST (verificado con API — no existen en modo live)**

---

## 💰 Para pasar a PRODUCCIÓN

### Cambios necesarios en Vercel:

```bash
# 1. STRIPE_SECRET_KEY → live key restringida
Valor: rk_live_51T4rmsKHITR2cWbK... (del vault: STRIPE_SECRET_KEY)

# 2. STRIPE_PUBLISHABLE_KEY → live publishable key
Valor: pk_live_51T4rmsKHITR2cWbK... (del vault: STRIPE_PUBLISHABLE_KEY)

# 3. STRIPE_WEBHOOK_SECRET → live webhook secret
Valor: whsec_jtzTc... (del vault: STRIPE_WEBHOOK_SECRET_BRIEFINTEL)
⚠️ IMPORTANTE: Verificar que este sea el webhook live, no test

# 4. TEST_MODE → eliminar o cambiar a false
Acción: Eliminar la variable TEST_MODE de Vercel
```

### Webhook URL en Stripe Dashboard (live):
```
https://getbriefintel.com/api/webhook
```

### Verificación del webhook secret:
El vault tiene DOS webhook secrets:
- `STRIPE_WEBHOOK_SECRET` = whsec_jwjzq... (genérico/NegoIA)
- `STRIPE_WEBHOOK_SECRET_BRIEFINTEL` = whsec_jtzTc... (específico BriefIntel)

**Acción requerida:** Verificar en el Stripe Dashboard live cuál webhook está configurado para BriefIntel y confirmar el secret correcto.

---

## 📋 Checklist antes de pasar a producción

- [ ] Crear webhook en Stripe Dashboard **LIVE** → `https://getbriefintel.com/api/webhook`
- [ ] Copiar el webhook secret live y añadirlo al vault si es nuevo
- [ ] Actualizar `STRIPE_SECRET_KEY` en Vercel → `rk_live_...`
- [ ] Actualizar `STRIPE_PUBLISHABLE_KEY` en Vercel → `pk_live_...`
- [ ] Actualizar `STRIPE_WEBHOOK_SECRET` en Vercel → secret del webhook live
- [ ] **Eliminar** `TEST_MODE` de Vercel (o cambiar a `false`)
- [ ] Redeploy en Vercel
- [ ] Probar pago real con tarjeta válida (€35 Talent Market es el más barato)
- [ ] Verificar notificación Telegram + email de confirmación

---

## 🔐 Keys en el vault (referencia)

```bash
# Para ver las keys (NO mostrar en chat):
grep "STRIPE" ~/.openclaw/workspace/.credentials_vault
```

| Variable | Tipo | Uso |
|----------|------|-----|
| `STRIPE_SECRET_KEY` | rk_live_... | BriefIntel producción |
| `STRIPE_PUBLISHABLE_KEY` | pk_live_... | BriefIntel producción |
| `STRIPE_SECRET_KEY_TEST` | sk_test_... | Testing |
| `STRIPE_PUBLISHABLE_KEY_TEST` | pk_test_... | Testing |
| `STRIPE_WEBHOOK_SECRET` | whsec_... | Genérico/NegoIA |
| `STRIPE_WEBHOOK_SECRET_BRIEFINTEL` | whsec_... | BriefIntel específico |

---

## ⚠️ Nota sobre TEST_MODE en el código

En `api/webhook.js`:
```javascript
if (process.env.TEST_MODE === 'true') {
  // NO verifica firma Stripe — solo parsea JSON
  event = JSON.parse(rawBody.toString('utf8'));
} else {
  // Verifica firma Stripe (producción)
  event = stripe.webhooks.constructEvent(rawBody, sig, secret);
}
```

**En producción REAL:** `TEST_MODE` debe estar eliminado o `false` para que el webhook verifique la firma de Stripe correctamente.
