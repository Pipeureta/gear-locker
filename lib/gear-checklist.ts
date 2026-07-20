'use client';

// Checklist de equipo personal — fuente única: la tabla gear_checklist_items
// en Supabase. Comandancia la administra (agregar/quitar); todos la leen
// para marcar qué tienen en Mi perfil o revisarla en la ficha de un
// integrante. Antes vivía duplicada en localStorage y en esta tabla, por
// eso el perfil y comandancia se desincronizaban.

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useGearChecklist() {
  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from('gear_checklist_items').select('name').order('name');
    setItems((data ?? []).map((row) => row.name as string));
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { items, loading, reload };
}
