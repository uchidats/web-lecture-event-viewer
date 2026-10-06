'use strict';
function validateSecret(value) {
  if(typeof value!=='string'||!value.trim())throw new Error('oauth_secret_unavailable');
  return value;
}
class EnvironmentSecretProvider {
  #env; #pending;
  constructor(env=process.env){this.#env=env;}
  getGoogleOAuthClientSecret(){
    if(!this.#pending)this.#pending=Promise.resolve().then(()=>validateSecret(this.#env.GOOGLE_OAUTH_CLIENT_SECRET)).catch(()=>{throw new Error('oauth_secret_unavailable');});
    return this.#pending;
  }
}
class GoogleSecretManagerProvider {
  #name; #clientFactory; #pending;
  constructor({projectId,secretName='ophthalconf-google-oauth-client-secret',clientFactory=()=>{
    const {SecretManagerServiceClient}=require('@google-cloud/secret-manager');
    return new SecretManagerServiceClient(); // ADC only; no key files or explicit credentials.
  }}={}){
    if(typeof projectId!=='string'||!/^[A-Za-z0-9-]+$/.test(projectId)||typeof secretName!=='string'||!/^[A-Za-z0-9_-]{1,255}$/.test(secretName))throw new Error('Invalid Secret Manager configuration');
    this.#name=`projects/${projectId}/secrets/${secretName}/versions/latest`;this.#clientFactory=clientFactory;
  }
  getGoogleOAuthClientSecret(){
    if(!this.#pending)this.#pending=(async()=>{
      try {
        const client=this.#clientFactory();
        // Concurrent callers share this Promise; do not keep the transport open after startup.
        try {
          const [version]=await client.accessSecretVersion({name:this.#name},{timeout:10000,retry:null});
          const data=version?.payload?.data;
          if(!Buffer.isBuffer(data)&&!(data instanceof Uint8Array)&&typeof data!=='string')throw new Error('Missing secret payload');
          const value=Buffer.from(data,typeof data==='string'?'base64':undefined).toString('utf8');
          return validateSecret(value);
        } finally {await client.close?.();}
      } catch {throw new Error('oauth_secret_unavailable');} // Discard provider errors/causes containing sensitive values.
    })();
    return this.#pending;
  }
}
function createSecretProvider(env=process.env,{clientFactory}={}){
  const mode=env.SECRET_PROVIDER===undefined?'env':env.SECRET_PROVIDER;
  if(mode==='env'){
    if(env.NODE_ENV==='production'||env.K_SERVICE)throw new Error('Production requires SECRET_PROVIDER=secret-manager');
    return new EnvironmentSecretProvider(env);
  }
  if(mode!=='secret-manager')throw new Error('SECRET_PROVIDER must be env or secret-manager');
  return new GoogleSecretManagerProvider({projectId:env.GOOGLE_OAUTH_SECRET_PROJECT_ID||env.FIREBASE_PROJECT_ID||env.GOOGLE_CLOUD_PROJECT,
    secretName:env.GOOGLE_OAUTH_CLIENT_SECRET_NAME||'ophthalconf-google-oauth-client-secret',clientFactory});
}
module.exports={EnvironmentSecretProvider,GoogleSecretManagerProvider,createSecretProvider};
