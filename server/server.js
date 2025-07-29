// ✅ server/server.js — modifié

const express = require('express');
const session = require('express-session');
const axios = require('axios');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config();

const db = require('./db');
const authRoutes = require('./routes/auth');
const sessionRoutes = require('./routes/session');

console.log("\uD83D\uDD10 Cl\u00E9 API charg\u00E9e :", process.env.OPENROUTER_API_KEY ? "\u2705 OK" : "\u274C Manquante");

// Utilisation du store en mémoire
const MemoryStore = require('express-session').MemoryStore;
const sessionStore = new MemoryStore();

const app = express();
const PORT = process.env.PORT || 4000;

// Configuration de la session
app.use(session({
  secret: 'chat-secret',
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    httpOnly: true,
    secure: false, // passe à true si tu es en HTTPS
    maxAge: 1000 * 60 * 60 * 24, // 24 heures
    sameSite: 'lax' // Améliore la compatibilité des cookies
  }
}));

// Middleware de débogage des sessions
app.use((req, res, next) => {
  console.group('🔐 Débogage Session');
  console.log('💻 Session ID :', req.sessionID);
  console.log('🔎 Données de session :', req.session);
  console.log('💬 Authentification :', req.session.isAuthenticated);
  console.groupEnd();
  next();
});

