require('dotenv').config();
const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, 
    REST, Routes, SlashCommandBuilder 
} = require('discord.js');
const fs = require('fs');
const ms = require('ms');
const express = require('express');

// --- INITIALISATION ---
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers]
});

// Configuration
const MOD_ADMIN_ID = '1505953617805312141';   
const SUPER_ADMIN_ID = '1505953755399454790'; 
const LOGS_CHANNEL_ID = '1505957112386289674'; 

// --- BASE DE DONNÉES ---
let db = { users: {}, giveaways: {} };
const dbPath = './database.json';
if (fs.existsSync(dbPath)) db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
function saveDB() { fs.writeFileSync(dbPath, JSON.stringify(db, null, 4)); }
function initUser(id) { if (!db.users[id]) { db.users[id] = { points: 0 }; saveDB(); } }

// --- DÉFINITION DES COMMANDES ---
const commands = [
    new SlashCommandBuilder().setName('ban').setDescription('[MOD] Bannir un membre').addUserOption(o=>o.setName('cible').setRequired(true)).addStringOption(o=>o.setName('raison')),
    new SlashCommandBuilder().setName('kick').setDescription('[MOD] Expulser').addUserOption(o=>o.setName('cible').setRequired(true)).addStringOption(o=>o.setName('raison')),
    new SlashCommandBuilder().setName('mute').setDescription('[MOD] Mute 1h').addUserOption(o=>o.setName('cible').setRequired(true)).addStringOption(o=>o.setName('raison')),
    new SlashCommandBuilder().setName('panel').setDescription('[ADMIN] Ouvrir le guide Nexro'),
    new SlashCommandBuilder().setName('gcreate').setDescription('[ADMIN] Créer Giveaway').addStringOption(o=>o.setName('lot').setRequired(true)).addStringOption(o=>o.setName('duree').setRequired(true)).addIntegerOption(o=>o.setName('prix').setRequired(true)),
    new SlashCommandBuilder().setName('addpoints').setDescription('[ADMIN] Donner des points').addUserOption(o=>o.setName('cible').setRequired(true)).addIntegerOption(o=>o.setName('montant').setRequired(true)),
    new SlashCommandBuilder().setName('loto').setDescription('Tenter sa chance (50 pts)').addIntegerOption(o=>o.setName('numero').setRequired(true).setMinValue(1).setMaxValue(100)),
    new SlashCommandBuilder().setName('points').setDescription('Voir ses points').addUserOption(o=>o.setName('cible'))
];

