# Patch ProductPage.tsx
1. Import : `import { ProductGallery } from '@/components/ProductGallery';`
2. Remplacer le bloc `<div className="detail-image">…</div>` par `<ProductGallery product={product} />`.
3. Dans src/hooks/useCatalog.ts, passer la sélection produit à :
   `supabase.from('products').select('*,product_variants(*),product_images(*)')`
