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
          puede_editar_tickets: boolean;
          puede_editar_turnos: boolean;
          puede_eliminar_turnos: boolean;
          creado_en: string;
        };
        Insert: {
          id: string;
          nombre: string;
          rol: "dueno" | "encargado" | "cajero";
          activo?: boolean;
          puede_editar_tickets?: boolean;
          puede_editar_turnos?: boolean;
          puede_eliminar_turnos?: boolean;
          creado_en?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          rol?: "dueno" | "encargado" | "cajero";
          activo?: boolean;
          puede_editar_tickets?: boolean;
          puede_editar_turnos?: boolean;
          puede_eliminar_turnos?: boolean;
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
          descripcion: string | null;
          caracteristicas: string[];
          orden: number;
          destacado: boolean;
          tiempo_estimado_min: number | null;
          activo: boolean;
        };
        Insert: {
          id?: string;
          nombre: string;
          descripcion?: string | null;
          caracteristicas?: string[];
          orden?: number;
          destacado?: boolean;
          tiempo_estimado_min?: number | null;
          activo?: boolean;
        };
        Update: {
          id?: string;
          nombre?: string;
          descripcion?: string | null;
          caracteristicas?: string[];
          orden?: number;
          destacado?: boolean;
          tiempo_estimado_min?: number | null;
          activo?: boolean;
        };
        Relationships: [];
      };
      servicios_precios: {
        Row: {
          id: string;
          servicio_id: string;
          tamano_vehiculo: "automovil" | "camioneta_chica" | "camioneta_grande" | "camioneta_extra_grande" | "moto_chica" | "moto_grande";
          precio: number;
        };
        Insert: {
          id?: string;
          servicio_id: string;
          tamano_vehiculo: "automovil" | "camioneta_chica" | "camioneta_grande" | "camioneta_extra_grande" | "moto_chica" | "moto_grande";
          precio: number;
        };
        Update: {
          id?: string;
          servicio_id?: string;
          tamano_vehiculo?: "automovil" | "camioneta_chica" | "camioneta_grande" | "camioneta_extra_grande" | "moto_chica" | "moto_grande";
          precio?: number;
        };
        Relationships: [];
      };
      extras_catalogo: {
        Row: {
          id: string;
          nombre: string;
          precio: number;
          orden: number;
          activo: boolean;
          creado_en: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          precio: number;
          orden?: number;
          activo?: boolean;
          creado_en?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          precio?: number;
          orden?: number;
          activo?: boolean;
          creado_en?: string;
        };
        Relationships: [];
      };
      ticket_extras: {
        Row: {
          id: string;
          ticket_id: string;
          extra_id: string;
          nombre: string;
          precio: number;
          creado_en: string;
        };
        Insert: {
          id?: string;
          ticket_id: string;
          extra_id: string;
          nombre: string;
          precio: number;
          creado_en?: string;
        };
        Update: {
          id?: string;
          ticket_id?: string;
          extra_id?: string;
          nombre?: string;
          precio?: number;
          creado_en?: string;
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
      // No es una tabla real sino una vista (ver migración
      // 20260831010000_usuarios_con_correo.sql), pero se declara aquí junto
      // con las demás tablas — con tipos inline, no vía interface aparte —
      // porque postgrest-js infiere mal el tipo de retorno y todo el árbol
      // de `.from(...)` de la app termina en `never` si esto se mete bajo
      // la clave `Views` en vez de `Tables` (bug ya visto una vez en este
      // archivo, ver nota arriba). Solo se usa para SELECT.
      usuarios_con_correo: {
        Row: {
          id: string;
          nombre: string;
          rol: "dueno" | "encargado" | "cajero";
          activo: boolean;
          puede_editar_tickets: boolean;
          creado_en: string;
          email: string | null;
          puede_editar_turnos: boolean;
          puede_eliminar_turnos: boolean;
        };
        Insert: {
          id?: string;
          nombre?: string;
          rol?: "dueno" | "encargado" | "cajero";
          activo?: boolean;
          puede_editar_tickets?: boolean;
          creado_en?: string;
          email?: string | null;
          puede_editar_turnos?: boolean;
          puede_eliminar_turnos?: boolean;
        };
        Update: {
          id?: string;
          nombre?: string;
          rol?: "dueno" | "encargado" | "cajero";
          activo?: boolean;
          puede_editar_tickets?: boolean;
          creado_en?: string;
          email?: string | null;
          puede_editar_turnos?: boolean;
          puede_eliminar_turnos?: boolean;
        };
        Relationships: [];
      };
      lavadores: {
        Row: {
          id: string;
          nombre: string;
          activo: boolean;
          creado_en: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          activo?: boolean;
          creado_en?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          activo?: boolean;
          creado_en?: string;
        };
        Relationships: [];
      };
      configuracion_app: {
        Row: {
          id: boolean;
          nav_dashboard: string;
          nav_tickets: string;
          nav_servicios: string;
          nav_lavadores: string;
          nav_turnos: string;
          nav_clientes: string;
          nav_inventario: string;
          nav_reportes: string;
          nav_gastos: string;
          emoji_saludo: string;
          emoji_lavador: string;
          emoji_automovil: string;
          emoji_camioneta_chica: string;
          emoji_camioneta_grande: string;
          emoji_camioneta_extra_grande: string;
          emoji_moto_chica: string;
          emoji_moto_grande: string;
          color_primario: string;
          color_accent: string;
          color_success: string;
          color_warning: string;
          semaforo_alerta_min: number;
          semaforo_critico_min: number;
        };
        Insert: {
          id?: boolean;
          nav_dashboard?: string;
          nav_tickets?: string;
          nav_servicios?: string;
          nav_lavadores?: string;
          nav_turnos?: string;
          nav_clientes?: string;
          nav_inventario?: string;
          nav_reportes?: string;
          nav_gastos?: string;
          emoji_saludo?: string;
          emoji_lavador?: string;
          emoji_automovil?: string;
          emoji_camioneta_chica?: string;
          emoji_camioneta_grande?: string;
          emoji_camioneta_extra_grande?: string;
          emoji_moto_chica?: string;
          emoji_moto_grande?: string;
          color_primario?: string;
          color_accent?: string;
          color_success?: string;
          color_warning?: string;
          semaforo_alerta_min?: number;
          semaforo_critico_min?: number;
        };
        Update: {
          id?: boolean;
          nav_dashboard?: string;
          nav_tickets?: string;
          nav_servicios?: string;
          nav_lavadores?: string;
          nav_turnos?: string;
          nav_clientes?: string;
          nav_inventario?: string;
          nav_reportes?: string;
          nav_gastos?: string;
          emoji_saludo?: string;
          emoji_lavador?: string;
          emoji_automovil?: string;
          emoji_camioneta_chica?: string;
          emoji_camioneta_grande?: string;
          emoji_camioneta_extra_grande?: string;
          emoji_moto_chica?: string;
          emoji_moto_grande?: string;
          color_primario?: string;
          color_accent?: string;
          color_success?: string;
          color_warning?: string;
          semaforo_alerta_min?: number;
          semaforo_critico_min?: number;
        };
        Relationships: [];
      };
      tickets: {
        Row: {
          id: string;
          vehiculo_id: string | null;
          cliente_id: string | null;
          distintivo: string | null;
          placa: string | null;
          servicio_id: string;
          tamano_vehiculo: "automovil" | "camioneta_chica" | "camioneta_grande" | "camioneta_extra_grande" | "moto_chica" | "moto_grande";
          empleado_id: string;
          lavador_id: string | null;
          turno_id: string;
          lavada_gratis: boolean;
          prioridad: boolean;
          descuento_monto: number;
          descuento_autorizado_por: string | null;
          estado: "en_espera" | "en_proceso" | "terminado" | "entregado";
          hora_entrada: string;
          hora_salida: string | null;
          hora_cambio_estado: string;
          hora_inicio_lavado: string | null;
          hora_fin_lavado: string | null;
          creado_por: string;
        };
        Insert: {
          id?: string;
          vehiculo_id?: string | null;
          cliente_id?: string | null;
          distintivo?: string | null;
          placa?: string | null;
          servicio_id: string;
          tamano_vehiculo: "automovil" | "camioneta_chica" | "camioneta_grande" | "camioneta_extra_grande" | "moto_chica" | "moto_grande";
          empleado_id: string;
          lavador_id?: string | null;
          turno_id: string;
          lavada_gratis?: boolean;
          prioridad?: boolean;
          descuento_monto?: number;
          descuento_autorizado_por?: string | null;
          estado?: "en_espera" | "en_proceso" | "terminado" | "entregado";
          hora_entrada?: string;
          hora_salida?: string | null;
          hora_cambio_estado?: string;
          hora_inicio_lavado?: string | null;
          hora_fin_lavado?: string | null;
          creado_por?: string;
        };
        Update: {
          id?: string;
          vehiculo_id?: string | null;
          cliente_id?: string | null;
          distintivo?: string | null;
          placa?: string | null;
          servicio_id?: string;
          tamano_vehiculo?: "automovil" | "camioneta_chica" | "camioneta_grande" | "camioneta_extra_grande" | "moto_chica" | "moto_grande";
          empleado_id?: string;
          lavador_id?: string | null;
          turno_id?: string;
          lavada_gratis?: boolean;
          prioridad?: boolean;
          descuento_monto?: number;
          descuento_autorizado_por?: string | null;
          estado?: "en_espera" | "en_proceso" | "terminado" | "entregado";
          hora_entrada?: string;
          hora_salida?: string | null;
          hora_cambio_estado?: string;
          hora_inicio_lavado?: string | null;
          hora_fin_lavado?: string | null;
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
          monto_recibido: number | null;
          cambio_entregado: number | null;
          turno_id: string;
          usuario_id: string;
          creado_en: string;
        };
        Insert: {
          id?: string;
          ticket_id: string;
          metodo: "efectivo" | "tarjeta" | "transferencia" | "membresia";
          monto: number;
          monto_recibido?: number | null;
          turno_id: string;
          usuario_id?: string;
          creado_en?: string;
        };
        Update: {
          id?: string;
          ticket_id?: string;
          metodo?: "efectivo" | "tarjeta" | "transferencia" | "membresia";
          monto?: number;
          monto_recibido?: number | null;
          turno_id?: string;
          usuario_id?: string;
          creado_en?: string;
        };
        Relationships: [];
      };
      gastos: {
        Row: {
          id: string;
          concepto: string;
          monto: number;
          fecha: string;
          notas: string | null;
          creado_por: string;
          creado_en: string;
        };
        Insert: {
          id?: string;
          concepto: string;
          monto: number;
          fecha?: string;
          notas?: string | null;
          creado_por: string;
          creado_en?: string;
        };
        Update: {
          id?: string;
          concepto?: string;
          monto?: number;
          fecha?: string;
          notas?: string | null;
          creado_por?: string;
          creado_en?: string;
        };
        Relationships: [];
      };
      inventario: {
        Row: {
          id: string;
          nombre_insumo: string;
          stock_actual: number;
          stock_minimo: number;
          costo_unitario: number;
        };
        Insert: {
          id?: string;
          nombre_insumo: string;
          stock_actual?: number;
          stock_minimo?: number;
          costo_unitario?: number;
        };
        Update: {
          id?: string;
          nombre_insumo?: string;
          stock_actual?: number;
          stock_minimo?: number;
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
      tamano_vehiculo: "automovil" | "camioneta_chica" | "camioneta_grande" | "camioneta_extra_grande" | "moto_chica" | "moto_grande";
    };
    CompositeTypes: Record<string, never>;
  };
}

// Alias de conveniencia derivados de Database (no al revés — ver nota arriba).
export type RolUsuario = Database["public"]["Enums"]["rol_usuario"];
export type TurnoEstado = Database["public"]["Enums"]["turno_estado"];
export type TicketEstado = Database["public"]["Enums"]["ticket_estado"];
export type PagoMetodo = Database["public"]["Enums"]["pago_metodo"];
export type TamanoVehiculo = Database["public"]["Enums"]["tamano_vehiculo"];

export type Usuario = Database["public"]["Tables"]["usuarios"]["Row"];
export type UsuarioConCorreo = Database["public"]["Tables"]["usuarios_con_correo"]["Row"];
export type Turno = Database["public"]["Tables"]["turnos"]["Row"];
export type ServicioCatalogo = Database["public"]["Tables"]["servicios_catalogo"]["Row"];
export type ServicioPrecio = Database["public"]["Tables"]["servicios_precios"]["Row"];
export type ExtraCatalogo = Database["public"]["Tables"]["extras_catalogo"]["Row"];
export type TicketExtra = Database["public"]["Tables"]["ticket_extras"]["Row"];
export type Cliente = Database["public"]["Tables"]["clientes"]["Row"];
export type Vehiculo = Database["public"]["Tables"]["vehiculos"]["Row"];
export type Lavador = Database["public"]["Tables"]["lavadores"]["Row"];
export type ConfiguracionApp = Database["public"]["Tables"]["configuracion_app"]["Row"];
export type Ticket = Database["public"]["Tables"]["tickets"]["Row"];
export type Pago = Database["public"]["Tables"]["pagos"]["Row"];
export type Inventario = Database["public"]["Tables"]["inventario"]["Row"];
export type ConsumoInventario = Database["public"]["Tables"]["consumo_inventario"]["Row"];
