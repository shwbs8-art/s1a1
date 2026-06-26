const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, Collection, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType } = require('discord.js');
const {
  joinVoiceChannel,
  entersState,
  VoiceConnectionStatus,
  getVoiceConnection,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus
} = require('@discordjs/voice');
const googleTTS = require('google-tts-api');

// ================= CONFIG =================
const TOKEN = process.env.DISCORD_TOKEN;
const OWNER_ID = "1221550661263429787";

// ================= رومات =================
const LOG_CHANNEL_ID = "1520181215859183888";
const MOD_CHANNEL_ID = "1502361550676168704";
const TICKET_CATEGORY_ID = "1502293033226604725";
const VERIFICATION_CHANNEL_ID = "1520181952408195132";
const STATS_CHANNEL_ID = "1520181215859183888";
const VOICE_CHANNEL_ID = "1502293174218002575";

// ================= الإعدادات =================
const MAX_MESSAGES = 5;
const TIME_WINDOW = 5000;
const MAX_MENTIONS = 3;
const MAX_EMOJIS = 10;
const WARN_LIMIT = 3;
const TICKET_LIMIT = 3;
const VERIFICATION_TIMEOUT = 60000;

// ================= الكلمات المحظورة =================
const BAD_WORDS = [
  'كلمة_محظورة1',
  'كلمة_محظورة2',
  'كلمة_محظورة3'
];

// ================= الروابط الممنوعة =================
const FORBIDDEN_LINKS = [
  'discord.gg',
  'discord.com/invite',
  'tenor.com',
  'giphy.com'
];

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences
  ]
});

// ================= المتغيرات =================
const spamMap = new Collection();
const warnings = new Collection();
const tickets = new Collection();
const verifications = new Collection();
const backups = new Collection();
let isInVoice = false;
let currentAudioPlayer = null;

// ================= عندما يكون البوت جاهز =================
client.once('ready', async () => {
  console.log(`🟢 ${client.user.tag} Online - Security Bot`);
  client.user.setActivity('🛡️ حماية السيرفر', { type: 'WATCHING' });
  
  setInterval(updateStats, 3600000);
  setInterval(createBackup, 21600000);
  
  setTimeout(() => joinVoiceChannelBot(), 5000);
});

// ================= دالة تشغيل صوت الترحيب =================
async function playWelcomeMessage(connection, text) {
  try {
    if (currentAudioPlayer) {
      currentAudioPlayer.stop();
      currentAudioPlayer = null;
    }

    const url = googleTTS.getAudioUrl(text, {
      lang: 'ar',
      slow: false,
      host: 'https://translate.google.com',
    });

    const player = createAudioPlayer();
    const resource = createAudioResource(url);

    player.play(resource);
    connection.subscribe(player);
    currentAudioPlayer = player;

    player.on(AudioPlayerStatus.Idle, () => {
      console.log('✅ انتهى التشغيل');
      currentAudioPlayer = null;
    });

    player.on('error', error => {
      console.error('❌ خطأ في التشغيل:', error.message);
      currentAudioPlayer = null;
    });

  } catch (error) {
    console.error('❌ خطأ في تشغيل الصوت:', error.message);
  }
}

