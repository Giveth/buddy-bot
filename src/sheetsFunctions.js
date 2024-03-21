const moment = require("moment");
const { shuffle, notifyAdmins } = require("./utils");
const { format } = require("date-fns");
const {
  bot,
  doc,
  userStates,
  MAIN_SHEET_NAME,
  PAIRINGS_SHEET_NAME,
  ROLE,
  ADMIN_IDS,
  SELFREVIEW_FORM,
  ANNOUNCEMENT_CHANNEL_ID,
  FEEDBACK_FORM,
} = require("./configurations");

// Use service account creds
doc.useServiceAccountAuth(require("../google-sheets-credentials.json"));

// Get all Contributors by Role from the Server
async function updateContributorsSheet() {
  try {
    // Load the document and the Contributors sheet
    await doc.loadInfo();
    const mainSheet = doc.sheetsByTitle[MAIN_SHEET_NAME];

    // Clear existing content, preserving headers
    const rows = await mainSheet.getRows();
    console.log(`Rows: ${rows}`);
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i];
      try {
        console.log(`Deleting row ${row.rowNumber}`);
        await row.delete();
        console.log(`${row.rowNumber} deleted`);
      } catch (error) {
        console.error(`Error deleting row: ${error.message}`);
      }
    }
    console.log("Sheet cleared successfully!");

    // Fetch members belonging to a specified role
    const guild = bot.guilds.cache.first(); // Assuming the bot is only in one guild; modify if needed
    const unicornRole = guild.roles.cache.find((role) => role.name === ROLE);
    const membersWithRole = guild.members.cache.filter((member) =>
      member.roles.cache.has(unicornRole.id)
    );

    // Define a batch size
    const batchSize = 50; // Modify as needed
    const batches = Math.ceil(membersWithRole.size / batchSize);

    const membersArray = [...membersWithRole.values()]; // Convert iterator to array
    console.log(`Contributors: ${membersArray}`);

    // Remove duplicates from the members array
    const uniqueMembersArray = Array.from(new Set(membersArray));

    for (let i = 0; i < batches; i++) {
      const batchMembers = uniqueMembersArray.slice(
        i * batchSize,
        (i + 1) * batchSize
      );
      const batchRows = batchMembers.map((member) => ({
        Names: member.user.username,
        UserID: member.user.id,
      }));
      console.log(`Current Batch: ${batchMembers}`);
      await mainSheet.addRows(batchRows);

      // Wait for a second between batches to reduce rate limit risks
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log("Contributors sheet updated successfully!");
  } catch (error) {
    console.error(`Error updating Contributors sheet: ${error.message}`);
    await notifyAdmins(
      `Error updating Contributors sheet: ${error.message}`,
      bot,
      ADMIN_IDS
    );
  }
}

// DEPRECATED
async function pairContributors() {
  try {
    await doc.loadInfo();
    const mainSheet = doc.sheetsByTitle[MAIN_SHEET_NAME];
    const pairingSheet = doc.sheetsByTitle[PAIRINGS_SHEET_NAME];

    const rows = await mainSheet.getRows();

    const contributors = rows.map((row) => ({
      name: row.Names,
      id: row.UserID,
    }));
    const shuffledContributors = shuffle([...contributors]);
    console.log(`shuffledContributors: ${shuffledContributors.length}`);

    if (shuffledContributors.length % 2 !== 0) {
      console.log("Odd number of contributors.");
      return;
    }

    const pairs = [];
    for (let i = 0; i < shuffledContributors.length; i += 2) {
      const pair = shuffledContributors.slice(i, i + 2);
      pairs.push(pair);

      // Send DM to the contributors
      for (const member of pair) {
        const user = bot.users.cache.get(member.id); // Use the User ID to fetch the user
        if (user) {
          userStates[user.id] = {
            state: "awaitingDate",
            buddy: pair.find((p) => p.id !== member.id).name,
          }; // Set the status of the buddy pair to awaiting a date
          user
            .send(
              `Hey, your buddy has been chosen - it is: ${
                pair.find((p) => p.id !== member.id).name
              }. Please DM me with the date you set for your buddy call.`
            )
            .catch((error) => {
              // If there's an error sending the DM, notify the admins
              ADMIN_IDS.forEach((adminId) => {
                const adminUser = bot.users.cache.get(adminId);
                if (adminUser) {
                  adminUser.send(
                    `Failed to send DM to user with ID: ${member.id}. Please notify them manually.`
                  );
                } else {
                  console.error(
                    `Couldn't notify the admin with ID: ${adminId}.`
                  );
                }
              });
            });
        } else {
          console.error(`Couldn't find user with ID: ${member.id}`);
        }
      }
    }

    // Save the pairs back to the Pairings sheet with the current date
    for (const pair of pairs) {
      await pairingSheet.addRow({
        Pair: pair.map((p) => p.name).join(" & "),
        Date: new Date().toISOString().split("T")[0],
        ID1: pair[0].id,
        ID2: pair[1] ? pair[1].id : "", // Handle odd numbers of contributors
        State: "paired no date", // New column
        Buddycalldate: "", // New column
      });
    }
    return pairs;
  } catch (error) {
    console.error(`Error in pairContributors function: ${error.message}`);
    await notifyAdmins(
      `Error occurred while pairing contributors: ${error.message}`,
      bot,
      ADMIN_IDS
    );
  }
}

