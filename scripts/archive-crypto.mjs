import { createCipheriv,createDecipheriv,randomBytes,createHash } from 'node:crypto';
import { gzipSync,gunzipSync } from 'node:zlib';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export function archiveKey(value) {
 if(!/^[a-f0-9]{64}$/i.test(value??''))throw new Error('HISTORY_KEY must be a 32-byte hex secret. Refusing an unencrypted archive.');
 return Buffer.from(value,'hex');
}
export function sealArchive(bytes,name,key){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
 cipher.setAAD(Buffer.from('bsq-history-v1:'+name));
 const data=Buffer.concat([cipher.update(gzipSync(bytes)),cipher.final()]);
 return {version:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),sha256:digest(bytes),data:data.toString('base64')};
}
export function openArchive(envelope,name,key){
 if(envelope?.version!==1)throw new Error('Unknown archive envelope');
 const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(envelope.iv,'base64'));
 decipher.setAAD(Buffer.from('bsq-history-v1:'+name));decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));
 const bytes=gunzipSync(Buffer.concat([decipher.update(Buffer.from(envelope.data,'base64')),decipher.final()]));
 if(digest(bytes)!==envelope.sha256)throw new Error('Archive checksum failed');
 return bytes;
}
