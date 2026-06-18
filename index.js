require('dotenv').config();
const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, 
    REST, Routes, SlashCommandBuilder 
} = require('discord.js');
const fs = require('fs');
const ms = require('ms');
const express = require('express');

// --- ⚙️ CONFIGURATION ---
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers]
});

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

// --- 📜 COMMANDES SLASH ---
const commands = [
    new SlashCommandBuilder().setName('ban').setDescription('[MOD] Bannir').addUserOption(o=>o.setName('cible').setRequired(true)).addStringOption(o=>o.setName('raison')),
    new SlashCommandBuilder().setName('kick').setDescription('[MOD] Expulser').addUserOption(o=>o.setName('cible').setRequired(true)).addStringOption(o=>o.setName('raison')),
    new SlashCommandBuilder().setName('mute').setDescription('[MOD] Mute 1h').addUserOption(o=>o.setName('cible').setRequired(true)).addStringOption(o=>o.setName('raison')),
    new SlashCommandBuilder().setName('panel').setDescription('[ADMIN] Menu'),
    new SlashCommandBuilder().setName('gcreate').setDescription('[ADMIN] Giveaway').addStringOption(o=>o.setName('lot').setRequired(true)).addStringOption(o=>o.setName('duree').setRequired(true)).addIntegerOption(o=>o.setName('prix').setRequired(true)),
    new SlashCommandBuilder().setName('addpoints').setDescription('[ADMIN] Ajouter points').addUserOption(o=>o.setName('cible').setRequired(true)).addIntegerOption(o=>o.setName('montant').setRequired(true)),
    new SlashCommandBuilder().setName('loto').setDescription('Loto (50 points)').addIntegerOption(o=>o.setName('numero').setRequired(true).setMinValue(1).setMaxValue(100)),
    new SlashCommandBuilder().setName('points').setDescription('Voir solde').addUserOption(o=>o.setName('cible'))
];

client.once('ready', async () => {
    console.log(`🤖 Nexro Bot est en ligne : ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log('✅ Commandes Slash enregistrées.');
    } catch (e) { console.error(e); }
    setInterval(checkGiveaways, 60000);
});

// --- 💬 INTERACTIONS ---
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const { commandName, options, user } = interaction;
        initUser(user.id);
        const isMod = user.id === MOD_ADMIN_ID || user.id === SUPER_ADMIN_ID;
        const isSuperAdmin = user.id === SUPER_ADMIN_ID;

        // Modération
        if (['ban', 'kick', 'mute'].includes(commandName)) {
            if (!isMod) return interaction.reply({ content: "⛔ Permissions insuffisantes.", ephemeral: true });
            const target = options.getMember('cible');
            const reason = options.getString('raison') || 'Aucune';
            try {
                if (commandName === 'ban') await target.ban({ reason });
                else if (commandName === 'kick') await target.kick(reason);
                else if (commandName === 'mute') await target.timeout(60 * 60 * 1000, reason);
                interaction.reply(`✅ ${commandName} réussi.`);
            } catch (e) { interaction.reply("❌ Erreur."); }
            return;
        }

        // Autres commandes...
        if (commandName === 'points') {
            const target = options.getUser('cible') || user;
            initUser(target.id);
            interaction.reply(`💳 ${target.username} a **${db.users[target.id].points} Nex Points**.`);
        }
        
        if (commandName === 'addpoints' && isSuperAdmin) {
            const target = options.getUser('cible');
            const amount = options.getInteger('montant');
            initUser(target.id);
            db.users[target.id].points += amount;
            saveDB();
            interaction.reply(`✅ Ajouté.`);
        }

        // (Ajoute le reste de ta logique panel/loto/gcreate ici comme avant)
    }
});

// --- 🌐 SERVEUR EXPRESS (CRUCIAL POUR RENDER) ---
const app = express();
app.get('/', (req, res) => res.send('Bot Actif'));
app.listen(process.env.PORT || 3000);

client.login(process.env.TOKEN);

async function checkGiveaways() { /* Ta fonction de vérification */ }
