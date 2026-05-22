import { Server, Lock, Code, CheckCircle } from "lucide-react";

export function AzureConnectionGuide() {
  const CodeBlock = ({ code }: { code: string }) => (
    <pre className="bg-gray-900 text-green-400 p-2 rounded text-[11px] overflow-x-auto">
      {code}
    </pre>
  );

  return (
    <div className="bg-white border rounded-xl shadow-sm p-4 h-full flex flex-col gap-4">

      {/* HEADER */}
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <Server className="w-4 h-4 text-blue-600" />
        Azure SQL
      </h2>

      {/* GRID */}
      <div className="grid grid-cols-2 gap-3 flex-1 overflow-auto">

        {/* CONFIG */}
        <div className="border rounded-lg p-3 text-xs space-y-2">
          <h3 className="font-semibold text-gray-700">Configuración</h3>

          <div className="space-y-1">
            <div>
              <span className="text-gray-500">Server</span>
              <div className="font-mono text-[11px]">
                admindpla.database.windows.net
              </div>
            </div>

            <div>
              <span className="text-gray-500">Database</span>
              <div className="font-mono">NUEVA_APP</div>
            </div>

            <div>
              <span className="text-gray-500">Region</span>
              <div>Brazil South</div>
            </div>
          </div>
        </div>

        {/* FIREWALL */}
        <div className="border rounded-lg p-3 text-xs space-y-2">
          <h3 className="font-semibold text-gray-700 flex items-center gap-1">
            <Lock className="w-3 h-3 text-orange-500" />
            Firewall
          </h3>

          <p className="text-gray-600 text-[11px]">
            Agrega tu IP en Azure Portal o usa:
          </p>

          <CodeBlock code="0.0.0.0 - 255.255.255.255" />

          <p className="text-[10px] text-orange-500">
            Solo desarrollo ⚠️
          </p>
        </div>

        {/* BACKEND */}
        <div className="border rounded-lg p-3 text-xs space-y-2">
          <h3 className="font-semibold text-gray-700 flex items-center gap-1">
            <Code className="w-3 h-3 text-green-600" />
            Backend
          </h3>

          <CodeBlock code="npm install express mssql cors dotenv" />
          <CodeBlock code="node server.js" />
        </div>

        {/* ENV */}
        <div className="border rounded-lg p-3 text-xs space-y-2">
          <h3 className="font-semibold text-gray-700">.env</h3>

          <CodeBlock
            code={`AZURE_SQL_SERVER=...
AZURE_SQL_DATABASE=NUEVA_APP
AZURE_SQL_USER=USER
AZURE_SQL_PASSWORD=PASS
PORT=3001`}
          />
        </div>

        {/* API */}
        <div className="col-span-2 border rounded-lg p-3 text-xs space-y-2">
          <h3 className="font-semibold text-gray-700">API</h3>

          <CodeBlock
            code={`GET /api/datos
GET /api/datos/agregados`}
          />
        </div>

        {/* FRONT */}
        <div className="col-span-2 border rounded-lg p-3 text-xs space-y-2">
          <h3 className="font-semibold text-gray-700 flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-purple-600" />
            Frontend
          </h3>

          <CodeBlock
            code={`fetch('http://localhost:3001/api/datos')`}
          />
        </div>

        {/* CONNECTION STRING */}
        <div className="col-span-2 border rounded-lg p-3 text-xs space-y-2">
          <h3 className="font-semibold text-gray-700">Connection</h3>

          <CodeBlock
            code={`Server=tcp:admindpla.database.windows.net;Database=NUEVA_APP;User ID=USER;Password=PASS;Encrypt=True;`}
          />
        </div>
      </div>

      {/* WARNING */}
      <div className="text-[11px] text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2">
        ⚠️ Nunca expongas credenciales en frontend
      </div>
    </div>
  );
}