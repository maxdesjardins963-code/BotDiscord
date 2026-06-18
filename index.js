require('dotenv').config();
const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, 
    REST, Routes, SlashCommandBuilder 
} = require('discord.js');
const fs = require('fs');
const ms = require('ms');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers
    ]
});

// --- ⚙️ CONFIGURATION ---
const MOD_ADMIN_ID = '1505953617805312141';   
const SUPER_ADMIN_ID = '1505953755399454790'; 
const LOGS_CHANNEL_ID = '1505957112386289674'; 

// --- 💾 BASE DE DONNÉES ---
let db = { users: {}, giveaways: {} };
const dbPath = './database.json';

if (fs.existsSync(dbPath)) {
    db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function saveDB() {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 4));
}

function initUser(userId) {
    if (!db.users[userId]) {
        db.users[userId] = { points: 0 };
        saveDB();
    }
}

// --- 🛡️ FONCTION LOGS ---
async function sendLog(guild, action, moderator, target, reason) {
    const logChannel = guild.channels.cache.get(LOGS_CHANNEL_ID);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setTitle(`🛑 Action de Modération : ${action}`)
        .setColor(action === 'Ban' ? '#ff0000' : action === 'Kick' ? '#ffaa00' : '#ffff00')
        .addFields(
            { name: '👤 Cible', value: `${target} (${target.id})`, inline: true },
            { name: '👮 Modérateur', value: `${moderator} (${moderator.id})`, inline: true },
            { name: '📝 Raison', value: reason || 'Aucune raison fournie', inline: false }
        )
        .setTimestamp();

    await logChannel.send({ embeds: [embed] });
}

// --- 📜 DEFINITION DES COMMANDES SLASH ---
const commands = [
    new SlashCommandBuilder()
        .setName('ban').setDescription('[MOD] Bannir un utilisateur')
        .addUserOption(o => o.setName('cible').setDescription('L\'utilisateur à bannir').setRequired(true))
        .addStringOption(o => o.setName('raison').setDescription('Raison du ban').setRequired(false)),
    new SlashCommandBuilder()
        .setName('kick').setDescription('[MOD] Expulser un utilisateur')
        .addUserOption(o => o.setName('cible').setDescription('L\'utilisateur à expulser').setRequired(true))
        .addStringOption(o => o.setName('raison').setDescription('Raison du kick').setRequired(false)),
    new SlashCommandBuilder()
        .setName('mute').setDescription('[MOD] Rendre muet un utilisateur (1h par défaut)')
        .addUserOption(o => o.setName('cible').setDescription('L\'utilisateur à mute').setRequired(true))
        .addStringOption(o => o.setName('raison').setDescription('Raison du mute').setRequired(false)),
    new SlashCommandBuilder()
        .setName('panel').setDescription('[ADMIN] Déployer le menu interactif Nexro'),
    new SlashCommandBuilder()
        .setName('gcreate').setDescription('[ADMIN] Créer un giveaway payant')
        .addStringOption(o => o.setName('lot').setDescription('Le cadeau à gagner').setRequired(true))
        .addStringOption(o => o.setName('duree').setDescription('Durée (ex: 10m, 1h, 1d)').setRequired(true))
        .addIntegerOption(o => o.setName('prix').setDescription('Prix de participation en Nex Points').setRequired(true)),
    new SlashCommandBuilder()
        .setName('addpoints').setDescription('[ADMIN] Donner des Nex Points')
        .addUserOption(o => o.setName('cible').setDescription('L\'utilisateur').setRequired(true))
        .addIntegerOption(o => o.setName('montant').setDescription('Nombre de points').setRequired(true)),
    new SlashCommandBuilder()
        .setName('loto').setDescription('Jouer au Loto (Coût: 50 Nex Points)')
        .addIntegerOption(o => o.setName('numero').setDescription('Choisis un nombre entre 1 et 100').setRequired(true).setMinValue(1).setMaxValue(100)),
    new SlashCommandBuilder()
        .setName('points').setDescription('Voir son solde ou celui d\'un autre joueur')
        .addUserOption(o => o.setName('cible').setDescription('L\'utilisateur').setRequired(false))
];

// --- 🚀 DÉMARRAGE ---
client.once('ready', async () => {
    console.log(`🤖 Nexro Bot est en ligne (${client.user.tag}) !`);
    client.user.setActivity('💠 Gérer les Nex Points', { type: 3 });

    // Enregistrement des commandes Slash direct avec process.env
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        console.log('🔄 Actualisation des commandes (/) en cours...');
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log('✅ Commandes (/) chargées avec succès !');
    } catch (error) {
        console.error("Erreur lors de l'actualisation des commandes :", error);
    }

    setInterval(checkGiveaways, 60000);
});