// DM users and their buddies to start the process
async function dmBuddies(userId) {
  await doc.loadInfo();
  const mainSheet = doc.sheetsByTitle[MAIN_SHEET_NAME];
  const rows = await mainSheet.getRows();

  const userRow = rows.find((row) => row.UserID === userId);
  if (!userRow) {
    console.error(`Couldn't find user with ID: ${userId}`);
    return;
  }

  const buddyRow = rows.find((row) => row.Names === userRow.Buddy);
  if (!buddyRow) {
    console.error(`Couldn't find buddy for user with ID: ${userId}`);
    return;
  }

  try {
    const user = await bot.users.fetch(userRow.UserID);
    const buddy = await bot.users.fetch(buddyRow.UserID);

    await user.send(
      `Hey, heeey. Its that time again! Please set a date for your buddy call with ${buddyRow.Names} and send the date back to me.`
    );
    userRow.State = "awaitingDate";
    await userRow.save();

    await buddy.send(
      `Hey, heeey. Its that time again! Please set a date for your buddy call with ${userRow.Names} so they can tell me`
    );

    return true; // Return true if the DMs were sent successfully
  } catch (error) {
    console.error(
      `Failed to send DM to user with ID: ${userId} or their buddy. Error: ${error.message}`
    );
    return false; // Return false if there was an error
  }
}

// Fill the backend sheet with buddy pairings and set the state to "paired no date"
async function fetchAndSavePairingsWithoutDate() {
  try {
    await doc.loadInfo();
    const mainSheet = doc.sheetsByTitle[MAIN_SHEET_NAME];
    const pairingSheet = doc.sheetsByTitle[PAIRINGS_SHEET_NAME];

    const rows = await mainSheet.getRows();

    const pairs = rows.map((row) => [
      {
        name: row.Names,
        id: row.UserID,
      },
      {
        name: row.Buddy,
        id: row.BuddyID,
      },
    ]);

    // Save the pairs back to the Pairings sheet without a date
    for (const pair of pairs) {
      await pairingSheet.addRow({
        Pair: pair.map((p) => p.name).join(" & "),
        ID1: pair[0].id,
        ID2: pair[1] ? pair[1].id : "", // Handle odd numbers of contributors
        State: "paired no date", // New column
      });
    }
    return pairs;
  } catch (error) {
    console.error(
      `Error in fetchAndSavePairingsWithoutDate function: ${error.message}`
    );
    await notifyAdmins(
      `Error occurred while fetching and saving pairings without date: ${error.message}`,
      bot,
      ADMIN_IDS
    );
  }
}

