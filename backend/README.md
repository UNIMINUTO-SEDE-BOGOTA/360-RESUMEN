# Backend API - Azure SQL Database (NUEVA_APP)

API backend para conectar la aplicación React con Azure SQL Database.

## 📋 Información de la Base de Datos

- **Servidor**: admindpla.database.windows.net
- **Base de datos**: NUEVA_APP
- **Usuario**: admindpla2
- **Ubicación**: Brazil South
- **Firewall**: ✅ Configurado (regla "Abierta")

## 🚀 Instalación

### Paso 1: Instalar Node.js (si no lo tienes)
Descarga e instala Node.js desde: https://nodejs.org/ (versión LTS recomendada)

### Paso 2: Navegar a la carpeta backend
```bash
cd backend
```

### Paso 3: Instalar dependencias
```bash
npm install
```

### Paso 4: Configurar variables de entorno
1. Copia el archivo `.env.example` y renómbralo a `.env`:
   ```bash
   cp .env.example .env
   ```
   
2. Edita el archivo `.env` y reemplaza `TU_CONTRASEÑA_AQUI` con tu contraseña real de Azure SQL:
   ```
   AZURE_SQL_SERVER=admindpla.database.windows.net
   AZURE_SQL_DATABASE=NUEVA_APP
   AZURE_SQL_USER=admindpla2
   AZURE_SQL_PASSWORD=tu_contraseña_real_aqui
   PORT=3001
   ```

### Paso 5: Iniciar el servidor
```bash
npm start
```

El servidor se ejecutará en `http://localhost:3001`

## 📡 Endpoints Disponibles

### GET `/api/tablas`
Lista todas las tablas disponibles en la base de datos.

```bash
curl http://localhost:3001/api/tablas
```

### GET `/api/tablas/:nombre/estructura`
Obtiene la estructura de una tabla específica.

```bash
curl http://localhost:3001/api/tablas/TuTabla/estructura
```

### GET `/api/datos/:tabla`
Obtiene los datos de una tabla específica (máximo 100 registros).

```bash
curl http://localhost:3001/api/datos/TuTabla
```

Puedes agregar `?limit=50` para limitar la cantidad de registros:
```bash
curl http://localhost:3001/api/datos/TuTabla?limit=50
```

### POST `/api/query`
Ejecuta una consulta SQL personalizada (solo SELECT).

```bash
curl -X POST http://localhost:3001/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT * FROM TuTabla WHERE columna = valor"}'
```

### GET `/api/health`
Verifica el estado de la conexión a la base de datos.

```bash
curl http://localhost:3001/api/health
```

## 🔧 Solución de Problemas

### Error: "Login failed for user"
- Verifica que la contraseña en el archivo `.env` sea correcta
- Asegúrate de que el usuario `admindpla2` tenga permisos en la base de datos

### Error: "Cannot open server"
- Verifica que las reglas de firewall estén configuradas correctamente en Azure
- Confirma que tu IP esté permitida (o usa la regla "Abierta" 0.0.0.0-255.255.255.255)

### Error: "Timeout"
- Verifica tu conexión a internet
- Azure SQL puede tomar unos segundos en la primera conexión

## 🔒 Seguridad

- **NUNCA** subas el archivo `.env` a GitHub o repositorios públicos
- El archivo `.env` contiene información sensible
- En producción, usa variables de entorno del sistema o servicios de secrets management

## 📝 Notas

- El servidor usa conexiones encriptadas por defecto (requerido por Azure)
- Pool de conexiones configurado con máximo 10 conexiones concurrentes
- Timeout de 30 segundos para conexiones y requests