// ================= دالة دخول الروم الصوتي =================
async function joinVoiceChannelBot() {
  try {
    const guild = client.guilds.cache.first();
    if (!guild) return;

    const voiceChannel = guild.channels.cache.get(VOICE_CHANNEL_ID);
    if (!voiceChannel) {
      console.log('❌ الروم الصوتي غير موجود!');
      return;
    }

    if (isInVoice) return;

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator
    });

    connection.on(VoiceConnectionStatus.Ready, () => {
      console.log(`🎙️ البوت دخل الروم الصوتي: ${voiceChannel.name}`);
      isInVoice = true;
      
      playWelcomeMessage(connection, 'أهلاً بكم في سيرفر عراق بابylon');
      
      const channel = client.channels.cache.get(LOG_CHANNEL_ID);
      if (channel) {
        channel.send(`🎙️ **البوت دخل الروم الصوتي:** ${voiceChannel.name}`);
      }
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      console.log('🔌 البوت خرج من الروم الصوتي، يحاول إعادة الدخول خلال 10 ثواني...');
      isInVoice = false;
      
      if (currentAudioPlayer) {
        currentAudioPlayer.stop();
        currentAudioPlayer = null;
      }
      
      setTimeout(async () => {
        console.log('🔄 محاولة إعادة الدخول إلى الروم الصوتي...');
        await joinVoiceChannelBot();
      }, 10000);
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 20000);

  } catch (error) {
    console.log('❌ خطأ في دخول الروم الصوتي:', error.message);
    
    setTimeout(async () => {
      console.log('🔄 محاولة إعادة الدخول إلى الروم الصوتي...');
      await joinVoiceChannelBot();
    }, 15000);
  }
}

// ================= مراقبة دخول الأعضاء إلى الروم الصوتي =================
client.on('voiceStateUpdate', async (oldState, newState) => {
  if (newState.member.user.bot) return;

  if (newState.channelId === VOICE_CHANNEL_ID && oldState.channelId !== VOICE_CHANNEL_ID) {
    const member = newState.member;
    
    const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) {
      logChannel.send(`👋 **${member.user.username}** دخل إلى الروم الصوتي!`);
    }

    try {
      const connection = getVoiceConnection(newState.guild.id);
      if (connection) {
        playWelcomeMessage(connection, `مرحباً ${member.user.username}`);
        console.log(`🎙️ ${member.user.username} دخل الروم الصوتي`);
      }
    } catch (e) {
      console.log('خطأ في الترحيب الصوتي:', e.message);
    }
  }

  if (oldState.channelId === VOICE_CHANNEL_ID && newState.channelId !== VOICE_CHANNEL_ID) {
    const member = oldState.member;
    
    const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) {
      logChannel.send(`👋 **${member.user.username}** غادر الروم الصوتي.`);
    }
  }
});

// =====================================================
// ================= نظام الحماية =================
// =====================================================

// ================= 1. حماية السبام =================
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

  const userId = message.author.id;
  const now = Date.now();

  if (!spamMap.has(userId)) {
    spamMap.set(userId, { messages: [], mentions: 0, emojis: 0, files: 0 });
  }

  const userData = spamMap.get(userId);
  userData.messages.push(now);

  while (userData.messages.length > 0 && userData.messages[0] < now - TIME_WINDOW) {
    userData.messages.shift();
  }

  if (userData.messages.length > MAX_MESSAGES) {
    await message.delete();
    warnUser(message, '🚫 سبام - كثرة الرسائل');
  }

  const mentions = message.mentions.users.size;
  if (mentions > MAX_MENTIONS) {
    await message.delete();
    warnUser(message, `🚫 منشن جماعي (${mentions} منشن)`);
  }

  const emojiCount = (message.content.match(/<a?:.+?:\d+>/g) || []).length;
  if (emojiCount > MAX_EMOJIS) {
    await message.delete();
    warnUser(message, `🚫 إيموجي مفرط (${emojiCount} إيموجي)`);
  }

  if (message.attachments.size > 5) {
    await message.delete();
    warnUser(message, `🚫 ملفات مفرطة (${message.attachments.size} ملف)`);
  }
});

// ================= 2. حماية الروابط =================
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

  const content = message.content.toLowerCase();

  for (const link of FORBIDDEN_LINKS) {
    if (content.includes(link)) {
      await message.delete();
      warnUser(message, `🚫 رابط ممنوع: ${link}`);
      break;
    }
  }

  if (content.match(/https?:\/\/[^\s]+/g)) {
    const links = content.match(/https?:\/\/[^\s]+/g);
    for (const link of links) {
      if (link.includes('discord') || link.includes('nitro') || link.includes('steal')) {
        await message.delete();
        warnUser(message, `🚫 رابط مشبوه: ${link}`);
        break;
      }
    }
  }
});

