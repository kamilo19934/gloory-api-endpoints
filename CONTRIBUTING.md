# Guía de Contribución

¡Gracias por tu interés en contribuir a Gloory API! Este documento proporciona pautas para contribuir al proyecto.

## Cómo Contribuir

### Reportar Bugs

Si encuentras un bug, por favor crea un issue con:
- Descripción clara del problema
- Pasos para reproducir
- Comportamiento esperado vs actual
- Versión de Node.js y sistema operativo
- Screenshots si aplica

### Sugerir Mejoras

Para sugerir nuevas características:
- Crea un issue describiendo la mejora
- Explica por qué sería útil
- Proporciona ejemplos de uso si es posible

### Pull Requests

1. **Fork el repositorio**
   ```bash
   git clone https://github.com/tu-usuario/gloory-api-endpoints.git
   cd gloory-api-endpoints
   ```

2. **Crea una rama para tu feature**
   ```bash
   git checkout -b feature/mi-nueva-caracteristica
   ```

3. **Instala las dependencias**
   ```bash
   ./install.sh
   # o
   npm run install:all
   ```

4. **Haz tus cambios**
   - Sigue el estilo de código existente
   - Agrega comentarios donde sea necesario
   - Actualiza la documentación si es relevante

5. **Formatea el código**
   ```bash
   cd backend && npm run format
   cd ../frontend && npm run format
   ```

6. **Ejecuta los linters**
   ```bash
   cd backend && npm run lint
   cd ../frontend && npm run lint
   ```

7. **Ejecuta los tests (si existen)**
   ```bash
   cd backend && npm run test
   ```

8. **Commit tus cambios**
   ```bash
   git add .
   git commit -m "feat: descripción clara de los cambios"
   ```

   Usa los prefijos de commit convencionales:
   - `feat:` - Nueva característica
   - `fix:` - Corrección de bug
   - `docs:` - Cambios en documentación
   - `style:` - Cambios de formato (no afectan el código)
   - `refactor:` - Refactorización de código
   - `test:` - Agregar o modificar tests
   - `chore:` - Cambios en build, configs, etc.

9. **Push a tu fork**
   ```bash
   git push origin feature/mi-nueva-caracteristica
   ```

10. **Crea un Pull Request**
    - Ve a GitHub y crea un PR desde tu rama
    - Describe los cambios claramente
    - Referencia issues relacionados si los hay

## Estándares de Código

### Backend (NestJS)

- Usa TypeScript estricto
- Sigue los principios SOLID
- Usa inyección de dependencias
- Maneja errores apropiadamente
- Agrega validación a los DTOs
- Documenta funciones complejas

Ejemplo:
```typescript
@Injectable()
export class MyService {
  constructor(
    private readonly dependencyService: DependencyService,
  ) {}

  async myMethod(param: string): Promise<ResultType> {
    // Tu código aquí
  }
}
```

### Frontend (Next.js)

- Usa TypeScript
- Componentes funcionales con hooks
- Separa lógica de presentación
- Maneja estados de loading y error
- Usa TailwindCSS para estilos
- Componentes reutilizables en `/components`

Ejemplo:
```typescript
'use client';

import { useState, useEffect } from 'react';

export default function MyComponent({ prop }: MyComponentProps) {
  const [state, setState] = useState<Type>(initialValue);

  useEffect(() => {
    // Side effects
  }, []);

  return (
    <div className="...">
      {/* JSX */}
    </div>
  );
}
```

## Estructura de Archivos

### Backend

```
backend/src/
├── module-name/
│   ├── entities/
│   │   └── entity.entity.ts
│   ├── dto/
│   │   ├── create-entity.dto.ts
│   │   └── update-entity.dto.ts
│   ├── module-name.service.ts
│   ├── module-name.controller.ts
│   └── module-name.module.ts
```

### Frontend

```
frontend/src/
├── app/
│   └── route/
│       └── page.tsx
├── components/
│   └── ComponentName.tsx
└── lib/
    └── utilities.ts
```

## Agregar Nuevos Endpoints

Para agregar un nuevo endpoint de Dentalink:

1. Edita `backend/src/endpoints/endpoint-config.ts`:
   ```typescript
   {
     id: 'nuevo-endpoint',
     name: 'Nombre del Endpoint',
     description: 'Descripción',
     method: 'GET',
     path: '/ruta',
     dentalinkPath: '/dentalink-ruta',
     category: 'categoria',
   }
   ```

2. (Opcional) Agrega handler específico en `backend/src/dentalink/dentalink.controller.ts`

3. El endpoint aparecerá automáticamente en el frontend

## Testing

Por ahora el proyecto no tiene tests completos, pero al agregar tests:

- Usa Jest para unit tests
- Mockea las dependencias externas
- Apunta a >80% de cobertura
- Agrega tests E2E para flujos críticos

## Documentación

Si agregas nuevas características:
- Actualiza el README correspondiente
- Agrega ejemplos en API_EXAMPLES.md si aplica
- Actualiza CHANGELOG.md
- Comenta código complejo

## Preguntas

Si tienes preguntas sobre cómo contribuir, puedes:
- Crear un issue con la etiqueta "question"
- Contactar a los mantenedores del proyecto

## Código de Conducta

- Sé respetuoso con otros contribuidores
- Acepta críticas constructivas
- Enfócate en lo que es mejor para el proyecto
- Muestra empatía hacia otros miembros de la comunidad

## Licencia

Al contribuir, aceptas que tus contribuciones serán licenciadas bajo la misma licencia del proyecto (MIT).