// --- ÉVÉNEMENTS ---
client.once('ready', async () => {
    console.log(`✅ Nexro Bot est connecté en tant que ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    setInterval(checkGiveaways, 60000);
});

client.on('interactionCreate', async interaction => {
    // 1. COMMANDES SLASH
    if (interaction.isChatInputCommand()) {
        const { commandName, options, user } = interaction;
        initUser(user.id);
        const isMod = user.id === MOD_ADMIN_ID || user.id === SUPER_ADMIN_ID;
        const isSuperAdmin = user.id === SUPER_ADMIN_ID;

        // Modération
        if (['ban', 'kick', 'mute'].includes(commandName)) {
            if (!isMod) return interaction.reply({ content: "⛔ Tu n'es pas modérateur.", ephemeral: true });
            const target = options.getMember('cible');
            const reason = options.getString('raison') || 'Aucune raison';
            try {
                if (commandName === 'ban') await target.ban({ reason });
                else if (commandName === 'kick') await target.kick(reason);
                else if (commandName === 'mute') await target.timeout(60 * 60 * 1000, reason);
                interaction.reply(`✅ ${commandName} exécuté sur ${target.user.tag}.`);
            } catch (e) { interaction.reply("❌ Erreur : rôle trop haut ou permissions insuffisantes."); }
        }

        // Panel
        if (commandName === 'panel') {
            if (!isSuperAdmin) return interaction.reply({ content: "⛔ Réservé au Super Admin.", ephemeral: true });
            const embed = new EmbedBuilder().setTitle("📘 GUIDE NEXRO 💠").setDescription("Choisis une catégorie pour apprendre comment utiliser le bot :");
            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('nexro_guide_menu').setPlaceholder('Choisis un guide').addOptions([
                    { label: 'Gagner des Points', value: 'guide_points', emoji: '💠' },
                    { label: 'Giveaways', value: 'guide_giveaways', emoji: '🎁' },
                    { label: 'Loto & Jeu', value: 'guide_loto', emoji: '🎰' }
                ])
            );
            interaction.reply({ embeds: [embed], components: [row] });
        }

        // Giveaway Création
        if (commandName === 'gcreate') {
            if (!isSuperAdmin) return;
            const prize = options.getString('lot');
            const duration = ms(options.getString('duree'));
            const cost = options.getInteger('prix');
            const endTime = Date.now() + duration;
            const id = `gw_${Date.now()}`;

            const embed = new EmbedBuilder().setTitle("🎁 Nouveau Giveaway").setDescription(`Lot: **${prize}**\nPrix participation: **${cost} points**\nFin dans: <t:${Math.floor(endTime/1000)}:R>`);
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`join_gw_${id}`).setLabel('Participer').setStyle(ButtonStyle.Success));
            const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

            db.giveaways[id] = { messageId: msg.id, channelId: interaction.channelId, cost, prize, endTime, participants: [], ended: false };
            saveDB();
        }

        // Points
        if (commandName === 'points') {
            const target = options.getUser('cible') || user;
            initUser(target.id);
            interaction.reply(`💳 **${target.username}** possède **${db.users[target.id].points} Nex Points**.`);
        }
        if (commandName === 'addpoints' && isSuperAdmin) {
            const target = options.getUser('cible');
            initUser(target.id);
            db.users[target.id].points += options.getInteger('montant');
            saveDB();
            interaction.reply("✅ Points ajoutés avec succès.");
        }

        // Loto
        if (commandName === 'loto') {
            if (db.users[user.id].points < 50) return interaction.reply("❌ Il te faut 50 points pour jouer !");
            db.users[user.id].points -= 50;
            const win = Math.floor(Math.random() * 100) + 1 === options.getInteger('numero');
            if (win) { db.users[user.id].points += 5000; interaction.reply("🎉 JACKPOT ! Tu as gagné 5000 points !"); }
            else interaction.reply("🎰 Perdu... Le numéro était différent.");
            saveDB();
        }
    }

    // 2. INTERACTIONS BOUTONS & MENUS
    if (interaction.isStringSelectMenu() && interaction.customId === 'nexro_guide_menu') {
        const guides = {
            guide_points: "💠 **Gagner des Points** : Participe au chat, sois actif, et utilise les commandes d'admin pour en obtenir !",
            guide_giveaways: "🎁 **Giveaways** : Utilise `/gcreate` pour en créer un. Les membres cliquent sur le bouton pour participer en payant des points.",
            guide_loto: "🎰 **Loto** : Commande `/loto <numéro>`. Mise de 50 points, gain potentiel de 5000 points !"
        };
        interaction.reply({ content: guides[interaction.values[0]], ephemeral: true });
    }

    if (interaction.isButton() && interaction.customId.startsWith('join_gw_')) {
        const id = interaction.customId.replace('join_gw_', '');
        const gw = db.giveaways[id];
        if (!gw || gw.ended) return interaction.reply({ content: "❌ Giveaway fini ou inexistant.", ephemeral: true });
        if (gw.participants.includes(interaction.user.id)) return interaction.reply({ content: "Déjà inscrit !", ephemeral: true });
        if (db.users[interaction.user.id].points < gw.cost) return interaction.reply({ content: "Pas assez de points !", ephemeral: true });
        
        db.users[interaction.user.id].points -= gw.cost;
        gw.participants.push(interaction.user.id);
        saveDB();
        interaction.reply({ content: "✅ Participation enregistrée !", ephemeral: true });
    }
});

// --- SERVEUR WEB (Render Keep-Alive) ---
const app = express();
app.get('/', (req, res) => res.send('Nexro Bot est en ligne !'));
app.listen(process.env.PORT || 3000);

// --- FONCTIONS ---
async function checkGiveaways() {
    for (const id in db.giveaways) {
        const gw = db.giveaways[id];
        if (!gw.ended && Date.now() >= gw.endTime) {
            gw.ended = true;
            if (gw.participants.length > 0) {
                const winner = gw.participants[Math.floor(Math.random() * gw.participants.length)];
                client.channels.cache.get(gw.channelId)?.send(`🎉 Félicitations <@${winner}> ! Tu as gagné le giveaway pour : **${gw.prize}** !`);
            }
            saveDB();
        }
    }
}

client.login(process.env.TOKEN);
