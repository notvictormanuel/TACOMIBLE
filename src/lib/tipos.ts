export type Rol = 'taquero' | 'tortillero' | 'auxiliar' | 'cajero'
export type Bloque = 'apertura' | 'servicio' | 'cierre'

export const ROLES: { id: Rol; nombre: string; descripcion: string }[] = [
  { id: 'taquero', nombre: 'Taquero', descripcion: 'Arma los tacos y cuida que las proteínas y salsas estén a punto.' },
  { id: 'tortillero', nombre: 'Tortillero', descripcion: 'Calienta las tortillas y maneja el horno y la parrilla.' },
  { id: 'auxiliar', nombre: 'Auxiliar', descripcion: 'Mantiene la cocina limpia, abastecida y en marcha.' },
  { id: 'cajero', nombre: 'Cajero', descripcion: 'Toma los pedidos, cobra y verifica que todo salga completo.' },
]

export const BLOQUES: { id: Bloque; nombre: string }[] = [
  { id: 'apertura', nombre: 'Apertura' },
  { id: 'servicio', nombre: 'Servicio' },
  { id: 'cierre', nombre: 'Cierre' },
]

export const nombreRol = (rol: Rol) => ROLES.find((r) => r.id === rol)!.nombre

export interface Perfil {
  admin: boolean
  nombre: string | null
  empleado_id: string | null
  hoy: string
}

export interface Empleado {
  id: string
  nombre: string
  activo: boolean
}

export interface Tarea {
  id: string
  rol: Rol
  bloque: Bloque
  texto: string
  orden: number
  creado_por: string
  creado_en: string
}

export interface Asignado {
  empleado_id: string
  nombre: string
}

export interface Asignacion {
  fecha: string
  roles: Partial<Record<Rol, Asignado | null>>
  definido_por: string
  definido_en: string
}

export interface Marca {
  id: string
  fecha: string
  empleado_id: string | null
  nombre: string
  tarea_id: string
  rol: Rol
  hora: string
}

/** Distribución que rige hoy. */
export interface Distribucion {
  estado: 'confirmada' | 'heredada' | 'vacia'
  asignacion: Asignacion | null
}
