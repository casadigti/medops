import { supabase } from '../lib/supabase';

// Tables to include in backup — ordered by foreign-key dependency for import.
// Independent first, junction/dependent last.
const TABLES = [
  'surgeons',
  'hospitals',
  'ars',
  'procedure_types',
  'implants',
  'trays',
  'surgeries',
  'implant_lots',
  'surgery_trays',
  'surgery_consumption',
] as const;

type BackupTable = (typeof TABLES)[number];

// surgery_trays uses a composite PK (surgery_id + tray_id), not an `id` column.
const CONFLICT_COL: Partial<Record<BackupTable, string>> = {
  surgery_trays: 'surgery_id,tray_id',
};

export interface BackupFile {
  version: '1.0';
  exported_at: string;
  tables: Partial<Record<BackupTable, unknown[]>>;
}

export const backupService = {
  /** Fetches all org data via RLS-filtered queries and triggers a JSON download. */
  async exportBackup(): Promise<void> {
    const tables: Partial<Record<BackupTable, unknown[]>> = {};

    for (const table of TABLES) {
      const { data, error } = await supabase.from(table).select('*');
      if (error) throw new Error(`Error exportando "${table}": ${error.message}`);
      tables[table] = data ?? [];
    }

    const backup: BackupFile = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      tables,
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medops-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /** Parses a backup JSON file and upserts all rows into the DB. */
  async importBackup(file: File): Promise<{ imported: number; errors: string[] }> {
    const text = await file.text();
    let backup: BackupFile;
    try {
      backup = JSON.parse(text);
    } catch {
      throw new Error('El archivo no es un JSON válido');
    }

    if (backup.version !== '1.0' || !backup.tables) {
      throw new Error('Formato de backup no reconocido. Se esperaba versión 1.0');
    }

    const errors: string[] = [];
    let imported = 0;

    for (const table of TABLES) {
      const rows = backup.tables[table];
      if (!rows || rows.length === 0) continue;

      // Strip org_id and created_at — the DB DEFAULT / RLS sets them correctly.
      const clean = rows.map((r: any) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { org_id, created_at, ...rest } = r;
        return rest;
      });

      const conflictCol = CONFLICT_COL[table] ?? 'id';

      const { error } = await supabase
        .from(table)
        .upsert(clean as Record<string, unknown>[], { onConflict: conflictCol });

      if (error) {
        errors.push(`${table}: ${error.message}`);
      } else {
        imported += clean.length;
      }
    }

    return { imported, errors };
  },

  /** Returns the total row count per table (for the export preview). */
  async getCounts(): Promise<Partial<Record<BackupTable, number>>> {
    const counts: Partial<Record<BackupTable, number>> = {};
    await Promise.all(
      TABLES.map(async (table) => {
        const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
        counts[table] = count ?? 0;
      })
    );
    return counts;
  },
};
