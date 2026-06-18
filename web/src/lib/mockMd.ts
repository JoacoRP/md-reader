// Documento de muestra para la preview en vivo de Settings: cubre todos los
// tipos de bloque (headings, listas, tabla, código, mermaid, cita).
export const MOCK_MD = `# Título de nivel 1 (h1)

Párrafo de ejemplo con **texto en negrita**, *texto en itálica*, ~~tachado~~,
\`código en línea\` y un [enlace de ejemplo](https://example.com). Este texto
sirve para evaluar el interlineado, el ancho de contenido y la legibilidad
general cuando se ajustan los parámetros del panel izquierdo.

## Título de nivel 2 (h2)

### Título de nivel 3 (h3)

#### Título de nivel 4 (h4)

##### Título de nivel 5 (h5)

###### Título de nivel 6 (h6)

> Esto es una cita (blockquote). Sirve para ver el color de acento y el
> tratamiento del texto citado.
>
> > Y una cita anidada en un segundo nivel.

---

## Listas

**Sin orden:**

- Primer ítem
- Segundo ítem
  - Sub-ítem A
  - Sub-ítem B
- Tercer ítem

**Ordenada:**

1. Paso uno
2. Paso dos
3. Paso tres

**Lista de tareas:**

- [x] Tarea completada
- [ ] Tarea pendiente
- [ ] Otra pendiente

## Tabla

| Componente | Soporta | Notas                       |
|------------|:-------:|-----------------------------|
| Encabezados| ✅      | h1 a h6                      |
| Tablas     | ✅      | con alineación de columnas  |
| Mermaid    | ✅      | flowchart, sequence, etc.   |
| Código     | ✅      | resaltado de sintaxis       |

## Bloque de código

\`\`\`javascript
// Resaltado de sintaxis con highlight.js
function saludar(nombre) {
  const mensaje = \`Hola, \${nombre}!\`;
  console.log(mensaje);
  return mensaje;
}

saludar('Markdown');
\`\`\`

\`\`\`python
def fibonacci(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a
\`\`\`

## Diagramas Mermaid

\`\`\`mermaid
flowchart LR
    A[Inicio] --> B{¿Es .md?}
    B -- Sí --> C[Renderizar]
    B -- No --> D[Ignorar]
    C --> E[Mostrar en el lector]
\`\`\`

\`\`\`mermaid
sequenceDiagram
    participant U as Usuario
    participant S as Servidor
    U->>S: GET /api/file
    S-->>U: contenido .md
    U->>U: render + estilos
\`\`\`

## Cierre

Último párrafo para verificar el espaciado entre bloques y el margen inferior
del contenido. El **fine-tuning** se refleja acá en tiempo real.
`;