// ================= 3. حماية الكلمات =================
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

  const content = message.content.toLowerCase();

  for (const word of BAD_WORDS) {
    if (content.includes(word)) {
      await message.delete();
      warnUser(message, `🚫 كلمة محظورة: ${word}`);
      break;
    }
  }
});

// ================= 4. حماية النيك نيم =================
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  if (oldMember.nickname === newMember.nickname) return;
  
  const badNicknames = ['admin', 'owner', 'mod', 'staff', 'hacker', 'hacked'];
  const newNick = newMember.nickname?.toLowerCase() || '';
  
  for (const bad of badNicknames) {
    if (newNick.includes(bad)) {
      await newMember.setNickname(null);
      const embed = new EmbedBuilder()
        .setTitle('🚫 تغيير نيك غير مصرح')
        .setDescription(`**المستخدم:** ${newMember.user.tag}\n**النيك الممنوع:** ${newMember.nickname}`)
        .setColor(0xFF0000)
        .setTimestamp();
      
      const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) await logChannel.send({ embeds: [embed] });
      break;
    }
  }
});

// ================= 5. حماية الهجوم (Anti-Raid) =================
client.on('guildMemberAdd', async (member) => {
  const recentJoins = client.recentJoins || [];
  const now = Date.now();
  
  recentJoins.push({ id: member.id, time: now });
  client.recentJoins = recentJoins.filter(j => now - j.time < 60000);

  if (client.recentJoins.length > 10) {
    const everyone = member.guild.roles.everyone;
    await member.guild.channels.cache.forEach(async channel => {
      await channel.permissionOverwrites.edit(everyone, {
        SendMessages: false
      });
    });

    const embed = new EmbedBuilder()
      .setTitle('🛡️ تفعيل الوضع الآمن')
      .setDescription('تم تفعيل الوضع الآمن بسبب هجوم محتمل!')
      .setColor(0xFF0000)
      .setTimestamp();

    const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) await logChannel.send({ embeds: [embed] });
  }
});

// ================= 6. حماية البوتات =================
client.on('guildMemberAdd', async (member) => {
  if (member.user.bot) {
    const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) {
      const embed = new EmbedBuilder()
        .setTitle('🤖 بوت جديد')
        .setDescription(`**البوت:** ${member.user.tag}\n**الأيدي:** \`${member.id}\``)
        .setColor(0xFFFF00)
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });
    }
  }
});

// =====================================================
// ================= نظام التحذيرات =================
// =====================================================

async function warnUser(message, reason) {
  const userId = message.author.id;

  if (!warnings.has(userId)) {
    warnings.set(userId, []);
  }

  warnings.get(userId).push({ reason, date: new Date(), mod: 'آلي' });
  const count = warnings.get(userId).length;

  const embed = new EmbedBuilder()
    .setTitle('⚠️ تحذير')
    .setDescription(`**المستخدم:** ${message.author}\n**السبب:** ${reason}\n**التحذير:** ${count}/${WARN_LIMIT}`)
    .setColor(0xFFA500)
    .setTimestamp();

  await message.channel.send({ embeds: [embed] });

  const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
  if (logChannel) {
    const logEmbed = new EmbedBuilder()
      .setTitle('⚠️ تحذير آلي')
      .setDescription(`**المستخدم:** ${message.author.tag}\n**السبب:** ${reason}\n**التحذير:** ${count}`)
      .setColor(0xFFA500)
      .setTimestamp();
    await logChannel.send({ embeds: [logEmbed] });
  }

  if (count >= WARN_LIMIT) {
    try {
      await message.member.kick(`تجاوز ${WARN_LIMIT} تحذيرات`);
      const kickEmbed = new EmbedBuilder()
        .setTitle('👢 طرد تلقائي')
        .setDescription(`**المستخدم:** ${message.author.tag}\n**السبب:** تجاوز ${WARN_LIMIT} تحذيرات`)
        .setColor(0xFF0000)
        .setTimestamp();
      await message.channel.send({ embeds: [kickEmbed] });
    } catch (e) {
      console.log(e);
    }
  }
}

