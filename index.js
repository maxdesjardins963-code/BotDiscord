const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Remets ton token sécurisé ici :
const TOKEN = 'MTUwNTkzNTQ5NDY5MTY4ODU3OQ.Gyw1ze.XK0EkytMT4Egb3bNKCK3re_WbxVXVdyl8IaVTY'; 

// --- CONFIGURATIONS DES IDS ---
const ROLE_MOD_ID = '1505953487404662804';       
const ROLE_STAFF_ID = '1505953552709845023';     
const SALON_LOGS_ID = '1505957112386289674';     

const DATA_FILE = path.join(__dirname, 'nexrodata.json');
let bdd = { users: {}, giveaways: {} };

function chargerDonnees() {
    if (fs.existsSync(DATA_FILE)) {
        try {
            bdd = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        } catch (e) {
            console.log("⚠️ Fichier de sauvegarde vide ou corrompu, réinitialisation...");
        }
    }
}
function sauvegarderDonnees() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(bdd, null, 4), 'utf-8');
}

let miniGiveawayEnCours = false;
let reponsesMiniGiveaway = new Map(); 
const cooldownsMessages = new Map();

client.once('ready', async () => {
    chargerDonnees();
    console.log(`🛡️🤖 NexroHub Tout-en-un activé sous le nom de ${client.user.tag}!`);

    const commands = [
        new SlashCommandBuilder()
            .setName('nexrohub')
            .setDescription('Afficher le panel principal de NexroHub'),
        
        new SlashCommandBuilder()
            .setName('setpoints')
            .setDescription('Donner des NexroPoints à un membre (Rôle Staff requis)')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre').setRequired(true))
            .addIntegerOption(opt => opt.setName('montant').setDescription('Le nombre de points').setRequired(true)),

        new SlashCommandBuilder()
            .setName('creategiveaway')
            .setDescription('Lancer un giveaway NexroHub (Rôle Staff requis)')
            .addStringOption(opt => opt.setName('prix').setDescription('Le lot à gagner').setRequired(true))
            .addIntegerOption(opt => opt.setName('temps').setDescription('Durée en minutes').setRequired(true))
            .addIntegerOption(opt => opt.setName('cout').setDescription('Coût de participation en NexroPoints (0 si gratuit)').setRequired(true))
            .addIntegerOption(opt => opt.setName('gagnants').setDescription('Nombre de gagnants pour ce tirage').setRequired(true)),

        new SlashCommandBuilder()
            .setName('minigiveaway')
            .setDescription('Lancer un mini-giveaway express devine le nombre (Rôle Staff requis)')
            .addStringOption(opt => opt.setName('prix').setDescription('Le lot à gagner').setRequired(true))
            .addIntegerOption(opt => opt.setName('nombre').setDescription('Le nombre à deviner entre 0 et 100').setRequired(true)),

        new SlashCommandBuilder()
            .setName('ban')
            .setDescription('Bannir définitivement un membre du serveur')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à bannir').setRequired(true))
            .addStringOption(opt => opt.setName('raison').setDescription('Raison du bannissement').setRequired(false)),

        new SlashCommandBuilder()
            .setName('kick')
            .setDescription('Expulser un membre du serveur')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à expulser').setRequired(true))
            .addStringOption(opt => opt.setName('raison').setDescription("Raison de l'expulsion").setRequired(false)),

        new SlashCommandBuilder()
            .setName('mute')
            .setDescription('Mettre un membre en sourdine (Timeout)')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à mute').setRequired(true))
            .addIntegerOption(opt => opt.setName('temps').setDescription('Durée du mute en minutes').setRequired(true))
            .addStringOption(opt => opt.setName('raison').setDescription('Raison du mute').setRequired(false)),

        new SlashCommandBuilder()
            .setName('warn')
            .setDescription('Avertir un membre (Envoie un message privé)')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à avertir').setRequired(true))
            .addStringOption(opt => opt.setName('raison').setDescription('Raison du warn').setRequired(true)),

        new SlashCommandBuilder()
            .setName('clear')
            .setDescription('Supprimer un nombre précis de messages')
            .addIntegerOption(opt => opt.setName('nombre').setDescription('Nombre de messages à supprimer (Max 100)').setRequired(true)),

        new SlashCommandBuilder()
            .setName('lock')
            .setDescription('Verrouiller le salon textuel actuel'),

        new SlashCommandBuilder()
            .setName('unlock')
            .setDescription('Déverrouiller le salon textuel actuel')
    ];

    await client.application.commands.set(commands);
    setInterval(checkGiveaways, 15000); 
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    if (message.content.startsWith('!hack')) {
        if (!message.member.roles.cache.has(ROLE_MOD_ID)) {
            return message.reply("❌ Tu n'as pas le rôle requis pour utiliser le panel de piratage.");
        }

        const cible = message.mentions.users.first();
        if (!cible) return message.reply("❌ Tu dois mentionner un membre à pirater ! Exemple : `!hack @Nexro` 🛰️");

        const msgHack = await message.channel.send(`🛰️ **[PANEL DE PIRATAGE NEXPANEL v3.4]**\nCible verrouillée : ${cible}\n\n🔄 Connexion...`);
        
        setTimeout(async () => {
            await msgHack.edit(`🛰️ **[PANEL DE PIRATAGE NEXPANEL v3.4]**\nCible verrouillée : ${cible}\n\n✅ Connexion...\n🌐 IP trouvée : \`192.168.${Math.floor(Math.random() * 254)}.${Math.floor(Math.random() * 254)}\``);
        }, 2000);

        setTimeout(async () => {
            await msgHack.edit(`🛰️ **[PANEL DE PIRATAGE NEXPANEL v3.4]**\nCible verrouillée : ${cible}\n\n✅ Connexion...\n✅ IP trouvée...\n🔑 Discord token trouvé : \`MTU${Math.random().toString(36).substring(2, 15)}...XXXXXXXX\``);
        }, 4500);

        setTimeout(async () => {
            await msgHack.edit(`🛰️ **[PANEL DE PIRATAGE NEXPANEL v3.4]**\nCible verrouillée : ${cible}\n\n✅ Connexion...\n✅ IP trouvée...\n✅ Discord token trouvé...\n\n💀 **Ceci était une blague.**`);
        }, 7000);

        return; 
    }

    const userId = message.author.id;
    const now = Date.now();
    const todayStr = new Date().toISOString().split('T')[0];

    if (!bdd.users[userId]) {
        bdd.users[userId] = { points: 0, xp: 0, level: 1, last_image_date: null, messages: 0, images: 0 };
    }

    let user = bdd.users[userId];
    let pointsGagnesCeMessage = 0;
    let aGagneQuelqueChose = false;

    const aDesImages = message.attachments.size > 0;
    if (aDesImages && user.last_image_date !== todayStr) {
        pointsGagnesCeMessage += 10;
        user.images += 1;
        user.last_image_date = todayStr;
        aGagneQuelqueChose = true;
    }

    const dernierGainMessage = cooldownsMessages.get(userId) || 0;
    if (now - dernierGainMessage >= 600000) { 
        pointsGagnesCeMessage += 10;
        user.messages += 1;
        cooldownsMessages.set(userId, now); 
        
        const xpGagne = Math.floor(Math.random() * 10) + 10;
        user.xp += xpGagne;

        const xpNecessaire = user.level * 100;
        if (user.xp >= xpNecessaire) {
            user.xp -= xpNecessaire;
            user.level += 1;
            message.channel.send(`✨ **LEVEL UP** ! ${message.author} passe au niveau **${user.level}** !`);
        }
        aGagneQuelqueChose = true;
    }

    if (aGagneQuelqueChose) {
        user.points += pointsGagnesCeMessage;
        sauvegarderDonnees();
    }
});

