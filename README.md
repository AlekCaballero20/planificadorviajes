# planificadorviajes
Planificador de viajes

## Checklist de viaje

La pestaña **Empaque** funciona como checklist en dos fases:

- **Ida · empacar:** marcas lo que metes a la maleta antes de salir.
- **Regreso · traer de vuelta:** confirmas que cada cosa volvió contigo.

Incluye búsqueda, filtros por estado (incluido *faltantes*) y categoría,
marcar/desmarcar todo, lista base sugerida, resumen (artículos, empacados,
de vuelta y faltantes) y exportar/importar el checklist en JSON. Un artículo
empacado que aún no se marca como devuelto cuenta como faltante y se resalta
también en la tarjeta del viaje.

## Despliegue (Firebase Hosting)

```bash
npm i -g firebase-tools
firebase login
firebase deploy --only hosting
```