// =====================================================
// ================= نظام التحقق =================
// =====================================================

client.on('guildMemberAdd', async (member) => {
  const channel = client.channels.cache.get(VERIFICATION_CHANNEL_ID);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle('🔐 التحقق')
    .setDescription(`**${member}**, اضغط على الزر للتحقق من حسابك!`)
    .setColor(0x00FF00)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`verify_${member.id}`)
      .setLabel('✅ تحقق')
      .setStyle(ButtonStyle.Success)
  );

  await channel.send({ content: member.toString(), embeds: [embed], components: [row] });
  verifications.set(member.id, { timeout: setTimeout(() => {
    member.kick('لم يتم التحقق خلال الوقت المحدد');
  }, VERIFICATION_TIMEOUT) });
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith('verify_')) return;

  const userId = interaction.customId.replace('verify_', '');
  if (interaction.user.id !== userId) {
    return interaction.reply({ content: '❌ هذا الزر ليس لك!', ephemeral: true });
  }

  const member = interaction.member;
  const verifyRole = interaction.guild.roles.cache.find(r => r.name === 'Verified');
  if (!verifyRole) {
    return interaction.reply({ content: '❌ رتبة التحقق غير موجودة!', ephemeral: true });
  }

  await member.roles.add(verifyRole);
  await interaction.reply({ content: '✅ تم التحقق بنجاح!', ephemeral: true });

  if (verifications.has(userId)) {
    clearTimeout(verifications.get(userId).timeout);
    verifications.delete(userId);
  }
});

// =====================================================
// ================= نظام التذاكر =================
// =====================================================

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'create_ticket') {
    const userTickets = tickets.filter(t => t.userId === interaction.user.id);
    if (userTickets.size >= TICKET_LIMIT) {
      return interaction.reply({
        content: `❌ لديك ${TICKET_LIMIT} تذاكر مفتوحة، أغلقتها أولاً!`,
        ephemeral: true
      });
    }

    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: TICKET_CATEGORY_ID,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
        },
        {
          id: interaction.client.user.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
        }
      ]
    });

    tickets.set(channel.id, { userId: interaction.user.id, channelId: channel.id });

    const embed = new EmbedBuilder()
      .setTitle('🎫 تذكرة جديدة')
      .setDescription(`**المستخدم:** ${interaction.user}\n**تم فتح التذكرة بواسطة:** ${interaction.user.tag}`)
      .setColor(0x00FF00)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel('🔒 إغلاق التذكرة')
        .setStyle(ButtonStyle.Danger)
    );

    await channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: `✅ تم فتح التذكرة: ${channel}`, ephemeral: true });
  }

  if (interaction.customId === 'close_ticket') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({
        content: '❌ فقط الأدمن يقدر يغلق التذكرة!',
        ephemeral: true
      });
    }

    const channel = interaction.channel;
    
    const embed = new EmbedBuilder()
      .setTitle('🔒 إغلاق التذكرة')
      .setDescription('سيتم حذف هذه التذكرة خلال 5 ثواني...')
      .setColor(0xFF0000)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    setTimeout(() => {
      channel.delete();
      tickets.delete(channel.id);
    }, 5000);
  }
});

// =====================================================
// ================= الردود التلقائية =================
// =====================================================

const autoReplies = new Map([
  ['سلام', 'وعليكم السلام 👋'],
  ['شلونك', 'تمام وانت؟ 😊'],
  ['شخبارك', 'الحمدلله بخير، شخبارك؟ 😄'],
  ['هلو', 'هلا والله 🌹'],
  ['هاي', 'هاي 🌸'],
  ['صباح الخير', 'صباح النور 🌅'],
  ['مساء الخير', 'مساء النور 🌙'],
  ['شباب', 'نعم 🌹'],
  ['باي', 'باي 👋'],
  ['تصبح على خير', 'تصبح على خير 🌙'],
  ['Good morning', 'Good morning ☀️'],
  ['Good night', 'Good night 🌙'],
  ['Hello', 'Hello 👋'],
  ['Hi', 'Hi 😊']
]);

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

  const content = message.content.toLowerCase().trim();
  
  for (const [key, reply] of autoReplies) {
    if (content === key) {
      await message.reply(reply);
      break;
    }
  }
});

