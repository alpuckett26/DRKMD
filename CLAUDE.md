# DRKMD

Window Mode convenience-store ordering app. Customers browse a store's menu (typically at night via a walk-up window), place and pay for orders, and staff fulfill them.

## Stack
- Next.js 14 App Router + TypeScript
- Prisma + Postgres (Vercel Postgres)
- Tailwind, brand color in `tailwind.config.ts`
- Square for payments (`src/lib/square.ts`)
- Open Food Facts (OFF) for product images (`src/lib/productImage.ts`, `/api/admin/products/image-lookup`)

## Routes at a glance
- `/platform` — multi-store operator dashboard
- `/admin/[storeId]/*` — store admin (setup, products, import, orders, scan, staff)
- `/staff/[storeId]/*` — in-store fulfillment (picking, handoff)
- `/store/[storeId]/*` — customer storefront (hero banner, cart, checkout)
- `/fulfillment/[storeId]` — kitchen/pickup view
- `/api/*` — REST endpoints grouped by role

## Data model (Prisma)
- `Store` — includes `windowModeEnabled`, `windowModeStart/End`, `logoUrl` (hero banner)
- `Product` — `storeId`, `name`, `category`, `price` (cents), `nighttimeAvailable`, `restrictedFlag` (21+), `imageUrl`, `active`
- `Order`, `OrderItem`, `Staff`, `StaffSession`

## Catalog / Import
- `src/lib/catalog.ts` exports `PRESET_CATALOG` and `CatalogItem` — 391 SKUs including **300 age-restricted** (cigarettes, cigars, smokeless, vape, nicotine pouches, accessories).
- `src/app/admin/[storeId]/import/page.tsx` consumes `PRESET_CATALOG` + supports CSV upload.
- `prisma/seed.ts` seeds `store_demo` with a separate curated list (395 products). Do not confuse the two.
- When adding items, match existing categories so OFF image lookup works well. Prices are strings in dollars in the catalog; cents in the DB.

## Pricing / fees
- Prices stored as integer cents on `Product`.
- Convenience fee: 12.5% (see `cfc1746` commit and server-side calc).
- Dedup threshold for scanned/imported products: 85%.

## Restricted items
- `restrictedFlag: true` shows a "21+" badge and requires age check at checkout.
- `src/lib/restrictedKeywords.ts` auto-flags by name keywords on save.

## Styling
- Dark theme, `bg-gray-950` base, `text-brand` for accents.
- `card`, `btn-primary`, `input`, `badge` are Tailwind component classes in `src/app/globals.css`.
- Customer store page uses a DoorDash-style hero banner (`store.logoUrl`) + 4:3 product card images.

## Gotchas
- Do NOT amend commits on pushed branches.
- Big single-file edits can time out — chunk into multiple commits.
- Tobacco/vape are **restricted**; beer/wine/spirits live in their own categories but are also restricted.
- `prisma/seed.ts` uses `upsert` on `(storeId, name)` — don't change that unique key without a migration.

## Dev loop
- `npm run dev` — Next.js dev server
- `npx prisma migrate dev` — apply migrations
- `npx prisma db seed` — run `prisma/seed.ts`
- `npx tsc --noEmit` — typecheck (requires `npm install` first)

## Branching
- Active session branch: `claude/general-session-2rbGR`
- Commit style: short imperative subject, optional body explaining the why.
