# ¿Qué hicimos y cómo funciona Google Analytics?
# url: https://analytics.google.com/
|
Este archivo explica los cambios recientes realizados en tu catálogo para integrar Google Analytics, de forma que puedas entender exactamente qué hace cada parte.

## 1. El objetivo
El objetivo era poder ver **cuántas personas visitan tu catálogo**, desde dónde lo hacen y cómo interactúan con él, a pesar de estar alojado en GitHub Pages (que por defecto no ofrece estadísticas detalladas).

Para esto elegimos **Google Analytics**, que es una herramienta gratuita y muy potente.

## 2. El código agregado
En el archivo `index.html`, justo antes de cerrar la etiqueta `</head>`, agregamos el siguiente bloque de código:

```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-K562E8V6ZP"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-K562E8V6ZP');
</script>
```

## 3. ¿Qué hace este código paso a paso?

1. **`<!-- Google tag (gtag.js) -->`**: Es simplemente un comentario para que los humanos sepamos qué es el código que sigue. El navegador lo ignora.
2. **`<script async src="...">`**: Esta línea descarga un archivo de JavaScript directamente desde los servidores de Google (`googletagmanager.com`). 
   - La palabra `async` significa que se descargará en "segundo plano" para no hacer que tu página web cargue más lento.
   - El código `G-K562E8V6ZP` es tu **ID de medición único**. Le dice a Google que los datos de esta página pertenecen a *tu* cuenta y a *tu* catálogo (Catalogo Tatynet).
3. **El segundo bloque `<script>...</script>`**: 
   - `window.dataLayer = ...`: Crea un "espacio de almacenamiento" (una lista) donde se guardarán los datos antes de enviarlos a Google.
   - `function gtag()...`: Es una función que usamos para enviar instrucciones a Analytics.
   - `gtag('js', new Date());`: Registra la fecha y hora exacta en la que el usuario abrió la página.
   - `gtag('config', 'G-K562E8V6ZP');`: Esta es la instrucción final que dice "Configura el seguimiento para esta página y envía los datos iniciales (como qué página es, de dónde viene el visitante, etc.) a mi ID de medición".

## 4. ¿Cómo funciona en la práctica?

Cada vez que alguien entra a `https://tatynet.github.io/catalogoweb/`:
1. El navegador de esa persona lee el código.
2. Descarga el programa de Analytics.
3. El programa recoge información anónima (país, tipo de dispositivo, tiempo que pasó en la página).
4. Envía esa información en secreto a los servidores de Google.
5. Tú abres tu panel de Google Analytics y ves esa información procesada en forma de gráficos y reportes.

## 5. Próximos pasos
Recuerda que los datos pueden tardar hasta 48 horas en aparecer en los informes completos de Google Analytics, pero si vas a la sección **"En tiempo real"**, podrás ver los visitantes activos al instante.