// DEPRECATED
async function fetchAndSavePairings() {
  try {
    await doc.loadInfo();
    const mainSheet = doc.sheetsByTitle[MAIN_SHEET_NAME];
    const pairingSheet = doc.sheetsByTitle[PAIRINGS_SHEET_NAME];

    const rows = await mainSheet.getRows();

    const pairs = rows.map((row) => [
      {
        name: row.Names,
        id: row.UserID,
      },
      {
        name: row.Buddy,
        id: row.BuddyID,
      },
    ]);

    // Send DM to the contributors
    for (const pair of pairs) {
      for (const member of pair) {
        const user = bot.users.cache.get(member.id); // Use the User ID to fetch the user
        if (user) {
          userStates[user.id] = {
            state: "awaitingDate",
            buddy: pair.find((p) => p.id !== member.id).name,
          }; // Set the status of the buddy pair to awaiting a date
          user
            .send(
              `Hey, your buddy has been chosen - it is: ${
                pair.find((p) => p.id !== member.id).name
              }. Please DM me with the date you set for your buddy call.`
            )
            .catch((error) => {
              // If there's an error sending the DM, notify the admins
              ADMIN_IDS.forEach((adminId) => {
                const adminUser = bot.users.cache.get(adminId);
                if (adminUser) {
                  adminUser.send(
                    `Failed to send DM to user with ID: ${member.id}. Please notify them manually.`
                  );
                } else {
                  console.error(
                    `Couldn't notify the admin with ID: ${adminId}.`
                  );
                }
              });
            });
        } else {
          console.error(`Couldn't find user with ID: ${member.id}`);
        }
      }
    }

    // Save the pairs back to the Pairings sheet with the current date
    for (const pair of pairs) {
      await pairingSheet.addRow({
        Pair: pair.map((p) => p.name).join(" & "),
        Date: new Date().toISOString().split("T")[0],
        ID1: pair[0].id,
        ID2: pair[1] ? pair[1].id : "", // Handle odd numbers of contributors
        State: "paired no date", // New column
        Buddycalldate: "", // New column
      });
    }
    return pairs;
  } catch (error) {
    console.error(`Error in fetchAndSavePairings function: ${error.message}`);
    await notifyAdmins(
      `Error occurred while fetching and saving pairings: ${error.message}`,
      bot,
      ADMIN_IDS
    );
  }
}

// Check if the last call date is overdue and update the state in the sheet
async function checkLastCallDate() {
  try {
    await doc.loadInfo();
    const buddiesSheet = doc.sheetsByTitle[PAIRINGS_SHEET_NAME]; // Access the "Buddies" sheet

    if (!buddiesSheet) {
      console.error("Couldn't find the 'Buddies' sheet.");
      return [];
    }

    const rows = await buddiesSheet.getRows();

    const tenWeeksAgo = new Date();
    tenWeeksAgo.setDate(tenWeeksAgo.getDate() - 70); // 10 weeks = 70 days

    // Update the state for rows with overdue dates
    const updatedPairs = [];
    for (const row of rows) {
      const lastCallDate = new Date(row.Lastcall);
      if (lastCallDate <= tenWeeksAgo && row.State !== "Time to do it") {
        row.State = "Time to do it";
        await row.save(); // Save the changes to the sheet
        updatedPairs.push(row.Pair);
      }
    }

    return updatedPairs;
  } catch (error) {
    console.error(`Error in checkLastCallDate function: ${error.message}`);
    await notifyAdmins(
      `Error occurred while checking last call dates: ${error.message}`,
      bot,
      ADMIN_IDS
    );
    return [];
  }
}

// DEPRECATED
async function processDate(message, dateTime) {
  try {
    // Store the date in Google Sheet (or other storage)
    await doc.loadInfo();
    const pairingSheet = doc.sheetsByTitle[PAIRINGS_SHEET_NAME];
    const rows = await pairingSheet.getRows();
    const userRow = rows.find(
      (row) => row.ID1 === message.author.id || row.ID2 === message.author.id
    );

    if (userRow) {
      userRow.Buddycalldate = dateTime.toISOString();
      userRow.State = "date set";
      await userRow.save(); // Save the changes to the sheet
    }

    message.channel.send(
      `Thanks! Your buddy call has been set for ${dateTime.toDateString()} at ${dateTime.toLocaleTimeString()}.`
    );

    const announcementChannel = bot.channels.cache.get(ANNOUNCEMENT_CHANNEL_ID);
    const buddyName = userStates[message.author.id].buddy;
    if (announcementChannel) {
      announcementChannel.send(
        `A buddy call has been set for ${message.author.username} and ${buddyName} - please give them some feedback!`
      );
    } else {
      console.error(
        `Couldn't find the announcement channel with ID: ${ANNOUNCEMENT_CHANNEL_ID}`
      );
    }

    delete userStates[message.author.id]; // Reset their state
  } catch (error) {
    console.error(`Error in processDate function: ${error.message}`);
    await notifyAdmins(
      `Error occurred while processing the date: ${error.message}`,
      bot,
      ADMIN_IDS
    );
  }
}

