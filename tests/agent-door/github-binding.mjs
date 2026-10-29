import {generateKeyPairSync} from 'node:crypto';
// The disposable verifier supplies this binding only to its real Worker.
// Provider I/O is intercepted by the declared GitHub edge; no account key is read.
export default async function(){
 const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs1',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
 return JSON.stringify({appId:'42',installationId:'7',privateKey,apiOrigin:'https://api.github.com'});
}
