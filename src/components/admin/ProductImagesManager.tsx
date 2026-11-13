import { useRef, useState } from 'react';
import { ImagePlus, Star, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { imageUrl, type Product } from '@/lib/types';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;

export function ProductImagesManager({ product, onChanged }: { product: Product; onChanged: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const images = (product.product_images || []).slice().sort((a, b) => a.position - b.position);

  const upload = async (files: FileList) => {
    for (const file of Array.from(files)) {
      if (!ACCEPTED.includes(file.type)) { toast.error(`${file.name} : format non accepté (JPEG, PNG, WebP).`); continue; }
      if (file.size > MAX_SIZE) { toast.error(`${file.name} : dépasse 5 Mo.`); continue; }
      const path = `${product.id}/${crypto.randomUUID()}.${file.name.split('.').pop()}`;
      setProgress(0);
      const { error } = await supabase.storage.from('product-images').upload(path, file, {
        cacheControl: '3600', upsert: false,
      });
      if (error) { toast.error(`Échec de l'envoi : ${error.message}`); setProgress(null); return; }
      const { error: dbError } = await supabase.from('product_images').insert({
        product_id: product.id, storage_path: path, alt_text: product.name,
        is_primary: images.length === 0, position: images.length,
      });
      if (dbError) { await supabase.storage.from('product-images').remove([path]); toast.error('Enregistrement impossible.'); setProgress(null); return; }
      setProgress(null); toast.success(`${file.name} ajouté`);
    }
    onChanged();
  };

  const setPrimary = async (id: string) => {
    const { error } = await supabase.from('product_images').update({ is_primary: true }).eq('id', id);
    if (error) toast.error('Permission catalogue requise.'); else onChanged();
  };
  const remove = async (id: string, path: string) => {
    const { error } = await supabase.from('product_images').delete().eq('id', id);
    if (!error) await supabase.storage.from('product-images').remove([path]);
    if (error) toast.error('Suppression refusée.'); else { toast.success('Image supprimée'); onChanged(); }
  };
  const move = async (id: string, dir: -1 | 1) => {
    const idx = images.findIndex(i => i.id === id);
    const target = images[idx + dir];
    if (!target) return;
    await supabase.from('product_images').update({ position: target.position }).eq('id', id);
    await supabase.from('product_images').update({ position: images[idx].position }).eq('id', target.id);
    onChanged();
  };

  return (
    <div className="images-manager">
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
        onChange={e => e.target.files && upload(e.target.files)} />
      <button className="button button-dark" onClick={() => inputRef.current?.click()} disabled={progress !== null}>
        <ImagePlus size={16} /> {progress !== null ? 'Envoi en cours…' : 'Ajouter des photos'}
      </button>
      <div className="images-grid">
        {images.map((img, i) => (
          <figure key={img.id} className={img.is_primary ? 'primary' : ''}>
            <img src={imageUrl(img.storage_path)} alt={img.alt_text} />
            <figcaption>
              <button onClick={() => setPrimary(img.id)} disabled={img.is_primary} title="Image principale" aria-label="Définir comme image principale"><Star /></button>
              <button onClick={() => move(img.id, -1)} disabled={i === 0} aria-label="Monter"><ArrowUp /></button>
              <button onClick={() => move(img.id, 1)} disabled={i === images.length - 1} aria-label="Descendre"><ArrowDown /></button>
              <button onClick={() => remove(img.id, img.storage_path)} aria-label="Supprimer"><Trash2 /></button>
            </figcaption>
            {img.is_primary && <span className="primary-tag">Principale</span>}
          </figure>
        ))}
      </div>
    </div>
  );
}
