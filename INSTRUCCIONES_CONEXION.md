# 🚀 Guía Completa de Conexión a Azure SQL Database

## ✅ Estado Actual

**Base de datos Azure SQL:**
- ✅ Servidor: `admindpla.database.windows.net`
- ✅ Base de datos: `NUEVA_APP`
- ✅ Usuario: `admindpla2`
- ✅ Ubicación: Brazil South
- ✅ Firewall: Configurado (regla "Abierta" permite todas las IPs)

## 📋 Pasos para Conectar

### 1️⃣ Configurar el Backend

#### A. Abrir una terminal y navegar a la carpeta backend
```bash
cd backend
```

#### B. Instalar Node.js
Si no tienes Node.js instalado, descárgalo desde: https://nodejs.org/
Verifica la instalación:
```bash
node --version
npm --version
```

#### C. Instalar las dependencias
```bash
npm install
```

Esto instalará:
- `express` - Framework web
- `mssql` - Driver de SQL Server para Node.js
- `cors` - Para permitir peticiones desde el frontend
- `dotenv` - Para manejar variables de entorno

#### D. Crear el archivo .env
1. Copia el archivo de ejemplo:
   ```bash
   cp .env.example .env
   ```

2. Abre el archivo `.env` y agrega tu contraseña:
   ```
   AZURE_SQL_SERVER=admindpla.database.windows.net
   AZURE_SQL_DATABASE=NUEVA_APP
   AZURE_SQL_USER=admindpla2
   AZURE_SQL_PASSWORD=TU_CONTRASEÑA_REAL_AQUI
   PORT=3001
   ```

3. **¡IMPORTANTE!** Reemplaza `TU_CONTRASEÑA_REAL_AQUI` con tu contraseña real de Azure SQL

#### E. Iniciar el servidor backend
```bash
npm start
```

Deberías ver algo como:
```
✅ Conectado exitosamente a Azure SQL Database (NUEVA_APP)
   Servidor: admindpla.database.windows.net
   Base de datos: NUEVA_APP

🚀 Servidor API ejecutándose en http://localhost:3001
```

### 2️⃣ Probar la Conexión

Abre otra terminal y prueba estos comandos:

#### Verificar que el servidor esté funcionando:
```bash
curl http://localhost:3001/
```

#### Ver todas las tablas disponibles:
```bash
curl http://localhost:3001/api/tablas
```

#### Verificar la salud de la conexión:
```bash
curl http://localhost:3001/api/health
```

O abre tu navegador y visita:
- http://localhost:3001/api/tablas
- http://localhost:3001/api/health

### 3️⃣ Conectar el Frontend

Una vez que el backend esté funcionando, necesitas actualizar el frontend para usar datos reales.

#### A. Identificar tu tabla de datos
Primero, ve qué tablas tienes disponibles:
```bash
curl http://localhost:3001/api/tablas
```

Esto te mostrará todas las tablas en tu base de datos db360.

#### B. Ver la estructura de una tabla
```bash
curl http://localhost:3001/api/tablas/NOMBRE_DE_TU_TABLA/estructura
```

#### C. Actualizar el archivo azureService.ts

Abre el archivo `src/app/services/azureService.ts` y reemplaza las funciones mock con llamadas reales a tu API.

**Ejemplo para obtener datos:**
```typescript
export const fetchAzureData = async (): Promise<DataItem[]> => {
  try {
    const response = await fetch('http://localhost:3001/api/datos/TU_TABLA');
    if (!response.ok) throw new Error('Error al obtener datos');
    const data = await response.json();
    
    // Mapea los datos de tu tabla al formato DataItem
    return data.map((item: any) => ({
      id: item.id || item.ID,
      fecha: item.fecha || new Date().toISOString(),
      categoria: item.categoria || 'Sin categoría',
      valor: Number(item.valor) || 0,
      estado: item.estado || 'Activo',
      descripcion: item.descripcion || ''
    }));
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};
```

**Ejemplo para consulta personalizada:**
```typescript
export const fetchCustomData = async (query: string) => {
  try {
    const response = await fetch('http://localhost:3001/api/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    });
    
    if (!response.ok) throw new Error('Error en la consulta');
    return await response.json();
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};
```

### 4️⃣ Verificar Todo Funciona

1. ✅ Backend corriendo en http://localhost:3001
2. ✅ Frontend corriendo (npm run dev en la carpeta raíz)
3. ✅ Los datos se actualizan automáticamente cada 10 segundos

## 🔧 Solución de Problemas Comunes

### ❌ Error: "Login failed for user 'admindpla2'"
**Solución:** 
- Verifica que la contraseña en el archivo `.env` sea correcta
- Intenta iniciar sesión en Azure Portal con esas credenciales para confirmar

### ❌ Error: "Cannot open server 'admindpla'"
**Solución:**
- Verifica que el firewall de Azure esté configurado (ya lo tienes ✅)
- Confirma que tu conexión a internet esté funcionando

### ❌ Error: "ENOTFOUND admindpla.database.windows.net"
**Solución:**
- Problema de DNS o conexión a internet
- Intenta hacer ping al servidor: `ping admindpla.database.windows.net`

### ❌ El backend se conecta pero no hay datos
**Solución:**
- Verifica que la tabla existe: `curl http://localhost:3001/api/tablas`
- Verifica que la tabla tenga datos en Azure Portal

### ❌ CORS error en el frontend
**Solución:**
El servidor ya tiene CORS habilitado, pero si aún tienes problemas:
- Asegúrate de que el backend esté corriendo
- Verifica que estés usando `http://localhost:3001` (no https)

## 📊 Estructura de Datos Esperada

Tu tabla debería tener columnas similares a:
- `id` - Identificador único
- `fecha` - Fecha del registro
- `categoria` - Categoría del item
- `valor` - Valor numérico
- `estado` - Estado actual (Activo, Pendiente, etc.)
- `descripcion` - Descripción del registro

Si tu tabla tiene columnas diferentes, necesitarás ajustar el mapeo en `azureService.ts`.

## 🎯 Próximos Pasos

1. ✅ Configurar y ejecutar el backend
2. ✅ Probar que se conecta a Azure SQL
3. ✅ Identificar tus tablas reales
4. ✅ Actualizar el frontend para usar datos reales
5. ✅ Personalizar los gráficos según tus necesidades

## 🆘 ¿Necesitas Ayuda?

Si tienes problemas:
1. Revisa los logs del backend (aparecen en la terminal donde ejecutaste `npm start`)
2. Usa el endpoint `/api/health` para verificar la conexión
3. Usa el endpoint `/api/tablas` para ver qué tablas tienes disponibles
4. Verifica que el archivo `.env` tenga la contraseña correcta

---

**¡Importante!** Nunca compartas tu archivo `.env` ni subas tus credenciales a GitHub.
