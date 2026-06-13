# Football Analytics - Plataforma de Análisis Deportivo ⚽

MVP de una plataforma web de análisis deportivo para fútbol que consume la API de Sportmonks Football API 3.0.

## Stack Tecnológico

- **Next.js 14** con App Router
- **TypeScript** 
- **Tailwind CSS** para estilos
- **API Routes** internas (token seguro en servidor)
- **Sportmonks Football API 3.0** como fuente de datos


## Estructura del Proyecto

```
app/
├── page.tsx                  # Dashboard principal
├── matches/page.tsx          # Listado de partidos por fecha
├── match/[id]/page.tsx       # Detalle de un partido
├── api/
│   ├── fixtures/route.ts     # API interna: consultar fixtures
│   ├── fixtures/[id]/route.ts # API interna: fixture por ID
│   └── prediction/route.ts   # API interna: generar predicción
components/
├── MatchCard.tsx             # Tarjeta de partido
├── MatchFilters.tsx          # Filtros de fecha
├── PredictionPanel.tsx       # Panel de predicción
└── StatsTable.tsx            # Tabla de estadísticas
lib/
├── sportmonks.ts             # Cliente de Sportmonks API
└── predictor.ts              # Motor de predicción heurístico
types/
└── sportmonks.ts             # TypeScript types
```

## Funcionalidades

- ✅ Dashboard con overview de la plataforma
- ✅ Consulta de partidos por fecha
- ✅ Tarjetas de partido con equipos, liga, estado y score
- ✅ Detalle de partido con estadísticas
- ✅ Panel de predicción con probabilidades
- ✅ Motor de predicción heurístico básico
- ✅ Estados de loading, error y vacío
- ✅ Token de API nunca expuesto al frontend

## Roadmap (Futuro)

- 🔲 Autenticación de usuarios (NextAuth.js)
- 🔲 Base de datos PostgreSQL (Prisma ORM)
- 🔲 Historial de predicciones
- 🔲 Modelo de IA/ML para predicciones
- 🔲 Planes de pago (Stripe)
- 🔲 Dashboard comercial
- 🔲 Head-to-head histórico
- 🔲 Datos avanzados: xG, corners, tarjetas, odds, lesiones
- 🔲 WebSocket para partidos en vivo

## Despliegue

Compatible con Vercel, Netlify, o cualquier plataforma que soporte Next.js.

```bash
npm run build
npm start
```
