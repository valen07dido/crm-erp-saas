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

**Opción recomendada — el `.exe` ya generado, no necesita Node instalado:**

1. Copiá `dist/print-agent.exe` a la PC de la caja (podés ponerlo en
   cualquier carpeta, por ejemplo `C:\Walti\print-agent.exe`).
2. Si necesitás configurar algo (ver "Configuración" más abajo), poné el
   archivo `.env` **al lado del .exe**, en esa misma carpeta.
3. Hacé doble clic para probarlo. Se abre una ventanita de consola con
   `Walti print-agent escuchando en http://localhost:9898`. Dejala abierta y
   hacé una venta de prueba en el POS — el ticket debería salir solo, sin
   ningún cartel.

**Alternativa (si preferís correrlo con Node en vez del .exe):**

1. Necesitás [Node.js](https://nodejs.org/) instalado en esa PC (versión 18+).
2. Copiá esta carpeta (`print-agent`) a la PC de la caja.
3. Abrí una terminal ahí y ejecutá `npm install`, después `npm start`.

## Que arranque solo con Windows

1. Presioná `Win + R`, escribí `shell:startup` y Enter — se abre la carpeta
   de Inicio de Windows.
2. Creá un acceso directo a `print-agent.exe` (o a `start-agent.bat` si
   usaste la alternativa con Node) dentro de esa carpeta de Inicio.
3. La próxima vez que prendas la PC, el agente arranca solo (se ve una
   ventanita de consola negra — no la cierres, solo minimizala).

### Si necesitás regenerar el .exe

```
npm run build
```

Esto requiere poder descargar un binario base de Node desde internet (no
necesita compilar nada localmente). Si tu versión de `pkg` no encuentra un
binario prebuilt para el target configurado en `package.json`, probá con un
target más nuevo (por ejemplo `node22-win-x64`, `node24-win-x64`) — los
binarios viejos (Node 18/20) a veces dejan de estar disponibles.

## Configuración (opcional)

Por defecto usa la impresora **predeterminada de Windows** — si esa ya es tu
impresora térmica, no hace falta configurar nada más.

Si querés que imprima en una impresora específica (por nombre exacto, tal
como figura en "Dispositivos e impresoras" de Windows) o cambiar el puerto,
creá un archivo `.env` al lado de `agent.js` con:

```
PRINT_AGENT_PORT=9898
PRINT_AGENT_PRINTER=Nombre Exacto De La Impresora
PRINT_AGENT_LEFT_OFFSET_MM=10
```

Para ver los nombres de impresoras que Windows reconoce en esa PC, con el
agente corriendo abrí en el navegador: `http://localhost:9898/printers`.

`PRINT_AGENT_LEFT_OFFSET_MM` compensa impresoras que imprimen corridas hacia
la derecha (un defecto del driver/hardware, no de este agente — le pasa
igual con el método de impresión viejo). Para calibrarlo: imprimí un ticket
de prueba, medí en milímetros cuánto margen de más queda a la izquierda, y
poné ese número acá.

## Notas

- Solo escucha en `localhost` (127.0.0.1) — no es accesible desde otras PCs
  de la red, solo desde el navegador que corre en la misma máquina.
- No imprime nada por su cuenta: solo reacciona cuando el POS le manda un
  ticket.
