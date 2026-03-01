# Comandos para deployar el seeder de tesis en el servidor

## Problema identificado
El servidor tiene hot-reload activo y los cambios en `seeder.service.ts` no se están aplicando correctamente.

## Solución: Forzar rebuild completo

```bash
# En el servidor
cd ~/maransa-app

# 1. Pull de cambios
git pull origin master

# 2. DETENER el contenedor backend
docker-compose down backend

# 3. Rebuild SIN CACHE
docker-compose build --no-cache backend

# 4. Levantar todo de nuevo
docker-compose up -d

# 5. Reset de BD (ahora debería usar el código correcto)
docker-compose exec backend npx prisma migrate reset --force

# 6. Ver logs para confirmar
docker-compose logs -f backend
```

## Alternativa: Editar directamente en el servidor

Si lo anterior no funciona, editar directamente:

```bash
cd ~/maransa-app/maransa-back

# Verificar contenido actual
cat src/seeder/seeder.service.ts | grep -A 5 "onApplicationBootstrap"

# Si muestra las líneas SIN comentar, hacer:
nano src/seeder/seeder.service.ts
# Y comentar manualmente las líneas 21-22
```
