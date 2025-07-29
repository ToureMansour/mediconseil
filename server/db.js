// server/db.js
const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',                // à adapter selon ton MySQL
  password: '', // à adapter
  database: 'mediconseil'       // nom de ta base
});

connection.connect((err) => {
  if (err) {
    console.error('❌ Erreur de connexion à la BDD :', err.message);
    return;
  }
  console.log('✅ Connexion à MySQL réussie !');
});

module.exports = connection;
