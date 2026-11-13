# Patch HomePage.tsx
1. Ajouter l'import : `import { ProductCarousel } from '@/components/ProductCarousel';`
2. Remplacer la section « La sélection du moment » (grille actuelle) par :
   `<ProductCarousel title="La sélection du moment" eyebrow="NOS COUPS DE CŒUR" products={featured} loading={loading} error={error} onRetry={refresh} />`
3. Remplacer la section « Les nouveautés » par :
   `<ProductCarousel title="Les nouveautés" eyebrow="JUSTE ARRIVÉS" products={newest} loading={loading} />`
4. Ajouter avant le footer, si des promos existent :
   `{promos.length > 0 && <ProductCarousel title="Offres en cours" eyebrow="PROMOTIONS" products={promos} loading={loading} />}`
   avec `const promos = products.filter(p => p.published && !p.archived && (p.promo_htg !== null || p.promo_usd !== null)).slice(0, 8);`
Note : la section « meilleures ventes » reste côté admin (order_items protégé par RLS staff).
