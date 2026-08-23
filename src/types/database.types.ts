// Tipos escritos a mano reflejando supabase/migrations/20260821170000_init_schema.sql
// Cuando el proyecto quede enlazado con `supabase link`, se puede regenerar con:
//   npx supabase gen types typescript --linked > src/types/database.types.ts
//
// Nota: las Row/Insert/Update de cada tabla van inline (no vía `interface` nombrada)
// a propósito — postgrest-js resuelve mal el tipo de retorno cuando `Row` referencia
// una interface separada en vez de un literal, y termina infiriendo `never`.

export interface Database {
  public: {
    Tables: {
      usuarios: {
        Row: {
          id: string;
          nombre: string;
          rol: "dueno" | "encargado" | "cajero";
          activo: boolean;
          creado_en: string;
        };
        Insert: {
          id: string;
          nombre: string;
          rol: "dueno" | "encargado" | "cajero";
          activo?: boolean;
          creado_en?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          rol?: "dueno" | "encargado" | "cajero";
          activo?: boolean;
          creado_en?: string;
        };
        Relationships: [];
      };
      turnos: {
        Row: {
          id: string;
          usuario_apertura_id: string;
          usuario_cierre_id: string | null;
          efectivo_inicial: number;
          efectivo_esperado: number | null;
          efectivo_contado: number | null;
          diferencia: number | null;
          alerta_diferencia: boolean;
          estado: "abierto" | "cerrado";
          hora_apertura: string;
          hora_cierre: string | null;
        };
        Insert: {
          id?: string;
          usuario_apertura_id: string;
          usuario_cierre_id?: string | null;
          efectivo_inicial?: number;
          efectivo_esperado?: number | null;
          efectivo_contado?: number | null;
          diferencia?: number | null;
          estado?: "abierto" | "cerrado";
          hora_apertura?: string;
          hora_cierre?: string | null;
        };
        Update: {
          id?: string;
          usuario_apertura_id?: string;
          usuario_cierre_id?: string | null;
          efectivo_inicial?: number;
          efectivo_esperado?: number | null;
          efectivo_contado?: number | null;
          diferencia?: number | null;
          estado?: "abierto" | "cerrado";
          hora_apertura?: string;
          hora_cierre?: string | null;
        };
        Relationships: [];
      };
      servicios_catalogo: {
        Row: {
          id: string;
          nombre: string;
          precio: number;
          tiempo_estimado_min: number | null;
          activo: boolean;
        };
        Insert: {
          id?: string;
          nombre: string;
          precio: number;
          tiempo_estimado_min?: number | null;
          activo?: boolean;
        };
        Update: {
          id?: string;
          nombre?: string;
          precio?: number;
          tiempo_estimado_min?: number | null;
          activo?: boolean;
        };
        Relationships: [];
      };
      clientes: {
        Row: {
          id: string;
          nombre: string;
          telefono: string | null;
          creado_en: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          telefono?: string | null;
          creado_en?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          telefono?: string | null;
          creado_en?: string;
        };
        Relationships: [];
      };
      vehiculos: {
        Row: {
          id: string;
          cliente_id: string;
          placas: string | null;
          tipo_vehiculo: string | null;
        };
        Insert: {
          id?: string;
          cliente_id: string;
          placas?: string | null;
          tipo_vehiculo?: string | null;
        };
        Update: {
          id?: string;
          cliente_id?: string;
          placas?: string | null;
          tipo_vehiculo?: string | null;
        };
        Relationships: [];
      };
      tickets: {
        Row: {
          id: string;
          vehiculo_id: string | null;
          cliente_id: string | null;
          servicio_id: string;
          empleado_id: string;
          turno_id: string;
          lavada_gratis: boolean;
          prioridad: boolean;
          descuento_monto: number;
          descuento_autorizado_por: string | null;
          estado: "en_espera" | "en_proceso" | "terminado" | "entregado";
          hora_entrada: string;
          hora_salida: string | null;
          creado_por: string;
        };
        Insert: {
          id?: string;
          vehiculo_id?: string | null;
          cliente_id?: string | null;
          servicio_id: string;
          empleado_id: string;
          turno_id: string;
          lavada_gratis?: boolean;
          prioridad?: boolean;
          descuento_monto?: number;
          descuento_autorizado_por?: string | null;
          estado?: "en_espera" | "en_proceso" | "terminado" | "entregado";
          hora_entrada?: string;
          hora_salida?: string | null;
          creado_por?: string;
        };
        Update: {
          id?: string;
          vehiculo_id?: string | null;
          cliente_id?: string | null;
          servicio_id?: string;
          empleado_id?: string;
          turno_id?: string;
          lavada_gratis?: boolean;
          prioridad?: boolean;
          descuento_monto?: number;
          descuento_autorizado_por?: string | null;
          estado?: "en_espera" | "en_proceso" | "terminado" | "entregado";
          hora_entrada?: string;
          hora_salida?: string | null;
          creado_por?: string;
        };
        Relationships: [];
      };
      pagos: {
        Row: {
          id: string;
          ticket_id: string;
          metodo: "efectivo" | "tarjeta" | "transferencia" | "membresia";
          monto: number;
          turno_id: string;
          usuario_id: string;
          creado_en: string;
        };
        Insert: {
          id?: string;
          ticket_id: string;
          metodo: "efectivo" | "tarjeta" | "transferencia" | "membresia";
          monto: number;
          turno_id: string;
          usuario_id?: string;
          creado_en?: string;
        };
        Update: {
          id?: string;
          ticket_id?: string;
          metodo?: "efectivo" | "tarjeta" | "transferencia" | "membresia";
          monto?: number;
          turno_id?: string;
          usuario_id?: string;
          creado_en?: string;
        };
        Relationships: [];
      };
      inventario: {
        Row: {
          id: string;
          nombre_insumo: string;
          stock_actual: number;
          costo_unitario: number;
        };
        Insert: {
          id?: string;
          nombre_insumo: string;
          stock_actual?: number;
          costo_unitario?: number;
        };
        Update: {
          id?: string;
          nombre_insumo?: string;
          stock_actual?: number;
          costo_unitario?: number;
        };
        Relationships: [];
      };
      consumo_inventario: {
        Row: {
          id: string;
          servicio_id: string;
          insumo_id: string;
          cantidad_estimada: number;
        };
        Insert: {
          id?: string;
          servicio_id: string;
          insumo_id: string;
          cantidad_estimada: number;
        };
        Update: {
          id?: string;
          servicio_id?: string;
          insumo_id?: string;
          cantidad_estimada?: number;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      rol_usuario: "dueno" | "encargado" | "cajero";
      turno_estado: "abierto" | "cerrado";
      ticket_estado: "en_espera" | "en_proceso" | "terminado" | "entregado";
      pago_metodo: "efectivo" | "tarjeta" | "transferencia" | "membresia";
    };
    CompositeTypes: Record<string, never>;
  };
}

// Alias de conveniencia derivados de Database (no al revés — ver nota arriba).
export type RolUsuario = Database["public"]["Enums"]["rol_usuario"];
export type TurnoEstado = Database["public"]["Enums"]["turno_estado"];
export type TicketEstado = Database["public"]["Enums"]["ticket_estado"];
export type PagoMetodo = Database["public"]["Enums"]["pago_metodo"];

export type Usuario = Database["public"]["Tables"]["usuarios"]["Row"];
export type Turno = Database["public"]["Tables"]["turnos"]["Row"];
export type ServicioCatalogo = Database["public"]["Tables"]["servicios_catalogo"]["Row"];
export type Cliente = Database["public"]["Tables"]["clientes"]["Row"];
export type Vehiculo = Database["public"]["Tables"]["vehiculos"]["Row"];
export type Ticket = Database["public"]["Tables"]["tickets"]["Row"];
export type Pago = Database["public"]["Tables"]["pagos"]["Row"];
export type Inventario = Database["public"]["Tables"]["inventario"]["Row"];
export type ConsumoInventario = Database["public"]["Tables"]["consumo_inventario"]["Row"];
