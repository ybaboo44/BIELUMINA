import { useState } from 'react';
import type { Product } from '@/lib/types';
import { imageUrl } from '@/lib/types';

export function ProductGallery({ product }: { product: Product }) {
  const images = (product.product_images || []).slice().sort((a, b) => a.position - b.position);
  const fallback = [{ storage_path: product.image_path, alt_text: product.name, is_primary: true }] as const;
  const list = images.length ? images : (fallback as unknown as typeof images);
  const initial = list.findIndex(i => i.is_primary);
  const [current, setCurrent] = useState(initial >= 0 ? initial : 0);
  const active = list[Math.min(current, list.length - 1)];
  return (
    <div className="gallery">
      <div className="gallery-main">
        <img src={imageUrl(active.storage_path)} alt={active.alt_text || product.name} />
        {product.is_new && <span className="badge-new">Nouveau</span>}
      </div>
      {list.length > 1 && (
        <div className="gallery-thumbs" role="tablist" aria-label="Photos du produit">
          {list.map((img, i) => (
            <button key={String(img.storage_path) + i} role="tab" aria-selected={i === current}
              className={`gallery-thumb ${i === current ? 'active' : ''}`}
              onClick={() => setCurrent(i)}>
              <img src={imageUrl(img.storage_path)} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
