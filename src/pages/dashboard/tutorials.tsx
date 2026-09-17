import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import {
  BookOpen,
  ChevronDown,
  LayoutDashboard,
  ScanBarcode,
  Package,
  Users,
  ShoppingCart,
  Truck,
  ClipboardList,
  Wallet,
  DollarSign,
  BarChart3,
  Store,
  Settings,
  Gift,
  UserCog,
  LucideIcon,
} from 'lucide-react';

interface Section {
  id: string;
  title: string;
  icon: LucideIcon;
  color: string;
  summary: string;
  tips: string[];
}

const sections: Section[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: LayoutDashboard,
    color: 'text-blue-400',
    summary: 'Es la pantalla principal: te muestra un resumen rápido de cómo viene el negocio (ventas del día, stock bajo, etc.) apenas entrás.',
    tips: [
      'Usalo como punto de partida diario para detectar si hay productos con poco stock antes de que se agoten.',
      'Si algo se ve mal acá, es una señal para revisar Ventas, Compras o Caja en detalle.',
    ],
  },
  {
    id: 'pos',
    title: 'Punto de Venta',
    icon: ScanBarcode,
    color: 'text-emerald-400',
    summary: 'Pantalla pensada para el mostrador: escaneás o buscás productos, arma el carrito y cobrás.',
    tips: [
      'El cursor queda siempre listo en el buscador de arriba — solo escaneá el código de barras y se agrega solo.',
      'El buscador manual y el botón "Precio" filtran tanto por nombre y código de barras como por la Descripción cargada en el producto.',
      'Usá "Modo Cajero" (pantalla completa) cuando estés atendiendo para no distraerte con el resto del panel.',
      'Botón "Precio": consulta el precio de un producto sin agregarlo a la venta en curso — ideal si un cliente pregunta un precio a mitad de un cobro.',
      'Al cobrar, podés elegir Efectivo, Tarjeta o Transferencia; con Efectivo te calcula el vuelto automáticamente.',
      'Si un producto está marcado como "se vende por peso" (ej: quesos, fiambres), al escanearlo o buscarlo te va a pedir el peso antes de agregarlo — podés ingresarlo en Kg o en gramos con el botón KG/G al lado del campo, y el precio se calcula solo.',
      'Antes de confirmar el cobro podés destildar "Imprimir ticket de esta venta" si por esa venta puntual no querés imprimir nada — la venta se registra igual, solo que sin el ticket. El valor por defecto de ese casillero (tildado o no) se configura en Configuración.',
      'Al cerrar una venta con el ticket activado, se imprime automáticamente en la impresora predeterminada de la PC (se abre el diálogo de impresión de Windows) — el ancho del papel (58mm por defecto, tipo posnet) se configura en Configuración. También podés reimprimirlo con el ícono de impresora en el aviso de "Venta registrada".',
    ],
  },
  {
    id: 'productos',
    title: 'Productos',
    icon: Package,
    color: 'text-primary',
    summary: 'Acá administrás todo tu catálogo: nombre, precio, stock, código de barras e imagen de cada producto.',
    tips: [
      'El buscador de arriba filtra por nombre, descripción o código de barras al mismo tiempo.',
      'Los desplegables "Todo el stock" y "Todos los vencimientos" te dejan filtrar rápido por productos con stock bajo/sin stock o por vencer/vencidos — "Limpiar filtros" los resetea junto con la búsqueda.',
      'La lista se pagina de a 20 productos para que no quede una tabla eterna — usá "Anterior"/"Siguiente" para moverte entre páginas.',
      'Para la foto del producto usá el botón "Subir imagen" (no hace falta tener la imagen alojada en otro lado) — se sube directamente desde tu computadora o celular.',
      '"Importar CSV" sirve para cargar muchos productos de una sola vez desde una planilla.',
      'El ícono de stock se pone naranja/rojo cuando queda poco — es tu aviso para reponer.',
      'Marcá "Se vende por peso (Kg)" para productos como quesos, fiambres o carnes — el precio pasa a ser por kilo y en el Punto de Venta te va a pedir el peso en vez de una cantidad entera.',
      'Cargá la "Fecha de Vencimiento" en productos perecederos — cuando falten 7 días o menos (o ya esté vencido) aparece un aviso en rojo/naranja debajo del nombre del producto en esta misma lista.',
    ],
  },
  {
    id: 'ofertas',
    title: 'Ofertas',
    icon: Gift,
    color: 'text-pink-400',
    summary: 'Armá combos de varios productos que se venden juntos a un precio fijo (ej: "Combo Familiar" = 3 gaseosas + 1 papas fritas a $5000).',
    tips: [
      'Un combo necesita al menos 2 productos elegidos de tu catálogo, cada uno con la cantidad que lleva adentro.',
      'El precio que cargues es el precio final del combo — no se calcula automático a partir de los productos, así que vos decidís el descuento.',
      'En el Punto de Venta el combo aparece junto a los productos (con un ícono de regalo) para escanear o buscar igual que cualquier otro artículo.',
      'Al venderlo se registra como una sola línea en la venta (ej: "Combo Familiar x2 — $10000"), pero por atrás se descuenta el stock de cada producto que lo compone.',
      'Si no tenés stock suficiente de alguno de los componentes, el sistema no te va a dejar vender más combos de los que realmente podés armar.',
      'Desmarcá "Oferta activa" para ocultarla del Punto de Venta sin borrarla (útil para pausar una promo).',
    ],
  },
  {
    id: 'clientes',
    title: 'Clientes',
    icon: Users,
    color: 'text-sky-400',
    summary: 'Base de datos de tus clientes, para asociarlos a ventas y llevar un historial de compras.',
    tips: [
      'Cargar el cliente en una venta te permite después ver en Reportes quiénes son tus mejores compradores.',
      'No es obligatorio: en el Punto de Venta siempre podés vender como "Consumidor Final".',
    ],
  },
  {
    id: 'ventas',
    title: 'Ventas',
    icon: ShoppingCart,
    color: 'text-amber-400',
    summary: 'Historial completo de todo lo que se vendió, con fecha, cliente, productos y total.',
    tips: [
      'Usalo para buscar una venta puntual si un cliente reclama un precio o una devolución.',
      'Cada venta hecha en el Punto de Venta aparece acá automáticamente.',
    ],
  },
  {
    id: 'proveedores',
    title: 'Proveedores',
    icon: Truck,
    color: 'text-violet-400',
    summary: 'Listado de tus proveedores (nombre, contacto), para vincularlos a las compras que les hacés.',
    tips: [
      'Cargá un proveedor antes de registrar una compra si querés llevar el historial de a quién le comprás cada cosa.',
    ],
  },
  {
    id: 'compras',
    title: 'Compras',
    icon: ClipboardList,
    color: 'text-orange-400',
    summary: 'Acá registrás la mercadería que ingresa: aumenta el stock de tus productos y queda como gasto en Caja.',
    tips: [
      '"Registrar Compra" es para cargar a mano, producto por producto, con su costo.',
      '"Importar Factura PDF" es el atajo grande: subís el PDF (lista de precios o factura) de tu proveedor, el sistema intenta leer los productos y precios automáticamente, vos definís el % de ganancia que le querés agregar, y confirmás — los productos se crean o actualizan ya con el precio de venta calculado.',
      'Como la lectura del PDF es automática, siempre revisá la tabla antes de confirmar: puede haber alguna línea mal interpretada, sobre todo en facturas con formatos poco comunes.',
      'Si el proveedor manda la misma lista actualizada más adelante, importarla de nuevo actualiza los precios de los productos existentes en vez de duplicarlos (los reconoce por el código del proveedor).',
      'Tocá cualquier fila de la lista (o el botón "Ver detalle") para ver exactamente qué productos y cantidades incluyó esa compra.',
    ],
  },
  {
    id: 'caja',
    title: 'Caja',
    icon: Wallet,
    color: 'text-teal-400',
    summary: 'Control de ingresos y egresos de dinero: lo que entra por ventas y lo que sale por compras/gastos.',
    tips: [
      'Es el lugar para chequear que la plata que debería haber, coincida con lo que efectivamente entró y salió.',
    ],
  },
  {
    id: 'gastos',
    title: 'Gastos',
    icon: DollarSign,
    color: 'text-red-400',
    summary: 'Para cargar gastos del negocio que no son compra de mercadería (alquiler, servicios, sueldos, etc.).',
    tips: [
      'Cargar los gastos acá es lo que hace que Reportes te muestre la ganancia real, no solo lo vendido.',
    ],
  },
  {
    id: 'reportes',
    title: 'Reportes',
    icon: BarChart3,
    color: 'text-fuchsia-400',
    summary: 'Gráficos y números que resumen cómo le fue al negocio en un período: ventas, ganancias, productos más vendidos.',
    tips: [
      'Usalo antes de tomar decisiones como subir precios o hacer una promoción — te dice qué productos realmente mueven la aguja.',
      '"Ventas por Turno" separa las ventas de un día en dos franjas horarias (ej: mañana/noche) — muy útil si el negocio cambia de encargado o de cajero a mitad del día. La hora de corte y los nombres de cada turno se configuran en Configuración.',
    ],
  },
  {
    id: 'tienda',
    title: 'Tienda Online / Configuración',
    icon: Store,
    color: 'text-indigo-400',
    summary: 'Personalizá cómo se ve tu catálogo público (el link que le mandás a tus clientes): logo, colores, textos e imágenes.',
    tips: [
      'Tanto acá como en Configuración podés subir el logo y las imágenes de portada directamente desde tu computadora, sin necesitar un link externo.',
      'Después de guardar cambios, entrá a "Ver Tienda" para chequear que se vea como esperás antes de compartir el link.',
    ],
  },
  {
    id: 'usuarios',
    title: 'Usuarios',
    icon: UserCog,
    color: 'text-cyan-400',
    summary: 'Solo la ve el Administrador: acá creás logins para tu equipo (empleados) sin compartir tu propia contraseña.',
    tips: [
      'Rol "Administrador": acceso completo, igual que vos.',
      'Rol "Solo Punto de Venta": ese usuario, al iniciar sesión, va directo al Punto de Venta y no puede ver ni tocar el resto del sistema (Productos, Reportes, Configuración, etc.).',
      'Podés cambiar el rol de un usuario en cualquier momento desde el desplegable de la lista.',
      'No podés eliminarte ni cambiarte el rol a vos mismo, para evitar quedarte afuera por error.',
    ],
  },
  {
    id: 'configuracion',
    title: 'Configuración',
    icon: Settings,
    color: 'text-slate-400',
    summary: 'Datos generales del negocio (nombre, moneda, impuesto) y la personalización de la tienda pública.',
    tips: [
      'La "URL del Tenant" es el link fijo de tu negocio — no se puede editar porque es la dirección de tu tienda online.',
      'Acá también configurás la hora de corte y los nombres de los turnos que usa el reporte "Ventas por Turno" en Reportes.',
    ],
  },
];

export default function TutorialsPage() {
  const [openId, setOpenId] = useState<string | null>(sections[0].id);

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="flex items-center gap-3 text-3xl font-bold">
          <BookOpen className="h-8 w-8 text-primary" />
          Tutoriales
        </h1>
        <p className="mt-1 text-muted-foreground">
          Una guía rápida de cada pantalla del sistema, para sacarle el máximo provecho
        </p>
      </div>

      <div className="space-y-3">
        {sections.map((section) => {
          const isOpen = openId === section.id;
          return (
            <div
              key={section.id}
              className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-lg"
            >
              <button
                onClick={() => setOpenId(isOpen ? null : section.id)}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-accent/50"
              >
                <div className="flex items-center gap-3">
                  <section.icon className={`h-5 w-5 shrink-0 ${section.color}`} />
                  <span className="font-semibold">{section.title}</span>
                </div>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {isOpen && (
                <div className="animate-fade-in border-t border-border/50 px-5 py-4">
                  <p className="text-sm text-muted-foreground">{section.summary}</p>
                  <ul className="mt-3 space-y-2">
                    {section.tips.map((tip, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