async function promptSelfReview() {
  try {
    await doc.loadInfo();
    const pairingsSheet = doc.sheetsByTitle[PAIRINGS_SHEET_NAME];

    if (!pairingsSheet) {
      console.error(
        `Couldn't find the sheet with name: ${PAIRINGS_SHEET_NAME}`
      );
      return;
    }

    const rows = await pairingsSheet.getRows();
    const selectedUsers = [];

    for (const row of rows) {
      if (row.State === "date set") {
        const userId1 = row.ID1;
        const messageContent = `Please fill out a self-review form for your upcoming buddy call:\n${SELFREVIEW_FORM}`;

        if (userId1) {
          const user1 = bot.users.cache.get(userId1);
          const mention = `<@${userId1}>`;
          if (user1) {
            user1.send(messageContent).catch((error) => {
              console.error(
                `Failed to send DM to user with ID: ${userId1}. Error: ${error.message}`
              );
            });
            selectedUsers.push(mention);
          }
        }

        row.State = "Review requested";
        await row.save();
      }
    }
    return selectedUsers;
  } catch (error) {
    console.error(`Error in promptSelfReview function: ${error.message}`);
    await notifyAdmins(
      `Error occurred while asking users for self-review: ${error.message}`,
      bot,
      ADMIN_IDS
    );
  }
}

async function checkCalls() {
  try {
    await doc.loadInfo();
    const pairingSheet = doc.sheetsByTitle[PAIRINGS_SHEET_NAME];
    const rows = await pairingSheet.getRows();

    const oneHourAgo = moment().subtract(1, "hour");

    for (const row of rows) {
      const callDateTime = moment(row.Buddycalldate, "MM/DD/YYYY HH:mm");
      console.log(`Call date time: ${callDateTime.format()}`);
      if (row.State === "date set" && callDateTime <= oneHourAgo) {
        console.log(`Call overdue for ${row.Pair} since ${row.Buddycalldate}`);

        // Send DM to both members of the pair
        const user1 = bot.users.cache.get(row.ID1);
        const user2 = bot.users.cache.get(row.ID2);

        if (user1) {
          user1.send(
            "Did your buddy call with " +
              row.Pair.split(" & ")[1] +
              " take place?"
          );
          const filter = (m) =>
            m.author.id === row.ID1 &&
            (m.content.toLowerCase() === "yes" ||
              m.content.toLowerCase() === "no");
          const collector = user1.dmChannel.createMessageCollector(filter, {
            time: 60000,
          });
          collector.on("collect", async (m) => {
            if (m.content.toLowerCase() === "yes") {
              if (user2)
                user2.send(
                  "Your buddy confirmed the call with " +
                    row.Pair.split(" & ")[0] +
                    " happened."
                );
              row.State = "DONE";
              row.Lastcall = moment().format("MM/DD/YYYY");
              await row.save();
              await sendNotes();
            } else if (m.content.toLowerCase() === "no") {
              if (user2)
                user2.send(
                  "Your buddy confirmed the call with " +
                    row.Pair.split(" & ")[0] +
                    " didn't happen."
                );
              row.State = "date set";
              await row.save();
            }
            collector.stop();
          });
          collector.on("end", async (collected, reason) => {
            console.log(`Collected ${collected.size} messages`);
            if (reason === "time") {
              await user1.send(
                "The process has expired, please DM @nicbals with the info I requested"
              );
            }
          });
        }

        if (user2) {
          user2.send(
            "Did your buddy call with " +
              row.Pair.split(" & ")[0] +
              " take place?"
          );
          const filter = (m) =>
            m.author.id === row.ID2 &&
            (m.content.toLowerCase() === "yes" ||
              m.content.toLowerCase() === "no");
          const collector = user2.dmChannel.createMessageCollector(filter, {
            time: 60000,
          });
          collector.on("collect", async (m) => {
            if (m.content.toLowerCase() === "yes") {
              if (user1)
                user1.send(
                  "Your buddy confirmed the call with " +
                    row.Pair.split(" & ")[1] +
                    " happened."
                );
              row.State = "DONE";
              row.Lastcall = moment().format("MM/DD/YYYY");
              await row.save();
              await sendNotes();
            } else if (m.content.toLowerCase() === "no") {
              if (user1)
                user1.send(
                  "Your buddy confirmed the call with " +
                    row.Pair.split(" & ")[1] +
                    " did not happen."
                );
              row.State = "date set";
              await row.save();
            }
            collector.stop();
          });
          collector.on("end", async (collected, reason) => {
            console.log(`Collected ${collected.size} messages`);
            if (reason === "time") {
              await user2.send(
                "The process has expired, please DM @nicbals with the info I requested."
              );
            }
          });
        }
      } else {
        console.log(`No calls overdue`);
      }
    }
  } catch (error) {
    console.error(`Error in checkCalls function: ${error.message}`);
    await notifyAdmins(
      `Error occurred while checking calls: ${error.message}`,
      bot,
      ADMIN_IDS
    );
  }
}

