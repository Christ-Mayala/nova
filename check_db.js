// Check local DB
require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/dryapi')
  .then(() => {
    console.log('Local DB connectée');
    
    // Wait for models to be ready
    setTimeout(async () => {
      try {
        const { getTenantDB } = require('./dry/config/connection/dbConnection');
        await getTenantDB('Nova');
        
        const User = mongoose.model('User');
        const Espace = mongoose.model('Espace');
        const Membre = mongoose.model('Membre');
        
        console.log('\n--- Users ---');
        const users = await User.find({}).select('email name role');
        console.log('Total:', users.length);
        users.forEach(u => console.log(' -', u.email, u.name || '', u.role));
        
        console.log('\n--- Espaces ---');
        const espaces = await Espace.find({}).select('nom role createdBy');
        console.log('Total:', espaces.length);
        espaces.forEach(e => console.log(' -', e.nom, e.role || '', e.createdBy));
        
        console.log('\n--- Membres ---');
        const membres = await Membre.find({}).select('email role');
        console.log('Total:', membres.length);
        membres.forEach(m => console.log(' -', m.email, m.role));
        
      } catch (err) {
        console.error('Erreur:', err);
      }
      
      mongoose.disconnect();
      console.log('\nDone');
    }, 1000);
  })
  .catch(e => console.error('Erreur connexion:', e.message));