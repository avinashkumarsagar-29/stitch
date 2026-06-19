const { connectMongo, mongoose } = require("./db.mongo");

async function connect() {
  return connectMongo();
}

async function getSqlPool() {
  throw new Error("SQL Server has been removed. Use MongoDB models instead.");
}

module.exports = {
  connect,
  connectMongo,
  getSqlPool,
  mongoose,
};