// =====================================================
// ================= الأوامر =================
// =====================================================

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (!message.content.startsWith('!')) return;

  const args = message.content.slice(1).split(' ');
  const command = args[0].toLowerCase();

  // ================= أمر فتح تذكرة =================
  if (command === 'ticket' || command === 'تذكرة') {
    const embed = new EmbedBuilder()
      .setTitle('🎫 نظام التذاكر')
      .setDescription('اضغط على الزر لفتح تذكرة جديدة')
      .setColor(0x00FF00);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('create_ticket')
        .setLabel('🎫 فتح تذكرة')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎫')
    );

    await message.channel.send({ embeds: [embed], components: [row] });
    await message.delete();
  }

  // ================= أمر دخول الروم الصوتي =================
  if (command === 'join' || command === 'دخول') {
    if (message.author.id !== OWNER_ID) {
      return message.reply('❌ هذا الأمر للمالك فقط!');
    }

    await joinVoiceChannelBot();
    message.reply('🎙️ جاري الدخول إلى الروم الصوتي...');
  }

  // ================= أمر الخروج من الروم الصوتي =================
  if (command === 'leave' || command === 'خروج') {
    if (message.author.id !== OWNER_ID) {
      return message.reply('❌ هذا الأمر للمالك فقط!');
    }

    const connection = getVoiceConnection(message.guild.id);
    if (connection) {
      if (currentAudioPlayer) {
        currentAudioPlayer.stop();
        currentAudioPlayer = null;
      }
      connection.destroy();
      isInVoice = false;
      message.reply('🔌 تم الخروج من الروم الصوتي');
    } else {
      message.reply('❌ البوت ليس في روم صوتي');
    }
  }

  // ================= أمر الطوارئ =================
  if (command === 'emergency' || command === 'طوارئ') {
    if (message.author.id !== OWNER_ID) {
      return message.reply('❌ هذا الأمر للمالك فقط!');
    }

    const embed = new EmbedBuilder()
      .setTitle('🚨 تفعيل حالة الطوارئ')
      .setDescription('تم تفعيل حالة الطوارئ!')
      .setColor(0xFF0000)
      .setTimestamp();

    await message.channel.send({ embeds: [embed] });

    message.guild.channels.cache.forEach(async channel => {
      await channel.permissionOverwrites.edit(message.guild.id, {
        SendMessages: false
      });
    });

    const everyone = message.guild.roles.everyone;
    await message.channel.send(`${everyone} 🚨 **حالة طوارئ! تم قفل جميع الرومات!**`);
  }

  // ================= أمر إلغاء الطوارئ =================
  if (command === 'unemergency' || command === 'الغاء_طوارئ') {
    if (message.author.id !== OWNER_ID) {
      return message.reply('❌ هذا الأمر للمالك فقط!');
    }

    message.guild.channels.cache.forEach(async channel => {
      await channel.permissionOverwrites.edit(message.guild.id, {
        SendMessages: null
      });
    });

    const embed = new EmbedBuilder()
      .setTitle('✅ إلغاء حالة الطوارئ')
      .setDescription('تم إلغاء حالة الطوارئ!')
      .setColor(0x00FF00)
      .setTimestamp();

    await message.channel.send({ embeds: [embed] });
  }

  // ================= أمر التطهير =================
  if (command === 'clear' || command === 'مسح') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return message.reply('❌ ما عندك صلاحية!');
    }

    const amount = parseInt(args[1]);
    if (!amount || amount < 1 || amount > 100) {
      return message.reply('📝 استخدم: `!clear 1-100`');
    }

    await message.channel.bulkDelete(amount, true);
    const reply = await message.channel.send(`✅ تم مسح ${amount} رسالة`);
    setTimeout(() => reply.delete(), 3000);
  }

  // ================= أمر الطرد =================
  if (command === 'kick' || command === 'طرد') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      return message.reply('❌ ما عندك صلاحية!');
    }

    const user = message.mentions.users.first();
    if (!user) {
      return message.reply('📝 استخدم: `!kick @شخص`');
    }

    const member = message.guild.members.cache.get(user.id);
    if (!member) {
      return message.reply('❌ العضو غير موجود');
    }

    const reason = args.slice(2).join(' ') || 'بدون سبب';

    try {
      await member.kick(reason);
      message.reply(`✅ تم طرد ${user.tag} (السبب: ${reason})`);
      
      const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setTitle('👢 طرد')
          .setDescription(`**المستخدم:** ${user.tag}\n**بواسطة:** ${message.author.tag}\n**السبب:** ${reason}`)
          .setColor(0xFFA500)
          .setTimestamp();
        await logChannel.send({ embeds: [embed] });
      }
    } catch (e) {
      message.reply(`❌ خطأ: ${e.message}`);
    }
  }

  // ================= أمر الحظر =================
  if (command === 'ban' || command === 'حظر') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return message.reply('❌ ما عندك صلاحية!');
    }

    const user = message.mentions.users.first();
    if (!user) {
      return message.reply('📝 استخدم: `!ban @شخص`');
    }

    const reason = args.slice(2).join(' ') || 'بدون سبب';

    try {
      await message.guild.bans.create(user, { reason });
      message.reply(`✅ تم حظر ${user.tag} (السبب: ${reason})`);
      
      const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setTitle('🔨 حظر')
          .setDescription(`**المستخدم:** ${user.tag}\n**بواسطة:** ${message.author.tag}\n**السبب:** ${reason}`)
          .setColor(0xFF0000)
          .setTimestamp();
        await logChannel.send({ embeds: [embed] });
      }
    } catch (e) {
      message.reply(`❌ خطأ: ${e.message}`);
    }
  }

  // ================= أمر التحذير =================
  if (command === 'warn' || command === 'تحذير') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return message.reply('❌ ما عندك صلاحية!');
    }

    const user = message.mentions.users.first();
    if (!user) {
      return message.reply('📝 استخدم: `!warn @شخص سبب`');
    }

    const reason = args.slice(2).join(' ') || 'بدون سبب';

    if (!warnings.has(user.id)) {
      warnings.set(user.id, []);
    }

    warnings.get(user.id).push({ reason, date: new Date(), mod: message.author.tag });
    const count = warnings.get(user.id).length;

    message.reply(`⚠️ تم تحذير ${user.tag} (التحذير ${count}/${WARN_LIMIT})`);

    if (count >= WARN_LIMIT) {
      const member = message.guild.members.cache.get(user.id);
      if (member) {
        await member.kick(`تجاوز ${WARN_LIMIT} تحذيرات`);
        message.reply(`👢 تم طرد ${user.tag} بسبب تجاوز التحذيرات`);
      }
    }
  }

  // ================= أمر التحذيرات =================
  if (command === 'warns' || command === 'تحذيرات') {
    const user = message.mentions.users.first() || message.author;
    const userWarns = warnings.get(user.id) || [];

    if (userWarns.length === 0) {
      return message.reply(`✅ ${user.tag} ما عنده تحذيرات`);
    }

    const embed = new EmbedBuilder()
      .setTitle(`⚠️ تحذيرات ${user.tag}`)
      .setDescription(userWarns.map((w, i) => `${i+1}. ${w.reason} (بواسطة: ${w.mod})`).join('\n'))
      .setColor(0xFFA500)
      .setTimestamp();

    message.reply({ embeds: [embed] });
  }

  // ================= أمر الإحصائيات =================
  if (command === 'stats' || command === 'احصائيات') {
    const embed = new EmbedBuilder()
      .setTitle('📊 إحصائيات السيرفر')
      .addFields(
        { name: '👥 الأعضاء', value: `${message.guild.memberCount}`, inline: true },
        { name: '🟢 الأونلاين', value: `${message.guild.members.cache.filter(m => m.presence?.status === 'online').size}`, inline: true },
        { name: '📝 الرومات', value: `${message.guild.channels.cache.size}`, inline: true },
        { name: '🛡️ التحذيرات', value: `${warnings.size}`, inline: true },
        { name: '🎫 التذاكر', value: `${tickets.size}`, inline: true }
      )
      .setColor(0x00FF00)
      .setTimestamp();

    message.reply({ embeds: [embed] });
  }

  // ================= أمر قفل الروم =================
  if (command === 'lock' || command === 'قفل') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return message.reply('❌ ما عندك صلاحية!');
    }

    await message.channel.permissionOverwrites.edit(message.guild.id, {
      SendMessages: false
    });

    message.reply('🔒 تم قفل الروم');
  }

  // ================= أمر فتح الروم =================
  if (command === 'unlock' || command === 'فتح') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return message.reply('❌ ما عندك صلاحية!');
    }

    await message.channel.permissionOverwrites.edit(message.guild.id, {
      SendMessages: null
    });

    message.reply('🔓 تم فتح الروم');
  }

  // ================= أمر النسخ الاحتياطي =================
  if (command === 'backup' || command === 'نسخ') {
    if (message.author.id !== OWNER_ID) {
      return message.reply('❌ هذا الأمر للمالك فقط!');
    }

    await createBackup();
    message.reply('✅ تم إنشاء نسخة احتياطية!');
  }

  // ================= أمر المساعدة =================
  if (command === 'help' || command === 'مساعدة') {
    const embed = new EmbedBuilder()
      .setTitle('🛡️ أوامر بوت الحماية')
      .setDescription(`
**🎙️ أوامر الصوتيات:**
\`!join\` - دخول الروم الصوتي (للمالك)
\`!leave\` - الخروج من الروم الصوتي (للمالك)

**🛠️ أوامر الإدارة:**
\`!clear 10\` - مسح الرسائل
\`!kick @شخص\` - طرد عضو
\`!ban @شخص\` - حظر عضو
\`!warn @شخص سبب\` - تحذير عضو
\`!warns @شخص\` - عرض التحذيرات
\`!lock\` - قفل الروم
\`!unlock\` - فتح الروم

**🎫 نظام التذاكر:**
\`!ticket\` - فتح تذكرة

**📊 أوامر عامة:**
\`!stats\` - عرض الإحصائيات
\`!help\` - عرض هذه الرسالة

**🚨 أوامر الطوارئ:**
\`!emergency\` - تفعيل حالة الطوارئ (المالك فقط)
\`!unemergency\` - إلغاء حالة الطوارئ (المالك فقط)
\`!backup\` - إنشاء نسخة احتياطية (المالك فقط)

**🛡️ نظام الحماية:**
- سبام (حماية ضد كثرة الرسائل)
- منشنات جماعية
- إيموجي مفرط
- روابط ممنوعة
- كلمات محظورة
- حماية ضد الهجوم (Anti-Raid)
- حماية ضد البوتات
- حماية ضد النيك نيم
- نظام التحقق
- تسجيل الأحداث
- نظام التذاكر
- نظام الإحصائيات
      `)
      .setColor(0x00FF00)
      .setTimestamp();

    message.reply({ embeds: [embed] });
  }
});

