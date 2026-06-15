const authType = (process.env.SQL_AUTH_TYPE || "windows").toLowerCase();
const useWindowsAuth = ["windows", "trusted", "integrated"].includes(authType);
const sql = useWindowsAuth ? require("mssql/msnodesqlv8") : require("mssql");

const database = process.env.SQL_DATABASE || "stitch";
const rawServer = process.env.SQL_SERVER || "SAGAR\\SQLEXPRESS";
const [server, instanceName] = rawServer.split("\\");
const port = process.env.SQL_PORT ? Number(process.env.SQL_PORT) : undefined;
const driver = process.env.SQL_DRIVER;

if (!useWindowsAuth && (!process.env.SQL_USER || !process.env.SQL_PASSWORD)) {
  throw new Error("SQL_AUTH_TYPE=sql requires SQL_USER and SQL_PASSWORD in backend/.env");
}

const sqlConfig = {
  server,
  database,
  ...(driver ? { driver } : {}),
  options: {
    encrypt: process.env.SQL_ENCRYPT === "true",
    trustServerCertificate: process.env.SQL_TRUST_SERVER_CERTIFICATE !== "false",
    ...(instanceName ? { instanceName } : {}),
    ...(useWindowsAuth ? { trustedConnection: true } : {}),
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

if (!instanceName && port) {
  sqlConfig.port = port;
}

if (!useWindowsAuth) {
  sqlConfig.user = process.env.SQL_USER;
  sqlConfig.password = process.env.SQL_PASSWORD;
}

let poolPromise = null;

function getSqlPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(sqlConfig);
  }

  return poolPromise;
}

module.exports = {
  getSqlPool,
  sql,
};
