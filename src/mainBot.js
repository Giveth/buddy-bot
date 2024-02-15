require("events").EventEmitter.defaultMaxListeners = 20;
const cron = require("node-cron");

const { bot, DISCORD_TOKEN } = require("./configurations");
const { handleMessages } = require("./eventHandlers");
const { pairContributors, checkCalls } = require("./sheetsFunctions");

// CURRENTLY DISABLED - Schedule the pairing function to run on the first day of every 3rd month (i.e., every quarter)
// cron.schedule("0 0 1 */3 *", pairContributors);

// Schedule the checkCalls function to run every hour
// cron.schedule("0 * * * *", checkCalls);

bot.on("ready", () => {
  console.log(`Logged in as ${bot.user.tag}!`);
});
bot.on("message", async (message) => {
  if (message.author.bot) return; // Ignore messages from bots

  handleMessages(message);
});
bot.on("error", console.error);
bot.login(DISCORD_TOKEN);
