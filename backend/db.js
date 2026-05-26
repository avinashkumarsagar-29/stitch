const useWindowsAuth = process.env.SQL_AUTH_TYPE === "windows";
const sql = useWindowsAuth ? require("mssql/msnodesqlv8") : require("mssql");

const database = process.env.SQL_DATABASE || "stitch";
const server = process.env.SQL_SERVER || "SAGAR\\SQLEXPRESS";

const windowsConnectionString =
  process.env.SQL_CONNECTION_STRING ||
  [
    "Driver={ODBC Driver 17 for SQL Server}",
    `Server=${server}`,
    `Database=${database}`,
    "Trusted_Connection=Yes",
    "Encrypt=Yes",
    "TrustServerCertificate=Yes",
  ].join(";");

const sqlAuthConfig = {
  server,
  database,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  port: Number(process.env.SQL_PORT || 1433),
  options: {
    encrypt: process.env.SQL_ENCRYPT === "true",
    trustServerCertificate: process.env.SQL_TRUST_SERVER_CERTIFICATE !== "false",
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

const sqlConfig = useWindowsAuth
  ? {
      connectionString: windowsConnectionString,
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
      },
    }
  : sqlAuthConfig;

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
