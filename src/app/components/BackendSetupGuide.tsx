import { useState } from "react";
import {
  Server,
  Terminal,
  CheckCircle,
  Copy,
  ExternalLink,
  AlertCircle,
} from "lucide-react";

export function BackendSetupGuide() {
  const [copied, setCopied] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "checking" | "connected" | "disconnected"
  >("disconnected");
  const [tables, setTables] = useState<string[]>([]);

  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  };

  const check = async () => {
    setStatus("checking");
    try {
      const res = await fetch("http://localhost:3001/api/health");
      if (!res.ok) throw new Error();

      setStatus("connected");

      const t = await fetch("http://localhost:3001/api/tablas");
      const json = await t.json();
      setTables(json.map((x: any) => x.TABLE_NAME));
    } catch {
      setStatus("disconnected");
    }
  };

  const Code = ({ code, id }: any) => (
    <div className="relative group">
      <pre className="bg-gray-900 text-green-400 p-2 rounded text-[11px] overflow-x-auto">
        {code}
      </pre>
      <button
        onClick={() => copy(code, id)}
        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100"
      >
        {copied === id ? (
          <CheckCircle className="w-4 h-4 text-green-400" />
        ) : (
          <Copy className="w-4 h-4 text-gray-400" />
        )}
      </button>
    </div>
  );

  return (
    <div className="bg-white border rounded-xl shadow-sm p-4 h-full flex flex-col gap-4">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Server className="w-4 h-4 text-blue-600" />
          Backend Azure
        </h2>

        <button
          onClick={check}
          className="text-xs px-3 py-1 bg-blue-600 text-white rounded-md flex items-center gap-1"
        >
          <Terminal className="w-3 h-3" />
          Probar
        </button>
      </div>

      {/* STATUS */}
      <div className="text-xs flex items-center gap-2">
        {status === "connected" && (
          <>
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-green-700">Conectado</span>
          </>
        )}
        {status === "checking" && (
          <span className="text-yellow-600">Verificando...</span>
        )}
        {status === "disconnected" && (
          <>
            <AlertCircle className="w-4 h-4 text-orange-500" />
            <span className="text-orange-600">Sin conexión</span>
          </>
        )}
      </div>

      {/* TABLAS */}
      {tables.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tables.map((t) => (
            <span
              key={t}
              className="text-[10px] px-2 py-0.5 bg-gray-100 rounded"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {/* GRID */}
      <div className="grid grid-cols-2 gap-3 flex-1 overflow-auto">

        {/* CONFIG */}
        <div className="border rounded-lg p-3 text-xs space-y-2">
          <h3 className="font-semibold text-gray-700">Config</h3>

          <div className="space-y-1">
            <div>
              <span className="text-gray-500">Server:</span>
              <div className="font-mono text-[11px]">
                admindpla.database.windows.net
              </div>
            </div>

            <div>
              <span className="text-gray-500">DB:</span>
              <div className="font-mono">NUEVA_APP</div>
            </div>

            <div>
              <span className="text-gray-500">User:</span>
              <div className="font-mono">admindpla2</div>
            </div>
          </div>
        </div>

        {/* COMMANDS */}
        <div className="border rounded-lg p-3 text-xs space-y-2">
          <h3 className="font-semibold text-gray-700">Setup</h3>

          <Code code="cd backend" id="cd" />
          <Code code="npm install" id="install" />
          <Code code="npm start" id="start" />
        </div>

        {/* ENV */}
        <div className="col-span-2 border rounded-lg p-3 text-xs space-y-2">
          <h3 className="font-semibold text-gray-700">.env</h3>

          <Code
            id="env"
            code={`AZURE_SQL_SERVER=admindpla.database.windows.net
AZURE_SQL_DATABASE=NUEVA_APP
AZURE_SQL_USER=admindpla2
AZURE_SQL_PASSWORD=********
PORT=3001`}
          />
        </div>

        {/* LINKS */}
        <div className="col-span-2 border rounded-lg p-3 text-xs space-y-2">
          <h3 className="font-semibold text-gray-700">Endpoints</h3>

          <a
            href="http://localhost:3001/api/health"
            target="_blank"
            className="flex items-center gap-1 text-blue-600"
          >
            <ExternalLink className="w-3 h-3" />
            /api/health
          </a>

          <a
            href="http://localhost:3001/api/tablas"
            target="_blank"
            className="flex items-center gap-1 text-blue-600"
          >
            <ExternalLink className="w-3 h-3" />
            /api/tablas
          </a>
        </div>
      </div>
    </div>
  );
}