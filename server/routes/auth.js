// server/routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const db = require('../db');
const { createNotification } = require('../utils/notifications');

// 🔐 INSCRIPTION
router.post('/register', async (req, res) => {
  const { nom, email, password } = req.body;
  
  // Validation des données
  if (!nom || !email || !password) {
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  }

  try {
    // Vérifier si l'email existe déjà
    const checkEmailQuery = 'SELECT * FROM utilisateur WHERE email = ?';
    db.query(checkEmailQuery, [email], async (checkErr, checkResults) => {
      if (checkErr) {
        return res.status(500).json({ error: 'Erreur serveur' });
      }

      if (checkResults.length > 0) {
        return res.status(409).json({ error: 'Email déjà utilisé' });
      }

      // Hacher le mot de passe
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Insérer le nouvel utilisateur
      const insertQuery = 'INSERT INTO utilisateur (nom, email, motdepasse) VALUES (?, ?, ?)';
      db.query(insertQuery, [nom, email, hashedPassword], (insertErr, result) => {
        if (insertErr) {
          return res.status(500).json({ error: 'Erreur lors de l\'inscription' });
        }
        
        res.status(201).json({ 
          message: 'Inscription réussie', 
          userId: result.insertId 
        });
      });
    });
  } catch (error) {
    console.error('Erreur d\'inscription :', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// CONNEXION
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Vérifier les données d'entrée
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }
  
  try {
    const query = 'SELECT * FROM utilisateur WHERE email = ?';
    db.query(query, [email], async (err, results) => {
      if (err) {
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      
      if (results.length === 0) {
        // Tentative de connexion avec un email inexistant
        await createNotification(null, 'LOGIN_ATTEMPT_FAILED', `Tentative de connexion avec email inconnu : ${email}`);
        return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      }
      
      const user = results[0];
      const isMatch = await bcrypt.compare(password, user.motdepasse);
      
      if (!isMatch) {
        // Mot de passe incorrect
        await createNotification(user.id, 'LOGIN_ATTEMPT_FAILED', 'Mot de passe incorrect');
        return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      }
      
      // Régénérer la session
      req.session.regenerate((err) => {
        if (err) {
          console.error('Erreur régénération session :', err);
          return res.status(500).json({ error: 'Erreur de session' });
        }

        // Définir les données de session
        req.session.userId = user.id;
        req.session.email = user.email;
        req.session.isAuthenticated = true;
        req.session.lastLogin = Date.now();

        // Sauvegarder la session
        req.session.save((err) => {
          if (err) {
            console.error('Erreur sauvegarde session :', err);
            return res.status(500).json({ error: 'Erreur de session' });
          }

          // Connexion réussie
          createNotification(user.id, 'LOGIN_SUCCESS', 'Connexion réussie');

          // Réponse de connexion réussie
          res.status(200).json({
            message: 'Connexion réussie',
            redirect: '/chat.html',
            userId: user.id
          });
        });
      });
    });
  } catch (error) {
    console.error('Erreur de connexion :', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Vérification de l'authentification
router.get('/check-auth', (req, res) => {
  // Vérification simple
  const isAuthenticated = !!(req.session.userId && req.session.isAuthenticated);

  if (isAuthenticated) {
    res.json({
      authenticated: true,
      redirectUrl: '/chat.html'
    });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

module.exports = router;
