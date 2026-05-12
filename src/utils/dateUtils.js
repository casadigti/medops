/**
 * Formatea una fecha a string YYYY-MM-DD usando la hora local del computador.
 * @param {Date|string} date - Objeto Date o string de fecha.
 * @returns {string} - Fecha formateada YYYY-MM-DD.
 */
export const getLocalDateString = (date = new Date()) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/**
 * Formatea una fecha para mostrar en la interfaz (DD/MM/YYYY).
 */
export const formatDisplayDate = (date) => {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  
  return d.toLocaleDateString('es-DO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};
