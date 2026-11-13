import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import useEmblaCarousel from 'embla-carousel-react';
import type { Product } from '@/lib/types';
import { ProductCard } from '@/components/ProductCard';

type Props = {
  title: string;
  eyebrow?: string;
  products: Product[];
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
};

// Carrousel de produits (embla-carousel-react, déjà présent dans package.json).
// Flèches clavier + boutons, swipe tactile, indicateurs, reduced-motion respecté.
export function ProductCarousel({ title, eyebrow, products, loading, error, onRetry }: Props) {
  const reduceMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, skipSnaps: false, duration: reduceMotion ? 0 : 20 });
  const [selected, setSelected] = useState(0);
  const [count, setCount] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const update = useCallback(() => {
    if (!emblaApi) return;
    setSelected(emblaApi.selectedScrollSnap());
    setCount(emblaApi.scrollSnapList().length);
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    update();
    emblaApi.on('select', update);
    emblaApi.on('reInit', update);
    return () => { emblaApi.off('select', update); emblaApi.off('reInit', update); };
  }, [emblaApi, update]);

  useEffect(() => { emblaApi?.reInit(); }, [products.length, emblaApi]);

  const scrollDir = useCallback((dir: 1 | -1) => {
    if (!emblaApi) return;
    if (dir === 1) emblaApi.scrollNext(); else emblaApi.scrollPrev();
  }, [emblaApi]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); scrollDir(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); scrollDir(-1); }
    };
    node.addEventListener('keydown', onKey);
    return () => node.removeEventListener('keydown', onKey);
  }, [scrollDir]);

  return (
    <section className="section-shell products-section" aria-label={title}>
      <div className="section-heading">
        <div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>
        <div className="carousel-controls">
          <button className="carousel-arrow" onClick={() => scrollDir(-1)} disabled={selected === 0}
            aria-label="Produits précédents"><ArrowLeft size={18} /></button>
          <button className="carousel-arrow" onClick={() => scrollDir(1)} disabled={selected >= count - 1}
            aria-label="Produits suivants"><ArrowRight size={18} /></button>
        </div>
      </div>
      {loading ? (
        <div className="product-grid">{[1, 2, 3, 4].map(i => <div className="product-skeleton" key={i} />)}</div>
      ) : error ? (
        <div className="error-state">{error}{onRetry && <button className="text-link" onClick={onRetry}>Réessayer</button>}</div>
      ) : products.length === 0 ? (
        <div className="error-state">Aucun produit dans cette sélection pour le moment.</div>
      ) : (
        <div className="embla" ref={rootRef} tabIndex={0}>
          <div className="embla-viewport" ref={emblaRef}>
            <div className="embla-container">
              {products.map(product => (
                <div className="embla-slide" key={product.id}><ProductCard product={product} /></div>
              ))}
            </div>
          </div>
          {count > 1 && (
            <div className="embla-dots">
              {Array.from({ length: count }).map((_, i) => (
                <button key={i} className={`embla-dot ${i === selected ? 'active' : ''}`}
                  onClick={() => emblaApi?.scrollTo(i)}
                  aria-label={`Aller au groupe ${i + 1}`} aria-current={i === selected} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