app.use(cors({
  origin: 'http://localhost:4000',
  credentials: true // IMPORTANT : pour que les cookies soient acceptés
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware pour servir les fichiers statiques
app.use(express.static(path.join(__dirname, '../public'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Middleware pour chat.html
app.get('/chat.html', (req, res) => {
  console.group('🔐 Accès à chat.html');
  console.log('💻 Session ID :', req.sessionID);
  console.log('🔐 Authentification :', req.session.isAuthenticated);
  console.log('👤 User ID :', req.session.userId);
  console.groupEnd();

  // Servir le fichier chat.html
  res.sendFile(path.join(__dirname, '../public/chat.html'));
});

// Route par défaut pour gérer les fichiers HTML
app.get('/:page.html', (req, res) => {
  const page = req.params.page;
  const filePath = path.join(__dirname, '../public', `${page}.html`);
  
  console.group('👁‍🗨 Diagnostic de fichier');
  console.log('Page demandée :', page);
  console.log('Chemin du fichier :', filePath);
  console.log('Fichier existe :', fs.existsSync(filePath));
  console.groupEnd();

  // Vérifier si le fichier existe
  if (fs.existsSync(filePath)) {
    // Envoyer le fichier
    res.sendFile(filePath);
  } else {
    console.error(`⛔ Fichier non trouvé : ${filePath}`);
    
    // Redirection alternative
    res.status(302).redirect('/index.html');
  }
});

// Middleware de redirection général
app.use((req, res, next) => {
  console.group('🔎 Diagnostic de requête');
  console.log('Chemin demandé :', req.path);
  console.log('Méthode :', req.method);
  console.log('Hôte :', req.get('host'));
  console.log('Protocole :', req.protocol);
  console.groupEnd();
  next();
});

// Middleware de log pour le débogage
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.use('/api', authRoutes);
app.use('/api', sessionRoutes);

// Middleware global de débogage pour chat.html
app.use((req, res, next) => {
  if (req.path === '/chat.html') {
    console.error('\n\n🚨 DIAGNOSTIC COMPLET CHAT.HTML 🚨');
    console.error('🔍 Informations de requête :', JSON.stringify({
      path: req.path,
      method: req.method,
      headers: req.headers,
      sessionID: req.sessionID
    }, null, 2));
    console.error('🔐 Informations de session :', JSON.stringify({
      userId: req.session.userId,
      email: req.session.email,
      isAuthenticated: req.session.isAuthenticated,
      sessionData: req.session
    }, null, 2));
    console.error('🚨 FIN DU DIAGNOSTIC CHAT.HTML 🚨\n\n');
  }
  next();
});

// Middleware de protection pour chat.html
app.get('/chat.html', (req, res) => {
  console.log('🔐 Middleware chat.html - Session :', {
    userId: req.session.userId,
    isAuthenticated: req.session.isAuthenticated
  });
  
  // Toujours servir chat.html
  res.sendFile(path.join(__dirname, '../public/chat.html'), (err) => {
    if (err) {
      console.error('❌ Erreur envoi fichier chat.html :', err);
      res.status(500).send('Erreur serveur');
    }
  });
});

// Middleware de contournement pour chat.html
app.use((req, res, next) => {
  if (req.path === '/chat.html') {
    console.warn('🚨 CONTOURNEMENT ACCES CHAT.HTML');
    // Forcer l'accès sans condition
    return res.sendFile(path.join(__dirname, '../public/chat.html'), (err) => {
      if (err) {
        console.error('❌ Erreur envoi fichier chat.html :', err);
        res.status(500).send('Erreur serveur');
      }
    });
  }
  next();
});

// 📩 Récupération de l'historique des messages pour une session
db.query(`CREATE TABLE IF NOT EXISTS chat (
  id INT AUTO_INCREMENT PRIMARY KEY,
  iduser INT NOT NULL,
  idsession INT NOT NULL,
  question TEXT NOT NULL,
  reponse TEXT NOT NULL,
  date_envoi DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (iduser) REFERENCES utilisateur(id) ON DELETE CASCADE,
  FOREIGN KEY (idsession) REFERENCES chatsession(id) ON DELETE CASCADE
)`);

app.get('/api/messages/:sessionId', (req, res) => {
  const userId = req.session.userId;
  const sessionId = req.params.sessionId;

  if (!userId) return res.status(401).json({ error: "Non autorisé" });

  const sql = 'SELECT question, reponse, date_envoi FROM chat WHERE iduser = ? AND idsession = ? ORDER BY date_envoi ASC';
  db.query(sql, [userId, sessionId], (err, results) => {
    if (err) {
      console.error("❌ Erreur messages:", err);
      return res.status(500).json({ error: "Erreur serveur" });
    }
    res.json({ messages: results });
  });
});

// 📡 Chat + enregistrement en base
app.post('/api/chat', async (req, res) => {
  const userMessage = req.body.message;
  const userId = req.session.userId;
  const sessionId = req.body.sessionId;

  if (!userId || !sessionId) return res.status(400).json({ error: "Session utilisateur manquante" });

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: "mistralai/mistral-7b-instruct-v0.2",
        messages: [
          { role: 'system', content: `
            Tu es un assistant médical intelligent, amical et professionnel,appélé MediConseil spécialisé exclusivement dans les **pathologies humaines** et la comprehension des  symptômes et les maladies des utilisateurs 
        tu dois pouvoir donner des traitements appropriés des conseils.
            Utilise TOUJOURS des emojis adaptés dans tes réponses pour les rendre plus expressives et agréables
            L'utilisateur vient de te saluer 
        Réponds uniquement par une salutation courtoise, chaleureuse et concise  Ta réponse ne doit pas dépasser 2 phrases courtes.
            Tu peux répondre uniquement aux questions portant sur :
            - les **maladies** et **pathologies humaines**
            - les **symptômes**
            - les **traitements médicaux**
            - les **préventions** ou **conduites à tenir en cas de maladie**
            
            ❌ Tu dois **refuser poliment** toute question ne relevant pas de ces domaines en une seule phrase courte (ex : technologie, sport, religion, alimentation, grossesse, animaux, IA, bien-être général, psychologie, médecine vétérinaire...).
            - comprendre les symptômes et les maladies des utilisateurs 
        
            Ta mission est de fournir des réponses médicales simples, compréhensibles et basées uniquement sur les pathologies humaines.
            `}
            ,
          { role: 'user', content: userMessage }
        
        ]

        
      },
      
      {
        
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const reply = response.data.choices?.[0]?.message?.content || "Réponse non disponible.";

    // 💾 Enregistrement du message dans la base
    const sql = 'INSERT INTO chat (iduser, idsession, question, reponse) VALUES (?, ?, ?, ?)';
    db.query(sql, [userId, sessionId, userMessage, reply], (err) => {
      if (err) console.error("❌ Erreur insertion message:", err);
    });

    res.json({ reply });
  } catch (error) {
    console.error("❌ Erreur OpenRouter:", error.response?.data || error.message);
    res.status(500).json({ reply: "Erreur IA." });
  }
});

// 🔐 Route pour vérifier l'authentification de l'utilisateur
app.get('/api/user', (req, res) => {
  console.group('🔎 Vérification utilisateur');
  console.log('💻 Session ID :', req.sessionID);
  console.log('🔐 Authentification :', req.session.isAuthenticated);
  console.log('👤 User ID :', req.session.userId);
  console.groupEnd();

  // Vérifier l'authentification
  if (!req.session.isAuthenticated || !req.session.userId) {
    console.warn('⛔ Utilisateur non authentifié');
    return res.status(401).json({ error: 'Non authentifié' });
  }

  // Récupérer les informations de l'utilisateur
  const sql = 'SELECT nom, email FROM utilisateur WHERE id = ?';
  db.query(sql, [req.session.userId], (err, results) => {
    if (err) {
      console.error('❌ Erreur récupération utilisateur :', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Renvoyer les informations de l'utilisateur
    res.json({
      id: req.session.userId,
      name: results[0].nom,
      email: results[0].email
    });
  });
});

// 🔐 Route pour vérifier l'authentification de l'utilisateur
app.get('/api/user', (req, res) => {
  console.group('🔎 Vérification utilisateur');
  console.log('💻 Session ID :', req.sessionID);
  console.log('🔐 Authentification :', req.session.isAuthenticated);
  console.log('👤 User ID :', req.session.userId);
  console.groupEnd();

  // Vérifier l'authentification
  if (!req.session.isAuthenticated || !req.session.userId) {
    console.warn('⛔ Utilisateur non authentifié');
    return res.status(401).json({ error: 'Non authentifié' });
  }

  // Récupérer les informations de l'utilisateur
  const sql = 'SELECT nom, email FROM utilisateur WHERE id = ?';
  db.query(sql, [req.session.userId], (err, results) => {
    if (err) {
      console.error('❌ Erreur récupération utilisateur :', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Renvoyer les informations de l'utilisateur
    res.json({
      id: req.session.userId,
      name: results[0].nom,
      email: results[0].email
    });
  });
});

app.listen(PORT, () => {
  console.log(`✅ Serveur backend démarré sur http://localhost:${PORT}`);
});