async function sendNotes() {
  try {
    await doc.loadInfo();
    const pairingSheet = doc.sheetsByTitle[PAIRINGS_SHEET_NAME];
    const rows = await pairingSheet.getRows();

    const oneHourAgo = moment().subtract(1, "hour");
    for (const row of rows) {
      const user1 = bot.users.cache.get(row.ID1);
      const user2 = bot.users.cache.get(row.ID2);
      if (row.State === "DONE" && user1) {
        await user1.send(`Please send some notes of your last buddycall.`);
        const filter = (m) => m.author.id === row.ID1;
        const collector = user1.dmChannel.createMessageCollector(filter, {
          time: 60000,
        });
        collector.on("collect", async (m) => {
          if (row.Notes) {
            row.Notes += "\n" + user1.username + ": " + m.content;
          } else {
            row.Notes = user1.username + ": " + m.content;
          }
          await row.save();
          await user1.send(`Thank you for your notes!`);
          collector.stop();
        });
        collector.on("end", async (collected, reason) => {
          console.log(`Collected ${collected.size} messages`);
          if (reason === "time") {
            await user1.send(
              "The message collector has expired. Please ask me to continue if you want to restart the process."
            );
          }
        });
      }
      if (row.State === "DONE" && user2) {
        await user2.send(`Please send some notes of your last buddycall.`);
        const filter = (m) => m.author.id === row.ID2;
        const collector = user2.dmChannel.createMessageCollector(filter, {
          time: 60000,
        });
        collector.on("collect", async (m) => {
          if (row.Notes) {
            row.Notes += "\n" + user2.username + ": " + m.content;
          } else {
            row.Notes = user2.username + ": " + m.content;
          }
          await row.save();
          await user2.send(`Thank you for your notes!`);
          collector.stop();
        });
        collector.on("end", async (collected, reason) => {
          console.log(`Collected ${collected.size} messages`);
          if (reason === "time") {
            await user2.send(
              "The message collector has expired. Please ask me to continue if you want to restart the process."
            );
          }
        });
      }
    }
  } catch (error) {
    console.error(`Error in sendNotes function: ${error.message}`);
    await notifyAdmins(
      `Error occurred while sending notes: ${error.message}`,
      bot,
      ADMIN_IDS
    );
  }
}

async function isUserAwaitingDate(userId) {
  await doc.loadInfo();
  const pairingsSheet = doc.sheetsByTitle[PAIRINGS_SHEET_NAME];
  const rows = await pairingsSheet.getRows();
  return rows.some((row) => row.State === "awaitingDate" && row.ID1 === userId);
}

async function saveBuddyCallDate(userId, date) {
  await doc.loadInfo();
  const pairingsSheet = doc.sheetsByTitle[PAIRINGS_SHEET_NAME];
  const rows = await pairingsSheet.getRows();
  const userRow = rows.find(
    (row) => row.State === "awaitingDate" && row.ID1 === userId
  );
  if (userRow) {
    userRow.Buddycalldate = format(date, "MM/dd/yyyy HH:mm");
    userRow.State = "date set";
    await userRow.save();
  } else {
    console.error(
      `Couldn't find user with ID: ${userId} in 'awaitingDate' state.`
    );
  }
}

