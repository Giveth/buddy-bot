# buddy-bot

This Discord bot facilitates a buddy pairing system, allowing users to be paired up with buddies for calls and handling various administrative tasks within the buddy system.

1. **Buddy Pairing**: Pairs users for buddy calls and notifies them.
2. **Role-based Administration**: Allows members with the "buddy-admin" role to execute special commands.

## Setup & Installation:

### Local Setup:

**Set up a discord bot first! See below how!**

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/Giveth/buddy-bot.git
   cd buddy-bot
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Environment Variables**:
   Copy `.env.template` to `.env.template` set all the needed values:
   ```
   SPREADSHEET_ID=your_spreadsheet_id
   MAIN_SHEET_NAME=your_main_sheet_name
   PAIRINGS_SHEET_NAME=your_pairings_sheet_name
   ANNOUNCEMENT_CHANNEL_ID=your_announcement_channel_id
   DISCORD_TOKEN=your_discord_bot_token
   ROLE=desired_role_for_paired_users
   ...
   ```

4. **Run the Bot**:
   ```bash
   node bot.js
   ```

### Discord Developer Portal Setup:

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click on the "New Application" button and give it a name.
3. Navigate to the "Bot" tab on the left and click "Add Bot".
4. Under the "TOKEN" section, click "Copy" to get your bot token. This is what you'll set as `DISCORD_TOKEN` in your `.env` file.
5. Under the "OAuth2" tab, under "OAuth2 URL Generator", select the following scopes: `bot`.
6. Under "Bot Permissions", select:
   - `Send Messages`
   - `Read Message History`
   - `View Channels`
   - `Manage Roles` (for role-based actions, use with caution)
   - `Attach Files` (for audio transcription)

7. Using the generated URL under "OAuth2 URL Generator", invite the bot to your server.

## Usage:

- **Updating the Contributors Sheet**:
  Admin users can type `!fillSheet` to update the contributors sheet with all people who possess the "Contributor" role.

- **Pairing Contributors**:
  Admin users can type `!pairContributors` in any channel to initiate the **pairing process**.

## The Pairing process
- A cron job is packaged with the bot that will run `!pairContributors` automatically every quarter
- Once the process has been started the *announcement channel* will announce the pairings for this round and send a DM to every participant, telling them who their buddy is and requesting a date and time for their feedback call
- Another cron job will check the sheet every ten minutes for buddy calls that already happened
- One hour after a call, the contributors will get a DM asking them for their buddy feedback call **notes**
- The notes get sent to the relevant person in HR

## Docker Deployment:

1. Build the Docker image:
   ```bash
   docker build -t your_bot_name .
   ```

2. Run the bot inside a Docker container:
   ```bash
   docker run your_bot_name
   ```

## Permissions:

Ensure the bot has permission to read roles, send messages, read messages, and access message attachments. If using role-based actions like updating roles or checking member roles, ensure that the bot's role is higher in the server's role hierarchy than the roles it's managing.
