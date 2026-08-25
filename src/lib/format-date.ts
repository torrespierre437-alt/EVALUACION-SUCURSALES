const MX_TIME_ZONE = "America/Mexico_City";

/** Formatea un instante real (timestamp) en la hora local de México, sin importar el huso del servidor. */
export function formatInstantMx(value: string | Date, options?: Intl.DateTimeFormatOptions) {
  return new Date(value).toLocaleString("es-MX", { timeZone: MX_TIME_ZONE, ...options });
}

export function formatInstantDateMx(value: string | Date, options?: Intl.DateTimeFormatOptions) {
  return new Date(value).toLocaleDateString("es-MX", { timeZone: MX_TIME_ZONE, ...options });
}

/**
 * Formatea una fecha "de calendario" (sin hora real, ej. due_date, construida como
 * medianoche UTC del día que representa) — usar timeZone UTC evita que se recorra
 * un día al renderizarse fuera del huso de México.
 */
export function formatCalendarDate(value: string | Date, options?: Intl.DateTimeFormatOptions) {
  return new Date(value).toLocaleDateString("es-MX", { timeZone: "UTC", ...options });
}
