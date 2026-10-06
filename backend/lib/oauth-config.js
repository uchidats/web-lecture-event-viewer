'use strict';
const {readOAuthConfig}=require('./google-oauth');
const {createSecretProvider}=require('./secret-provider');
async function loadOAuthConfig(env=process.env,{provider=createSecretProvider(env)}={}){
  // Validate public settings before invoking any remote secret service.
  const config=readOAuthConfig(env,undefined,{requireSecret:false});
  if(!config)return null;
  try {
    const clientSecret=await provider.getGoogleOAuthClientSecret();
    if(typeof clientSecret!=='string'||!clientSecret.trim())throw new Error('Missing secret');
    return {...config,clientSecret};
  } catch {throw new Error('oauth_secret_unavailable');}
}
module.exports={loadOAuthConfig};
