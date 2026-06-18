require('dotenv').config();
const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, 
    REST, Routes, SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle 
} = require('discord.js');
const fs = require('fs');
const ms = require('ms');
const express = require('express');

// ==========================================
// 1. INITIALISATION DU BOT
// ==========================================
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers]
});

// 🔴 REMPLACE CES IDS PAR LES TIENS 🔴
const ROLES = {
    MODO: '1505953617805312141',   
    ADMIN: '1505953755399454790'  
};

// ==========================================
// 2. BASE DE DONNÉES
// ==========================================
const dbPath = './database.json';
let db = { users: {}, giveaways: {}, lotos: {} };

if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 4));
} else {
    db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    if (!db.lotos) db.lotos = {}; // Sécurité pour les anciennes DB
}

function saveDB() { fs.writeFileSync(dbPath, JSON.stringify(db, null, 4)); }
function initUser(id) {
    if (!db.users[id]) { db.users[id] = { points: 0 }; saveDB(); }
}

// ==========================================
// 3. COMMANDES SLASH
// ==========================================
const commands = [
    // --- MODÉRATION ---
    new SlashCommandBuilder().setName('ban').setDescription('[MOD] Bannir un membre').addUserOption(o=>o.setName('cible').setDescription('Membre').setRequired(true)).addStringOption(o=>o.setName('raison').setDescription('Raison').setRequired(false)),
    new SlashCommandBuilder().setName('kick').setDescription('[MOD] Expulser un membre').addUserOption(o=>o.setName('cible').setDescription('Membre').setRequired(true)).addStringOption(o=>o.setName('raison').setDescription('Raison').setRequired(false)),
    new SlashCommandBuilder().setName('mute').setDescription('[MOD] Rendre muet (1h)').addUserOption(o=>o.setName('cible').setDescription('Membre').setRequired(true)).addStringOption(o=>o.setName('raison').setDescription('Raison').setRequired(false)),
    
    // --- ADMINISTRATION ---
    new SlashCommandBuilder().setName('panel').setDescription('[ADMIN] Ouvrir le grand guide Nexro'),
    new SlashCommandBuilder().setName('gcreate').setDescription('[ADMIN] Créer un Giveaway')
        .addStringOption(o=>o.setName('lot').setDescription('Le cadeau').setRequired(true))
        .addStringOption(o=>o.setName('duree').setDescription('Ex: 10m, 1h').setRequired(true))
        .addIntegerOption(o=>o.setName('prix').setDescription('Prix en points').setRequired(true)),
    new SlashCommandBuilder().setName('addpoints').setDescription('[ADMIN] Donner des points')
        .addUserOption(o=>o.setName('cible').setDescription('Le joueur').setRequired(true))
        .addIntegerOption(o=>o.setName('montant').setDescription('Points').setRequired(true)),
        
    // --- LE NOUVEAU LOTO ---
    new SlashCommandBuilder().setName('loto').setDescription('[ADMIN] Lancer un grand tirage au sort de Loto')
        .addStringOption(o=>o.setName('lot').setDescription('Le lot que TU choisis d\'offrir (ex: Rôle VIP, 50k points...)').setRequired(true))
        .addStringOption(o=>o.setName('duree').setDescription('Combien de temps ils ont pour parier (ex: 5m, 1h)').setRequired(true))
        .addIntegerOption(o=>o.setName('max_chiffre').setDescription('Le nombre maximum (ex: 100 pour choisir entre 1 et 100)').setRequired(true)),
    
    // --- JOUEURS ---
    new SlashCommandBuilder().setName('points').setDescription('Voir ton solde').addUserOption(o=>o.setName('cible').setDescription('Joueur (optionnel)').setRequired(false))
];

// ==========================================
// 4. DÉMARRAGE
// ==========================================
client.once('clientReady', async () => {
    console.log(`✅ ${client.user.tag} est en ligne !`);
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    } catch (err) { console.error(err); }
    
    // Vérifie les chronos toutes les 30 secondes
    setInterval(() => {
        checkGiveaways();
        checkLotos();
    }, 30000);
});

