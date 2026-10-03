# Walti — Agente de impresión local

Programa chico que corre en la PC de la caja y le permite al sistema imprimir
el ticket de cada venta **directo a la impresora térmica, sin ningún diálogo
de impresión** — ni de Windows ni del navegador.

## Por qué hace falta

Un navegador, por seguridad, nunca puede mandarle algo a una impresora sin
mostrar un diálogo (o sin un flag especial que a veces no funciona según el
equipo). Este agente resuelve eso: es un programita aparte que sí tiene
permiso para imprimir directo, y el sistema le manda el ticket a él en vez de
pedírselo al navegador.

Si este agente no está corriendo, el sistema sigue funcionando igual que
antes (abre el diálogo de impresión normal) — instalarlo es opcional, no
rompe nada si todavía no lo tenés.

## Instalación (una vez, en la PC de la caja)

1. Necesitás tener [Node.js](https://nodejs.org/) instalado en esa PC
   (versión 18 o superior). Si no lo tenés, descargalo e instalalo primero.
2. Copiá esta carpeta (`print-agent`) a la PC de la caja.
3. Abrí una terminal (PowerShell o CMD) dentro de la carpeta y ejecutá:
   ```
   npm install
   ```
4. Para probarlo, ejecutá:
   ```
   npm start
   ```
   Deberías ver: `Walti print-agent escuchando en http://localhost:9898`.
   Dejá esa ventana abierta y hacé una venta de prueba en el POS — el ticket
   debería salir solo, sin ningún cartel.

## Que arranque solo con Windows

Para no tener que abrir la terminal cada vez:

1. Generá el ejecutable (no hace falta tener Node instalado para usarlo
   después, solo para generarlo):
   ```
   npm run build
   ```
   Esto crea `dist/print-agent.exe`.
2. Presioná `Win + R`, escribí `shell:startup` y Enter — se abre la carpeta
   de Inicio de Windows.
3. Creá un acceso directo a `dist/print-agent.exe` dentro de esa carpeta.
4. La próxima vez que prendas la PC, el agente arranca solo (se ve un ícono
   de consola chiquito, podés minimizarlo).

## Configuración (opcional)

Por defecto usa la impresora **predeterminada de Windows** — si esa ya es tu
impresora térmica, no hace falta configurar nada más.

Si querés que imprima en una impresora específica (por nombre exacto, tal
como figura en "Dispositivos e impresoras" de Windows) o cambiar el puerto,
creá un archivo `.env` al lado de `agent.js` con:

```
PRINT_AGENT_PORT=9898
PRINT_AGENT_PRINTER=Nombre Exacto De La Impresora
```

Para ver los nombres de impresoras que Windows reconoce en esa PC, con el
agente corriendo abrí en el navegador: `http://localhost:9898/printers`.

## Notas

- Solo escucha en `localhost` (127.0.0.1) — no es accesible desde otras PCs
  de la red, solo desde el navegador que corre en la misma máquina.
- No imprime nada por su cuenta: solo reacciona cuando el POS le manda un
  ticket.