// =====================================================
// ================= تحديث الإحصائيات =================
// =====================================================

async function updateStats() {
  try {
    const guild = client.guilds.cache.first();
    if (!guild) return;

    const statsChannel = client.channels.cache.get(STATS_CHANNEL_ID);
    if (!statsChannel) return;

    const totalMembers = guild.memberCount;
    const onlineMembers = guild.members.cache.filter(m => m.presence?.status === 'online').size;
    const bots = guild.members.cache.filter(m => m.user.bot).size;
    const humans = totalMembers - bots;

    const embed = new EmbedBuilder()
      .setTitle('📊 إحصائيات السيرفر')
      .setColor(0x00FF00)
      .addFields(
        { name: '👥 إجمالي الأعضاء', value: `${totalMembers}`, inline: true },
        { name: '🟢 الأونلاين', value: `${onlineMembers}`, inline: true },
        { name: '🤖 البوتات', value: `${bots}`, inline: true },
        { name: '👤 البشر', value: `${humans}`, inline: true },
        { name: '📝 الرومات', value: `${guild.channels.cache.size}`, inline: true },
        { name: '🛡️ التحذيرات', value: `${warnings.size}`, inline: true },
        { name: '🎫 التذاكر', value: `${tickets.size}`, inline: true }
      )
      .setTimestamp();

    const messages = await statsChannel.messages.fetch({ limit: 10 });
    const oldMessage = messages.find(m => m.author.id === client.user.id);
    
    if (oldMessage) {
      await oldMessage.edit({ embeds: [embed] });
    } else {
      await statsChannel.send({ embeds: [embed] });
    }
  } catch (e) {
    console.log('خطأ في تحديث الإحصائيات:', e.message);
  }
}

