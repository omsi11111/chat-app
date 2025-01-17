const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Connexion à la base de données MongoDB
const mongoURI = 'mongodb://localhost:27017/chat_app';
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'Erreur de connexion à MongoDB :'));
db.once('open', () => {
    console.log('Connecté à MongoDB');
});

// Définir un schéma pour les messages
const messageSchema = new mongoose.Schema({
    username: { type: String, required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
});

// Créer un modèle basé sur le schéma
const Message = mongoose.model('Message', messageSchema);

// Définir le répertoire pour servir les fichiers statiques (HTML, CSS, JS)
app.use(express.static('public'));

// Gérer les connexions des clients
io.on('connection', (socket) => {
    console.log('Un utilisateur est connecté');

    // Charger les anciens messages depuis la base de données
    Message.find().sort({ timestamp: 1 }).limit(50).then((messages) => {
        socket.emit('oldMessages', messages); // Envoyer les anciens messages au client
    }).catch(err => {
        console.error('Erreur lors de la récupération des anciens messages :', err);
    });

    // Recevoir un nouveau message et l'enregistrer dans la base de données
    socket.on('message', async (data) => {
        try {
            const nouveauMessage = new Message({ username: `Personne ${data.user}`, content: data.message });
            await nouveauMessage.save();
            io.emit('message', { message: data.message, user: data.user }); // Diffuser le message à tous les utilisateurs
        } catch (error) {
            console.error('Erreur lors de l\'enregistrement du message :', error);
        }
    });

    // Gérer la demande de suppression de la conversation
    socket.on('clearChat', async () => {
        try {
            await Message.deleteMany(); // Supprimer tous les messages de la base de données
            io.emit('clearChat'); // Diffuser à tous les clients que la conversation a été effacée
        } catch (error) {
            console.error('Erreur lors de la suppression de la conversation :', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('Un utilisateur s\'est déconnecté');
    });
});

// Démarrer le serveur
server.listen(3000, () => {
    console.log('Serveur en écoute sur le port http://localhost:3000');
});