// ==========================================
// 5. GESTION DES INTERACTIONS
// ==========================================
client.on('interactionCreate', async interaction => {
    
    // ------------------------------------------
    // A. COMMANDES SLASH
    // ------------------------------------------
    if (interaction.isChatInputCommand()) {
        const { commandName, options, user, member } = interaction;
        initUser(user.id);

        const hasModRole = member.roles?.cache.has(ROLES.MODO);
        const hasAdminRole = member.roles?.cache.has(ROLES.ADMIN);
        const isMod = hasModRole || hasAdminRole;
        const isAdmin = hasAdminRole;

        // 🛡️ MODÉRATION
        if (['ban', 'kick', 'mute'].includes(commandName)) {
            if (!isMod) return interaction.reply({ content: "⛔ Tu n'as pas le rôle Modérateur.", ephemeral: true });
            const target = options.getMember('cible');
            const reason = options.getString('raison') || 'Aucune';
            try {
                if (commandName === 'ban') { await target.ban({ reason }); return interaction.reply(`✅ **${target.user.tag}** banni.`); }
                if (commandName === 'kick') { await target.kick(reason); return interaction.reply(`✅ **${target.user.tag}** expulsé.`); }
                if (commandName === 'mute') { await target.timeout(60 * 60 * 1000, reason); return interaction.reply(`✅ **${target.user.tag}** muet 1h.`); }
            } catch (err) { return interaction.reply({ content: "❌ Erreur de permission.", ephemeral: true }); }
        }

        // ⚙️ ADMINISTRATION
        if (['panel', 'gcreate', 'addpoints', 'loto'].includes(commandName)) {
            if (!isAdmin) return interaction.reply({ content: "⛔ Réservé à l'Administration.", ephemeral: true });

            if (commandName === 'panel') {
                const embed = new EmbedBuilder()
                    .setTitle("📜 GRAND GUIDE DU SERVEUR")
                    .setDescription("Sélectionnez une catégorie dans le menu déroulant ci-dessous pour lire les explications détaillées sur le fonctionnement de notre économie, de nos giveaways et de nos événements spéciaux.")
                    .setColor('#2b2d31'); // Couleur sombre UI
                
                const row = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId('panel_guide').setPlaceholder('Sélectionner un module...').addOptions([
                        { label: 'Module Économie (Points)', value: 'desc_points', emoji: '💠' },
                        { label: 'Module Giveaways', value: 'desc_giveaways', emoji: '🎁' },
                        { label: 'Module Loto Administratif', value: 'desc_loto', emoji: '🎰' }
                    ])
                );
                return interaction.reply({ embeds: [embed], components: [row] });
            }

            if (commandName === 'gcreate') {
                const prize = options.getString('lot');
                const durationMs = ms(options.getString('duree'));
                const cost = options.getInteger('prix');
                if (!durationMs) return interaction.reply({ content: "❌ Format de durée invalide.", ephemeral: true });

                const endTime = Date.now() + durationMs;
                const gwId = `gw_${Date.now()}`;
                
                const embed = new EmbedBuilder()
                    .setTitle("🎁 NOUVEAU GIVEAWAY")
                    .setDescription(`**Lot à gagner :** ${prize}\n**Prix du ticket :** ${cost} points\n**Tirage au sort :** <t:${Math.floor(endTime/1000)}:R>`)
                    .setColor('#2b2d31');
                    
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`join_gw_${gwId}`).setLabel(`Acheter un ticket (${cost} pts)`).setStyle(ButtonStyle.Success)
                );

                const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
                db.giveaways[gwId] = { messageId: msg.id, channelId: interaction.channelId, prize, cost, endTime, participants: [], ended: false };
                saveDB();
                return;
            }

            if (commandName === 'loto') {
                const lot = options.getString('lot');
                const durationMs = ms(options.getString('duree'));
                const maxNum = options.getInteger('max_chiffre');
                if (!durationMs) return interaction.reply({ content: "❌ Format de durée invalide.", ephemeral: true });

                const endTime = Date.now() + durationMs;
                const lotoId = `loto_${Date.now()}`;

                const embed = new EmbedBuilder()
                    .setTitle("🎰 LE GRAND LOTO EST OUVERT !")
                    .setDescription(`L'Administration a lancé un Loto exceptionnel !\n\n🏆 **Lot en jeu :** ${lot}\n🎯 **Règle :** Devinez le bon numéro entre **1 et ${maxNum}**.\n⏳ **Fin des paris :** <t:${Math.floor(endTime/1000)}:R>\n\n*Cliquez sur le bouton ci-dessous pour entrer votre numéro secret. Si vous trouvez le numéro exact tiré par le bot à la fin du temps, vous raflevez la mise !*`)
                    .setColor('#FFD700');

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`play_loto_${lotoId}`).setLabel('Faire mon pari !').setStyle(ButtonStyle.Primary).setEmoji('🎟️')
                );

                const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
                
                db.lotos[lotoId] = { messageId: msg.id, channelId: interaction.channelId, lot, endTime, maxNum, guesses: {}, ended: false };
                saveDB();
                return;
            }

            if (commandName === 'addpoints') {
                const target = options.getUser('cible');
                const amount = options.getInteger('montant');
                initUser(target.id);
                db.users[target.id].points += amount;
                saveDB();
                return interaction.reply(`✅ Ajout de **${amount} pts** à ${target.username}.`);
            }
        }

        // 🎮 PUBLIQUE
        if (commandName === 'points') {
            const target = options.getUser('cible') || user;
            initUser(target.id);
            return interaction.reply(`💳 Solde : **${db.users[target.id].points} Nex Points** 💠`);
        }
    }

    // ------------------------------------------
    // B. MENUS DÉROULANTS (LE PANEL / GUIDE)
    // ------------------------------------------
    if (interaction.isStringSelectMenu() && interaction.customId === 'panel_guide') {
        const choice = interaction.values[0];
        let embed = new EmbedBuilder().setColor('#2b2d31');

        if (choice === 'desc_points') {
            embed.setTitle("💠 LE SYSTÈME DE POINTS")
                 .setDescription("Bienvenue dans le cœur de l'économie de notre communauté.\n\n> **À quoi servent les points ?**\nLes Nex Points sont la monnaie officielle du serveur. Ils prouvent ton activité et ton implication. Plus tu es un membre de confiance et actif, plus tu as d'opportunités d'en gagner.\n\n> **Comment les utiliser ?**\nCes points ne servent pas qu'à faire joli sur ton profil. Ils te permettent d'acheter des tickets d'entrée pour les *Giveaways* exclusifs créés par l'Administration. C'est un système méritocratique : seuls ceux qui s'investissent peuvent participer aux gros lots.\n\n*N'hésite pas à taper la commande `/points` à tout moment pour vérifier tes finances personnelles.*");
        } 
        else if (choice === 'desc_giveaways') {
            embed.setTitle("🎁 LES GIVEAWAYS EXCLUSIFS")
                 .setDescription("Le système de Giveaway est notre façon de récompenser la fidélité.\n\n> **Le Fonctionnement**\nLorsqu'un administrateur lance un Giveaway, un message apparaît avec le lot à gagner (Jeux, Nitros, Rôles, etc.) et le prix en points du ticket d'entrée.\n\n> **Comment participer ?**\nIl te suffit de cliquer sur le bouton vert sous le message. Le bot vérifiera instantanément si tu as assez de fonds, te débitera le prix du ticket de manière sécurisée, et t'ajoutera à la liste des participants.\n\nÀ la fin du compte à rebours, le bot effectuera un tirage au sort 100% aléatoire parmi tous les inscrits et annoncera le grand vainqueur. Attention, les tickets ne sont pas remboursables !");
        } 
        else if (choice === 'desc_loto') {
            embed.setTitle("🎰 LE LOTO ADMINISTRATIF")
                 .setDescription("Contrairement aux tirages au sort classiques, le Loto est un test d'intuition totale !\n\n> **Un événement manuel**\nLe Loto n'est pas automatique. C'est un événement déclenché uniquement par un Administrateur qui choisit manuellement le lot exceptionnel qu'il met en jeu.\n\n> **La Mécanique de pari**\nQuand le loto est lancé, tu verras un intervalle (par exemple, entre 1 et 100). En cliquant sur le bouton de participation, une fenêtre va s'ouvrir pour que tu tapes le numéro de ton choix. **Un seul choix par personne est autorisé.**\n\n> **La Résolution**\nQuand le chronomètre tombe à zéro, la roulette du serveur s'arrête sur un chiffre. Le bot analyse ensuite les bases de données : tous ceux qui ont tapé **exactement** ce chiffre remportent le lot ! Si personne ne trouve, le lot est perdu à tout jamais.");
        }
        
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ------------------------------------------
    // C. BOUTONS
    // ------------------------------------------
    // Bouton Giveaway
    if (interaction.isButton() && interaction.customId.startsWith('join_gw_')) {
        const gwId = interaction.customId.replace('join_gw_', '');
        const gw = db.giveaways[gwId];
        if (!gw || gw.ended) return interaction.reply({ content: "❌ Terminé.", ephemeral: true });
        
        initUser(interaction.user.id);
        if (gw.participants.includes(interaction.user.id)) return interaction.reply({ content: "⚠️ Tu as déjà ton ticket !", ephemeral: true });
        if (db.users[interaction.user.id].points < gw.cost) return interaction.reply({ content: `❌ Il te faut ${gw.cost} points.`, ephemeral: true });

        db.users[interaction.user.id].points -= gw.cost;
        gw.participants.push(interaction.user.id);
        saveDB();
        return interaction.reply({ content: `✅ Billet acheté pour ${gw.cost} points !`, ephemeral: true });
    }

    // Bouton Loto -> Ouvre le Modal (Fenêtre pop-up)
    if (interaction.isButton() && interaction.customId.startsWith('play_loto_')) {
        const lotoId = interaction.customId.replace('play_loto_', '');
        const loto = db.lotos[lotoId];
        if (!loto || loto.ended) return interaction.reply({ content: "❌ Ce loto est fermé.", ephemeral: true });

        if (loto.guesses[interaction.user.id]) {
            return interaction.reply({ content: `⚠️ Tu as déjà parié le numéro **${loto.guesses[interaction.user.id]}** !`, ephemeral: true });
        }

        const modal = new ModalBuilder().setCustomId(`modal_loto_${lotoId}`).setTitle('🎰 Fais ton pari !');
        const numInput = new TextInputBuilder()
            .setCustomId('chiffre_choisi')
            .setLabel(`Choisis un nombre entre 1 et ${loto.maxNum}`)
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(numInput));
        await interaction.showModal(modal);
    }

    // ------------------------------------------
    // D. RÉPONSES AUX MODALS (Soumission Loto)
    // ------------------------------------------
    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_loto_')) {
        const lotoId = interaction.customId.replace('modal_loto_', '');
        const loto = db.lotos[lotoId];
        if (!loto || loto.ended) return interaction.reply({ content: "❌ Temps écoulé.", ephemeral: true });

        const inputStr = interaction.fields.getTextInputValue('chiffre_choisi');
        const numero = parseInt(inputStr);

        if (isNaN(numero) || numero < 1 || numero > loto.maxNum) {
            return interaction.reply({ content: `❌ Rejeté : Tu dois entrer un nombre valide entre 1 et ${loto.maxNum}.`, ephemeral: true });
        }

        loto.guesses[interaction.user.id] = numero;
        saveDB();
        return interaction.reply({ content: `✅ Ton pari est validé ! Tu as choisi le **${numero}**. Croise les doigts !`, ephemeral: true });
    }
});