// =====================================================
// ================= نظام النسخ الاحتياطي =================
// =====================================================

async function createBackup() {
  try {
    const guild = client.guilds.cache.first();
    if (!guild) return;

    const backup = {
      name: guild.name,
      members: guild.memberCount,
      channels: guild.channels.cache.map(c => ({ name: c.name, type: c.type })),
      roles: guild.roles.cache.map(r => ({ name: r.name, color: r.color })),
      date: new Date()
    };

    backups.set(Date.now(), backup);

    const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) {
      const embed = new EmbedBuilder()
        .setTitle('💾 نسخة احتياطية جديدة')
        .setDescription(`**تم إنشاء نسخة احتياطية للسيرفر**\n**الأعضاء:** ${backup.members}\n**الرومات:** ${backup.channels.length}\n**الأدوار:** ${backup.roles.length}`)
        .setColor(0x00FF00)
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });
    }
  } catch (e) {
    console.log('خطأ في إنشاء النسخة الاحتياطية:', e.message);
  }
}

// =====================================================
// ================= تسجيل الأحداث =================
// =====================================================

client.on('guildMemberAdd', async (member) => {
  const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('👤 عضو جديد')
    .setDescription(`**المستخدم:** ${member.user.tag}\n**الأيدي:** \`${member.id}\``)
    .setColor(0x00FF00)
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });
});

client.on('guildMemberRemove', async (member) => {
  const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('👤 عضو غادر')
    .setDescription(`**المستخدم:** ${member.user.tag}\n**الأيدي:** \`${member.id}\``)
    .setColor(0xFF0000)
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
  if (oldMessage.author?.bot) return;
  if (!oldMessage.guild) return;

  const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('✏️ رسالة معدلة')
    .setDescription(`**المستخدم:** ${oldMessage.author?.tag}\n**الروم:** ${oldMessage.channel.name}`)
    .addFields(
      { name: '📝 قبل التعديل', value: oldMessage.content || 'فارغ' },
      { name: '📝 بعد التعديل', value: newMessage.content || 'فارغ' }
    )
    .setColor(0xFFFF00)
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });
});

client.on('messageDelete', async (message) => {
  if (message.author?.bot) return;
  if (!message.guild) return;

  const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('🗑️ رسالة محذوفة')
    .setDescription(`**المستخدم:** ${message.author?.tag}\n**الروم:** ${message.channel.name}`)
    .addFields(
      { name: '📝 المحتوى', value: message.content || 'فارغ' }
    )
    .setColor(0xFF0000)
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });
});

// =====================================================
// ================= تشغيل البوت =================
// =====================================================

client.login(TOKEN);