const crypto=require('node:crypto');
function aesAdapter() {
  class Key {
    constructor(bytes) { this.value=bytes; }
    static async generate(){return new Key(crypto.randomBytes(32));}
    static async import(value,encoding){return new Key(Buffer.from(value,encoding));}
    async encoded(encoding){return this.value.toString(encoding);}
  }
  return { AESEncryptionKey:Key,AESSealedData:{fromCombined:bytes=>bytes},
    aesEncryptAsync:async(bytes,key,opts)=>{
      const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key.value,iv);
      cipher.setAAD(Buffer.from(opts.additionalData));
      const data=Buffer.concat([iv,cipher.update(bytes),cipher.final(),cipher.getAuthTag()]);
      return {combined:async()=>data};
    },
    aesDecryptAsync:async(bytes,key,opts)=>{
      const data=Buffer.from(bytes),decipher=crypto.createDecipheriv('aes-256-gcm',key.value,data.subarray(0,12));
      decipher.setAAD(Buffer.from(opts.additionalData));decipher.setAuthTag(data.subarray(-16));
      return new Uint8Array(Buffer.concat([decipher.update(data.subarray(12,-16)),decipher.final()]));
    },
  };
}
module.exports={aesAdapter};
