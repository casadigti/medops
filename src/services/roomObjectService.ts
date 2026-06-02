import { supabase } from '../lib/supabase';
import { getImpersonatedOrgId } from '../utils/impersonation';
import type { RoomObject, RoomObjectType } from '../types/domain';

export const roomObjectService = {

  async getAll(): Promise<RoomObject[]> {
    const orgOverride = getImpersonatedOrgId();
    let query = supabase.from('room_objects').select('*').order('created_at');
    if (orgOverride) query = (query as typeof query).eq('org_id', orgOverride);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },

  async create(input: {
    type: RoomObjectType;
    label?: string;
    position_x: number;
    position_y: number;
    width: number;
    height: number;
    color: string;
  }): Promise<RoomObject> {
    const { data, error } = await supabase
      .from('room_objects')
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updatePosition(id: string, x: number, y: number): Promise<void> {
    const { error } = await supabase
      .from('room_objects')
      .update({ position_x: x, position_y: y })
      .eq('id', id);
    if (error) throw error;
  },

  async updateLabel(id: string, label: string): Promise<void> {
    const { error } = await supabase
      .from('room_objects')
      .update({ label })
      .eq('id', id);
    if (error) throw error;
  },

  async updateSize(id: string, width: number, height: number): Promise<void> {
    const { error } = await supabase.from('room_objects').update({ width, height }).eq('id', id);
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('room_objects').delete().eq('id', id);
    if (error) throw error;
  },
};
