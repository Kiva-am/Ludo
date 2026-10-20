import express from 'express';
import {createServer} from 'node:http';
import {MongoClient} from 'mongodb';
import {attachMultiplayer} from './hero-multiplayer.js';
const app=express(),server=createServer(app);
let mongo=null,collection=null;
if(process.env.MONGODB_URI){
 mongo=new MongoClient(process.env.MONGODB_URI,{serverSelectionTimeoutMS:10000});
 try{await mongo.connect();collection=mongo.db(process.env.MONGODB_DB||'ludo').collection('heroRooms');await collection.createIndex({expiresAt:1},{expireAfterSeconds:0});console.log('MongoDB connected: heroRooms.');}
 catch{console.error('MongoDB connection failed. Check Atlas credentials and IP access.');await mongo.close();process.exit(1);}
}else console.log('Local test mode: rooms are in memory. Set MONGODB_URI in .env to save snapshots.');
const multiplayer=attachMultiplayer(server,collection);
app.get('/health',(_req,res)=>res.json({status:'ok',multiplayer:true,persistence:collection?'mongodb':'memory'}));
app.use(express.static('original-ludo',{dotfiles:'deny'}));
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'Port is in use. Stop the other server or set HERO_PORT.':e.message);process.exitCode=1;});
const port=Number(process.env.HERO_PORT)||3002;
const host=process.env.HERO_HOST||'127.0.0.1';
server.listen(port,host,()=>console.log(`Ludo with private rooms: http://${host==='0.0.0.0'?'localhost':host}:${port}`));
async function shutdown(){for(const s of multiplayer.wss.clients)s.close();multiplayer.wss.close();server.close();await mongo?.close();process.exit(0);}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
