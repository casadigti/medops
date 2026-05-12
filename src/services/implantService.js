import { supabase } from '../lib/supabase';
import { auditService } from './auditService';
import { getLocalDateString } from '../utils/dateUtils';

export const implantService = {
  async getAll() {
    const { data, error } = await supabase
      .from('implants')
      .select(`
        *,
        implant_lots (id, lot_number, expiration_date, current_quantity)
      `)
      .order('name');
    
    if (error) throw error;
    return data;
  },

  async create(implant) {
    const { data, error } = await supabase
      .from('implants')
      .insert(implant)
      .select()
      .single();
    
    if (error) throw error;
    await auditService.log('IMPLANT_CREATE', 'implants', data.id, implant);
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('implants')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    await auditService.log('IMPLANT_UPDATE', 'implants', id, updates);
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('implants')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    await auditService.log('IMPLANT_DELETE', 'implants', id, { note: 'Producto eliminado' });
    return true;
  },

  // Gestión de Lotes
  async addLot(lot) {
    const { data, error } = await supabase
      .from('implant_lots')
      .insert(lot)
      .select()
      .single();
    
    if (error) throw error;
    await auditService.log('LOT_ADD', 'implant_lots', data.id, lot);
    return data;
  },

  async updateLot(id, updates) {
    const { data, error } = await supabase
      .from('implant_lots')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async reportConsumption(consumptionData) {
    const { surgery_id, implant_lot_id, quantity_used, notes, auth_number } = consumptionData;

    // 1. Obtener el lote actual
    const { data: lot, error: lotError } = await supabase
      .from('implant_lots')
      .select('current_quantity')
      .eq('id', implant_lot_id)
      .single();
    
    if (lotError) throw lotError;
    if (lot.current_quantity < quantity_used) throw new Error('Stock insuficiente en el lote seleccionado');

    // 2. Insertar consumo
    const { error: consumptionError } = await supabase
      .from('surgery_consumption')
      .insert({
        surgery_id,
        implant_lot_id,
        quantity_used,
        notes,
        auth_number
      });
    
    if (consumptionError) throw consumptionError;

    // 3. Actualizar stock del lote
    const { error: updateError } = await supabase
      .from('implant_lots')
      .update({ current_quantity: lot.current_quantity - quantity_used })
      .eq('id', implant_lot_id);
    
    if (updateError) throw updateError;

    await auditService.log('CONSUMPTION_REPORT', 'surgery_consumption', surgery_id, consumptionData);
    return true;
  },

  async getConsumptionBySurgery(surgeryId) {
    const { data, error } = await supabase
      .from('surgery_consumption')
      .select(`
        *,
        implant_lots (
          lot_number,
          implants (name, sku, unit_cost)
        )
      `)
      .eq('surgery_id', surgeryId);
    
    if (error) throw error;
    return data;
  },

  async bulkCreateImplants(implants) {
    const { data, error } = await supabase
      .from('implants')
      .insert(implants)
      .select();
    
    if (error) throw error;
    return data;
  },

  async getConsumptionReport(startDate, endDate) {
    let query = supabase
      .from('surgery_consumption')
      .select(`
        *,
        implant_lots (
          id,
          lot_number,
          implants (id, name, sku, category, unit_cost, selling_price)
        ),
        surgeries!inner (
          id,
          patient_name,
          surgery_date,
          status,
          surgeon_id,
          hospital_id,
          surgeon: surgeons (full_name),
          hospital: hospitals (name)
        )
      `)
      .eq('surgeries.status', 'Completada')
      .order('used_at', { ascending: false });

    if (startDate) query = query.gte('used_at', startDate);
    if (endDate) query = query.lte('used_at', endDate);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getExpiringLots() {
    const today = getLocalDateString();
    const { data, error } = await supabase
      .from('implant_lots')
      .select(`
        *,
        implants (name, sku)
      `)
      .lte('expiration_date', getLocalDateString(new Date(Date.now() + 90 * 86400000)))
      .gt('current_quantity', 0)
      .order('expiration_date');

    if (error) throw error;
    return data;
  },

  async getLowStockImplants() {
    // 1. Obtener todos los implantes con sus lotes
    const { data, error } = await supabase
      .from('implants')
      .select(`
        *,
        implant_lots (current_quantity)
      `);
    
    if (error) throw error;

    // 2. Filtrar manualmente los que tienen stock total <= min_stock
    return data.filter(imp => {
      const total = (imp.implant_lots || []).reduce((acc, lot) => acc + lot.current_quantity, 0);
      return total <= (imp.min_stock || 0);
    });
  },

  async getAllLotsDetailed() {
    const { data, error } = await supabase
      .from('implant_lots')
      .select(`
        *,
        implants (id, name, sku, category, unit_cost, selling_price)
      `);
    
    if (error) throw error;
    return data;
  }
};