// --- 💬 GESTION DES INTERACTIONS ---
client.on('interactionCreate', async interaction => {
    // 1. COMMANDES SLASH
    if (interaction.isChatInputCommand()) {
        const { commandName, options, user } = interaction;
        
        initUser(user.id);

        const isMod = user.id === MOD_ADMIN_ID || user.id === SUPER_ADMIN_ID;
        const isSuperAdmin = user.id === SUPER_ADMIN_ID;

        // MODÉRATION
        if (['ban', 'kick', 'mute'].includes(commandName)) {
            if (!isMod) return interaction.reply({ content: "⛔ Tu n'as pas les permissions.", ephemeral: true });
            
            const target = options.getMember('cible');
            const reason = options.getString('raison') || 'Aucune raison spécifiée';

            if (!target) return interaction.reply({ content: "⚠️ Cet utilisateur n'est pas sur le serveur.", ephemeral: true });

            try {
                if (commandName === 'ban') {
                    await target.ban({ reason });
                    await interaction.reply(`✅ ${target.user.tag} a été banni.`);
                    sendLog(interaction.guild, 'Ban', user, target.user, reason);
                } else if (commandName === 'kick') {
                    await target.kick(reason);
                    await interaction.reply(`✅ ${target.user.tag} a été expulsé.`);
                    sendLog(interaction.guild, 'Kick', user, target.user, reason);
                } else if (commandName === 'mute') {
                    await target.timeout(60 * 60 * 1000, reason); 
                    await interaction.reply(`✅ ${target.user.tag} a été mute pour 1 heure.`);
                    sendLog(interaction.guild, 'Mute', user, target.user, reason);
                }
            } catch (err) {
                interaction.reply({ content: "❌ Impossible de sanctionner cet utilisateur (rôle supérieur au mien ?).", ephemeral: true });
            }
            return;
        }

        // PANEL
        if (commandName === 'panel') {
            if (!isSuperAdmin) return interaction.reply({ content: "⛔ Réservé au Super Admin.", ephemeral: true });

            const embed = new EmbedBuilder()
                .setTitle("📘 GUIDE NEXRO 💠")
                .setDescription("Bienvenue dans le centre de contrôle Nexro !\n\nIci tu peux apprendre comment fonctionnent les différents systèmes du serveur 🔥\n\nChoisis une catégorie dans le menu ci-dessous pour afficher les explications :")
                .setColor('#2b2d31')
                .addFields(
                    { name: '💠 Gagner des Nex Points', value: 'Découvre comment t\'enrichir', inline: false },
                    { name: '🎁 Participer aux Giveaways', value: 'Tente ta chance pour gagner du lourd', inline: false }
                );

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('nexro_guide_menu')
                    .setPlaceholder('Choisir une section du guide')
                    .addOptions([
                        { label: 'Gagner des Nex Points', value: 'guide_points', emoji: '💠' },
                        { label: 'Participer aux Giveaways', value: 'guide_giveaways', emoji: '🎁' },
                        { label: 'Niveaux & Progression', value: 'guide_niveaux', emoji: '⭐' },
                    ]),
            );

            await interaction.reply({ embeds: [embed], components: [row] });
            return;
        }

        // GCREATE (GIVEAWAY)
        if (commandName === 'gcreate') {
            if (!isSuperAdmin) return interaction.reply({ content: "⛔ Réservé au Super Admin.", ephemeral: true });

            const prize = options.getString('lot');
            const durationStr = options.getString('duree');
            const cost = options.getInteger('prix');

            const durationMs = ms(durationStr);
            if (!durationMs) return interaction.reply({ content: "⚠️ Temps invalide. Utilise 10m, 1h, 1d...", ephemeral: true });

            const endTime = Date.now() + durationMs;
            const giveawayId = `gw_${Date.now()}`;

            const embed = new EmbedBuilder()
                .setTitle("🎁 Giveaway ouvert")
                .setDescription(`Participe à ce GIVEAWAY pour tenter de gagner un lot exceptionnel !\n\n--------------------------\n\n🎯 **LOT**\n🍍 **${prize}**\n\n--------------------------\n\n📊 **INFOS**\n👥 Gagnants : **1**\n👥 Participants : **0**\n⏳ Fin : <t:${Math.floor(endTime / 1000)}:R>\n\n--------------------------\n\n💰 **PARTICIPATION**\nCoût : **${cost} Nex Points** 💠`)
                .setColor('#2b2d31')
                .setFooter({ text: 'La participation utilise les points requis.' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`join_gw_${giveawayId}`)
                    .setLabel(`Participer • ${cost} points`)
                    .setEmoji('🟢')
                    .setStyle(ButtonStyle.Success)
            );

            const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

            db.giveaways[giveawayId] = {
                messageId: msg.id,
                channelId: interaction.channelId,
                cost: cost,
                prize: prize,
                endTime: endTime,
                participants: [],
                ended: false
            };
            saveDB();
            return;
        }

        // ADDPOINTS
        if (commandName === 'addpoints') {
            if (!isSuperAdmin) return interaction.reply({ content: "⛔ Interdit.", ephemeral: true });
            const target = options.getUser('cible');
            const amount = options.getInteger('montant');

            initUser(target.id);
            db.users[target.id].points += amount;
            saveDB();
            return interaction.reply(`✅ Ajouté **${amount} Nex Points** à ${target}. (Nouveau solde: ${db.users[target.id].points} 💠)`);
        }

        // POINTS
        if (commandName === 'points') {
            const target = options.getUser('cible') || user;
            initUser(target.id);
            return interaction.reply(`💳 Solde de ${target.username} : **${db.users[target.id].points} Nex Points** 💠`);
        }

        // LOTO
        if (commandName === 'loto') {
            const cost = 50;
            const reward = 5000;
            const guess = options.getInteger('numero');

            if (db.users[user.id].points < cost) {
                return interaction.reply({ content: `❌ Tu es fauché ! Il te faut **${cost} Nex Points** pour jouer.`, ephemeral: true });
            }

            db.users[user.id].points -= cost;
            saveDB();

            const winningNumber = Math.floor(Math.random() * 100) + 1;

            if (guess === winningNumber) {
                db.users[user.id].points += reward;
                saveDB();
                return interaction.reply(`🎉 **BINGO !** Incroyable ! Le numéro gagnant était bien le **${winningNumber}** ! Tu remportes le jackpot de **${reward} Nex Points** ! 💠`);
            } else {
                return interaction.reply(`🎰 Dommage... Tu as parié le **${guess}**, mais le numéro gagnant était le **${winningNumber}**. Tu perds ${cost} points.`);
            }
        }
    }

    // 2. MENUS DÉROULANTS (PANEL)
    if (interaction.isStringSelectMenu() && interaction.customId === 'nexro_guide_menu') {
        const choice = interaction.values[0];
        let replyText = "";

        if (choice === 'guide_points') replyText = "**💠 Les Nex Points**\nC'est la monnaie du serveur ! Participe au chat et aux events pour t'enrichir.";
        else if (choice === 'guide_giveaways') replyText = "**🎁 Giveaways**\nUtilise tes points pour rejoindre des concours incroyables avec `/gcreate` (admins) !";
        else if (choice === 'guide_niveaux') replyText = "**⭐ Niveaux & Progression**\nPlus tu es actif, plus tu montes en grade et débloques des avantages.";

        await interaction.reply({ content: replyText, ephemeral: true });
    }

    // 3. BOUTONS (GIVEAWAY)
    if (interaction.isButton() && interaction.customId.startsWith('join_gw_')) {
        const gwId = interaction.customId.replace('join_gw_', '');
        const gw = db.giveaways[gwId];

        if (!gw || gw.ended) return interaction.reply({ content: "❌ Ce giveaway est expiré ou n'existe plus.", ephemeral: true });

        initUser(interaction.user.id);

        if (gw.participants.includes(interaction.user.id)) {
            return interaction.reply({ content: "Tu participes déjà à ce giveaway ! 🍀", ephemeral: true });
        }

        if (db.users[interaction.user.id].points < gw.cost) {
            return interaction.reply({ content: `❌ Il te manque des fonds. Il te faut **${gw.cost} Nex Points** pour participer.`, ephemeral: true });
        }

        db.users[interaction.user.id].points -= gw.cost;
        gw.participants.push(interaction.user.id);
        saveDB();

        const oldEmbed = interaction.message.embeds[0];
        const newEmbed = EmbedBuilder.from(oldEmbed)
            .setDescription(`Participe à ce GIVEAWAY pour tenter de gagner un lot exceptionnel !\n\n--------------------------\n\n🎯 **LOT**\n🍍 **${gw.prize}**\n\n--------------------------\n\n📊 **INFOS**\n👥 Gagnants : **1**\n👥 Participants : **${gw.participants.length}**\n⏳ Fin : <t:${Math.floor(gw.endTime / 1000)}:R>\n\n--------------------------\n\n💰 **PARTICIPATION**\nCoût : **${gw.cost} Nex Points** 💠`);

        await interaction.message.edit({ embeds: [newEmbed] });
        await interaction.reply({ content: `✅ Participation validée ! Tu as payé **${gw.cost} Nex Points**. Bonne chance ! 🍀`, ephemeral: true });
    }
});

