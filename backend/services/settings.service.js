const AppSettings = require("../models/AppSettings");

async function getAppSettings() {
  try {
    const settings = await AppSettings.find({
      key: { $in: ["disableNewRegistrations", "maintenanceMode"] }
    });

    return settings.reduce(
      (settingsMap, row) => ({
        ...settingsMap,
        [row.key]: String(row.value).toLowerCase() === "true",
      }),
      {
        disableNewRegistrations: false,
        maintenanceMode: false,
      }
    );
  } catch (error) {
    console.error("getAppSettings error:", error);
    return {
      disableNewRegistrations: false,
      maintenanceMode: false,
    };
  }
}

module.exports = {
  getAppSettings,
};