client.on('interactionCreate', async interaction => {
    const userId = interaction.user.id;

    if (interaction.isChatInputCommand()) {
        const { commandName, options, guild, channel } = interaction;

        const envoyerLog = (action, cible, moderateur, raison, détails = null) => {
            const logChannel = guild.channels.cache.get(SALON_LOGS_ID);
            if (!logChannel) return;
            const embedLog = new EmbedBuilder()
                .setTitle(`🛡️ Log Modération | ${action}`)
                .addFields(
                    { name: '👤 Cible', value: `${cible} (\`${cible.id || cible}\`)`, inline: true },
                    { name: '👮 Modérateur', value: `${moderateur}`, inline: true },
                    { name: '📝 Raison', value: `\`${raison}\``, inline: false }
                )
                .setColor(action.includes('BAN') || action.includes('KICK') ? '#ff0000' : '#ffaa00')
                .setTimestamp();
            if (détails) embedLog.addFields({ name: '📊 Détails', value: détails });
            logChannel.send({ embeds: [embedLog] });
        };

        const listesMod = ['ban', 'kick', 'mute', 'warn', 'clear', 'lock', 'unlock'];
        if (listesMod.includes(commandName) && !interaction.member.roles.cache.has(ROLE_MOD_ID)) {
            return interaction.reply({ content: `❌ Tu n'as pas le rôle requis (<@&${ROLE_MOD_ID}>) pour utiliser les commandes de modération.`, ephemeral: true });
        }

        if (commandName === 'ban') {
            const cible = options.getMember('membre');
            const raison = options.getString('raison') || 'Aucune raison fournie';
            if (!cible || !cible.bannable) return interaction.reply({ content: "❌ Impossible de bannir ce membre.", ephemeral: true });

            await cible.ban({ reason: `${interaction.user.tag} : ${raison}` });
            await interaction.reply({ content: `✅ **${cible.user.tag}** banni.`, ephemeral: true });
            envoyerLog('BAN', cible.user, interaction.user, raison);
        }

        if (commandName === 'kick') {
            const cible = options.getMember('membre');
            const raison = options.getString('raison') || 'Aucune raison fournie';
            if (!cible || !cible.kickable) return interaction.reply({ content: "❌ Impossible d'expulser ce membre.", ephemeral: true });

            await cible.kick(`${interaction.user.tag} : ${raison}`);
            await interaction.reply({ content: `✅ **${cible.user.tag}** expulsé.`, ephemeral: true });
            envoyerLog('KICK', cible.user, interaction.user, raison);
        }

        if (commandName === 'mute') {
            const cible = options.getMember('membre');
            const temps = options.getInteger('temps');
            const raison = options.getString('raison') || 'Aucune raison fournie';
            if (!cible || !cible.moderatable) return interaction.reply({ content: "❌ Impossible de mute ce membre.", ephemeral: true });

            await cible.timeout(temps * 60 * 1000, `${interaction.user.tag} : ${raison}`);
            await interaction.reply({ content: `✅ **${cible.user.tag}** mute pendant \`${temps} minute(s)\`.`, ephemeral: true });
            envoyerLog('MUTE', cible.user, interaction.user, raison, `**Durée :** ${temps} minute(s)`);
        }

        if (commandName === 'warn') {
            const cible = options.getUser('membre');
            const raison = options.getString('raison');
            let mp = true;
            await cible.send(`⚠️ **Avertissement de ${guild.name}**\n**Raison :** ${raison}`).catch(() => mp = false);

            await interaction.reply({ content: `✅ **${cible.tag}** a été averti.`, ephemeral: true });
            envoyerLog('WARN', cible, interaction.user, raison);
        }

        if (commandName === 'clear') {
            const nombre = options.getInteger('nombre');
            if (nombre < 1 || nombre > 100) return interaction.reply({ content: "❌ Le nombre doit être entre 1 et 100.", ephemeral: true });
            if (!channel.permissionsFor(guild.members.me).has(PermissionFlagsBits.ManageMessages)) return interaction.reply({ content: "❌ Permission manquante.", ephemeral: true });

            const supprimes = await channel.bulkDelete(nombre, true).catch(() => null);
            if (!supprimes) return interaction.reply({ content: "❌ Erreur de suppression.", ephemeral: true });

            await interaction.reply({ content: `🧹 **${supprimes.size} messages** supprimés.`, ephemeral: true });
            envoyerLog('CLEAR', `Salon <#${channel.id}>`, interaction.user, `Nettoyage`, `**Supprimés :** ${supprimes.size}`);
        }

        if (commandName === 'lock') {
            if (!channel.permissionsFor(guild.members.me).has(PermissionFlagsBits.ManageRoles)) return interaction.reply({ content: "❌ Permission manquante.", ephemeral: true });
            await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
            await interaction.reply({ content: `🔒 Salon verrouillé avec succès.` });
            envoyerLog('LOCK', `Salon <#${channel.id}>`, interaction.user, `Verrouillage du salon`);
        }

        if (commandName === 'unlock') {
            if (!channel.permissionsFor(guild.members.me).has(PermissionFlagsBits.ManageRoles)) return interaction.reply({ content: "❌ Permission manquante.", ephemeral: true });
            await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null });
            await interaction.reply({ content: `🔓 Salon déverrouillé avec succès.` });
            envoyerLog('UNLOCK', `Salon <#${channel.id}>`, interaction.user, `Réouverture du salon`);
        }

        if (commandName === 'nexrohub') {
            const embed = new EmbedBuilder()
                .setTitle('👻 NEXRO HUB')
                .setDescription(`Bienvenue sur le centre de contrôle de l'économie.\n\n💬 **Gagne des NexroPoints :** 10 coins par message (toutes les 10 minutes).\n🖼️ **Bonus Image :** Poste une image pour obtenir 10 coins bonus une fois par jour.\n\n*Clique sur les boutons ci-dessous pour interagir avec ton compte.*`)
                .setColor('#1a1a1a');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('hub_points').setLabel('💰 NexroPoints').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('hub_profil').setLabel('👤 Mon Profil').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('hub_niveau').setLabel('📈 Mon Niveau').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('hub_giveaways').setLabel('🎁 Giveaways').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('hub_stats').setLabel('📜 Historique').setStyle(ButtonStyle.Secondary)
            );
            await interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'setpoints') {
            if (!interaction.member.roles.cache.has(ROLE_STAFF_ID)) {
                return interaction.reply({ content: `❌ Rôle manquant (<@&${ROLE_STAFF_ID}>).`, ephemeral: true });
            }
            const cible = options.getUser('membre');
            const montant = options.getInteger('montant');

            if (!bdd.users[cible.id]) bdd.users[cible.id] = { points: 0, xp: 0, level: 1, last_image_date: null, messages: 0, images: 0 };
            bdd.users[cible.id].points += montant;
            sauvegarderDonnees();
            await interaction.reply({ content: `✅ **${montant} NexroPoints** ajustés pour ${cible}.`, ephemeral: true });
        }

        if (commandName === 'creategiveaway') {
            if (!interaction.member.roles.cache.has(ROLE_STAFF_ID)) {
                return interaction.reply({ content: `❌ Rôle manquant.`, ephemeral: true });
            }
            const prize = options.getString('prix');
            const temps = options.getInteger('temps');
            const cost = options.getInteger('cout');
            const maxWinners = options.getInteger('gagnants');
            const endsAt = Date.now() + (temps * 60 * 1000);

            if (maxWinners < 1) return interaction.reply({ content: "❌ Minimum 1 gagnant.", ephemeral: true });

            const embedGiv = new EmbedBuilder()
                .setTitle(`🎉 **NEXRO GIVEAWAY** 🎉`)
                .setDescription(`⚡ **Lot à gagner :** \`${prize}\`\n👥 **Nombre de gagnants :** \`${maxWinners}\`\n💰 **Ticket d'entrée :** \`${cost} NexroPoints\`\n⏳ **Fin du tirage :** <t:${Math.floor(endsAt / 1000)}:R>`)
                .setColor('#ff0055');

            const rowGiv = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('join_giveaway').setLabel('🎉 Rejoindre le Giveaway').setStyle(ButtonStyle.Danger)
            );
            
            const msg = await interaction.reply({ embeds: [embedGiv], components: [rowGiv], fetchReply: true });
            bdd.giveaways[msg.id] = { prize, cost, endsAt, channelId: interaction.channelId, maxWinners, participants: [] };
            sauvegarderDonnees();
        }

        if (commandName === 'minigiveaway') {
            if (!interaction.member.roles.cache.has(ROLE_STAFF_ID)) {
                return interaction.reply({ content: `❌ Rôle manquant.`, ephemeral: true });
            }
            if (miniGiveawayEnCours) {
                return interaction.reply({ content: "❌ Un mini-giveaway est déjà en cours !", ephemeral: true });
            }

            const prix = options.getString('prix');
            const nombreSecret = options.getInteger('nombre'); // Option corrigée ici !

            if (nombreSecret < 0 || nombreSecret > 100) {
                return interaction.reply({ content: "❌ Choisi un nombre entre 0 et 100 !", ephemeral: true });
            }
            if (!channel.permissionsFor(guild.members.me).has(PermissionFlagsBits.ManageRoles)) {
                return interaction.reply({ content: "❌ Permission manquante au bot.", ephemeral: true });
            }

            miniGiveawayEnCours = true;
            reponsesMiniGiveaway.clear();

            await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });

            const embedMini = new EmbedBuilder()
                .setTitle("🛰️ **MINI-GIVEAWAY EXPRESS !** 🛰️")
                .setDescription(`Le salon a été verrouillé ! J'ai choisi un nombre secret entre **0** et **100**.\n\n🎁 **Lot à gagner :** \`${prix}\`\n⏳ **Temps restant :** \`45 secondes\`\n\n*Clique sur le bouton ci-dessous pour entrer ton chiffre !*`)
                .setColor('#00ffcc');

            const rowMini = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_devine_nombre').setLabel('🎲 Entrer un nombre').setStyle(ButtonStyle.Success)
            );

            await interaction.reply({ embeds: [embedMini], components: [rowMini] });

            setTimeout(async () => {
                await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null });

                let gagnants = [];
                let plusPetiteDifference = 999;

                reponsesMiniGiveaway.forEach((nbChoisi, idMembre) => {
                    const diff = Math.abs(nbChoisi - nombreSecret);
                    if (diff < plusPetiteDifference) {
                        plusPetiteDifference = diff;
                        gagnants = [idMembre];
                    } else if (diff === plusPetiteDifference) {
                        gagnants.push(idMembre);
                    }
                });

                const embedResultat = new EmbedBuilder().setTitle("🏁 **FIN DU MINI-GIVEAWAY !** 🏁").setColor('#ffaa00');

                if (gagnants.length === 0) {
                    embedResultat.setDescription(`Le temps est écoulé !\n\n🔢 Le nombre secret était : **${nombreSecret}**\n😢 Personne n'a participé.`);
                    await channel.send({ embeds: [embedResultat] });
                } else {
                    const mentionsGagnants = gagnants.map(id => `<@${id}>`).join(', ');
                    if (plusPetiteDifference === 0) {
                        embedResultat.setDescription(`Le temps est écoulé !\n\n🔢 Le nombre secret était bien : **${nombreSecret}**\n👑 **Gagnant(s) (Pile poil !) :** ${mentionsGagnants}\n\n🎁 Tu remportes : **${prix}** !`);
                    } else {
                        embedResultat.setDescription(`Le temps est écoulé !\n\n🔢 Le nombre secret était : **${nombreSecret}**\n👑 **Gagnant(s) le plus proche :** ${mentionsGagnants} (Nombre donné: \`${reponsesMiniGiveaway.get(gagnants[0])}\`)\n\n🎁 Tu remportes : **${prix}** !`);
                    }
                    await channel.send({ content: `🎉 Félicitations ${mentionsGagnants} !`, embeds: [embedResultat] });
                }

                miniGiveawayEnCours = false;
                reponsesMiniGiveaway.clear();
            }, 45000);
        }
    }

    if (interaction.isButton()) {
        if (!bdd.users[userId]) bdd.users[userId] = { points: 0, xp: 0, level: 1, last_image_date: null, messages: 0, images: 0 };
        const user = bdd.users[userId];

        if (interaction.customId === 'btn_devine_nombre') {
            if (!miniGiveawayEnCours) return interaction.reply({ content: "❌ Ce mini-giveaway est terminé !", ephemeral: true });
            if (reponsesMiniGiveaway.has(userId)) return interaction.reply({ content: "❌ Tu as déjà soumis un nombre !", ephemeral: true });

            const modal = new ModalBuilder().setCustomId('modal_devine').setTitle('Devine le Nombre !');
            const inputNombre = new TextInputBuilder()
                .setCustomId('txt_input_nombre').setLabel('Propose un chiffre entre 0 et 100 :').setStyle(TextInputStyle.Short)
                .setPlaceholder('Ex: 55').setMinLength(1).setMaxLength(3).setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(inputNombre));
            await interaction.showModal(modal);
        }

        if (interaction.customId === 'hub_points') await interaction.reply({ content: `💰 Ton solde actuel : **${user.points} NexroPoints**.`, ephemeral: true });
        
        if (interaction.customId === 'hub_profil') {
            const embed = new EmbedBuilder().setTitle(`👤 PROFIL DE ${interaction.user.username.toUpperCase()}`).addFields({ name: '🌟 Niveau', value: `\`Niveau ${user.level}\``, inline: true }, { name: '💰 NexroPoints', value: `\`${user.points} Pts\``, inline: true }).setColor('#00bfff');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        if (interaction.customId === 'hub_niveau') await interaction.reply({ content: `📈 **Niveau ${user.level}** (${user.xp} / ${user.level * 100} XP)`, ephemeral: true });
        if (interaction.customId === 'hub_stats') await interaction.reply({ content: `📜 **Statistiques :**\n💬 Messages : \`${user.messages}\` | 🖼️ Images : \`${user.images}\``, ephemeral: true });
        
        if (interaction.customId === 'hub_giveaways') {
            let txt = "🎁 **Giveaways actifs :**\n\n"; let c = 0;
            for (const id in bdd.giveaways) { if (Date.now() < bdd.giveaways[id].endsAt) { txt += `• **${bdd.giveaways[id].prize}** | Entrée : \`${bdd.giveaways[id].cost} Pts\`\n`; c++; } }
            await interaction.reply({ content: c === 0 ? "Aucun giveaway actif." : txt, ephemeral: true });
        }

        if (interaction.customId === 'join_giveaway') {
            const g = bdd.giveaways[interaction.message.id];
            if (!g || Date.now() > g.endsAt) return interaction.reply({ content: "❌ Ce giveaway est expiré.", ephemeral: true });
            if (g.participants.includes(userId)) return interaction.reply({ content: "❌ Tu es déjà inscrit !", ephemeral: true });
            if (user.points < g.cost) return interaction.reply({ content: `❌ Solde insuffisant (\`${g.cost} Pts\` requis).`, ephemeral: true });

            user.points -= g.cost;
            g.participants.push(userId);
            sauvegarderDonnees();
            await interaction.reply({ content: `🎉 Inscription validée ! \`${g.cost} NexroPoints\` débités.`, ephemeral: true });
        }
    }

    if (interaction.type === InteractionType.ModalSubmit) {
        if (interaction.customId === 'modal_devine') {
            const valeurEntree = interaction.fields.getTextInputValue('txt_input_nombre');
            const conversionNombre = parseInt(valeurEntree);

            if (isNaN(conversionNombre) || conversionNombre < 0 || conversionNombre > 100) {
                return interaction.reply({ content: "❌ Tu devez écrire un nombre valide entre 0 et 100 !", ephemeral: true });
            }

            reponsesMiniGiveaway.set(userId, conversionNombre);
            await interaction.reply({ content: `✅ Ton nombre (**${conversionNombre}**) a été enregistré en secret !`, ephemeral: true });
        }
    }
});

