const { Client } = require("discord.js");
const { GoogleSpreadsheet } = require("google-spreadsheet");
require("dotenv").config();

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const MAIN_SHEET_NAME = process.env.MAIN_SHEET_NAME;
const PAIRINGS_SHEET_NAME = process.env.PAIRINGS_SHEET_NAME;

const ANNOUNCEMENT_CHANNEL_ID = process.env.ANNOUNCEMENT_CHANNEL_ID;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const ROLE = process.env.ROLE;
const SELFREVIEW_FORM = process.env.SELFREVIEW_FORM;
const FEEDBACK_FORM = process.env.FEEDBACK_FORM;

const bot = new Client();
const doc = new GoogleSpreadsheet(SPREADSHEET_ID);
const userStates = {}; // State management object

module.exports = {
  bot,
  doc,
  userStates,
  SPREADSHEET_ID,
  MAIN_SHEET_NAME,
  PAIRINGS_SHEET_NAME,
  ANNOUNCEMENT_CHANNEL_ID,
  DISCORD_TOKEN,
  SELFREVIEW_FORM,
  FEEDBACK_FORM,
  ADMIN_ID,
  ROLE,
};
