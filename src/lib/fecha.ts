export const ZONA = 'America/Bogota'

/** Fecha de hoy en Bogotá como 'AAAA-MM-DD'. */
export function hoyBogota(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

// Las fechas 'AAAA-MM-DD' se interpretan al mediodía UTC para que no se corran de día.
const aDate = (iso: string) => new Date(`${iso}T12:00:00Z`)

export function restarDias(iso: string, dias: number): string {
  const d = aDate(iso)
  d.setUTCDate(d.getUTCDate() - dias)
  return d.toISOString().slice(0, 10)
}

const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

/** "Jueves, 9 de octubre de 2026" */
export function fechaLarga(iso: string): string {
  return mayuscula(
    new Intl.DateTimeFormat('es-CO', {
      timeZone: 'UTC',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(aDate(iso)),
  )
}

/** "jueves 9 de octubre" */
export function fechaMedia(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
    .format(aDate(iso))
    .replace(',', '')
}

/** "9 de octubre" */
export function fechaCorta(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', day: 'numeric', month: 'long' }).format(aDate(iso))
}

/** Hora en Bogotá: "7:42 a. m." */
export function hora(ts: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: ZONA,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(ts))
}

/** Fecha de un timestamp en Bogotá como 'AAAA-MM-DD'. */
export function fechaDe(ts: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ts))
}
