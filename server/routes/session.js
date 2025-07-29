const express = require('express');
const router = express.Router();
const db = require('../db');

// ✅ Obtenir l'utilisateur connecté (email)
router.get('/session/userinfo', (req, res) => {
  if (!req.session.userId || !req.session.email) {
    return res.status(401).json({ error: 'Non connecté' });
  }
  res.json({ email: req.session.email });
});

// ➕ Créer une nouvelle session
router.post('/session/new', (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: "Non autorisé" });

  const sql = 'INSERT INTO chatsession (iduser) VALUES (?)';
  db.query(sql, [userId], (err, result) => {
    if (err) return res.status(500).json({ error: "Erreur serveur" });
    res.json({ message: "Nouvelle session créée", sessionId: result.insertId });
  });
});

// 📄 Lister les sessions d’un utilisateur
router.get('/session/list', (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: "Non autorisé" });

  const sql = 'SELECT id, date_creation, titre FROM chatsession WHERE iduser = ? ORDER BY date_creation DESC';
  db.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: "Erreur serveur" });
    res.json({ sessions: results });
  });
});

// 🗑️ Supprimer une session
router.delete('/session/delete/:id', (req, res) => {
  const userId = req.session.userId;
  const sessionId = req.params.id;
  if (!userId) return res.status(401).json({ error: "Non autorisé" });

  const sql = 'DELETE FROM chatsession WHERE id = ? AND iduser = ?';
  db.query(sql, [sessionId, userId], (err) => {
    if (err) return res.status(500).json({ error: "Erreur serveur" });
    res.json({ message: "Session supprimée" });
  });
});

// ✏️ Renommer une session
router.put('/session/rename/:id', (req, res) => {
  const userId = req.session.userId;
  const sessionId = req.params.id;
  const { title } = req.body;

  if (!userId || !title) return res.status(400).json({ error: "Données manquantes" });

  const sql = 'UPDATE chatsession SET titre = ? WHERE id = ? AND iduser = ?';
  db.query(sql, [title, sessionId, userId], (err) => {
    if (err) return res.status(500).json({ error: "Erreur serveur" });
    res.json({ message: "Session renommée" });
  });
});

// 🚪 Déconnexion
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Erreur de déconnexion :', err);
      return res.status(500).json({ message: 'Erreur lors de la déconnexion' });
    }
    res.clearCookie('connect.sid'); // Nom du cookie de session par défaut
    res.json({ message: 'Déconnexion réussie' });
  });
});

// Route de vérification d'authentification
router.get('/check-auth', (req, res) => {
  console.log('🔐 Vérification authentification :', {
    userId: req.session.userId,
    isAuthenticated: req.session.isAuthenticated
  });

  if (req.session.userId && req.session.isAuthenticated) {
    res.json({
      authenticated: true,
      userId: req.session.userId,
      email: req.session.email
    });
  } else {
    res.status(401).json({
      authenticated: false
    });
  }
});

module.exports = router;