// --- ⏲️ VERIFICATION DES GIVEAWAYS ---
async function checkGiveaways() {
    const now = Date.now();
    for (const gwId in db.giveaways) {
        const gw = db.giveaways[gwId];
        if (!gw.ended && now >= gw.endTime) {
            gw.ended = true;
            saveDB();

            try {
                const channel = await client.channels.fetch(gw.channelId);
                const message = await channel.messages.fetch(gw.messageId);

                if (gw.participants.length === 0) {
                    await message.reply("😢 Personne n'a participé à ce giveaway...");
                    continue;
                }

                const winnerId = gw.participants[Math.floor(Math.random() * gw.participants.length)];
                
                const disabledRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('gw_ended').setLabel('Terminé').setStyle(ButtonStyle.Secondary).setDisabled(true)
                );
                
                const endedEmbed = EmbedBuilder.from(message.embeds[0]).setTitle("🎉 Giveaway Terminé").setColor('#78b159');

                await message.edit({ embeds: [endedEmbed], components: [disabledRow] });
                await message.reply(`🎉 Félicitations à <@${winnerId}> qui remporte **${gw.prize}** ! 🎁`);

            } catch (err) {
                console.error("Erreur Giveaway:", err);
            }
        }
    }
}

// Connexion directe avec process.env.TOKEN
client.login(process.env.TOKEN);