async function checkGiveaways() {
    const now = Date.now();
    for (const id in bdd.giveaways) {
        const g = bdd.giveaways[id];
        if (now >= g.endsAt) {
            const channel = await client.channels.fetch(g.channelId).catch(() => null);
            if (channel) {
                const message = await channel.messages.fetch(id).catch(() => null);
                
                if (g.participants.length === 0) {
                    if (message) {
                        const embedFin = EmbedBuilder.from(message.embeds[0]).setDescription(`⚡ **Lot :** \`${g.prize}\`\n\n😢 Aucun participant inscrit.`);
                        await message.edit({ embeds: [embedFin], components: [] });
                    }
                } else {
                    let listeParticipants = [...g.participants];
                    let gagnantsChoisis = [];
                    const nbGagnantsVoulus = Math.min(g.maxWinners, listeParticipants.length);

                    for (let i = 0; i < nbGagnantsVoulus; i++) {
                        const randomIndex = Math.floor(Math.random() * listeParticipants.length);
                        gagnantsChoisis.push(`<@${listeParticipants[randomIndex]}>`);
                        listeParticipants.splice(randomIndex, 1);
                    }

                    if (message) {
                        const embedFin = EmbedBuilder.from(message.embeds[0]).setDescription(`⚡ **Lot :** \`${g.prize}\`\n👑 **Gagnant(s) :** ${gagnantsChoisis.join(', ')}`);
                        await message.edit({ embeds: [embedFin], components: [] });
                    }
                    channel.send(`🎉 Félicitations à ${gagnantsChoisis.join(', ')} qui remporte(nt) **${g.prize}** !`);
                }
            }
            delete bdd.giveaways[id];
            sauvegarderDonnees();
}

client.login(process.env.TOKEN);
