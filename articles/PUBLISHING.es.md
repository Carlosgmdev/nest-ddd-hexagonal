# Publicar la guía en Medium y DEV

## Orden recomendado

1. Revisar y publicar la versión en español en Medium.
2. Revisar y publicar la versión en inglés en Medium.
3. Publicar la versión en español en DEV, con la URL española de Medium como canónica.
4. Publicar la versión en inglés en DEV, con la URL inglesa de Medium como canónica.

Empezar por español facilita revisar el contenido en tu idioma. El orden entre idiomas es editorial; lo necesario para este flujo es tener la URL de cada original de Medium antes de configurar su copia en DEV. No hace falta esperar un número concreto de días.

| Publicación        | Archivo fuente                                                             | URL canónica en DEV      |
| ------------------ | -------------------------------------------------------------------------- | ------------------------ |
| Medium ES y DEV ES | [Artículo español](./implementing-ddd-hexagonal-architecture-nestjs.es.md) | URL pública de Medium ES |
| Medium EN y DEV EN | [Artículo inglés](./implementing-ddd-hexagonal-architecture-nestjs.en.md)  | URL pública de Medium EN |

Cada idioma tiene su propio original. El enlace a una traducción se añade como enlace visible; no uses la URL inglesa como canonical de la copia española ni al revés.

## Antes de publicar

Lee ambos textos, añade tu experiencia y confirma que puedes explicar los ejemplos. Comprueba que el repositorio y los archivos enlazados sean accesibles sin iniciar sesión. Los comandos con `<order-id>` y `<technician-id>` contienen marcadores que el lector debe sustituir; el artículo ya lo indica.

Usa la misma [portada tecnológica v2](./assets/nest-ddd-hexagonal-cover-v2.png) en las cuatro publicaciones. El archivo mide 1932 × 814 píxeles y sirve para ambos idiomas. Su [ficha](./assets/nest-ddd-hexagonal-cover-v2.prompt.md) contiene el prompt final y los textos alternativos en ambos idiomas. La [portada anterior](./assets/nest-ddd-hexagonal-cover.png) se conserva como alternativa.

## Medium: qué copiar y cómo publicarlo

Abre el archivo del idioma correspondiente y distingue estas partes:

- `title`: solamente su valor será el título en Medium.
- `description`: puedes usar su valor como subtítulo.
- La cabecera entre `---` y el comentario `<!-- Publication notes... -->` o `<!-- Notas de publicación... -->` son metadatos e instrucciones locales; no forman parte del cuerpo que publicarás.
- El cuerpo empieza en `## 1. Cuando un servicio empieza a hacerlo todo` o `## 1. When a service starts doing everything` y termina en la pregunta final.

En Medium pulsa **Write**, completa el título y pega el cuerpo. Desde una vista previa de Markdown puedes copiar el texto ya formateado; revisa el resultado en el editor. Pegar el archivo fuente completo puede dejar visibles los marcadores de Markdown. La [guía de inicio de Medium](https://help.medium.com/hc/en-us/articles/225168768-Writing-and-publishing-your-first-story) explica la creación del borrador y el menú de publicación.

Revisa encabezados, enlaces, listas, tablas y sangría. Si una tabla no conserva su estructura al pegarla, conviértela en una lista de comparaciones. Mantén código y diagramas de texto en bloques monoespaciados. Para crear un bloque de código en escritorio, escribe tres acentos graves en una línea vacía; después pega el contenido del bloque sin las delimitaciones de Markdown. Consulta la [guía de bloques de código](https://help.medium.com/hc/en-us/articles/35756844492439-Using-code-blocks-and-inline-code).

Sube la portada desde el botón **+ → imagen** y selecciónala como imagen destacada en la vista previa de publicación. Añade el texto alternativo del idioma correspondiente y el pie que identifica la generación con IA. Medium permite subir imágenes y configurar texto alternativo, según su [guía de imágenes](https://help.medium.com/hc/en-us/articles/215679797-Using-images).

Añade temas pertinentes, por ejemplo NestJS, TypeScript, Software Architecture y Domain Driven Design, según los que ofrezca el selector. Comprueba la vista previa y publica. Para estos borradores recomiendo acceso libre. Guarda las dos URLs públicas finales, sin parámetros de seguimiento.

## DEV: qué copiar y cómo publicarlo

El editor **Rich + Markdown** permite introducir título, etiquetas y portada en campos separados. Copia el valor de `title`, conserva las cuatro etiquetas `nestjs, typescript, architecture, ddd` y pega únicamente el cuerpo del artículo en el campo de contenido.

Sube la portada con **Add a cover image**. En las opciones junto a **Save draft**, asigna **Canonical URL** a la URL de Medium del mismo idioma. Guarda el borrador, revisa **Preview** y publica cuando esté listo. Las opciones están documentadas en la [ayuda de publicación y cross-posting de DEV](https://dev.to/help/writing-editing-scheduling).

Si eliges **Basic Markdown**, usa el archivo completo con su cabecera YAML y agrega dentro de ella las líneas siguientes, sustituyendo los valores de ejemplo:

```yaml
canonical_url: 'URL_PUBLICA_DE_MEDIUM_DEL_MISMO_IDIOMA'
cover_image: 'URL_HTTPS_PUBLICA_DE_LA_PORTADA'
```

Elimina el `#` de `# canonical_url:` al completar esa línea; si sigue comentada, no tendrá efecto. `cover_image` necesita una URL pública de la imagen, no una ruta local. Si prefieres subir el PNG directamente, utiliza Rich + Markdown. Conserva `published: false` durante la revisión; en Basic cambia a `true` al publicar. Consulta la [guía de front matter de DEV](https://dev.to/p/editor_guide/).

## Identificar la asistencia de IA

Medium pide identificar el texto generado con IA; sugiere hacerlo dentro de los dos primeros párrafos. También exige un pie para las imágenes generadas con IA. El contenido mayoritariamente generado con poca revisión humana no es elegible para el paywall. Revisa su [política de IA](https://help.medium.com/hc/en-us/articles/22576852947223-Artificial-Intelligence-AI-content-policy).

DEV también pide declarar la asistencia de IA y comprobar el contenido antes de publicarlo, según sus [directrices](https://dev.to/guidelines-for-ai-assisted-articles-on-dev). Estas notas todavía no están insertadas en los artículos: añádelas al preparar cada publicación.

Texto sugerido para incluir al principio de cada versión:

> Nota editorial: este artículo se preparó con asistencia de IA a partir del código de mi proyecto.

> Editorial note: this article was prepared with AI assistance using the code from my project.

Pie de portada: «Portada generada con IA» / “Cover generated with AI.”

## Después de publicar

Añade un enlace visible entre idiomas en cada plataforma: «Read this article in English» y «Lee este artículo en español». Comprueba las cuatro publicaciones en una ventana privada, incluida la portada, los bloques de código y los enlaces al repositorio. Conserva en los Markdown locales las URLs canónicas reales para futuras actualizaciones.
