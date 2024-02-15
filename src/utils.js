const { ADMIN_IDS } = require("./configurations");
const { format, parse, isValid } = require("date-fns");

// Helper function to notify admin
async function notifyAdmins(errorMessage, bot, ADMIN_IDS) {
  for (const ADMIN_ID of ADMIN_IDS) {
    try {
      const adminUser = bot.users.cache.get(ADMIN_ID);
      if (adminUser) {
        await adminUser.send(errorMessage);
      } else {
        console.error(`Couldn't notify the admin with ID: ${ADMIN_ID}.`);
      }
    } catch (err) {
      console.error(
        `Error while notifying admin with ID: ${ADMIN_ID}: ${err.message}`
      );
    }
  }
}

// Shuffle function
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function parseDate(dateString) {
  const date = parse(dateString, "P", new Date());
  if (isValid(date)) {
    return format(date, "EEE MMM dd yyyy");
  }
  return null;
}

module.exports = {
  shuffle,
  notifyAdmins,
  parseDate,
};