async function announceBuddyCall(bot, contributor, date) {
  await doc.loadInfo();
  const announcementChannel = bot.channels.cache.get(
    process.env.ANNOUNCEMENT_CHANNEL_ID
  );
  if (!announcementChannel) {
    console.error("ANNOUNCEMENT_CHANNEL_ID not found");
    return;
  }
  const mention = `<@${contributor}>`;
  const dateStr = date.toLocaleString(); // Format the date as a string
  const message = `A new buddy call has been set for ${mention} on ${dateStr}. Please give some feedback! ${FEEDBACK_FORM}`;
  await announcementChannel.send(message);
}

async function isUserInPairings(userId) {
  await doc.loadInfo();
  const pairingsSheet = doc.sheetsByTitle[PAIRINGS_SHEET_NAME];
  const rows = await pairingsSheet.getRows();
  return rows.some((row) => row.ID1 === userId);
}

async function sendDocLinkToBuddy(userId) {
  await doc.loadInfo();
  const pairingsSheet = doc.sheetsByTitle[PAIRINGS_SHEET_NAME];
  const rows = await pairingsSheet.getRows();

  for (const row of rows) {
    if (row.ID1 === userId) {
      const docLink = row.Doclink;
      const buddyId = row.ID2;

      if (docLink && buddyId) {
        try {
          const buddy = await bot.users.fetch(buddyId);
          await buddy.send(
            `Here is the link to the "Feedback Doc" for your upcoming buddy call: ${docLink}`
          );
        } catch (error) {
          console.error(
            `Failed to send DM to user with ID: ${buddyId}. Error: ${error.message}`
          );
        }
      }
    }
  }
}

async function checkBuddyCallDates(bot) {
  try {
    await doc.loadInfo();
    const pairingsSheet = doc.sheetsByTitle[PAIRINGS_SHEET_NAME];

    if (!pairingsSheet) {
      console.error("Couldn't find the 'Pairings' sheet.");
      return [];
    }

    const rows = await pairingsSheet.getRows();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0); // Set the time to 00:00:00 for comparison

    const updatedContributors = [];
    for (const row of rows) {
      if (!row.Buddycalldate) {
        continue; // Skip this iteration if Buddycalldate is empty
      }

      const buddyCallDate = moment(
        row.Buddycalldate,
        "MM/DD/YYYY HH:mm"
      ).toDate();
      buddyCallDate.setHours(0, 0, 0, 0); // Set the time to 00:00:00 for comparison

      if (+buddyCallDate === +tomorrow) {
        await sendDocLinkToBuddy(row.ID1);

        // Send a status message to the ANNOUNCEMENT_CHANNEL_ID
        const channel = bot.channels.cache.get(ANNOUNCEMENT_CHANNEL_ID);
        if (channel) {
          channel.send(
            `The link ${row.Doclink} has been sent for tomorrows buddy call between **${row.Pair}**.`
          );
        }

        updatedContributors.push(row.ID1);
      }
    }

    if (updatedContributors.length === 0) {
      console.log(
        `The function checkBuddyCallDates ran, but did not find any upcoming reviews for ${tomorrow.toDateString()}.`
      );
    }

    return updatedContributors;
  } catch (error) {
    console.error(`Error in checkBuddyCallDates function: ${error.message}`);
    await notifyAdmins(
      `Error occurred while checking buddy call dates: ${error.message}`,
      bot,
      ADMIN_IDS
    );
    return [];
  }
}

module.exports = {
  updateContributorsSheet,
  checkLastCallDate,
  fetchAndSavePairings,
  pairContributors,
  processDate,
  checkCalls,
  sendNotes,
  promptSelfReview,
  fetchAndSavePairingsWithoutDate,
  dmBuddies,
  isUserAwaitingDate,
  saveBuddyCallDate,
  announceBuddyCall,
  isUserInPairings,
  checkBuddyCallDates,
};