// ==========================================
// 6. SYSTÈMES AUTOMATIQUES (GIVEAWAY & LOTO)
// ==========================================
async function checkGiveaways() {
    const now = Date.now();
    for (const gwId in db.giveaways) {
        const gw = db.giveaways[gwId];
        if (!gw.ended && now >= gw.endTime) {
            gw.ended = true; saveDB();
            try {
                const channel = await client.channels.fetch(gw.channelId);
                const message = await channel.messages.fetch(gw.messageId);
                const disabledRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ended').setLabel('Fermé').setStyle(ButtonStyle.Secondary).setDisabled(true));
                await message.edit({ components: [disabledRow] });
                
                if (gw.participants.length === 0) { await message.reply("😢 Aucun participant pour le giveaway."); continue; }
                const winnerId = gw.participants[Math.floor(Math.random() * gw.participants.length)];
                await message.reply(`🎉 **GIVEAWAY TERMINÉ**\nFélicitations <@${winnerId}> ! Tu remportes : **${gw.prize}** !`);
            } catch (err) {}
        }
    }
}

async function checkLotos() {
    const now = Date.now();
    for (const lotoId in db.lotos) {
        const loto = db.lotos[lotoId];
        if (!loto.ended && now >= loto.endTime) {
            loto.ended = true; saveDB();
            try {
                const channel = await client.channels.fetch(loto.channelId);
                const message = await channel.messages.fetch(loto.messageId);
                const disabledRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ended').setLabel('Paris Terminés').setStyle(ButtonStyle.Secondary).setDisabled(true));
                await message.edit({ components: [disabledRow] });

                // Tirage du chiffre
                const winningNum = Math.floor(Math.random() * loto.maxNum) + 1;
                
                // Recherche des gagnants
                let winners = [];
                for (const [userId, guessedNum] of Object.entries(loto.guesses)) {
                    if (guessedNum === winningNum) winners.push(`<@${userId}>`);
                }

                const resultEmbed = new EmbedBuilder().setTitle("🎰 RÉSULTAT DU LOTO").setColor('#2b2d31');
                
                if (winners.length > 0) {
                    resultEmbed.setDescription(`Le numéro gagnant était le **${winningNum}** !\n\n🎉 **INCROYABLE !** ${winners.join(', ')} a/ont trouvé le bon numéro et remporte(nt) :\n**${loto.lot}** !`);
                } else {
                    resultEmbed.setDescription(`Le numéro gagnant était le **${winningNum}** !\n\n💀 **DOMMAGE !** Absolument personne n'a trouvé le bon numéro. Le lot (**${loto.lot}**) est perdu !`);
                }

                await message.reply({ embeds: [resultEmbed] });
            } catch (err) {}
        }
    }
}

// ==========================================
// 7. SERVEUR RENDER KEEPALIVE
// ==========================================
const app = express();
app.listen(process.env.PORT || 3000);
client.login(process.env.TOKEN);
