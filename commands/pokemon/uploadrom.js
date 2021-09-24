const { PokemonRom } = require('../../libs/database/index');
const config = require('../../resources/config');

function filter(message) {
  const isAttachment = message.attachments.size > 0;
  if (isAttachment) return true;
  let url;
  try {
    url = new URL(message.content);
  }
  catch (_) {
    return false;
  }
  return (url.protocol === 'http:' || url.protocol === 'https:');
}

let lastMessage;

/**
 * Downloads attachment or URL from message and writes it to a file
 * Note: Maybe some checks are unnecessary given the filter in the awaitMessages
 * @param {*} message Discord Message
 * @param {*} interaction Discord interaction
 * @param {*} askIfURL ask for name of file if an URL is detected
 * @returns path to file in file system
 */
async function downloadFile(message, interaction, askIfURL) {
  const attach = message.attachments.first();
  let name;
  let url;
  if (attach) {
    name = attach.name;
    url = new URL(attach.url);
  }
  else {
    // Throws error if message content is not an URL
    url = new URL(message.content);
    if (askIfURL) {
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        lastMessage = await message.reply('URL detectada, elige un nombre para el fichero (recuerda añadir la extensión de fichero correcta por ej.: rom.nds):');
        const collectedName = await interaction.channel.awaitMessages({
          max: 1, time: 60000, errors: ['time'],
        });
        name = collectedName.first().content;
      }
      else {
        throw new Error('Invalid URL');
      }
    }
  }
  return { url: url.toString(), name };
}

module.exports = {
  name: 'uploadrom',
  description: 'Sube una rom y la configuración del randomizer',
  category: 'pokemon',
  args: false,
  cooldown: 5,
  roles: [config.pokemonRole],
  run: async (interaction) => {
    const { logger } = interaction.client;
    try {
      lastMessage = await interaction.reply('Sube la ROM (pasa una URL o adjunta el archivo en un mensaje):');
      const collectedRom = await interaction.channel.awaitMessages({
        filter, max: 1, time: 60000, errors: ['time'],
      });
      const romPath = await downloadFile(collectedRom.first(), interaction, true);
      lastMessage = await collectedRom.first().reply('Sube la configuración del randomizer (pasa una URL o adjunta el archivo en un mensaje):');
      const collectedConfig = await interaction.channel.awaitMessages({
        filter, max: 1, time: 60000, errors: ['time'],
      });
      const settingsPath = await downloadFile(collectedConfig.first(), interaction, false);
      const rom = PokemonRom.create({
        currentROMPath: romPath.url,
        currentSettingsPath: settingsPath.url,
        name: romPath.name,
      });
      return collectedConfig.first().reply(`La ROM se ha subido correctamente con id: ${rom.id}`);
    }
    catch (error) {
      logger.error(`Ha habido un error al subir la rom: ${error}`);
      return lastMessage.reply(`Ha habido un error al subir la rom: ${error}`);
    }
  },
};
