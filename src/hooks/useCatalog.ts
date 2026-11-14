import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Category, Product, ShippingZone } from '@/lib/types';

export function useCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    const [productResult, categoryResult] = await Promise.all([
      supabase.from('products').select('*,product_variants(*),product_images(*)').order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('position'),
    ]);
    if (productResult.error || categoryResult.error) setError('Le catalogue est momentanément indisponible. Veuillez réessayer.');
    setProducts((productResult.data || []) as Product[]);
    setCategories((categoryResult.data || []) as Category[]);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  return { products, categories, loading, error, refresh };
}

export function useShippingZones() {
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: queryError } = await supabase.from('shipping_zones').select('*').order('fee_htg');
      if (queryError) throw queryError;
      setZones((data || []) as ShippingZone[]);
    } catch (queryError) {
      setError(queryError instanceof Error ? queryError.message : 'Impossible de charger les zones de livraison.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { zones, loading, error, refresh };
}
