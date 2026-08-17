/**
 * Convierte un arreglo de objetos a un archivo CSV y desencadena su descarga
 * @param data Arreglo de objetos (filas) a exportar
 * @param filename Nombre del archivo (sin la extensión .csv)
 */
export function exportToCSV(data: any[], filename: string) {
  if (!data || !data.length) {
    alert("No hay datos para exportar");
    return;
  }

  // Extraer los headers a partir de las llaves del primer objeto
  // Solo consideramos propiedades de nivel superior que no sean objetos anidados
  const headers = Object.keys(data[0]).filter(key => typeof data[0][key] !== 'object' || data[0][key] === null);

  // Construir las filas del CSV
  const csvRows = [];
  
  // Agregar fila de headers
  csvRows.push(headers.join(','));

  // Agregar datos
  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header];
      const escaped = ('' + (val !== null && val !== undefined ? val : '')).replace(/"/g, '""');
      // Si el valor contiene comas, comillas o saltos de línea, hay que encerrarlo en comillas
      if (escaped.search(/("|,|\n)/g) >= 0) {
        return `"${escaped}"`;
      }
      return escaped;
    });
    csvRows.push(values.join(','));
  }

  // Combinar filas con saltos de línea y agregar el BOM para que Excel detecte UTF-8
  const csvString = '\uFEFF' + csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  
  // Crear un link invisible para forzar la descarga
  const link = document.createElement('a');
  if (link.download !== undefined) { 
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
