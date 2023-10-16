const { ADMIN_ID } = require("./configurations");
// Helper function to notify admin
async function notifyAdmin(errorMessage, bot, ADMIN_ID) {
  try {
    const adminUser = bot.users.cache.get(ADMIN_ID);
    if (adminUser) {
      await adminUser.send(errorMessage);
    } else {
      console.error("Couldn't notify the admin.");
    }
  } catch (err) {
    console.error(`Error while notifying admin: ${err.message}`);
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

module.exports = {
  shuffle,
  notifyAdmin,
};
