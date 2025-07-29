// server/utils/notifications.js
const db = require('../db');

const createNotification = async (userId, type, message) => {
  try {
    const query = 'INSERT INTO notifications (utilisateur_id, type, message, date_creation) VALUES (?, ?, ?, NOW())';
    await new Promise((resolve, reject) => {
      db.query(query, [userId, type, message], (err, result) => {
        if (err) reject(err);
        resolve(result);
      });
    });
  } catch (error) {
    console.error('Erreur lors de la création de la notification :', error);
  }
};

module.exports = { createNotification };
